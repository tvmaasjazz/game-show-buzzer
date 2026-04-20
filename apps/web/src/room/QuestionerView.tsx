import { useEffect, useState } from "react";
import type { PlayerId, Room } from "@buzzer/shared";
import { useRoomStore } from "../hooks/useRoomStore";
import { BuzzesList } from "./BuzzesList";

const POINT_VALUES = [100, 200, 300, 400, 500] as const;

interface Props {
  room: Room;
  you: PlayerId;
}

export const QuestionerView = ({ room, you }: Props) => {
  const { openBuzzer, closeBuzzer, markCorrect, markIncorrect, endQuestion } =
    useRoomStore();
  const { buzzer } = room;
  const [points, setPoints] = useState<number>(100);
  const questionStarted = !!buzzer.questionId;

  // Reset to default when a question fully ends (questionId cleared).
  useEffect(() => {
    if (!questionStarted) setPoints(100);
  }, [questionStarted]);
  const winner = buzzer.winner
    ? room.players.find((p) => p.id === buzzer.winner)
    : null;
  const contestantCount = room.players.filter(
    (p) => p.id !== room.questionerId,
  ).length;
  const canOpen = contestantCount >= 1;
  const hasPendingJudgment = !buzzer.open && !!winner;

  const subtitle = buzzer.open
    ? "Buzzer OPEN"
    : winner
      ? `${winner.name} buzzed first`
      : canOpen
        ? "Tap to open the buzzer"
        : "Waiting for players...";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex gap-2">
        {POINT_VALUES.map((v) => (
          <button
            key={v}
            onClick={() => setPoints(v)}
            disabled={questionStarted}
            aria-pressed={points === v}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-standard disabled:opacity-40 ${
              points === v
                ? "bg-white text-black"
                : "bg-white/10 text-white"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`text-lg ${winner && !buzzer.open ? "text-white" : "text-gray-500"}`}
      >
        {subtitle}
      </p>
      {buzzer.open ? (
        <button
          onClick={closeBuzzer}
          aria-pressed="true"
          aria-label="Close buzzer"
          className="min-h-[50vh] w-full max-w-lg rounded-xl bg-red-500 text-4xl text-white transition-standard"
        >
          CLOSE
        </button>
      ) : hasPendingJudgment ? (
        <div className="flex w-full max-w-lg flex-col gap-3">
          <button
            onClick={() => markCorrect(points)}
            aria-label="Mark correct"
            className="min-h-[18vh] w-full rounded-xl bg-green-500 text-3xl text-black transition-standard"
          >
            Correct
          </button>
          <button
            onClick={markIncorrect}
            aria-label="Mark incorrect"
            className="min-h-[18vh] w-full rounded-xl bg-red-500 text-3xl text-white transition-standard"
          >
            Incorrect
          </button>
          <button
            onClick={endQuestion}
            aria-label="Close question"
            className="min-h-[12vh] w-full rounded-xl bg-white/10 text-xl text-white transition-standard"
          >
            Close
          </button>
        </div>
      ) : (
        <button
          onClick={openBuzzer}
          disabled={!canOpen}
          aria-pressed="false"
          aria-disabled={!canOpen}
          aria-label="Open buzzer"
          className="min-h-[50vh] w-full max-w-lg rounded-xl bg-green-500 text-4xl text-black transition-standard disabled:opacity-60"
        >
          OPEN
        </button>
      )}
      {!buzzer.open && buzzer.buzzes && (
        <BuzzesList room={room} buzzes={buzzer.buzzes} you={you} />
      )}
    </div>
  );
};
