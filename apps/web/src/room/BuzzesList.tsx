import type { BuzzRecord, PlayerId, Room } from "@buzzer/shared";

interface Props {
  room: Room;
  buzzes: BuzzRecord[];
  you: PlayerId | null;
}

export const BuzzesList = ({ room, buzzes, you }: Props) => {
  if (!buzzes.length) return null;
  const nameOf = (id: PlayerId): string =>
    room.players.find((p) => p.id === id)?.name ?? "Someone";

  return (
    <ul className="mt-4 w-full max-w-lg divide-y divide-white/10 rounded-md bg-white/5 text-sm">
      {buzzes.map((b, i) => {
        const name = nameOf(b.playerId);
        const isYou = b.playerId === you;
        const isWinner = i === 0;
        const label = isWinner
          ? `${isYou ? "You" : name} — first`
          : `${isYou ? "You were" : `${name} was`} ${b.deltaMs}ms late`;
        return (
          <li
            key={b.playerId}
            className={`flex justify-between px-3 py-2 ${
              isWinner ? "text-green-500" : "text-gray-500"
            }`}
          >
            <span>{label}</span>
            <span className="tabular-nums">
              {isWinner ? "+0ms" : `+${b.deltaMs}ms`}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
