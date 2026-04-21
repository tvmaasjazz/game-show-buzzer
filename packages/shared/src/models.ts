export type PlayerId = string;
export type RoomCode = string;
export type ClientToken = string;

export interface Player {
  id: PlayerId;
  name: string;
  connected: boolean;
  joinedAt: number;
  score?: number;
  correctCount?: number;
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
export interface BuzzRecord {
  playerId: PlayerId;
  // 0 for the winner; positive milliseconds for late arrivals.
  deltaMs: number;
}

export interface BuzzerState {
  open: boolean;
  questionId?: string;
  openedAt?: number;
  // When clients should enable the buzz button (server clock, ms).
  openAt?: number;
  winner?: PlayerId;
  // Server timestamp when the winning buzz was received. Internal; clients
  // don't need to read this, but it's included for reconnect state.
  winnerAt?: number;
  // All buzzes accepted for this question, sorted ascending by deltaMs.
  // Populated progressively; clients see the full set via BuzzesReported.
  buzzes?: BuzzRecord[];
  // Players the questioner has judged Incorrect this session. They can't buzz
  // on subsequent re-opens until the session ends (Correct/Ended/fresh Open).
  excludedPlayerIds?: PlayerId[];
  // Players the questioner has manually blocked this question. Resets when a
  // new question starts. Toggleable by the questioner at any time.
  blockedPlayerIds?: PlayerId[];
}

export interface Room {
  code: RoomCode;
  adminId: PlayerId;
  questionerId: PlayerId;
  players: Player[];
  buzzer: BuzzerState;
  createdAt: number;
  questionNumber: number;
}
