import type { PlayerId, RoomCode } from "@buzzer/shared";

export interface PlayerDisconnectedEvent {
  roomCode: RoomCode;
  playerId: PlayerId;
}

export interface PlayerReconnectedEvent {
  roomCode: RoomCode;
  playerId: PlayerId;
}

export interface AdminChangedEvent {
  roomCode: RoomCode;
  adminId: PlayerId;
}

export interface QuestionerChangedEvent {
  roomCode: RoomCode;
  questionerId: PlayerId;
}

export interface RoomDeletedEvent {
  roomCode: RoomCode;
}

export type PresenceEventMap = {
  player_disconnected: (e: PlayerDisconnectedEvent) => void;
  player_reconnected: (e: PlayerReconnectedEvent) => void;
  admin_changed: (e: AdminChangedEvent) => void;
  questioner_changed: (e: QuestionerChangedEvent) => void;
  room_deleted: (e: RoomDeletedEvent) => void;
};
