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
} as const;
