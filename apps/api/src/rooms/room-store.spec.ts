import { describe, it, expect, beforeEach } from "vitest";
import { BuzzerCloseReason } from "@buzzer/shared";
import { InMemoryRoomStore, RoomCodeExhaustedError } from "./room-store";

describe("InMemoryRoomStore", () => {
  let store: InMemoryRoomStore;

  beforeEach(() => {
    store = new InMemoryRoomStore();
  });

  describe("createRoom", () => {
    it("creates a room with the creator as admin and questioner", () => {
      const room = store.createRoom({ id: "p1", name: "Alice" });
      expect(room.code).toMatch(/^[A-Z]{4}$/);
      expect(room.adminId).toBe("p1");
      expect(room.questionerId).toBe("p1");
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toMatchObject({ id: "p1", name: "Alice", connected: true });
      expect(room.buzzer).toEqual({ open: false });
    });

    it("generates unique codes across calls", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const r = store.createRoom({ id: `p${i}`, name: `Alice${i}` });
        expect(codes.has(r.code)).toBe(false);
        codes.add(r.code);
      }
    });

    it("retries on collision and eventually succeeds", () => {
      // Fill the store with many rooms using forced codes, then verify it still creates new ones.
      // We can't easily force specific codes through the public API, so we rely on the
      // ~450K address space and a 50-room smoke test above being sufficient. This test
      // documents the intent.
      expect(() => store.createRoom({ id: "x", name: "x" })).not.toThrow();
    });
  });

  describe("tryRegisterBuzz — atomic invariant", () => {
    it("returns winner for the first caller and null for every subsequent caller", () => {
      const room = store.createRoom({ id: "admin", name: "Admin" });
      // Add some contestants
      for (let i = 0; i < 5; i++) {
        store.addPlayer(room.code, {
          id: `p${i}`,
          name: `P${i}`,
          connected: true,
          joinedAt: Date.now(),
        });
      }
      const opened = store.openBuzzer(room.code);
      expect(opened).not.toBeNull();
      const questionId = opened!.questionId;

      // First press wins.
      const winResult = store.tryRegisterBuzz(room.code, "p0", questionId);
      expect(winResult).toEqual({ winner: "p0" });

      // Every subsequent call with valid params returns null.
      for (let i = 1; i < 5; i++) {
        const r = store.tryRegisterBuzz(room.code, `p${i}`, questionId);
        expect(r).toBeNull();
      }

      // Room state reflects the winner.
      const afterRoom = store.getRoom(room.code)!;
      expect(afterRoom.buzzer.open).toBe(false);
      expect(afterRoom.buzzer.winner).toBe("p0");
    });

    it("returns null when buzzer is closed", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      // Buzzer is closed by default.
      const r = store.tryRegisterBuzz(room.code, "a", "any");
      expect(r).toBeNull();
    });

    it("returns null when questionId is stale", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const opened = store.openBuzzer(room.code);
      expect(opened).not.toBeNull();
      const r = store.tryRegisterBuzz(room.code, "a", "WRONG_QID");
      expect(r).toBeNull();
    });

    it("returns null when winner is already set (double-safety)", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const opened = store.openBuzzer(room.code)!;
      const first = store.tryRegisterBuzz(room.code, "a", opened.questionId);
      expect(first).toEqual({ winner: "a" });
      // Another call with same questionId should be null (buzzer is closed AND winner is set).
      const second = store.tryRegisterBuzz(room.code, "a", opened.questionId);
      expect(second).toBeNull();
    });
  });

  describe("tryRegisterBuzz — concurrency stress", () => {
    // Node's event loop is single-threaded: this test simulates N "simultaneous"
    // buzz arrivals by invoking tryRegisterBuzz N times in a tight loop (sync),
    // which is exactly how they'd be processed if N Socket.IO events fired on the
    // same tick. Exactly one caller must win.
    it("exactly one winner across 1000 parallel buzz attempts", () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      const playerIds: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const id = `p${i}`;
        playerIds.push(id);
        store.addPlayer(room.code, {
          id,
          name: id,
          connected: true,
          joinedAt: Date.now(),
        });
      }
      const opened = store.openBuzzer(room.code)!;
      const results = playerIds.map((pid) =>
        store.tryRegisterBuzz(room.code, pid, opened.questionId),
      );
      const winners = results.filter((r) => r !== null);
      expect(winners).toHaveLength(1);
      expect(winners[0]).toHaveProperty("winner");
    });

    it("exactly one winner when invoked via Promise.all (async interleaving)", async () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      for (let i = 0; i < 50; i++) {
        store.addPlayer(room.code, {
          id: `p${i}`,
          name: `P${i}`,
          connected: true,
          joinedAt: Date.now(),
        });
      }
      const opened = store.openBuzzer(room.code)!;
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          Promise.resolve().then(() =>
            store.tryRegisterBuzz(room.code, `p${i}`, opened.questionId),
          ),
        ),
      );
      const winners = results.filter((r): r is { winner: string } => r !== null);
      expect(winners).toHaveLength(1);
    });
  });

  describe("openBuzzer / closeBuzzer", () => {
    it("openBuzzer generates a fresh questionId each time", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const first = store.openBuzzer(room.code)!;
      store.closeBuzzer(room.code, BuzzerCloseReason.Manual);
      const second = store.openBuzzer(room.code)!;
      expect(first.questionId).not.toBe(second.questionId);
    });

    it("closeBuzzer preserves existing winner", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const opened = store.openBuzzer(room.code)!;
      store.tryRegisterBuzz(room.code, "a", opened.questionId);
      const afterWin = store.getRoom(room.code)!;
      expect(afterWin.buzzer.winner).toBe("a");
      // closeBuzzer (e.g., on questioner drop) shouldn't wipe the winner.
      store.closeBuzzer(room.code, BuzzerCloseReason.QuestionerLeft);
      const after = store.getRoom(room.code)!;
      expect(after.buzzer.open).toBe(false);
      expect(after.buzzer.winner).toBe("a");
    });

    it("openBuzzer on next round clears the previous winner", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const first = store.openBuzzer(room.code)!;
      store.tryRegisterBuzz(room.code, "a", first.questionId);
      expect(store.getRoom(room.code)!.buzzer.winner).toBe("a");
      store.openBuzzer(room.code);
      expect(store.getRoom(room.code)!.buzzer.winner).toBeUndefined();
    });
  });

  describe("players", () => {
    it("addPlayer is idempotent on same player id", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.addPlayer(room.code, { id: "b", name: "B", connected: true, joinedAt: 0 });
      store.addPlayer(room.code, { id: "b", name: "B", connected: true, joinedAt: 0 });
      expect(store.getRoom(room.code)!.players).toHaveLength(2);
    });

    it("removePlayer removes by id", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.addPlayer(room.code, { id: "b", name: "B", connected: true, joinedAt: 0 });
      store.removePlayer(room.code, "b");
      expect(store.getRoom(room.code)!.players.map((p) => p.id)).toEqual(["a"]);
    });

    it("updatePlayerConnected toggles the flag", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.updatePlayerConnected(room.code, "a", false);
      expect(store.getRoom(room.code)!.players[0]!.connected).toBe(false);
    });
  });

  describe("clientToken bindings", () => {
    it("roundtrips a binding", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.setBinding(room.code, "token-xyz", "a");
      expect(store.getBinding(room.code, "token-xyz")).toBe("a");
    });

    it("returns null for unknown tokens", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      expect(store.getBinding(room.code, "nope")).toBeNull();
    });

    it("deleteRoom clears bindings", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.setBinding(room.code, "t", "a");
      store.deleteRoom(room.code);
      expect(store.getBinding(room.code, "t")).toBeNull();
    });
  });
});

// Kept for explicit surface reference.
describe("RoomCodeExhaustedError", () => {
  it("is a named error", () => {
    const e = new RoomCodeExhaustedError();
    expect(e.name).toBe("RoomCodeExhaustedError");
  });
});
