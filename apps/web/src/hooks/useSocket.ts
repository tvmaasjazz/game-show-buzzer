import { useEffect, useRef, useState } from "react";
import type { ServerMessage } from "@buzzer/shared";
import { createSocket, TypedSocket } from "../lib/socket";

let singleton: TypedSocket | null = null;

export const getSocket = (): TypedSocket => {
  if (!singleton) singleton = createSocket();
  return singleton;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const useSocket = () => {
  const socket = getSocket();
  const [status, setStatus] = useState<ConnectionStatus>(
    socket.raw.connected ? "connected" : "connecting",
  );

  useEffect(() => {
    const offConn = socket.onConnect(() => setStatus("connected"));
    const offDisc = socket.onDisconnect(() => setStatus("disconnected"));
    return () => {
      offConn();
      offDisc();
    };
  }, [socket]);

  return { socket, status };
};

export const useServerMessages = (
  handler: (msg: ServerMessage) => void,
): void => {
  const socket = getSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => socket.on((m) => ref.current(m)), [socket]);
};
