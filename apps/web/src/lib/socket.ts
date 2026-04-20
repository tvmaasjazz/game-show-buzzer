import { io, Socket } from "socket.io-client";
import type { ClientMessage, ServerMessage } from "@buzzer/shared";
import { apiUrl } from "./config";

const WS_EVENT = "message" as const;

export type TypedSocket = {
  raw: Socket;
  send: (msg: ClientMessage) => void;
  on: (handler: (msg: ServerMessage) => void) => () => void;
  onConnect: (handler: () => void) => () => void;
  onDisconnect: (handler: () => void) => () => void;
  disconnect: () => void;
};

export const createSocket = (): TypedSocket => {
  const raw = io(apiUrl, {
    autoConnect: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
  });

  const send = (msg: ClientMessage) => raw.emit(WS_EVENT, msg);

  const on = (handler: (msg: ServerMessage) => void) => {
    raw.on(WS_EVENT, handler);
    return () => {
      raw.off(WS_EVENT, handler);
    };
  };

  const onConnect = (handler: () => void) => {
    raw.on("connect", handler);
    return () => {
      raw.off("connect", handler);
    };
  };

  const onDisconnect = (handler: () => void) => {
    raw.on("disconnect", handler);
    return () => {
      raw.off("disconnect", handler);
    };
  };

  return {
    raw,
    send,
    on,
    onConnect,
    onDisconnect,
    disconnect: () => raw.disconnect(),
  };
};
