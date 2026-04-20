import { useEffect, useRef } from "react";
import { MessageType } from "@buzzer/shared";
import type { ServerMessage } from "@buzzer/shared";
import { getSocket } from "./useSocket";

// Module-level so all components share one offset.
let clockOffsetMs = 0;

// Returns the estimated current server time using the measured clock offset.
export const serverNow = (): number => Date.now() + clockOffsetMs;

const SAMPLE_COUNT = 5;

export const useClockSync = (): void => {
  const socket = getSocket();
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    const runSync = () => {
      samplesRef.current = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        setTimeout(() => {
          socket.send({ type: MessageType.Ping, clientTime: Date.now() });
        }, i * 50);
      }
    };

    const off = socket.on((msg: ServerMessage) => {
      if (msg.type !== MessageType.Pong) return;
      const now = Date.now();
      const roundTrip = now - msg.clientTime;
      const offset = msg.serverTime + roundTrip / 2 - now;
      samplesRef.current.push(offset);
      if (samplesRef.current.length >= SAMPLE_COUNT) {
        // Median discards outlier round-trip spikes.
        const sorted = [...samplesRef.current].sort((a, b) => a - b);
        clockOffsetMs = sorted[Math.floor(sorted.length / 2)]!;
      }
    });

    runSync();
    const interval = setInterval(runSync, 30_000);
    const offConn = socket.onConnect(runSync);

    return () => {
      off();
      offConn();
      clearInterval(interval);
    };
  }, [socket]);
};
