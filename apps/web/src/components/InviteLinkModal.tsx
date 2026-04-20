import { useEffect, useState } from "react";

interface Props {
  roomCode: string;
  onClose: () => void;
}

const buildUrl = (code: string): string =>
  `${window.location.origin}/?room=${code}`;

export const InviteLinkModal = ({ roomCode, onClose }: Props) => {
  const url = buildUrl(roomCode);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Buzzer",
        text: `Join my buzzer room ${roomCode}`,
        url,
      });
    } catch {
      /* user cancelled or unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite friends"
        className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 p-6 text-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl">Invite friends</h2>
        <p className="mt-1 text-sm text-gray-400">
          Room code <span className="tracking-widest text-white">{roomCode}</span>
        </p>
        <p className="mt-4 break-all rounded-md bg-white/5 px-3 py-2 text-sm text-gray-300">
          {url}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={copy}
            className="w-full rounded-md bg-green-500 px-4 py-3 text-black transition-standard"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          {copyError && (
            <p className="text-xs text-red-400">
              Couldn&apos;t copy — select the URL above.
            </p>
          )}
          {canShare && (
            <button
              onClick={share}
              className="w-full rounded-md bg-white/10 px-4 py-3 text-white transition-standard"
            >
              Share...
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
