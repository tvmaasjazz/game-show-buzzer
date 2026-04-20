import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAdmin, type Room, type PlayerId } from "@buzzer/shared";
import { useAudio } from "../hooks/useAudioSettings";
import { useRoomStore } from "../hooks/useRoomStore";


interface Props {
  room: Room;
  you: PlayerId;
  onClose: () => void;
  onShare: () => void;
}

const StatusDot = ({ connected }: { connected: boolean }) => (
  <span
    aria-label={connected ? "connected" : "disconnected"}
    className={`inline-block h-2 w-2 rounded-full ${
      connected ? "bg-green-500" : "bg-gray-500"
    }`}
  />
);

export const PlayerListDrawer = ({ room, you, onClose, onShare }: Props) => {
  const nav = useNavigate();
  const { leaveRoom, changeQuestioner } = useRoomStore();
  const { enabled, setEnabled } = useAudio();
  const youAreAdmin = isAdmin(room, you);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleLeave = () => {
    leaveRoom();
    onClose();
    nav("/", { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/70"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label="Room menu"
        className="flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-neutral-950 text-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3 pr-16">
          <span className="text-sm text-gray-500">Room</span>
          <span className="text-lg tracking-widest text-white">{room.code}</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-white/10 px-4 py-3">
            <button
              onClick={onShare}
              className="flex w-full items-center justify-between rounded-md bg-white/5 px-3 py-3 text-left text-white transition-standard hover:bg-white/10"
            >
              <span>Share invite link</span>
              <span aria-hidden className="text-gray-400">→</span>
            </button>
          </div>
          <ul className="divide-y divide-white/10">
            {[
              ...room.players.filter((p) => p.id === room.questionerId),
              ...[...room.players.filter((p) => p.id !== room.questionerId)].sort(
                (a, b) => (b.score ?? 0) - (a.score ?? 0),
              ),
            ].map((p) => {
              const isQ = p.id === room.questionerId;
              const isA = p.id === room.adminId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 px-4 py-3 ${
                    isQ ? "border-l-2 border-green-500 bg-white/5" : ""
                  }`}
                >
                  <StatusDot connected={p.connected} />
                  {isA && (
                    <span aria-label="admin" title="Admin" className="text-yellow-400">
                      ★
                    </span>
                  )}
                  <span
                    className={`flex-1 truncate ${
                      p.connected ? "text-white" : "text-white/50"
                    }`}
                  >
                    {p.name}
                    {p.id === you && (
                      <span className="ml-1 text-xs text-gray-500">(you)</span>
                    )}
                    {isQ && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-green-500">
                        Questioner
                      </span>
                    )}
                  </span>
                  {!isQ && room.questionNumber > 0 && (
                    <span className="text-sm tabular-nums text-gray-400">
                      {p.score ?? 0}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {youAreAdmin && (
            <div className="border-t border-white/10 px-4 py-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Change questioner
              </p>
              <ul className="flex flex-col gap-1">
                {room.players.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => changeQuestioner(p.id)}
                      disabled={p.id === room.questionerId}
                      className="w-full rounded-md px-3 py-2 text-left text-white transition-standard hover:bg-white/10 disabled:cursor-default disabled:opacity-50"
                    >
                      {p.name}
                      {p.id === room.questionerId && (
                        <span className="ml-2 text-xs text-gray-500">
                          (current)
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-white/10 px-4 py-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
              Sound
            </p>
            <label className="flex items-center justify-between py-1 text-sm text-white">
              <span>Sound effects</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-green-500"
              />
            </label>
          </div>
        </div>

        <footer className="border-t border-white/10 p-4">
          <button
            onClick={() => setConfirmLeave(true)}
            className="w-full rounded-md bg-white/5 px-4 py-3 text-red-400 transition-standard hover:bg-white/10"
          >
            Leave Room
          </button>
        </footer>

        {confirmLeave && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-6"
            onClick={() => setConfirmLeave(false)}
          >
            <div
              role="alertdialog"
              aria-label="Leave room?"
              className="w-full rounded-xl border border-white/10 bg-neutral-900 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg">Leave the room?</h3>
              <p className="mt-1 text-sm text-gray-400">
                You&apos;ll lose your spot and won&apos;t see the rest of this session.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleLeave}
                  autoFocus
                  className="w-full rounded-md bg-red-500 px-4 py-3 text-white transition-standard"
                >
                  Leave
                </button>
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="w-full rounded-md bg-white/10 px-4 py-3 text-white transition-standard"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
