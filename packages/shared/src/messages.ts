import type {
  BuzzRecord,
  Player,
  PlayerId,
  Room,
  RoomCode,
  ClientToken,
} from "./models";
import type { BuzzerCloseReason, ErrorCode } from "./enums";
import { MessageType } from "./enums";

// --- Client -> Server ---

export interface CreateRoomMessage {
  type: MessageType.CreateRoom;
  playerName: string;
  clientToken: ClientToken;
}

export interface JoinRoomMessage {
  type: MessageType.JoinRoom;
  roomCode: RoomCode;
  playerName: string;
  clientToken: ClientToken;
}

export interface LeaveRoomMessage {
  type: MessageType.LeaveRoom;
}

export interface ChangeQuestionerMessage {
  type: MessageType.ChangeQuestioner;
  newQuestionerId: PlayerId;
}

export interface BuzzerOpenMessage {
  type: MessageType.BuzzerOpen;
}

export interface BuzzerCloseMessage {
  type: MessageType.BuzzerClose;
}

export interface BuzzMessage {
  type: MessageType.Buzz;
  questionId: string;
  buzzedAt: number;
}

export interface MarkCorrectMessage {
  type: MessageType.MarkCorrect;
  points?: number;
}

export interface MarkIncorrectMessage {
  type: MessageType.MarkIncorrect;
}

export interface EndQuestionMessage {
  type: MessageType.EndQuestion;
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | ChangeQuestionerMessage
  | BuzzerOpenMessage
  | BuzzerCloseMessage
  | BuzzMessage
  | MarkCorrectMessage
  | MarkIncorrectMessage
  | EndQuestionMessage;

// --- Server -> Client ---

export interface RoomStateMessage {
  type: MessageType.RoomState;
  room: Room;
  you: PlayerId;
}

export interface PlayerJoinedMessage {
  type: MessageType.PlayerJoined;
  player: Player;
}

export interface PlayerLeftMessage {
  type: MessageType.PlayerLeft;
  playerId: PlayerId;
}

export interface PlayerDisconnectedMessage {
  type: MessageType.PlayerDisconnected;
  playerId: PlayerId;
}

export interface PlayerReconnectedMessage {
  type: MessageType.PlayerReconnected;
  playerId: PlayerId;
}

export interface AdminChangedMessage {
  type: MessageType.AdminChanged;
  adminId: PlayerId;
}

export interface QuestionerChangedMessage {
  type: MessageType.QuestionerChanged;
  questionerId: PlayerId;
}

export interface BuzzerOpenedMessage {
  type: MessageType.BuzzerOpened;
  questionId: string;
  openedAt: number;
  // Absolute server timestamp when clients should enable their buzz button.
  openAt: number;
  excludedPlayerIds?: PlayerId[];
}

export interface BuzzerClosedMessage {
  type: MessageType.BuzzerClosed;
  reason: BuzzerCloseReason;
  winner?: PlayerId;
  scores?: Record<PlayerId, number>;
  // Next questionNumber, sent on every close that ends the question session.
  // Omitted for Incorrect (same question continues).
  questionNumber?: number;
}

export interface BuzzesReportedMessage {
  type: MessageType.BuzzesReported;
  buzzes: BuzzRecord[];
}

export interface ErrorMessage {
  type: MessageType.Error;
  code: ErrorCode;
  message: string;
}

export type ServerMessage =
  | RoomStateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerDisconnectedMessage
  | PlayerReconnectedMessage
  | AdminChangedMessage
  | QuestionerChangedMessage
  | BuzzerOpenedMessage
  | BuzzerClosedMessage
  | BuzzesReportedMessage
  | ErrorMessage;
