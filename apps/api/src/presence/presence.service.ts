import { EventEmitter } from "node:events";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PlayerId, Room, RoomCode } from "@buzzer/shared";
import { InMemoryRoomStore } from "../rooms/room-store";
import { AppConfig } from "../config";

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly roleTimers = new Map<PlayerId, NodeJS.Timeout>();
  private readonly roomDeathTimers = new Map<RoomCode, NodeJS.Timeout>();
  readonly events = new EventEmitter();

  constructor(
    @Inject(InMemoryRoomStore) private readonly store: InMemoryRoomStore,
  ) {}

  /**
   * Called by the gateway when a socket drops for a player currently in a room.
   * Marks them disconnected, starts role-idle + room-death timers as appropriate.
   */
  onPlayerDisconnect(roomCode: RoomCode, playerId: PlayerId): void {
    this.store.updatePlayerConnected(roomCode, playerId, false);
    this.events.emit("player_disconnected", { roomCode, playerId });

    const room = this.store.getRoom(roomCode);
    if (!room) return;

    const holdsRole = room.adminId === playerId || room.questionerId === playerId;
    if (holdsRole) {
      this.scheduleRoleIdle(roomCode, playerId);
    }

    if (this.everyoneDisconnected(room)) {
      this.scheduleRoomDeath(roomCode);
    }
  }

  /**
   * Called by the gateway when a known clientToken re-binds to a fresh socket.
   * Clears any role-idle timer for this player and any room-death timer for
   * the room.
   */
  onPlayerReconnect(roomCode: RoomCode, playerId: PlayerId): void {
    this.store.updatePlayerConnected(roomCode, playerId, true);
    this.clearRoleTimer(playerId);
    this.clearRoomDeathTimer(roomCode);
    this.events.emit("player_reconnected", { roomCode, playerId });
  }

  /**
   * Called when a player is permanently removed (explicit Leave).
   * Clears any timers held by that player.
   */
  onPlayerRemoved(_roomCode: RoomCode, playerId: PlayerId): void {
    this.clearRoleTimer(playerId);
  }

  shutdown(): void {
    for (const t of this.roleTimers.values()) clearTimeout(t);
    for (const t of this.roomDeathTimers.values()) clearTimeout(t);
    this.roleTimers.clear();
    this.roomDeathTimers.clear();
  }

  // --- internals ---

  private scheduleRoleIdle(roomCode: RoomCode, playerId: PlayerId): void {
    this.clearRoleTimer(playerId);
    const timer = setTimeout(
      () => this.onRoleIdleExpiry(roomCode, playerId),
      AppConfig.roleIdleMs,
    );
    this.roleTimers.set(playerId, timer);
  }

  private scheduleRoomDeath(roomCode: RoomCode): void {
    this.clearRoomDeathTimer(roomCode);
    const timer = setTimeout(
      () => this.onRoomDeath(roomCode),
      AppConfig.roomDeathMs,
    );
    this.roomDeathTimers.set(roomCode, timer);
  }

  private onRoleIdleExpiry(roomCode: RoomCode, playerId: PlayerId): void {
    this.roleTimers.delete(playerId);
    const room = this.store.getRoom(roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player?.connected) return; // they came back between scheduling and firing

    // Admin promotion first — it may cascade the questioner role.
    if (room.adminId === playerId) {
      const next = this.oldestOther(room, playerId);
      if (next) {
        this.store.setAdmin(roomCode, next.id);
        this.events.emit("admin_changed", { roomCode, adminId: next.id });
        // Cascade: if this player was also the questioner, new admin takes questioner by default.
        if (room.questionerId === playerId) {
          this.store.setQuestioner(roomCode, next.id);
          this.events.emit("questioner_changed", {
            roomCode,
            questionerId: next.id,
          });
        }
      } else {
        this.logger.warn(`no eligible player to promote admin in room ${roomCode}`);
      }
    } else if (room.questionerId === playerId) {
      // Questioner alone — admin inherits the role.
      this.store.setQuestioner(roomCode, room.adminId);
      this.events.emit("questioner_changed", {
        roomCode,
        questionerId: room.adminId,
      });
    }
  }

  private onRoomDeath(roomCode: RoomCode): void {
    this.roomDeathTimers.delete(roomCode);
    const room = this.store.getRoom(roomCode);
    if (!room) return;
    if (!this.everyoneDisconnected(room)) return; // someone came back
    // Clear any lingering role timers for this room's players.
    for (const p of room.players) this.clearRoleTimer(p.id);
    this.store.deleteRoom(roomCode);
    this.events.emit("room_deleted", { roomCode });
  }

  private clearRoleTimer(playerId: PlayerId): void {
    const t = this.roleTimers.get(playerId);
    if (t) {
      clearTimeout(t);
      this.roleTimers.delete(playerId);
    }
  }

  private clearRoomDeathTimer(roomCode: RoomCode): void {
    const t = this.roomDeathTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.roomDeathTimers.delete(roomCode);
    }
  }

  private everyoneDisconnected(room: Room): boolean {
    return room.players.length > 0 && room.players.every((p) => !p.connected);
  }

  private oldestOther(
    room: Room,
    excludeId: PlayerId,
  ): Room["players"][number] | null {
    const candidates = room.players
      .filter((p) => p.id !== excludeId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    return candidates[0] ?? null;
  }
}
