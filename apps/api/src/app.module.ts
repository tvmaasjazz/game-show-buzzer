import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { RoomsModule } from "./rooms/rooms.module";
import { PlayersModule } from "./players/players.module";

@Module({
  imports: [RoomsModule, PlayersModule],
  controllers: [AppController],
})
export class AppModule {}
