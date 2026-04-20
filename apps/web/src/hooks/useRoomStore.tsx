import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BuzzerCloseReason,
  ErrorCode,
  MessageType,
  type BuzzerState,
  type ErrorMessage as WireError,
  type PlayerId,
  type Room,
  type ServerMessage,
} from "@buzzer/shared";
import { getClientToken } from "../lib/clientToken";
import { storage } from "../lib/storage";
import { useAudio } from "./useAudioSettings";
import { useClockSync, serverNow } from "./useClockSync";
import { useServerMessages, useSocket } from "./useSocket";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface RoomStoreValue {
  room: Room | null;
  you: PlayerId | null;
  lastError: WireError | null;
  connectionStatus: ConnectionStatus;
  roomEnded: boolean;
  toasts: Toast[];
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;
  openBuzzer: () => void;
  closeBuzzer: () => void;
  buzz: () => void;
  markCorrect: (points: number) => void;
  markIncorrect: () => void;
  endQuestion: () => void;
  changeQuestioner: (id: PlayerId) => void;
  dismissToast: (id: number) => void;
  clearError: () => void;
  resetRoom: () => void;
}

const RoomStoreContext = createContext<RoomStoreValue | null>(null);

const findName = (room: Room | null, id: PlayerId): string =>
  room?.players.find((p) => p.id === id)?.name ?? "Someone";

export const RoomStoreProvider = ({ children }: { children: ReactNode }) => {
  const { socket, status } = useSocket();
  useClockSync();
  const { playOpen, playCorrect, playIncorrect, speakName } = useAudio();
  const [room, setRoom] = useState<Room | null>(null);
  const [you, setYou] = useState<PlayerId | null>(null);
  const [lastError, setLastError] = useState<WireError | null>(null);
  const [roomEnded, setRoomEnded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updatePlayer = useCallback(
    (id: PlayerId, patch: Partial<{ connected: boolean }>) =>
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) =>
                p.id === id ? { ...p, ...patch } : p,
              ),
            }
          : prev,
      ),
    [],
  );

  const setBuzzer = useCallback(
    (patch: Partial<BuzzerState>) =>
      setRoom((prev) =>
        prev ? { ...prev, buzzer: { ...prev.buzzer, ...patch } } : prev,
      ),
    [],
  );

  const handle = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case MessageType.RoomState:
          setRoom(msg.room);
          setYou(msg.you);
          setRoomEnded(false);
          storage.activeRoom.set(msg.room.code);
          return;
        case MessageType.PlayerJoined:
          setRoom((prev) =>
            prev && !prev.players.some((p) => p.id === msg.player.id)
              ? { ...prev, players: [...prev.players, msg.player] }
              : prev,
          );
          pushToast(`${msg.player.name} joined`);
          return;
        case MessageType.PlayerLeft:
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  players: prev.players.filter((p) => p.id !== msg.playerId),
                }
              : prev,
          );
          return;
        case MessageType.PlayerDisconnected:
          updatePlayer(msg.playerId, { connected: false });
          return;
        case MessageType.PlayerReconnected:
          updatePlayer(msg.playerId, { connected: true });
          return;
        case MessageType.AdminChanged:
          setRoom((prev) => (prev ? { ...prev, adminId: msg.adminId } : prev));
          pushToast(`${findName(room, msg.adminId)} is now admin`);
          return;
        case MessageType.QuestionerChanged:
          setRoom((prev) =>
            prev ? { ...prev, questionerId: msg.questionerId } : prev,
          );
          pushToast(
            `${findName(room, msg.questionerId)} is now the questioner`,
          );
          return;
        case MessageType.BuzzerOpened:
          setBuzzer({
            open: true,
            questionId: msg.questionId,
            openedAt: msg.openedAt,
            openAt: msg.openAt,
            winner: undefined,
            winnerAt: undefined,
            buzzes: [],
            excludedPlayerIds: msg.excludedPlayerIds ?? [],
          });
          playOpen();
          return;
        case MessageType.BuzzerClosed: {
          const amQuestioner = room?.questionerId === you;
          if (msg.reason === BuzzerCloseReason.Winner && msg.winner) {
            setBuzzer({ open: false, winner: msg.winner });
            if (amQuestioner) {
              const winnerName = room?.players.find((p) => p.id === msg.winner)?.name;
              if (winnerName) speakName(winnerName);
            }
          } else if (msg.reason === BuzzerCloseReason.Correct) {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    questionNumber: msg.questionNumber ?? prev.questionNumber,
                    players: msg.scores
                      ? prev.players.map((p) => ({
                          ...p,
                          score: msg.scores![p.id] ?? p.score ?? 0,
                        }))
                      : prev.players,
                    buzzer: { open: false },
                  }
                : prev,
            );
            if (amQuestioner) playCorrect();
          } else if (msg.reason === BuzzerCloseReason.Incorrect) {
            // Winner is cleared on the server; the paired BuzzerOpened that
            // follows will bring in the fresh questionId + new excluded list.
            setBuzzer({ open: false, winner: undefined });
            if (amQuestioner) playIncorrect();
          } else if (msg.reason === BuzzerCloseReason.Ended) {
            setRoom((prev) =>
              prev
                ? { ...prev, questionNumber: msg.questionNumber ?? prev.questionNumber, buzzer: { open: false } }
                : prev,
            );
          } else {
            // Manual / QuestionerLeft / QuestionerChanged — question session over.
            setRoom((prev) =>
              prev
                ? { ...prev, questionNumber: msg.questionNumber ?? prev.questionNumber, buzzer: { open: false } }
                : prev,
            );
            if (msg.reason === BuzzerCloseReason.QuestionerLeft) {
              pushToast("Buzzer closed — questioner left");
            } else if (msg.reason === BuzzerCloseReason.QuestionerChanged) {
              pushToast("Buzzer closed — questioner changed");
            }
          }
          return;
        }
        case MessageType.BuzzesReported:
          setBuzzer({ buzzes: msg.buzzes });
          return;
        case MessageType.Error:
          setLastError(msg);
          if (msg.code === ErrorCode.RoomNotFound) {
            setRoomEnded(true);
            storage.activeRoom.clear();
          }
          return;
      }
    },
    [
      playCorrect,
      playIncorrect,
      playOpen,
      pushToast,
      room,
      setBuzzer,
      speakName,
      updatePlayer,
    ],
  );

  useServerMessages(handle);

  const createRoom = useCallback(
    (name: string) => {
      storage.playerName.set(name);
      socket.send({
        type: MessageType.CreateRoom,
        playerName: name,
        clientToken: getClientToken(),
      });
    },
    [socket],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      storage.playerName.set(name);
      socket.send({
        type: MessageType.JoinRoom,
        roomCode: code,
        playerName: name,
        clientToken: getClientToken(),
      });
    },
    [socket],
  );

  const leaveRoom = useCallback(() => {
    socket.send({ type: MessageType.LeaveRoom });
    storage.activeRoom.clear();
    setRoom(null);
    setYou(null);
  }, [socket]);

  const openBuzzer = useCallback(
    () => socket.send({ type: MessageType.BuzzerOpen }),
    [socket],
  );
  const closeBuzzer = useCallback(
    () => socket.send({ type: MessageType.BuzzerClose }),
    [socket],
  );
  const buzz = useCallback(() => {
    const qid = room?.buzzer.questionId;
    if (!qid || !room?.buzzer.open) return;
    socket.send({ type: MessageType.Buzz, questionId: qid, buzzedAt: serverNow() });
  }, [socket, room]);

  const markCorrect = useCallback(
    (points: number) => socket.send({ type: MessageType.MarkCorrect, points }),
    [socket],
  );
  const markIncorrect = useCallback(
    () => socket.send({ type: MessageType.MarkIncorrect }),
    [socket],
  );
  const endQuestion = useCallback(
    () => socket.send({ type: MessageType.EndQuestion }),
    [socket],
  );

  const changeQuestioner = useCallback(
    (id: PlayerId) =>
      socket.send({ type: MessageType.ChangeQuestioner, newQuestionerId: id }),
    [socket],
  );

  const clearError = useCallback(() => setLastError(null), []);

  const resetRoom = useCallback(() => {
    setRoom(null);
    setYou(null);
    setRoomEnded(false);
    storage.activeRoom.clear();
  }, []);

  const value = useMemo<RoomStoreValue>(
    () => ({
      room,
      you,
      lastError,
      connectionStatus: status,
      roomEnded,
      toasts,
      createRoom,
      joinRoom,
      leaveRoom,
      openBuzzer,
      closeBuzzer,
      buzz,
      markCorrect,
      markIncorrect,
      endQuestion,
      changeQuestioner,
      dismissToast,
      clearError,
      resetRoom,
    }),
    [
      room,
      you,
      lastError,
      status,
      roomEnded,
      toasts,
      createRoom,
      joinRoom,
      leaveRoom,
      openBuzzer,
      closeBuzzer,
      buzz,
      markCorrect,
      markIncorrect,
      endQuestion,
      changeQuestioner,
      dismissToast,
      clearError,
      resetRoom,
    ],
  );

  return (
    <RoomStoreContext.Provider value={value}>
      {children}
    </RoomStoreContext.Provider>
  );
};

export const useRoomStore = (): RoomStoreValue => {
  const ctx = useContext(RoomStoreContext);
  if (!ctx) throw new Error("useRoomStore used outside RoomStoreProvider");
  return ctx;
};
