import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Toasts } from "../components/Toasts";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { useRoomStore } from "../hooks/useRoomStore";
import { storage } from "../lib/storage";

export const HomePage = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { leaveRoom } = useRoomStore();
  const roomParam = params.get("room");
  const [savedCode, setSavedCode] = useState(() => storage.activeRoom.get());

  useEffect(() => {
    if (roomParam) {
      nav(`/join?room=${encodeURIComponent(roomParam)}`, { replace: true });
    }
  }, [roomParam, nav]);

  const forget = () => {
    leaveRoom();
    setSavedCode(null);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-6">
      <ConnectionBanner />
      <Toasts />
      <div className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="mb-2 text-center text-3xl">Buzzer</h1>
        {savedCode && (
          <div className="flex flex-col gap-2 rounded-xl bg-white/10 p-4">
            <p className="text-sm text-gray-400">
              You&apos;re still in room{" "}
              <span className="tracking-widest text-white">{savedCode}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => nav(`/room/${savedCode}`)}
                className="flex-1 rounded-md bg-green-500 px-4 py-3 text-black transition-standard"
              >
                Rejoin
              </button>
              <button
                onClick={forget}
                className="flex-1 rounded-md bg-white px-4 py-3 text-black transition-standard"
              >
                Leave
              </button>
            </div>
          </div>
        )}
        <Link
          to="/create"
          className="w-full rounded-xl bg-green-500 px-4 py-5 text-center text-lg text-black transition-standard"
        >
          Create Room
        </Link>
        <Link
          to="/join"
          className="w-full rounded-xl bg-white px-4 py-5 text-center text-lg text-black transition-standard"
        >
          Join Room
        </Link>
      </div>
    </main>
  );
};
