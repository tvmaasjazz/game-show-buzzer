const CLIENT_TOKEN_KEY = "buzzer.clientToken";
const ACTIVE_ROOM_KEY = "buzzer.activeRoom";
const PLAYER_NAME_KEY = "buzzer.playerName";

type Getter = (key: string) => string | null;
type Setter = (key: string, value: string) => void;
type Remover = (key: string) => void;

const memoryStore = new Map<string, string>();

const tryLocalStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    const probe = "__buzzer_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
};

const ls = tryLocalStorage();

const getItem: Getter = (key) =>
  ls ? ls.getItem(key) : (memoryStore.get(key) ?? null);

const setItem: Setter = (key, value) => {
  if (ls) ls.setItem(key, value);
  else memoryStore.set(key, value);
};

const removeItem: Remover = (key) => {
  if (ls) ls.removeItem(key);
  else memoryStore.delete(key);
};

export const storage = {
  clientToken: {
    get: () => getItem(CLIENT_TOKEN_KEY),
    set: (v: string) => setItem(CLIENT_TOKEN_KEY, v),
  },
  activeRoom: {
    get: () => getItem(ACTIVE_ROOM_KEY),
    set: (v: string) => setItem(ACTIVE_ROOM_KEY, v),
    clear: () => removeItem(ACTIVE_ROOM_KEY),
  },
  playerName: {
    get: () => getItem(PLAYER_NAME_KEY),
    set: (v: string) => setItem(PLAYER_NAME_KEY, v),
  },
  hasPersistentStorage: ls !== null,
};
