import { useRoomStore } from "../hooks/useRoomStore";

export const ConnectionBanner = () => {
  const { connectionStatus } = useRoomStore();
  if (connectionStatus === "connected") return null;
  const text =
    connectionStatus === "connecting"
      ? "Connecting..."
      : "Reconnecting...";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center">
      <div className="mt-1 rounded-md bg-yellow-400 px-3 py-1 text-xs font-bold text-black shadow-sm">
        {text}
      </div>
    </div>
  );
};
