import { useRoomStore } from "../hooks/useRoomStore";

export const Toasts = () => {
  const { toasts, dismissToast } = useRoomStore();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto max-w-sm rounded-md px-4 py-2 text-sm shadow-sm transition-standard ${
            t.kind === "error"
              ? "bg-red-500 text-white"
              : "bg-white text-black"
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
};
