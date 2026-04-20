const ENABLED_KEY = "buzzer.audio.enabled";
const VOICE_KEY = "buzzer.audio.voice";

const readBool = (key: string, fallback: boolean): boolean => {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
};

const writeBool = (key: string, value: boolean): void => {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* private mode */
  }
};

const readString = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeString = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

export const audioSettings = {
  getEnabled: (): boolean => readBool(ENABLED_KEY, true),
  setEnabled: (v: boolean): void => writeBool(ENABLED_KEY, v),
  getVoiceURI: (): string | null => readString(VOICE_KEY),
  setVoiceURI: (v: string | null): void => writeString(VOICE_KEY, v),
};
