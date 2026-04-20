import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { io, Socket } from "socket.io-client";
import {
  BuzzerCloseReason,
  MessageType,
  type ClientMessage,
  type ServerMessage,
} from "@buzzer/shared";
import { AppModule } from "../src/app.module";

const PORT = 4001;

function newClient(): Socket {
  return io(`http://localhost:${PORT}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
}

function waitFor(
  socket: Socket,
  predicate: (m: ServerMessage) => boolean,
  timeoutMs = 2000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for predicate (${timeoutMs}ms)`)),
      timeoutMs,
    );
    const onMsg = (m: ServerMessage) => {
      if (predicate(m)) {
        clearTimeout(timer);
        socket.off("message", onMsg);
        resolve(m);
      }
    };
    socket.on("message", onMsg);
  });
}

async function collectUntil(
  socket: Socket,
  count: number,
  timeoutMs = 2000,
): Promise<ServerMessage[]> {
  const out: ServerMessage[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("collectUntil timeout")), timeoutMs);
    const onMsg = (m: ServerMessage) => {
      out.push(m);
      if (out.length >= count) {
        clearTimeout(timer);
        socket.off("message", onMsg);
        resolve(out);
      }
    };
    socket.on("message", onMsg);
  });
}

function send(socket: Socket, msg: ClientMessage) {
  socket.emit("message", msg);
}

describe("buzzer e2e (full flow)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.listen(PORT);
  }, 15_000);

  afterAll(async () => {
    await app?.close();
  });

  it("host creates room, guest joins, first buzz wins", async () => {
    const host = newClient();
    const guest = newClient();

    try {
      await new Promise<void>((r) => host.on("connect", () => r()));
      await new Promise<void>((r) => guest.on("connect", () => r()));

      // Host creates.
      send(host, {
        type: MessageType.CreateRoom,
        playerName: "Host",
        clientToken: "token-host",
      });
      const hostState = await waitFor(
        host,
        (m): m is ServerMessage =>
          m.type === MessageType.RoomState && m.room.players.length === 1,
      );
      if (hostState.type !== MessageType.RoomState) throw new Error("bad");
      const roomCode = hostState.room.code;
      const hostId = hostState.you;

      // Guest joins — host should see player_joined, guest sees room_state.
      send(guest, {
        type: MessageType.JoinRoom,
        roomCode,
        playerName: "Guest",
        clientToken: "token-guest",
      });
      const guestState = await waitFor(
        guest,
        (m): m is ServerMessage => m.type === MessageType.RoomState,
      );
      if (guestState.type !== MessageType.RoomState) throw new Error("bad");
      const guestId = guestState.you;

      const hostSawJoin = await waitFor(
        host,
        (m) => m.type === MessageType.PlayerJoined,
      );
      if (hostSawJoin.type !== MessageType.PlayerJoined) throw new Error("bad");
      expect(hostSawJoin.player.id).toBe(guestId);

      // Host (questioner by default) opens buzzer.
      send(host, { type: MessageType.BuzzerOpen });
      const opened = await waitFor(
        guest,
        (m) => m.type === MessageType.BuzzerOpened,
      );
      if (opened.type !== MessageType.BuzzerOpened) throw new Error("bad");
      const questionId = opened.questionId;

      // Guest buzzes. Host should see buzzer_closed with reason=winner.
      send(guest, { type: MessageType.Buzz, questionId });
      const closed = await waitFor(
        host,
        (m) => m.type === MessageType.BuzzerClosed,
      );
      if (closed.type !== MessageType.BuzzerClosed) throw new Error("bad");
      expect(closed.reason).toBe(BuzzerCloseReason.Winner);
      expect(closed.winner).toBe(guestId);

      // Host (questioner) trying to buzz should get NotAuthorized error.
      send(host, { type: MessageType.Buzz, questionId: "anything" });
      const err = await waitFor(host, (m) => m.type === MessageType.Error);
      if (err.type !== MessageType.Error) throw new Error("bad");
      expect(err.code).toBe("not_authorized");

      expect(hostId).toBeTruthy();
    } finally {
      host.close();
      guest.close();
    }
  }, 10_000);

  it("reconnect with same clientToken reclaims identity", async () => {
    const a = newClient();
    const b = newClient();
    try {
      await new Promise<void>((r) => a.on("connect", () => r()));
      await new Promise<void>((r) => b.on("connect", () => r()));

      send(a, {
        type: MessageType.CreateRoom,
        playerName: "A",
        clientToken: "reconnect-token",
      });
      const firstState = await waitFor(
        a,
        (m) => m.type === MessageType.RoomState,
      );
      if (firstState.type !== MessageType.RoomState) throw new Error("bad");
      const roomCode = firstState.room.code;
      const originalId = firstState.you;

      // B joins so that the room outlives A's disconnect.
      send(b, {
        type: MessageType.JoinRoom,
        roomCode,
        playerName: "B",
        clientToken: "token-b",
      });
      await waitFor(b, (m) => m.type === MessageType.RoomState);

      a.close();
      await new Promise((r) => setTimeout(r, 100));

      // Reconnect with same clientToken.
      const a2 = newClient();
      await new Promise<void>((r) => a2.on("connect", () => r()));
      send(a2, {
        type: MessageType.JoinRoom,
        roomCode,
        playerName: "A",
        clientToken: "reconnect-token",
      });
      const secondState = await waitFor(
        a2,
        (m) => m.type === MessageType.RoomState,
      );
      if (secondState.type !== MessageType.RoomState) throw new Error("bad");
      expect(secondState.you).toBe(originalId); // same PlayerId reclaimed
      a2.close();
    } finally {
      a.close();
      b.close();
    }
  }, 10_000);
});
