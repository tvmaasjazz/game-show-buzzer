import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  ClientToken,
  Player,
  PlayerId,
  Room,
  RoomCode,
} from "@buzzer/shared";
import { BuzzerCloseReason } from "@buzzer/shared";
import { AppConfig } from "../config";

export interface RoomStore {
  createRoom(admin: Pick<Player, "id" | "name">): Room;
  getRoom(code: RoomCode): Room | null;
  deleteRoom(code: RoomCode): void;
  listRooms(): Room[];

  addPlayer(code: RoomCode, player: Player): void;
  removePlayer(code: RoomCode, playerId: PlayerId): void;
  updatePlayerConnected(code: RoomCode, playerId: PlayerId, connected: boolean): void;

  // Per-room clientToken binding (persists for the room's lifetime).
  getBinding(code: RoomCode, clientToken: ClientToken): PlayerId | null;
  setBinding(code: RoomCode, clientToken: ClientToken, playerId: PlayerId): void;

  // Buzzer atomic ops.
  openBuzzer(code: RoomCode): { questionId: string; openedAt: number } | null;
  closeBuzzer(code: RoomCode, _reason: BuzzerCloseReason): void;
  tryRegisterBuzz(
    code: RoomCode,
    playerId: PlayerId,
    questionId: string,
  ): { winner: PlayerId } | null;

  // Role mutations.
  setAdmin(code: RoomCode, playerId: PlayerId): void;
  setQuestioner(code: RoomCode, playerId: PlayerId): void;
}

class RoomCodeExhaustedError extends Error {
  constructor() {
    super("Could not generate a unique room code after max retries");
    this.name = "RoomCodeExhaustedError";
  }
}

@Injectable()
export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<RoomCode, Room>();
  // Per-room map of clientToken -> PlayerId. Persists for room lifetime.
  private readonly bindings = new Map<RoomCode, Map<ClientToken, PlayerId>>();

  createRoom(admin: Pick<Player, "id" | "name">): Room {
    const code = this.generateUniqueCode();
    const now = Date.now();
    const adminPlayer: Player = {
      id: admin.id,
      name: admin.name,
      connected: true,
      joinedAt: now,
    };
    const room: Room = {
      code,
      adminId: admin.id,
      questionerId: admin.id,
      players: [adminPlayer],
      buzzer: { open: false },
      createdAt: now,
    };
    this.rooms.set(code, room);
    this.bindings.set(code, new Map());
    return room;
  }

  getRoom(code: RoomCode): Room | null {
    return this.rooms.get(code) ?? null;
  }

  deleteRoom(code: RoomCode): void {
    this.rooms.delete(code);
    this.bindings.delete(code);
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  addPlayer(code: RoomCode, player: Player): void {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.players.some((p) => p.id === player.id)) return;
    room.players.push(player);
  }

  removePlayer(code: RoomCode, playerId: PlayerId): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
  }

  updatePlayerConnected(code: RoomCode, playerId: PlayerId, connected: boolean): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connected = connected;
  }

  getBinding(code: RoomCode, clientToken: ClientToken): PlayerId | null {
    return this.bindings.get(code)?.get(clientToken) ?? null;
  }

  setBinding(code: RoomCode, clientToken: ClientToken, playerId: PlayerId): void {
    let roomBindings = this.bindings.get(code);
    if (!roomBindings) {
      roomBindings = new Map();
      this.bindings.set(code, roomBindings);
    }
    roomBindings.set(clientToken, playerId);
  }

  openBuzzer(code: RoomCode): { questionId: string; openedAt: number } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const questionId = randomUUID();
    const openedAt = Date.now();
    room.buzzer = { open: true, questionId, openedAt, winner: undefined };
    return { questionId, openedAt };
  }

  closeBuzzer(code: RoomCode, _reason: BuzzerCloseReason): void {
    const room = this.rooms.get(code);
    if (!room) return;
    // Preserve `winner` if set (Winner reason); clear questionId/openedAt.
    const existingWinner = room.buzzer.winner;
    room.buzzer = {
      open: false,
      winner: existingWinner,
    };
  }

  // Atomic under Node's single-threaded event loop: this entire method runs
  // start-to-finish without any other async interleaving. See design doc
  // "Buzz Race-Condition Handling" + EUREKA log.
  tryRegisterBuzz(
    code: RoomCode,
    playerId: PlayerId,
    questionId: string,
  ): { winner: PlayerId } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const b = room.buzzer;
    if (!b.open) return null;
    if (b.questionId !== questionId) return null;
    if (b.winner !== undefined) return null;
    room.buzzer = {
      open: false,
      questionId: b.questionId,
      openedAt: b.openedAt,
      winner: playerId,
    };
    return { winner: playerId };
  }

  setAdmin(code: RoomCode, playerId: PlayerId): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.adminId = playerId;
  }

  setQuestioner(code: RoomCode, playerId: PlayerId): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.questionerId = playerId;
  }

  private generateUniqueCode(): RoomCode {
    for (let attempt = 0; attempt < AppConfig.roomCodeMaxRetries; attempt++) {
      const code = this.randomCode();
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomCodeExhaustedError();
  }

  private randomCode(): RoomCode {
    const { roomCodeLength, roomCodeCharset } = AppConfig;
    let out = "";
    for (let i = 0; i < roomCodeLength; i++) {
      out += roomCodeCharset[Math.floor(Math.random() * roomCodeCharset.length)];
    }
    return out;
  }
}

export { RoomCodeExhaustedError };
