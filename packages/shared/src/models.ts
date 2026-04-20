export type PlayerId = string;
export type RoomCode = string;
export type ClientToken = string;

export interface Player {
  id: PlayerId;
  name: string;
  connected: boolean;
  joinedAt: number;
}

// BuzzerState state machine:
//
//     buzzer_open (from Idle OR from any Closed_* state - winner cleared)
//   +---------->  OPEN (questionId, openedAt, winner: undefined)
//   |              |
//   |              +-- first valid buzz ----> CLOSED_WINNER  (winner set)
//   |              +-- questioner CLOSE ----> CLOSED_MANUAL
//   |              +-- questioner drops ----> CLOSED_QUESTIONER_LEFT
//   |              +-- admin reassigns Q ---> CLOSED_QUESTIONER_CHANGED
//   |
//   +-- any CLOSED_* stays here until next buzzer_open; `winner` persists
//       so reconnecting clients can show the last-winner overlay.
export interface BuzzerState {
  open: boolean;
  questionId?: string;
  openedAt?: number;
  winner?: PlayerId;
}

export interface Room {
  code: RoomCode;
  adminId: PlayerId;
  questionerId: PlayerId;
  players: Player[];
  buzzer: BuzzerState;
  createdAt: number;
}
