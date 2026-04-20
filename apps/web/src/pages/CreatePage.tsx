import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toasts } from "../components/Toasts";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { ErrorCode } from "@buzzer/shared";
import { useRoomStore } from "../hooks/useRoomStore";
import { storage } from "../lib/storage";

export const CreatePage = () => {
  const nav = useNavigate();
  const { createRoom, leaveRoom, room, lastError, clearError, connectionStatus } =
    useRoomStore();
  const [name, setName] = useState(storage.playerName.get() ?? "");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && room) {
      nav(`/room/${room.code}?created=1`, { replace: true });
    }
  }, [room, nav]);

  useEffect(() => {
    if (!lastError) return;
    if (lastError.code === ErrorCode.RoomCreateFailed) setSubmitting(false);
    if (lastError.code === ErrorCode.NameRequired) setSubmitting(false);
  }, [lastError]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const trimmed = name.trim();
    if (!trimmed) return;
    submittedRef.current = true;
    setSubmitting(true);
    if (storage.activeRoom.get()) leaveRoom();
    createRoom(trimmed);
  };

  const isCreating = submitting && !lastError;
  const showRetryable =
    lastError?.code === ErrorCode.RoomCreateFailed ||
    lastError?.code === ErrorCode.NameRequired;

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6">
      <ConnectionBanner />
      <Toasts />
      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-col justify-between gap-6"
      >
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl">What&apos;s your name?</h1>
          <input
            autoFocus
            type="text"
            inputMode="text"
            autoCapitalize="words"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            className="w-full rounded-md bg-white px-4 py-3 text-lg text-black"
          />
          {showRetryable && (
            <p className="text-sm text-red-500">
              {lastError?.message ??
                "Couldn't create a room — try again."}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={!name.trim() || connectionStatus !== "connected"}
            className="w-full rounded-xl bg-green-500 px-4 py-4 text-lg text-black transition-standard disabled:opacity-60"
          >
            {isCreating ? "Creating..." : "Create room"}
          </button>
          <button
            type="button"
            onClick={() => nav("/")}
            className="w-full px-4 py-2 text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
};
