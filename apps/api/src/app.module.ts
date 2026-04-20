import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { RoomsModule } from "./rooms/rooms.module";
import { PlayersModule } from "./players/players.module";
import { PresenceModule } from "./presence/presence.module";
import { BuzzerModule } from "./buzzer/buzzer.module";

@Module({
  imports: [RoomsModule, PlayersModule, PresenceModule, BuzzerModule],
  controllers: [AppController],
})
export class AppModule {}
