import { Module } from "@nestjs/common";
import { RoomsModule } from "../rooms/rooms.module";
import { PlayersModule } from "../players/players.module";
import { PresenceModule } from "../presence/presence.module";
import { BuzzerGateway } from "./buzzer.gateway";

@Module({
  imports: [RoomsModule, PlayersModule, PresenceModule],
  providers: [BuzzerGateway],
})
export class BuzzerModule {}
