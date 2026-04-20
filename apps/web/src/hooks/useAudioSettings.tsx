import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { audio } from "../lib/audio";
import { speech } from "../lib/speech";
import { audioSettings } from "../lib/audioSettings";

interface AudioContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  playOpen: () => void;
  playClick: () => void;
  playCorrect: () => void;
  playIncorrect: () => void;
  speakName: (name: string) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export const AudioSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabledState] = useState<boolean>(() =>
    audioSettings.getEnabled(),
  );

  const setEnabled = useCallback((v: boolean) => {
    audioSettings.setEnabled(v);
    setEnabledState(v);
    if (v) {
      audio.prime();
      speech.prime();
    }
  }, []);

  const playOpen = useCallback(() => { if (enabled) audio.playOpen(); }, [enabled]);
  const playClick = useCallback(() => { if (enabled) audio.playClick(); }, [enabled]);
  const playCorrect = useCallback(() => { if (enabled) audio.playCorrect(); }, [enabled]);
  const playIncorrect = useCallback(() => { if (enabled) audio.playIncorrect(); }, [enabled]);
  const speakName = useCallback((name: string) => { if (enabled) speech.speak(name); }, [enabled]);

  const value = useMemo<AudioContextValue>(
    () => ({ enabled, setEnabled, playOpen, playClick, playCorrect, playIncorrect, speakName }),
    [enabled, setEnabled, playOpen, playClick, playCorrect, playIncorrect, speakName],
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
};

export const useAudio = (): AudioContextValue => {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio outside AudioSettingsProvider");
  return ctx;
};
