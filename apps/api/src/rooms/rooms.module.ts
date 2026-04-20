import { Module } from "@nestjs/common";
import { InMemoryRoomStore } from "./room-store";
import { RoomsService } from "./rooms.service";

@Module({
  providers: [InMemoryRoomStore, RoomsService],
  exports: [InMemoryRoomStore, RoomsService],
})
export class RoomsModule {}
