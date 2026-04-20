import { ErrorCode } from "@buzzer/shared";

export class BuzzerError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = "BuzzerError";
  }
}
