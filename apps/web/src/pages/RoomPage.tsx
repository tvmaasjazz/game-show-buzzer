import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isQuestioner } from "@buzzer/shared";
import { Toasts } from "../components/Toasts";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { InviteLinkModal } from "../components/InviteLinkModal";
import { useAudio } from "../hooks/useAudioSettings";
import { useRoomStore } from "../hooks/useRoomStore";
import { storage } from "../lib/storage";
import { QuestionerView } from "../room/QuestionerView";
import { ContestantView } from "../room/ContestantView";
import { PlayerListDrawer } from "../room/PlayerListDrawer";

const QuestionLabel = ({ n }: { n: number }) => (
  <p className="mb-4 text-center text-xs uppercase tracking-wide text-gray-500">
    Question {n}
  </p>
);

const AudioToggle = () => {
  const { enabled, setEnabled } = useAudio();
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      aria-label={enabled ? "Mute sound" : "Unmute sound"}
      aria-pressed={enabled}
      className="rounded-md bg-white/10 px-3 py-2 text-xl text-white transition-standard"
    >
      {enabled ? "🔊" : "🔇"}
    </button>
  );
};

export const RoomPage = () => {
  const nav = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [params, setParams] = useSearchParams();
  const {
    room,
    you,
    roomEnded,
    resetRoom,
    connectionStatus,
    joinRoom,
  } = useRoomStore();
  const [showInvite, setShowInvite] = useState(params.get("created") === "1");
  const [showDrawer, setShowDrawer] = useState(false);

  // If we landed directly on /room/:code without prior state, attempt auto-join.
  useEffect(() => {
    if (room) return;
    if (roomEnded) return;
    if (connectionStatus !== "connected") return;
    if (!code) return;
    const savedName = storage.playerName.get();
    if (savedName) {
      joinRoom(code.toUpperCase(), savedName);
    } else {
      nav(`/join?room=${encodeURIComponent(code)}`, { replace: true });
    }
  }, [room, roomEnded, connectionStatus, code, joinRoom, nav]);

  // After a socket reconnect mid-session, rebind by re-emitting join_room.
  const wasDisconnectedRef = useRef(false);
  useEffect(() => {
    if (connectionStatus === "disconnected") {
      wasDisconnectedRef.current = true;
      return;
    }
    if (
      connectionStatus === "connected" &&
      wasDisconnectedRef.current &&
      room &&
      you
    ) {
      wasDisconnectedRef.current = false;
      const me = room.players.find((p) => p.id === you);
      const name = me?.name ?? storage.playerName.get();
      if (name) joinRoom(room.code, name);
    }
  }, [connectionStatus, room, you, joinRoom]);

  // Clear the ?created=1 flag after first render so refreshes don't reopen it.
  useEffect(() => {
    if (params.get("created") === "1") {
      params.delete("created");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // beforeunload guard
  useEffect(() => {
    if (!room) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [room]);

  if (roomEnded) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-6">
        <h1 className="text-2xl">This room has ended</h1>
        <button
          onClick={() => {
            resetRoom();
            nav("/", { replace: true });
          }}
          className="w-full max-w-sm rounded-xl bg-green-500 px-4 py-4 text-black transition-standard"
        >
          Back to home
        </button>
      </main>
    );
  }

  if (!room || !you) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-6">
        <ConnectionBanner />
        <Toasts />
        <p className="text-gray-500">Joining {code ?? ""}...</p>
      </main>
    );
  }

  const youAreQuestioner = isQuestioner(room, you);
  const yourName = room.players.find((p) => p.id === you)?.name;

  return (
    <main className="flex min-h-dvh flex-col px-4 py-6">
      <ConnectionBanner />
      <Toasts />
      <header className="mb-6 flex items-center justify-between">
        <div className="flex min-w-0 items-baseline gap-2 text-sm text-gray-500">
          <span>Room</span>
          <span className="text-lg tracking-widest text-white">{room.code}</span>
          {yourName && (
            <span className="truncate text-sm text-gray-400">· {yourName}</span>
          )}
        </div>
        <div className="relative z-50 flex items-center gap-2">
          {!showDrawer && <AudioToggle />}
          <button
            onClick={() => setShowDrawer((v) => !v)}
            aria-label={showDrawer ? "Close menu" : "Open menu"}
            aria-expanded={showDrawer}
            className="rounded-md bg-white/10 px-3 py-2 text-xl text-white transition-standard"
          >
            {showDrawer ? "✕" : "☰"}
          </button>
        </div>
      </header>

      <QuestionLabel n={room.questionNumber} />

      <section className="flex flex-1 flex-col items-center justify-center">
        {youAreQuestioner ? (
          <QuestionerView room={room} you={you} />
        ) : (
          <ContestantView room={room} you={you} />
        )}
      </section>

      {showInvite && (
        <InviteLinkModal
          roomCode={room.code}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showDrawer && (
        <PlayerListDrawer
          room={room}
          you={you}
          onClose={() => setShowDrawer(false)}
          onShare={() => {
            setShowDrawer(false);
            setShowInvite(true);
          }}
        />
      )}
    </main>
  );
};
