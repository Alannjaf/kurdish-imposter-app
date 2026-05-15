// useVoiceChat — wraps VoiceMeshController + the PartyClient's rtc_signal
// stream into a React hook that yields a simple { active, muted, toggle, setMuted }
// surface for the UI. Web-only — does nothing on native (RTCPeerConnection
// is undefined there).
//
// Also runs:
//   - Per-stream audio analysers (local + remote) so UI can show a
//     "currently speaking" indicator (returns `speakingPlayerIds: Set<string>`).
//   - iOS Safari autoplay-block detection — when audio.play() is rejected
//     with NotAllowedError, expose `audioBlocked: true` so the UI can show
//     a "tap to enable voice" hint. A single user gesture (click/touch)
//     unblocks playback for the remainder of the session.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { PartyClient } from './client';
import { VoiceMeshController } from './voiceChat';
import type { C2S } from './protocol';

export type UseVoiceChatOpts = {
  /** PartyClient handle — used to subscribe to rtc_signal events and to send. */
  client: PartyClient | null;
  /** My playerId — needed for deterministic offer-initiator ordering. */
  myPlayerId: string;
  /** Other connected players (excluding self). */
  peers: string[];
};

export type UseVoiceChatResult = {
  active: boolean;
  muted: boolean;
  available: boolean;
  toggle: () => Promise<void>;
  setMuted: (m: boolean) => void;
  lastError: string | null;
  /** PlayerIds (including own) whose audio level is above the speaking
   *  threshold right now. Updates ~5 times/sec when voice is active. */
  speakingPlayerIds: Set<string>;
  /** True iff at least one remote audio element failed to autoplay because
   *  the browser hasn't received a user gesture yet (iOS Safari). The UI
   *  should show a hint and call `unblockAudio()` from a tap handler. */
  audioBlocked: boolean;
  /** Resume any blocked <audio> elements. Must be called from a user gesture. */
  unblockAudio: () => Promise<void>;
};

// Speaking threshold — RMS of normalized [-1,1] samples. 0.04 ≈ quiet but
// intentional speech. Below this is background hum.
const SPEAKING_RMS_THRESHOLD = 0.04;
// Hysteresis: once detected, hold the "speaking" flag for this many ticks
// to avoid flicker on natural pauses between syllables.
const SPEAKING_HOLD_TICKS = 6;
const TICK_HZ = 12; // analyser samples per second

export function useVoiceChat({ client, myPlayerId, peers }: UseVoiceChatOpts): UseVoiceChatResult {
  const [active, setActive] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [speakingPlayerIds, setSpeakingPlayerIds] = useState<Set<string>>(new Set());
  const [audioBlocked, setAudioBlocked] = useState(false);
  const ctrlRef = useRef<VoiceMeshController | null>(null);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Audio-analyser state — one AudioContext shared across all streams, one
  // analyser node per stream (local + each remote peer).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; src: MediaStreamAudioSourceNode }>>(new Map());
  const holdRef = useRef<Map<string, number>>(new Map());
  const tickHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Available iff we're on web AND the browser has RTCPeerConnection.
  const available =
    Platform.OS === 'web' &&
    typeof (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  // Subscribe to incoming rtc_signal events whenever the client changes.
  useEffect(() => {
    if (!client) return;
    const onSignal = (msg: Parameters<Parameters<PartyClient['on']>[1]>[0]) => {
      ctrlRef.current?.handleSignal(msg as never);
    };
    client.on('rtc_signal', onSignal);
    return () => {
      try {
        client.off('rtc_signal', onSignal);
      } catch {
        // best effort
      }
    };
  }, [client]);

  // Reconcile peer set whenever it changes — start new offers / prune drops.
  useEffect(() => {
    const c = ctrlRef.current;
    if (!c || !active) return;
    c.pruneAbsent(new Set(peers));
    c.start(peers).catch((e) => setLastError(String(e)));
  }, [peers, active]);

  const send = useCallback(
    (msg: C2S) => {
      client?.send(msg);
    },
    [client]
  );

  // Lazily creates the shared AudioContext + adds an analyser for `stream`
  // keyed by `id`. Safe to call multiple times for the same id — idempotent.
  const attachAnalyser = useCallback((id: string, stream: MediaStream) => {
    if (typeof window === 'undefined') return;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (analysersRef.current.has(id)) return;
    try {
      const src = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      src.connect(analyser);
      // Intentionally NOT connecting to destination — audio is already
      // playing via the <audio> element. This is silent analysis only.
      analysersRef.current.set(id, { analyser, src });
    } catch {
      // MediaStream may have no audio track yet, or AudioContext blocked.
    }
  }, []);

  const detachAnalyser = useCallback((id: string) => {
    const entry = analysersRef.current.get(id);
    if (!entry) return;
    try {
      entry.src.disconnect();
      entry.analyser.disconnect();
    } catch {}
    analysersRef.current.delete(id);
    holdRef.current.delete(id);
  }, []);

  // Drives the speaking-detection loop. RMS of each analyser is computed
  // every 1000/TICK_HZ ms; ids above threshold (with hysteresis) populate
  // the speakingPlayerIds set.
  const startTickLoop = useCallback(() => {
    if (tickHandleRef.current) return;
    const buf = new Uint8Array(512);
    tickHandleRef.current = setInterval(() => {
      const newSpeaking = new Set<string>();
      for (const [id, entry] of analysersRef.current) {
        entry.analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const d = (buf[i] - 128) / 128;
          sumSq += d * d;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        const prevHold = holdRef.current.get(id) ?? 0;
        if (rms > SPEAKING_RMS_THRESHOLD) {
          holdRef.current.set(id, SPEAKING_HOLD_TICKS);
          newSpeaking.add(id);
        } else if (prevHold > 0) {
          holdRef.current.set(id, prevHold - 1);
          newSpeaking.add(id);
        }
      }
      // Only re-set state if the set actually changed (cheap shallow diff)
      // — saves needless React renders when nobody is talking.
      setSpeakingPlayerIds((prev) => {
        if (prev.size !== newSpeaking.size) return newSpeaking;
        for (const id of prev) if (!newSpeaking.has(id)) return newSpeaking;
        return prev;
      });
    }, Math.round(1000 / TICK_HZ));
  }, []);

  const stopTickLoop = useCallback(() => {
    if (tickHandleRef.current) {
      clearInterval(tickHandleRef.current);
      tickHandleRef.current = null;
    }
    setSpeakingPlayerIds((prev) => (prev.size === 0 ? prev : new Set()));
    holdRef.current.clear();
  }, []);

  // After mounting a hidden <audio> for a remote peer, try to play() it.
  // On iOS Safari + Chrome with autoplay policy=blocked, this rejects with
  // NotAllowedError until the document has received a user gesture. Mark
  // audioBlocked so the UI can show a "tap to hear" prompt.
  const tryPlay = useCallback((el: HTMLAudioElement) => {
    const p = el.play?.();
    if (p && typeof p.then === 'function') {
      p.catch((err: unknown) => {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'AbortError') {
          setAudioBlocked(true);
        }
      });
    }
  }, []);

  const unblockAudio = useCallback(async () => {
    let allOk = true;
    for (const el of audiosRef.current.values()) {
      try {
        await el.play();
      } catch {
        allOk = false;
      }
    }
    // AudioContext can also be in suspended state on iOS until a gesture.
    if (audioCtxRef.current?.state === 'suspended') {
      try { await audioCtxRef.current.resume(); } catch {}
    }
    if (allOk) setAudioBlocked(false);
  }, []);

  const toggle = useCallback(async () => {
    if (!available) {
      setLastError('Voice chat requires a browser microphone.');
      return;
    }
    if (active) {
      ctrlRef.current?.stop();
      ctrlRef.current = null;
      // Detach any rendered audio elements.
      for (const el of audiosRef.current.values()) {
        try {
          el.pause();
          el.srcObject = null;
          el.remove();
        } catch {}
      }
      audiosRef.current.clear();
      // Tear down all analysers + the audio context.
      for (const id of [...analysersRef.current.keys()]) detachAnalyser(id);
      stopTickLoop();
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
      setActive(false);
      setMutedState(false);
      setAudioBlocked(false);
      return;
    }
    try {
      const c = new VoiceMeshController(send, myPlayerId, {
        onLocalStream: (stream) => {
          attachAnalyser(myPlayerId, stream);
          startTickLoop();
        },
        onRemoteStream: (peerId, stream) => {
          // Mount a hidden <audio> per remote peer so the browser plays it.
          let el = audiosRef.current.get(peerId);
          if (!el) {
            el = document.createElement('audio');
            el.setAttribute('data-peer', peerId);
            el.autoplay = true;
            (el as unknown as { playsInline?: boolean }).playsInline = true;
            document.body.appendChild(el);
            audiosRef.current.set(peerId, el);
          }
          el.srcObject = stream;
          tryPlay(el);
          attachAnalyser(peerId, stream);
        },
        onPeerClosed: (peerId) => {
          const el = audiosRef.current.get(peerId);
          if (el) {
            try {
              el.pause();
              el.srcObject = null;
              el.remove();
            } catch {}
            audiosRef.current.delete(peerId);
          }
          detachAnalyser(peerId);
        },
      });
      await c.start(peers);
      ctrlRef.current = c;
      setActive(true);
      setLastError(null);
    } catch (e) {
      setLastError(String(e));
    }
  }, [active, available, myPlayerId, peers, send, attachAnalyser, detachAnalyser, startTickLoop, stopTickLoop, tryPlay]);

  const setMuted = useCallback((m: boolean) => {
    ctrlRef.current?.setMuted(m);
    setMutedState(m);
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      ctrlRef.current?.stop();
      ctrlRef.current = null;
      for (const el of audiosRef.current.values()) {
        try {
          el.remove();
        } catch {}
      }
      audiosRef.current.clear();
      stopTickLoop();
      for (const id of [...analysersRef.current.keys()]) detachAnalyser(id);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { active, muted, available, toggle, setMuted, lastError, speakingPlayerIds, audioBlocked, unblockAudio };
}
