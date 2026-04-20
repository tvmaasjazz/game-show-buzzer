let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

interface ToneOpts {
  type?: OscillatorType;
  startFreq: number;
  endFreq?: number;
  duration: number;
  gain?: number;
}

const tone = ({ type = "sine", startFreq, endFreq, duration, gain = 0.25 }: ToneOpts): void => {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  osc.type = type;
  const t0 = c.currentTime;
  osc.frequency.setValueAtTime(startFreq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

const chord = (freqs: number[], duration: number, gain: number): void => {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
};

export const audio = {
  // Fires when the questioner opens a question — short rising "ding".
  playOpen(): void {
    tone({ type: "sine", startFreq: 420, endFreq: 880, duration: 0.18, gain: 0.25 });
  },
  // Fires when a contestant slaps the buzzer (local only).
  playClick(): void {
    tone({ type: "square", startFreq: 900, endFreq: 500, duration: 0.06, gain: 0.18 });
  },
  // Positive two-note major-third — C5 then E5+G5 layered.
  playCorrect(): void {
    tone({ type: "sine", startFreq: 523, duration: 0.18, gain: 0.22 });
    window.setTimeout(() => chord([659, 784], 0.28, 0.18), 130);
  },
  // Short low sawtooth buzz that pitches down.
  playIncorrect(): void {
    tone({ type: "sawtooth", startFreq: 220, endFreq: 110, duration: 0.32, gain: 0.25 });
  },
  // Primes the audio context on a user gesture. Safe to call multiple times.
  prime(): void {
    getCtx();
  },
};
