import type { PlayerId, Room } from "./models";

export const isInRoom = (room: Room, playerId: PlayerId): boolean =>
  room.players.some((p) => p.id === playerId);

export const isAdmin = (room: Room, playerId: PlayerId): boolean =>
  room.adminId === playerId;

export const isQuestioner = (room: Room, playerId: PlayerId): boolean =>
  room.questionerId === playerId;

export const canBuzz = (room: Room, playerId: PlayerId): boolean =>
  isInRoom(room, playerId) && !isQuestioner(room, playerId);

export const canOpenBuzzer = (room: Room, playerId: PlayerId): boolean =>
  isQuestioner(room, playerId);

export const canCloseBuzzer = canOpenBuzzer;

export const canChangeQuestioner = (room: Room, playerId: PlayerId): boolean =>
  isAdmin(room, playerId);
