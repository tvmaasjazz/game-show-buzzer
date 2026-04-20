const ONE_MINUTE_MS = 60 * 1000;

export const AppConfig = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? false,
  roleIdleMs: 2 * ONE_MINUTE_MS,
  roomDeathMs: 5 * ONE_MINUTE_MS,
  roomGcSweepMs: 5 * ONE_MINUTE_MS,
  roomCodeLength: 4,
  roomCodeCharset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  roomCodeMaxRetries: 5,
  // How long after the first buzz the server waits before declaring a winner.
  // Override with BUZZ_WINDOW_MS env var.
  buzzWindowMs: parseInt(process.env.BUZZ_WINDOW_MS ?? "300", 10),
  // How far in the future (ms) the server schedules the buzzer open so all
  // clients enable their buttons simultaneously. Override with OPEN_DELAY_MS.
  openDelayMs: parseInt(process.env.OPEN_DELAY_MS ?? "200", 10),
} as const;
