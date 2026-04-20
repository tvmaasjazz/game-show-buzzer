import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InMemoryRoomStore } from "../rooms/room-store";
import { PresenceService } from "./presence.service";
import { AppConfig } from "../config";

describe("PresenceService", () => {
  let store: InMemoryRoomStore;
  let presence: PresenceService;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryRoomStore();
    presence = new PresenceService(store);
  });

  afterEach(() => {
    presence.shutdown();
    vi.useRealTimers();
  });

  describe("role-idle timer", () => {
    it("does NOT schedule a timer for a role-less player", () => {
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, {
        id: "guest",
        name: "G",
        connected: true,
        joinedAt: Date.now(),
      });
      let adminChanged = false;
      presence.events.on("admin_changed", () => (adminChanged = true));
      presence.onPlayerDisconnect(room.code, "guest");
      vi.advanceTimersByTime(AppConfig.roleIdleMs + 1000);
      expect(adminChanged).toBe(false);
    });

    it("promotes oldest-other player to admin after 2 min of admin disconnect", () => {
      const now = Date.now();
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, {
        id: "p1",
        name: "Older",
        connected: true,
        joinedAt: now + 10,
      });
      store.addPlayer(room.code, {
        id: "p2",
        name: "Younger",
        connected: true,
        joinedAt: now + 20,
      });
      const events: string[] = [];
      presence.events.on("admin_changed", (e) => events.push(`admin:${e.adminId}`));
      presence.onPlayerDisconnect(room.code, "admin");

      // Not yet — advance just under 2 min.
      vi.advanceTimersByTime(AppConfig.roleIdleMs - 1);
      expect(events).toEqual([]);

      // Tick over the threshold.
      vi.advanceTimersByTime(2);
      expect(events).toContain("admin:p1");
      expect(store.getRoom(room.code)!.adminId).toBe("p1");
    });

    it("reconnect within window clears the role-idle timer (no promotion)", () => {
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, {
        id: "p1",
        name: "P1",
        connected: true,
        joinedAt: Date.now() + 1,
      });
      const events: string[] = [];
      presence.events.on("admin_changed", (e) => events.push(e.adminId));
      presence.onPlayerDisconnect(room.code, "admin");
      vi.advanceTimersByTime(AppConfig.roleIdleMs - 1000);
      presence.onPlayerReconnect(room.code, "admin");
      vi.advanceTimersByTime(10_000);
      expect(events).toEqual([]);
      expect(store.getRoom(room.code)!.adminId).toBe("admin");
    });

    it("cascades questioner to new admin when disconnecting player held both roles", () => {
      const now = Date.now();
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, {
        id: "p1",
        name: "P1",
        connected: true,
        joinedAt: now + 1,
      });
      const events: Array<{ kind: string; id: string }> = [];
      presence.events.on("admin_changed", (e) =>
        events.push({ kind: "admin", id: e.adminId }),
      );
      presence.events.on("questioner_changed", (e) =>
        events.push({ kind: "questioner", id: e.questionerId }),
      );
      presence.onPlayerDisconnect(room.code, "admin");
      vi.advanceTimersByTime(AppConfig.roleIdleMs + 1);
      expect(events).toEqual([
        { kind: "admin", id: "p1" },
        { kind: "questioner", id: "p1" },
      ]);
    });

    it("promotes admin to questioner when questioner-only role-holder goes idle", () => {
      const now = Date.now();
      const room = store.createRoom({ id: "admin", name: "Admin" });
      store.addPlayer(room.code, {
        id: "q",
        name: "Q",
        connected: true,
        joinedAt: now + 1,
      });
      store.setQuestioner(room.code, "q");
      const events: string[] = [];
      presence.events.on("questioner_changed", (e) => events.push(e.questionerId));
      presence.onPlayerDisconnect(room.code, "q");
      vi.advanceTimersByTime(AppConfig.roleIdleMs + 1);
      expect(events).toEqual(["admin"]);
      expect(store.getRoom(room.code)!.questionerId).toBe("admin");
    });
  });

  describe("room-death timer", () => {
    it("schedules room death when all players disconnect", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      store.addPlayer(room.code, {
        id: "b",
        name: "B",
        connected: true,
        joinedAt: Date.now() + 1,
      });
      let deleted = false;
      presence.events.on("room_deleted", () => (deleted = true));
      presence.onPlayerDisconnect(room.code, "a");
      presence.onPlayerDisconnect(room.code, "b");
      vi.advanceTimersByTime(AppConfig.roomDeathMs + 1);
      expect(deleted).toBe(true);
      expect(store.getRoom(room.code)).toBeNull();
    });

    it("cancels room death when anyone reconnects before 5 min", () => {
      const room = store.createRoom({ id: "a", name: "A" });
      let deleted = false;
      presence.events.on("room_deleted", () => (deleted = true));
      presence.onPlayerDisconnect(room.code, "a");
      vi.advanceTimersByTime(AppConfig.roomDeathMs - 10_000);
      presence.onPlayerReconnect(room.code, "a");
      vi.advanceTimersByTime(60_000);
      expect(deleted).toBe(false);
      expect(store.getRoom(room.code)).not.toBeNull();
    });
  });
});
