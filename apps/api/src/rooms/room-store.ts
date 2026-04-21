import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  BuzzRecord,
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
  openBuzzer(code: RoomCode): {
    questionId: string;
    openedAt: number;
    excludedPlayerIds: PlayerId[];
    blockedPlayerIds: PlayerId[];
  } | null;
  closeBuzzer(code: RoomCode, _reason: BuzzerCloseReason): void;
  // Toggle a player in the buzzer's manual block list. Returns the new list.
  toggleBlock(code: RoomCode, playerId: PlayerId): PlayerId[] | null;
  // Returns true if the buzz is valid (buzzer open, correct questionId, not excluded).
  // Does not mutate winner state — call finalizeWinner after the collection window.
  acceptBuzz(code: RoomCode, playerId: PlayerId, questionId: string): boolean;
  // Commits winner + buzzes to the store after the collection window closes.
  // Returns false if the question has already changed (window was cancelled).
  finalizeWinner(
    code: RoomCode,
    questionId: string,
    winnerId: PlayerId,
    buzzes: BuzzRecord[],
  ): boolean;

  markCorrect(code: RoomCode, points: number): { winner: PlayerId; scores: Record<PlayerId, number>; questionNumber: number } | null;
  markIncorrect(code: RoomCode): {
    prevWinner: PlayerId;
    questionId: string;
    openedAt: number;
    excludedPlayerIds: PlayerId[];
    blockedPlayerIds: PlayerId[];
  } | null;
  endQuestion(code: RoomCode): number;

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
      score: 0,
      correctCount: 0,
    };
    const room: Room = {
      code,
      adminId: admin.id,
      questionerId: admin.id,
      players: [adminPlayer],
      buzzer: { open: false },
      createdAt: now,
      questionNumber: 1,
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

  openBuzzer(
    code: RoomCode,
  ): {
    questionId: string;
    openedAt: number;
    excludedPlayerIds: PlayerId[];
    blockedPlayerIds: PlayerId[];
  } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const questionId = randomUUID();
    const openedAt = Date.now();
    // Carry forward any blocks the questioner set during setup — those reset
    // only when the previous question ends (closeBuzzer/markCorrect/etc.
    // already wipe buzzer state), not on OPEN itself.
    const blockedPlayerIds = room.buzzer.blockedPlayerIds ?? [];
    room.buzzer = {
      open: true,
      questionId,
      openedAt,
      winner: undefined,
      winnerAt: undefined,
      buzzes: [],
      excludedPlayerIds: [],
      blockedPlayerIds,
    };
    return { questionId, openedAt, excludedPlayerIds: [], blockedPlayerIds };
  }

  toggleBlock(code: RoomCode, playerId: PlayerId): PlayerId[] | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.questionerId === playerId) return null;
    const current = room.buzzer.blockedPlayerIds ?? [];
    const next = current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId];
    room.buzzer = { ...room.buzzer, blockedPlayerIds: next };
    return next;
  }

  closeBuzzer(code: RoomCode, _reason: BuzzerCloseReason): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.buzzer = { open: false };
    room.questionNumber += 1;
  }

  markCorrect(code: RoomCode, points: number): { winner: PlayerId; scores: Record<PlayerId, number>; questionNumber: number } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const b = room.buzzer;
    if (b.open) return null;
    if (!b.winner) return null;
    const winner = b.winner;
    const winnerPlayer = room.players.find((p) => p.id === winner);
    if (winnerPlayer) {
      winnerPlayer.score = (winnerPlayer.score ?? 0) + points;
      winnerPlayer.correctCount = (winnerPlayer.correctCount ?? 0) + 1;
    }
    room.buzzer = { open: false };
    room.questionNumber += 1;
    const scores: Record<PlayerId, number> = Object.fromEntries(
      room.players.map((p) => [p.id, p.score ?? 0]),
    );
    return { winner, scores, questionNumber: room.questionNumber };
  }

  markIncorrect(code: RoomCode): {
    prevWinner: PlayerId;
    questionId: string;
    openedAt: number;
    excludedPlayerIds: PlayerId[];
    blockedPlayerIds: PlayerId[];
  } | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const b = room.buzzer;
    if (b.open) return null;
    if (!b.winner) return null;
    const prevWinner = b.winner;
    const excludedPlayerIds = [
      ...(b.excludedPlayerIds ?? []),
      prevWinner,
    ];
    const blockedPlayerIds = b.blockedPlayerIds ?? [];
    const questionId = randomUUID();
    const openedAt = Date.now();
    room.buzzer = {
      open: true,
      questionId,
      openedAt,
      winner: undefined,
      winnerAt: undefined,
      buzzes: [],
      excludedPlayerIds,
      blockedPlayerIds,
    };
    return { prevWinner, questionId, openedAt, excludedPlayerIds, blockedPlayerIds };
  }

  endQuestion(code: RoomCode): number {
    const room = this.rooms.get(code);
    if (!room) return 0;
    room.buzzer = { open: false };
    room.questionNumber += 1;
    return room.questionNumber;
  }

  acceptBuzz(code: RoomCode, playerId: PlayerId, questionId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const b = room.buzzer;
    if (!b.open) return false;
    if (b.questionId !== questionId) return false;
    if (b.excludedPlayerIds?.includes(playerId)) return false;
    if (b.blockedPlayerIds?.includes(playerId)) return false;
    return true;
  }

  finalizeWinner(
    code: RoomCode,
    questionId: string,
    winnerId: PlayerId,
    buzzes: BuzzRecord[],
  ): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const b = room.buzzer;
    // Guard: question may have changed if questioner acted during the window.
    if (b.questionId !== questionId) return false;
    room.buzzer = {
      open: false,
      questionId: b.questionId,
      openedAt: b.openedAt,
      winner: winnerId,
      winnerAt: Date.now(),
      buzzes,
      excludedPlayerIds: b.excludedPlayerIds,
      blockedPlayerIds: b.blockedPlayerIds,
    };
    return true;
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
