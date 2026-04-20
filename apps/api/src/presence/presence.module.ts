import { Module } from "@nestjs/common";
import { RoomsModule } from "../rooms/rooms.module";
import { PresenceService } from "./presence.service";

@Module({
  imports: [RoomsModule],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
