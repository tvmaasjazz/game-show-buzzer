export enum ErrorCode {
  RoomNotFound = "room_not_found",
  RoomCreateFailed = "room_create_failed",
  NameRequired = "name_required",
  NotAuthorized = "not_authorized",
  InvalidTarget = "invalid_target",
  BuzzerNotOpen = "buzzer_not_open",
  StaleQuestion = "stale_question",
}

export enum BuzzerCloseReason {
  Manual = "manual",
  Winner = "winner",
  QuestionerLeft = "questioner_left",
  QuestionerChanged = "questioner_changed",
}

export enum MessageType {
  CreateRoom = "create_room",
  JoinRoom = "join_room",
  LeaveRoom = "leave_room",
  ChangeQuestioner = "change_questioner",
  BuzzerOpen = "buzzer_open",
  BuzzerClose = "buzzer_close",
  Buzz = "buzz",
  RoomState = "room_state",
  PlayerJoined = "player_joined",
  PlayerLeft = "player_left",
  PlayerDisconnected = "player_disconnected",
  PlayerReconnected = "player_reconnected",
  AdminChanged = "admin_changed",
  QuestionerChanged = "questioner_changed",
  BuzzerOpened = "buzzer_opened",
  BuzzerClosed = "buzzer_closed",
  Error = "error",
}
