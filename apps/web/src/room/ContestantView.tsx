import { useEffect, useRef, useState } from "react";
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

  // Flash +N when our own score jumps.
  const yourScore = room.players.find((p) => p.id === you)?.score ?? 0;
  const prevScoreRef = useRef(yourScore);
  const [pointsFlash, setPointsFlash] = useState<number | null>(null);
  useEffect(() => {
    if (yourScore > prevScoreRef.current) {
      const delta = yourScore - prevScoreRef.current;
      setPointsFlash(delta);
      const t = window.setTimeout(() => setPointsFlash(null), 2500);
      prevScoreRef.current = yourScore;
      return () => window.clearTimeout(t);
    }
    prevScoreRef.current = yourScore;
  }, [yourScore]);

  // Flash "INCORRECT" when we transition from not-excluded to excluded.
  const prevExcludedRef = useRef<boolean>(youExcluded);
  const [justIncorrect, setJustIncorrect] = useState(false);
  useEffect(() => {
    const wasExcluded = prevExcludedRef.current;
    prevExcludedRef.current = youExcluded;
    if (!wasExcluded && youExcluded) {
      setJustIncorrect(true);
      const t = window.setTimeout(() => setJustIncorrect(false), 3500);
      return () => window.clearTimeout(t);
    }
    if (!youExcluded) setJustIncorrect(false);
  }, [youExcluded]);

  const subtitle: React.ReactNode = buzzer.open
    ? youExcluded
      ? justIncorrect
        ? (
          <>
            <span className="text-red-500">INCORRECT.</span>{" "}
            You&apos;re out this round.
          </>
        )
        : "You're out this round"
      : "Buzzer OPEN — tap now"
    : winnerPlayer
      ? youWon
        ? "You buzzed first!"
        : `${winnerPlayer.name} buzzed first`
      : "Waiting for questioner...";

  const baseBtn = "min-h-[50vh] w-full max-w-lg rounded-xl text-4xl transition-standard";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative flex items-center">
        <p
          role="status"
          aria-live="polite"
          className={`text-lg ${youWon && !buzzer.open ? "text-green-500" : "text-gray-500"}`}
        >
          {subtitle}
        </p>
        {pointsFlash !== null && (
          <span
            aria-live="polite"
            className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce whitespace-nowrap text-3xl font-bold text-green-400"
          >
            +{pointsFlash}
          </span>
        )}
      </div>
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
      ) : youWon && winnerPlayer ? (
        <button
          disabled
          aria-disabled="true"
          aria-label="You buzzed first — answer now"
          className={`${baseBtn} animate-pulse bg-yellow-300 text-black shadow-[0_0_60px_rgba(253,224,71,0.7)]`}
        >
          The answer is...
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
