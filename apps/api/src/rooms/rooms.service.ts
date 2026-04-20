import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  ClientToken,
  Player,
  PlayerId,
  Room,
  RoomCode,
} from "@buzzer/shared";
import { ErrorCode, isAdmin, isInRoom } from "@buzzer/shared";
import { InMemoryRoomStore, RoomCodeExhaustedError } from "./room-store";
import { BuzzerError } from "./buzzer-error";

export interface JoinResult {
  room: Room;
  player: Player;
  isReconnect: boolean;
}

@Injectable()
export class RoomsService {
  constructor(
    @Inject(InMemoryRoomStore) private readonly store: InMemoryRoomStore,
  ) {}

  createRoom(clientToken: ClientToken, playerName: string): JoinResult {
    const name = this.validateName(playerName);
    let room: Room;
    try {
      const playerId = randomUUID();
      room = this.store.createRoom({ id: playerId, name });
      this.store.setBinding(room.code, clientToken, playerId);
    } catch (err) {
      if (err instanceof RoomCodeExhaustedError) {
        throw new BuzzerError(ErrorCode.RoomCreateFailed, err.message);
      }
      throw err;
    }
    return { room, player: room.players[0]!, isReconnect: false };
  }

  joinRoom(
    roomCode: RoomCode,
    clientToken: ClientToken,
    playerName: string,
  ): JoinResult {
    const name = this.validateName(playerName);
    const room = this.store.getRoom(roomCode);
    if (!room) throw new BuzzerError(ErrorCode.RoomNotFound, `room ${roomCode} not found`);

    const boundPlayerId = this.store.getBinding(roomCode, clientToken);
    if (boundPlayerId) {
      const existing = room.players.find((p) => p.id === boundPlayerId);
      if (existing) {
        // Gateway calls PresenceService.onPlayerReconnect which flips `connected`
        // and clears timers. Keep this method side-effect-free on reconnect.
        return { room, player: existing, isReconnect: true };
      }
      // Binding exists but player was removed (explicit Leave) — treat as new join.
    }

    const playerId = randomUUID();
    const finalName = this.dedupeName(room, name);
    const player: Player = {
      id: playerId,
      name: finalName,
      connected: true,
      joinedAt: Date.now(),
    };
    this.store.addPlayer(roomCode, player);
    this.store.setBinding(roomCode, clientToken, playerId);
    return { room, player, isReconnect: false };
  }

  leaveRoom(roomCode: RoomCode, playerId: PlayerId): { roomNowEmpty: boolean } {
    const room = this.store.getRoom(roomCode);
    if (!room) return { roomNowEmpty: false };
    this.store.removePlayer(roomCode, playerId);
    const updated = this.store.getRoom(roomCode);
    if (!updated) return { roomNowEmpty: true };
    const roomNowEmpty = updated.players.length === 0;
    if (roomNowEmpty) {
      this.store.deleteRoom(roomCode);
    }
    return { roomNowEmpty };
  }

  changeQuestioner(
    roomCode: RoomCode,
    callerPlayerId: PlayerId,
    newQuestionerId: PlayerId,
  ): Room {
    const room = this.store.getRoom(roomCode);
    if (!room) throw new BuzzerError(ErrorCode.RoomNotFound, `room ${roomCode} not found`);
    if (!isAdmin(room, callerPlayerId)) {
      throw new BuzzerError(ErrorCode.NotAuthorized, "only admin can change questioner");
    }
    if (!isInRoom(room, newQuestionerId)) {
      throw new BuzzerError(ErrorCode.InvalidTarget, "target not in room");
    }
    this.store.setQuestioner(roomCode, newQuestionerId);
    return this.store.getRoom(roomCode)!;
  }

  private validateName(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) throw new BuzzerError(ErrorCode.NameRequired, "name required");
    return trimmed.slice(0, 32);
  }

  private dedupeName(room: Room, candidate: string): string {
    const taken = new Set(room.players.map((p) => p.name));
    if (!taken.has(candidate)) return candidate;
    for (let n = 2; n <= 99; n++) {
      const attempt = `${candidate} (${n})`;
      if (!taken.has(attempt)) return attempt;
    }
    return `${candidate} (${Date.now() % 10000})`;
  }
}
