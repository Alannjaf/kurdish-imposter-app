// Synthetic sound effects via Web Audio API.
//
// All sounds are synthesized on the fly with OscillatorNode + GainNode envelopes
// — no audio files in the bundle. On web this works natively. On native (RN),
// `AudioContext` is undefined; every `play()` call falls through a try/catch and
// becomes a no-op gracefully.
//
// Usage:
//   play('tap');
//   const [muted, setMuted] = useMuted();   // hook, persists via AsyncStorage
//
// The mute state is module-scoped (single source of truth) and mirrored into
// React via the MuteProvider. Changes from any subscriber update everyone.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoundName =
  | 'tap'
  | 'pass'
  | 'reveal_word'
  | 'reveal_imposter'
  | 'vote_confirm'
  | 'win'
  | 'lose';

const STORAGE_KEY = 'app.muted.v1';

// ─── Module-scoped state ─────────────────────────────────────────
let mutedState = false;
let cachedCtx: AudioContext | null = null;
let unlockListenerInstalled = false;
let unlocked = false;

type AudioContextCtor = typeof AudioContext;

function getAudioContext(): AudioContext | null {
  if (cachedCtx) return cachedCtx;
  try {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      AudioContext?: AudioContextCtor;
      webkitAudioContext?: AudioContextCtor;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    cachedCtx = new Ctor();
    return cachedCtx;
  } catch {
    return null;
  }
}

// Resume an autoplay-blocked context on the first user gesture.
function ensureRunning(ctx: AudioContext): void {
  try {
    if (ctx.state === 'suspended') {
      // resume() returns a promise — we don't need to await.
      ctx.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

// One-time silent oscillator burst to fully wake the context. Mobile Safari
// requires that the FIRST sound after unlock be scheduled inside the gesture
// stack — so we run this synchronously from the unlock handler.
function primeContext(ctx: AudioContext): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    // ignore
  }
}

// Install a one-shot global listener that unlocks the AudioContext on the
// first real user interaction. This handles cases where the first sound is
// fired from a useEffect (e.g. reveal screen) rather than a tap handler —
// by the time that effect runs, the context is already unlocked.
function installUnlockListener(): void {
  if (unlockListenerInstalled) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  unlockListenerInstalled = true;

  const events = ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'click', 'keydown'];

  const handler = () => {
    const ctx = getAudioContext();
    if (ctx) {
      ensureRunning(ctx);
      primeContext(ctx);
    }
    unlocked = true;
    events.forEach((e) => {
      try {
        document.removeEventListener(e, handler, true);
      } catch {
        // ignore
      }
    });
  };

  events.forEach((e) => {
    try {
      document.addEventListener(e, handler, { capture: true, passive: true } as AddEventListenerOptions);
    } catch {
      // ignore
    }
  });
}

// Try to install the unlock listener at module load (web only — guarded).
installUnlockListener();

// ─── Envelope helpers ────────────────────────────────────────────
type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function tone(
  ctx: AudioContext,
  opts: {
    type?: OscType;
    freq: number;
    freqEnd?: number;
    start: number;
    duration: number;
    peak?: number;     // peak gain (0..1)
    attack?: number;   // seconds
    release?: number;  // seconds, defaults to remaining time
  }
): void {
  const {
    type = 'sine',
    freq,
    freqEnd,
    start,
    duration,
    peak = 0.18,
    attack = 0.005,
    release,
  } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
  }
  // Envelope: 0 → peak (attack), peak → 0 (release)
  const rel = release ?? Math.max(0.01, duration - attack);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + rel);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// ─── Sound recipes ───────────────────────────────────────────────
function playTap(ctx: AudioContext, t0: number): void {
  // 50ms blip ~600 Hz
  tone(ctx, { type: 'sine', freq: 600, start: t0, duration: 0.05, peak: 0.18, attack: 0.003 });
}

function playPass(ctx: AudioContext, t0: number): void {
  // 200ms upward sweep 400 → 800 Hz
  tone(ctx, {
    type: 'triangle',
    freq: 400,
    freqEnd: 800,
    start: t0,
    duration: 0.2,
    peak: 0.18,
    attack: 0.01,
  });
}

function playRevealWord(ctx: AudioContext, t0: number): void {
  // Soft bell — fundamental 880 Hz + 1.5x harmonic, 400ms decay
  tone(ctx, {
    type: 'sine',
    freq: 880,
    start: t0,
    duration: 0.45,
    peak: 0.22,
    attack: 0.005,
    release: 0.4,
  });
  tone(ctx, {
    type: 'sine',
    freq: 1320,
    start: t0,
    duration: 0.45,
    peak: 0.08,
    attack: 0.005,
    release: 0.4,
  });
}

function playRevealImposter(ctx: AudioContext, t0: number): void {
  // Low ominous sting ~150 Hz, 800ms decay; sawtooth for menace
  tone(ctx, {
    type: 'sawtooth',
    freq: 150,
    start: t0,
    duration: 0.85,
    peak: 0.18,
    attack: 0.02,
    release: 0.78,
  });
  // Subtle dissonant minor third up (180 Hz) at half volume
  tone(ctx, {
    type: 'sine',
    freq: 180,
    start: t0,
    duration: 0.85,
    peak: 0.07,
    attack: 0.02,
    release: 0.78,
  });
}

function playVoteConfirm(ctx: AudioContext, t0: number): void {
  // A + E perfect-fifth chord, 250ms
  tone(ctx, { type: 'sine', freq: 440, start: t0, duration: 0.28, peak: 0.18, attack: 0.005, release: 0.25 });
  tone(ctx, { type: 'sine', freq: 660, start: t0, duration: 0.28, peak: 0.14, attack: 0.005, release: 0.25 });
}

function playWin(ctx: AudioContext, t0: number): void {
  // Happy C major chord (C E G), 600ms — slight stagger for arpeggio feel
  tone(ctx, { type: 'sine', freq: 523.25, start: t0,        duration: 0.65, peak: 0.18, attack: 0.005, release: 0.6 });
  tone(ctx, { type: 'sine', freq: 659.25, start: t0 + 0.04, duration: 0.65, peak: 0.16, attack: 0.005, release: 0.6 });
  tone(ctx, { type: 'sine', freq: 783.99, start: t0 + 0.08, duration: 0.65, peak: 0.15, attack: 0.005, release: 0.6 });
}

function playLose(ctx: AudioContext, t0: number): void {
  // Minor chord (A C E) descending, 800ms
  tone(ctx, { type: 'triangle', freq: 659.25, start: t0,        duration: 0.85, peak: 0.16, attack: 0.005, release: 0.8 });
  tone(ctx, { type: 'triangle', freq: 523.25, start: t0 + 0.08, duration: 0.85, peak: 0.16, attack: 0.005, release: 0.75 });
  tone(ctx, { type: 'triangle', freq: 440,    start: t0 + 0.16, duration: 0.85, peak: 0.18, attack: 0.005, release: 0.7 });
}

const RECIPES: Record<SoundName, (ctx: AudioContext, t0: number) => void> = {
  tap: playTap,
  pass: playPass,
  reveal_word: playRevealWord,
  reveal_imposter: playRevealImposter,
  vote_confirm: playVoteConfirm,
  win: playWin,
  lose: playLose,
};

// ─── Public API ──────────────────────────────────────────────────
export function play(name: SoundName): void {
  if (mutedState) return;
  try {
    // Make sure the listener is in place even if module-init was too early.
    if (!unlockListenerInstalled) installUnlockListener();
    const ctx = getAudioContext();
    if (!ctx) return;
    ensureRunning(ctx);
    if (!unlocked) primeContext(ctx);
    const recipe = RECIPES[name];
    if (!recipe) return;
    // Schedule a few ms in the future so freshly-resumed contexts don't drop
    // the very first event due to a stale currentTime on iOS Safari.
    const t0 = ctx.currentTime + 0.02;
    recipe(ctx, t0);
  } catch {
    // best-effort — never break the UI for a sound failure
  }
}

const subscribers = new Set<(muted: boolean) => void>();

export function setMuted(muted: boolean): void {
  mutedState = muted;
  subscribers.forEach((s) => {
    try {
      s(muted);
    } catch {
      // ignore subscriber errors
    }
  });
  AsyncStorage.setItem(STORAGE_KEY, muted ? '1' : '0').catch(() => {
    // best-effort
  });
}

export function isMuted(): boolean {
  return mutedState;
}

// ─── React provider + hook ───────────────────────────────────────
type MuteContextValue = {
  muted: boolean;
  setMuted: (next: boolean) => void;
};

const MuteContext = createContext<MuteContextValue | null>(null);

export function MuteProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMutedReact] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved === '1') {
          mutedState = true;
          setMutedReact(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep React state in sync with module-scoped state for any imperative
  // setMuted() calls from outside the hook.
  useEffect(() => {
    const sub = (next: boolean) => setMutedReact(next);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    setMuted(next);
  }, []);

  const value = useMemo<MuteContextValue>(
    () => ({ muted, setMuted: update }),
    [muted, update]
  );

  // Match other providers' hydration gate for consistency.
  if (!hydrated) return null;

  return React.createElement(MuteContext.Provider, { value }, children);
}

export function useMuted(): [boolean, (next: boolean) => void] {
  const ctx = useContext(MuteContext);
  if (!ctx) {
    // Outside the provider — return module state with a working setter.
    return [mutedState, setMuted];
  }
  return [ctx.muted, ctx.setMuted];
}
