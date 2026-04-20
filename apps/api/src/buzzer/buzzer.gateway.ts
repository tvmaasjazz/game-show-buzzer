import { Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import {
  BuzzerCloseReason,
  ErrorCode,
  MessageType,
  canBuzz,
  canOpenBuzzer,
  isQuestioner,
} from "@buzzer/shared";
import type {
  ClientMessage,
  ServerMessage,
  RoomCode,
} from "@buzzer/shared";
import { AppConfig } from "../config";
import { InMemoryRoomStore } from "../rooms/room-store";
import { RoomsService } from "../rooms/rooms.service";
import { PlayersService } from "../players/players.service";
import { PresenceService } from "../presence/presence.service";
import { BuzzerError } from "../rooms/buzzer-error";

const WS_EVENT = "message" as const;

@WebSocketGateway({
  cors: AppConfig.corsOrigin ? { origin: AppConfig.corsOrigin } : false,
})
export class BuzzerGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(BuzzerGateway.name);

  constructor(
    @Inject(InMemoryRoomStore) private readonly store: InMemoryRoomStore,
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

  afterInit(): void {
    // Bridge presence events to socket.io broadcasts.
    this.presence.events.on("player_disconnected", ({ roomCode, playerId }) => {
      this.broadcast(roomCode, { type: MessageType.PlayerDisconnected, playerId });
    });
    this.presence.events.on("player_reconnected", ({ roomCode, playerId }) => {
      this.broadcast(roomCode, { type: MessageType.PlayerReconnected, playerId });
    });
    this.presence.events.on("admin_changed", ({ roomCode, adminId }) => {
      this.broadcast(roomCode, { type: MessageType.AdminChanged, adminId });
    });
    this.presence.events.on("questioner_changed", ({ roomCode, questionerId }) => {
      this.broadcast(roomCode, { type: MessageType.QuestionerChanged, questionerId });
    });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const binding = this.players.unbind(client.id);
    if (!binding) return;
    this.presence.onPlayerDisconnect(binding.roomCode, binding.playerId);
  }

  @SubscribeMessage(WS_EVENT)
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() msg: ClientMessage,
  ): void {
    try {
      switch (msg.type) {
        case MessageType.CreateRoom:
          this.handleCreate(client, msg);
          return;
        case MessageType.JoinRoom:
          this.handleJoin(client, msg);
          return;
        case MessageType.LeaveRoom:
          this.handleLeave(client);
          return;
        case MessageType.ChangeQuestioner:
          this.handleChangeQuestioner(client, msg.newQuestionerId);
          return;
        case MessageType.BuzzerOpen:
          this.handleBuzzerOpen(client);
          return;
        case MessageType.BuzzerClose:
          this.handleBuzzerClose(client);
          return;
        case MessageType.Buzz:
          this.handleBuzz(client, msg.questionId);
          return;
      }
    } catch (err) {
      if (err instanceof BuzzerError) {
        this.sendError(client, err);
      } else {
        this.logger.error("unexpected error in handleMessage", err);
        throw err;
      }
    }
  }

  private handleCreate(client: Socket, msg: { playerName: string; clientToken: string }): void {
    const { room, player } = this.rooms.createRoom(msg.clientToken, msg.playerName);
    this.players.bind(client.id, { roomCode: room.code, playerId: player.id });
    void client.join(room.code);
    this.sendTo(client, { type: MessageType.RoomState, room, you: player.id });
  }

  private handleJoin(
    client: Socket,
    msg: { roomCode: string; playerName: string; clientToken: string },
  ): void {
    const result = this.rooms.joinRoom(msg.roomCode, msg.clientToken, msg.playerName);
    this.players.bind(client.id, { roomCode: result.room.code, playerId: result.player.id });
    void client.join(result.room.code);

    const freshRoom = this.store.getRoom(result.room.code);
    if (!freshRoom) {
      throw new BuzzerError(ErrorCode.RoomNotFound, "room vanished mid-join");
    }
    this.sendTo(client, { type: MessageType.RoomState, room: freshRoom, you: result.player.id });

    if (result.isReconnect) {
      // PresenceService will emit player_reconnected, which our afterInit
      // bridge translates into a broadcast.
      this.presence.onPlayerReconnect(result.room.code, result.player.id);
    } else {
      this.broadcastExcept(client, result.room.code, {
        type: MessageType.PlayerJoined,
        player: result.player,
      });
    }
  }

  private handleLeave(client: Socket): void {
    const binding = this.players.get(client.id);
    if (!binding) return;
    const { roomCode, playerId } = binding;
    this.presence.onPlayerRemoved(roomCode, playerId);
    this.rooms.leaveRoom(roomCode, playerId);
    this.players.unbind(client.id);
    void client.leave(roomCode);
    this.broadcast(roomCode, { type: MessageType.PlayerLeft, playerId });
  }

  private handleChangeQuestioner(client: Socket, newQuestionerId: string): void {
    const binding = this.requireBinding(client);
    const room = this.store.getRoom(binding.roomCode);
    if (!room) throw new BuzzerError(ErrorCode.RoomNotFound, "room gone");

    // Force-close an open buzzer before the role changes.
    if (room.buzzer.open) {
      this.store.closeBuzzer(binding.roomCode, BuzzerCloseReason.QuestionerChanged);
      this.broadcast(binding.roomCode, {
        type: MessageType.BuzzerClosed,
        reason: BuzzerCloseReason.QuestionerChanged,
      });
    }

    this.rooms.changeQuestioner(binding.roomCode, binding.playerId, newQuestionerId);
    this.broadcast(binding.roomCode, {
      type: MessageType.QuestionerChanged,
      questionerId: newQuestionerId,
    });
  }

  private handleBuzzerOpen(client: Socket): void {
    const binding = this.requireBinding(client);
    const room = this.store.getRoom(binding.roomCode);
    if (!room) throw new BuzzerError(ErrorCode.RoomNotFound, "room gone");
    if (!canOpenBuzzer(room, binding.playerId)) {
      throw new BuzzerError(ErrorCode.NotAuthorized, "only questioner can open the buzzer");
    }
    const opened = this.store.openBuzzer(binding.roomCode);
    if (!opened) throw new BuzzerError(ErrorCode.RoomNotFound, "room gone");
    this.broadcast(binding.roomCode, {
      type: MessageType.BuzzerOpened,
      questionId: opened.questionId,
      openedAt: opened.openedAt,
    });
  }

  private handleBuzzerClose(client: Socket): void {
    const binding = this.requireBinding(client);
    const room = this.store.getRoom(binding.roomCode);
    if (!room) throw new BuzzerError(ErrorCode.RoomNotFound, "room gone");
    if (!isQuestioner(room, binding.playerId)) {
      throw new BuzzerError(ErrorCode.NotAuthorized, "only questioner can close the buzzer");
    }
    if (!room.buzzer.open) {
      throw new BuzzerError(ErrorCode.BuzzerNotOpen, "buzzer already closed");
    }
    this.store.closeBuzzer(binding.roomCode, BuzzerCloseReason.Manual);
    this.broadcast(binding.roomCode, {
      type: MessageType.BuzzerClosed,
      reason: BuzzerCloseReason.Manual,
    });
  }

  private handleBuzz(client: Socket, questionId: string): void {
    const binding = this.requireBinding(client);
    const room = this.store.getRoom(binding.roomCode);
    if (!room) return; // silent — room is gone, no point responding
    if (!canBuzz(room, binding.playerId)) {
      throw new BuzzerError(ErrorCode.NotAuthorized, "questioner cannot buzz");
    }
    const result = this.store.tryRegisterBuzz(binding.roomCode, binding.playerId, questionId);
    if (!result) return; // race loser — silent drop
    this.broadcast(binding.roomCode, {
      type: MessageType.BuzzerClosed,
      reason: BuzzerCloseReason.Winner,
      winner: result.winner,
    });
  }

  // --- helpers ---

  private requireBinding(client: Socket) {
    const b = this.players.get(client.id);
    if (!b) throw new BuzzerError(ErrorCode.NotAuthorized, "no binding for socket");
    return b;
  }

  private broadcast(roomCode: RoomCode, message: ServerMessage): void {
    this.server.to(roomCode).emit(WS_EVENT, message);
  }

  private broadcastExcept(client: Socket, roomCode: RoomCode, message: ServerMessage): void {
    client.to(roomCode).emit(WS_EVENT, message);
  }

  private sendTo(client: Socket, message: ServerMessage): void {
    client.emit(WS_EVENT, message);
  }

  private sendError(client: Socket, err: BuzzerError): void {
    this.sendTo(client, {
      type: MessageType.Error,
      code: err.code,
      message: err.message,
    });
  }
}
