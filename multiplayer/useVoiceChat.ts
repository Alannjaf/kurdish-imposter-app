// useVoiceChat — wraps VoiceMeshController + the PartyClient's rtc_signal
// stream into a React hook that yields a simple { active, muted, toggle, setMuted }
// surface for the UI. Web-only — does nothing on native (RTCPeerConnection
// is undefined there).

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
};

export function useVoiceChat({ client, myPlayerId, peers }: UseVoiceChatOpts): UseVoiceChatResult {
  const [active, setActive] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const ctrlRef = useRef<VoiceMeshController | null>(null);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

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
      setActive(false);
      setMutedState(false);
      return;
    }
    try {
      const c = new VoiceMeshController(send, myPlayerId, {
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
        },
      });
      await c.start(peers);
      ctrlRef.current = c;
      setActive(true);
      setLastError(null);
    } catch (e) {
      setLastError(String(e));
    }
  }, [active, available, myPlayerId, peers, send]);

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
    };
  }, []);

  return { active, muted, available, toggle, setMuted, lastError };
}
