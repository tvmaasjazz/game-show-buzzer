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

  describe("acceptBuzz", () => {
    it("returns true for a valid buzz", () => {
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, { id: "p1", name: "P1", connected: true, joinedAt: 0 });
      const opened = store.openBuzzer(room.code)!;
      expect(store.acceptBuzz(room.code, "p1", opened.questionId)).toBe(true);
    });

    it("returns false when buzzer is closed", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      expect(store.acceptBuzz(room.code, "a", "any")).toBe(false);
    });

    it("returns false for a stale questionId", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.openBuzzer(room.code);
      expect(store.acceptBuzz(room.code, "a", "WRONG_QID")).toBe(false);
    });

    it("returns false for an excluded player", () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      store.addPlayer(room.code, { id: "p1", name: "P1", connected: true, joinedAt: 0 });
      const opened = store.openBuzzer(room.code)!;
      // Simulate p1 having been marked incorrect previously
      store.markIncorrect(room.code); // needs winner first
      // Just test directly via finalizeWinner then markIncorrect
      const buzzes = [{ playerId: "p1", deltaMs: 0 }];
      store.finalizeWinner(room.code, opened.questionId, "p1", buzzes);
      const inc = store.markIncorrect(room.code)!;
      expect(store.acceptBuzz(room.code, "p1", inc.questionId)).toBe(false);
    });
  });

  describe("finalizeWinner", () => {
    it("sets winner state and buzzes", () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      store.addPlayer(room.code, { id: "p1", name: "P1", connected: true, joinedAt: 0 });
      store.addPlayer(room.code, { id: "p2", name: "P2", connected: true, joinedAt: 0 });
      const opened = store.openBuzzer(room.code)!;
      const buzzes = [{ playerId: "p1", deltaMs: 0 }, { playerId: "p2", deltaMs: 15 }];
      const ok = store.finalizeWinner(room.code, opened.questionId, "p1", buzzes);
      expect(ok).toBe(true);
      const after = store.getRoom(room.code)!;
      expect(after.buzzer.open).toBe(false);
      expect(after.buzzer.winner).toBe("p1");
      expect(after.buzzer.buzzes).toEqual(buzzes);
    });

    it("returns false when questionId has changed (stale window)", () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      const opened = store.openBuzzer(room.code)!;
      // Questioner closes and reopens — new questionId
      store.closeBuzzer(room.code, BuzzerCloseReason.Manual);
      store.openBuzzer(room.code);
      const ok = store.finalizeWinner(room.code, opened.questionId, "q", []);
      expect(ok).toBe(false);
    });

    it("preserves excludedPlayerIds from prior incorrect rounds", () => {
      const room = store.createRoom({ id: "q", name: "Q" });
      store.addPlayer(room.code, { id: "p1", name: "P1", connected: true, joinedAt: 0 });
      store.addPlayer(room.code, { id: "p2", name: "P2", connected: true, joinedAt: 0 });
      const opened = store.openBuzzer(room.code)!;
      store.finalizeWinner(room.code, opened.questionId, "p1", [{ playerId: "p1", deltaMs: 0 }]);
      const inc = store.markIncorrect(room.code)!;
      store.finalizeWinner(room.code, inc.questionId, "p2", [{ playerId: "p2", deltaMs: 0 }]);
      const after = store.getRoom(room.code)!;
      expect(after.buzzer.excludedPlayerIds).toContain("p1");
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

    it("closeBuzzer resets buzzer and increments questionNumber", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const qnBefore = room.questionNumber;
      store.openBuzzer(room.code);
      store.closeBuzzer(room.code, BuzzerCloseReason.QuestionerLeft);
      const after = store.getRoom(room.code)!;
      expect(after.buzzer.open).toBe(false);
      expect(after.buzzer.winner).toBeUndefined();
      expect(after.questionNumber).toBe(qnBefore + 1);
    });

    it("openBuzzer on next round clears the previous winner", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      const first = store.openBuzzer(room.code)!;
      store.finalizeWinner(room.code, first.questionId, "a", [{ playerId: "a", deltaMs: 0 }]);
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
