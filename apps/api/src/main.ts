import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { MessageType } from "@buzzer/shared";
import { AppModule } from "./app.module";
import { AppConfig } from "./config";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    cors: AppConfig.corsOrigin ? { origin: AppConfig.corsOrigin } : false,
  });
  await app.listen(AppConfig.port);
  logger.log(
    `api listening on :${AppConfig.port} (cors: ${AppConfig.corsOrigin || "same-origin only"})`
  );
  // Tiny sanity check that shared types are resolved.
  logger.log(`shared contract loaded (e.g. MessageType.Buzz = "${MessageType.Buzz}")`);
}

bootstrap().catch((err) => {
  console.error("bootstrap failed:", err);
  process.exit(1);
});
