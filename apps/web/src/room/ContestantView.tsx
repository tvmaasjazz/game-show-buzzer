import { useEffect, useState } from "react";
import type { PlayerId, Room } from "@buzzer/shared";
import { useAudio } from "../hooks/useAudioSettings";
import { serverNow } from "../hooks/useClockSync";
import { useRoomStore } from "../hooks/useRoomStore";
import { BuzzesList } from "./BuzzesList";

interface Props {
  room: Room;
  you: PlayerId;
}

export const ContestantView = ({ room, you }: Props) => {
  const { buzz } = useRoomStore();
  const { playClick } = useAudio();
  const { buzzer } = room;

  // Delay enabling the button until the server-scheduled openAt time so all
  // clients activate simultaneously regardless of individual network latency.
  const [buzzerLive, setBuzzerLive] = useState(false);
  useEffect(() => {
    if (!buzzer.open) {
      setBuzzerLive(false);
      return;
    }
    const delay = (buzzer.openAt ?? serverNow()) - serverNow();
    if (delay <= 0) {
      setBuzzerLive(true);
      return;
    }
    setBuzzerLive(false);
    const t = setTimeout(() => setBuzzerLive(true), delay);
    return () => clearTimeout(t);
  }, [buzzer.open, buzzer.openAt]);

  const winnerPlayer = buzzer.winner
    ? room.players.find((p) => p.id === buzzer.winner)
    : null;
  const youWon = buzzer.winner === you;
  const youExcluded = !!buzzer.excludedPlayerIds?.includes(you);
  const youCanBuzz = buzzerLive && !youExcluded;

  const subtitle = buzzer.open
    ? youExcluded
      ? "You're out this round"
      : "Buzzer OPEN — tap now"
    : winnerPlayer
      ? youWon
        ? "You buzzed first!"
        : `${winnerPlayer.name} buzzed first`
      : "Waiting for questioner...";

  const baseBtn = "min-h-[50vh] w-full max-w-lg rounded-xl text-4xl transition-standard";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p
        role="status"
        aria-live="polite"
        className={`text-lg ${youWon && !buzzer.open ? "text-green-500" : "text-gray-500"}`}
      >
        {subtitle}
      </p>
      {youCanBuzz ? (
        <button
          onClick={() => {
            playClick();
            buzz();
          }}
          aria-label="Buzzer"
          aria-pressed="false"
          className={`${baseBtn} animate-pulse bg-green-500 text-black`}
        >
          BUZZ
        </button>
      ) : buzzer.open && youExcluded ? (
        <button
          disabled
          aria-disabled="true"
          aria-label="Buzzer (excluded)"
          className={`${baseBtn} bg-gray-300 text-gray-500`}
        >
          OUT
        </button>
      ) : (
        <button
          disabled
          aria-disabled="true"
          aria-label="Buzzer (closed)"
          className={`${baseBtn} ${winnerPlayer ? "bg-gray-300 text-gray-500" : "bg-red-300 text-white"}`}
        >
          —
        </button>
      )}
      {!buzzer.open && buzzer.buzzes && (
        <BuzzesList room={room} buzzes={buzzer.buzzes} you={you} />
      )}
    </div>
  );
};
