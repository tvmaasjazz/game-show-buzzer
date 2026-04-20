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
      connected ? "bg-green-500" : "bg-gray-400"
    }`}
  />
);

export const PlayerListDrawer = ({ room, you, onClose, onShare }: Props) => {
  const nav = useNavigate();
  const { leaveRoom, changeQuestioner } = useRoomStore();
  const { enabled, setEnabled } = useAudio();
  const youAreAdmin = isAdmin(room, you);

  const handleLeave = () => {
    leaveRoom();
    onClose();
    nav("/", { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label="Room menu"
        className="flex h-full w-full max-w-sm flex-col bg-white text-black shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Room:</span>
            <span className="text-lg tracking-widest">{room.code}</span>
          </div>
          <button
            onClick={onShare}
            aria-label="Share room"
            className="rounded-md bg-gray-100 px-3 py-1 text-sm text-black"
          >
            Share
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-gray-300">
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
                    isQ ? "border-l-2 border-green-500" : ""
                  }`}
                >
                  <StatusDot connected={p.connected} />
                  {isA && (
                    <span aria-label="admin" className="text-yellow-400">
                      ★
                    </span>
                  )}
                  <span
                    className={`flex-1 ${
                      p.connected ? "text-black" : "text-black/60"
                    }`}
                  >
                    {p.name}
                    {p.id === you && (
                      <span className="ml-1 text-xs text-gray-500">(you)</span>
                    )}
                  </span>
                  {!isQ && room.questionNumber > 0 && (
                    <span className="text-sm text-gray-500">{p.score ?? 0} pts</span>
                  )}
                </li>
              );
            })}
          </ul>

          {youAreAdmin && (
            <div className="border-t border-gray-300 px-4 py-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Change questioner
              </p>
              <ul className="flex flex-col gap-1">
                {room.players.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => changeQuestioner(p.id)}
                      disabled={p.id === room.questionerId}
                      className="w-full rounded-md px-3 py-2 text-left text-black transition-standard hover:bg-gray-100 disabled:cursor-default disabled:opacity-60"
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

          <div className="border-t border-gray-300 px-4 py-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
              Sound
            </p>
            <label className="flex items-center justify-between py-1 text-sm text-black">
              <span>Sound effects</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
        </div>

        <footer className="border-t border-gray-300 p-4">
          <button
            onClick={handleLeave}
            className="w-full rounded-md px-4 py-3 text-red-500 transition-standard"
          >
            Leave Room
          </button>
          <button
            onClick={onClose}
            className="mt-1 w-full px-4 py-2 text-sm text-gray-500"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
};
