import { Injectable } from "@nestjs/common";
import type { PlayerId, RoomCode } from "@buzzer/shared";

export interface SocketBinding {
  roomCode: RoomCode;
  playerId: PlayerId;
}

/**
 * Tracks socketId <-> { roomCode, playerId } binding for the current connection.
 * On disconnect, the socket entry is removed; the clientToken -> PlayerId
 * binding (which lives inside RoomStore, per-room) persists for the room's
 * lifetime so reconnecting clients can reclaim their identity.
 */
@Injectable()
export class PlayersService {
  private readonly bySocket = new Map<string, SocketBinding>();

  bind(socketId: string, binding: SocketBinding): void {
    this.bySocket.set(socketId, binding);
  }

  get(socketId: string): SocketBinding | null {
    return this.bySocket.get(socketId) ?? null;
  }

  unbind(socketId: string): SocketBinding | null {
    const binding = this.bySocket.get(socketId) ?? null;
    this.bySocket.delete(socketId);
    return binding;
  }
}
