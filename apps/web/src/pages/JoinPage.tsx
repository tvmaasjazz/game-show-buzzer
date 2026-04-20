import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorCode } from "@buzzer/shared";
import { Toasts } from "../components/Toasts";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { useRoomStore } from "../hooks/useRoomStore";
import { storage } from "../lib/storage";

const sanitizeCode = (v: string): string =>
  v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);

export const JoinPage = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { joinRoom, leaveRoom, room, lastError, clearError, connectionStatus } =
    useRoomStore();
  const [code, setCode] = useState(sanitizeCode(params.get("room") ?? ""));
  const [name, setName] = useState(storage.playerName.get() ?? "");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && room) nav(`/room/${room.code}`, { replace: true });
  }, [room, nav]);

  useEffect(() => {
    if (lastError) setSubmitting(false);
  }, [lastError]);

  const codeError =
    lastError?.code === ErrorCode.RoomNotFound ? lastError.message : null;
  const nameError =
    lastError?.code === ErrorCode.NameRequired ? lastError.message : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length !== 4 || !trimmedName) return;
    submittedRef.current = true;
    setSubmitting(true);
    const prior = storage.activeRoom.get();
    if (prior && prior !== trimmedCode) leaveRoom();
    joinRoom(trimmedCode, trimmedName);
  };

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6">
      <ConnectionBanner />
      <Toasts />
      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-col justify-between gap-6"
      >
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl">Join a room</h1>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-500" htmlFor="code">
              Room code
            </label>
            <input
              id="code"
              type="text"
              autoFocus={!code}
              autoCapitalize="characters"
              autoCorrect="off"
              inputMode="text"
              placeholder="ABCD"
              value={code}
              onChange={(e) => setCode(sanitizeCode(e.target.value))}
              maxLength={4}
              className="w-full rounded-md bg-white px-4 py-3 text-center text-2xl uppercase tracking-widest text-black"
            />
            {codeError && <p className="text-sm text-red-500">{codeError}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-500" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              type="text"
              autoFocus={!!code}
              autoCapitalize="words"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="w-full rounded-md bg-white px-4 py-3 text-lg text-black"
            />
            {nameError && <p className="text-sm text-red-500">{nameError}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={
              code.length !== 4 ||
              !name.trim() ||
              connectionStatus !== "connected"
            }
            className="w-full rounded-xl bg-green-500 px-4 py-4 text-lg text-black transition-standard disabled:opacity-60"
          >
            {submitting ? `Joining ${code}...` : "Join room"}
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
