type VoiceChangeListener = (voices: SpeechSynthesisVoice[]) => void;

let cached: SpeechSynthesisVoice[] = [];
const listeners = new Set<VoiceChangeListener>();

const available = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

const refresh = (): void => {
  const s = available();
  if (!s) return;
  cached = s.getVoices();
  for (const l of listeners) l(cached);
};

if (available()) {
  refresh();
  available()!.addEventListener("voiceschanged", refresh);
}

const samanthaVoice = (): SpeechSynthesisVoice | null =>
  cached.find((v) => v.name === "Samantha" && v.lang.startsWith("en")) ??
  cached.find((v) => v.name.includes("Samantha")) ??
  null;

export const speech = {
  isSupported(): boolean {
    return available() !== null;
  },
  getVoices(): SpeechSynthesisVoice[] {
    if (cached.length === 0) refresh();
    return cached;
  },
  onVoicesChanged(listener: VoiceChangeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  speak(text: string): void {
    const s = available();
    if (!s || !text) return;
    s.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = samanthaVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1.05;
    utter.pitch = 1.15;
    utter.volume = 1;
    s.speak(utter);
  },
  // Unlocks speech synthesis on iOS/Safari (needs user gesture). Silent no-op
  // elsewhere. Safe to call any number of times.
  prime(): void {
    const s = available();
    if (!s) return;
    const utter = new SpeechSynthesisUtterance("");
    utter.volume = 0;
    s.speak(utter);
  },
};
