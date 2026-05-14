// React hook wrapping PartyClient: connects on mount, exposes state/role/chat/send/status.

import { useEffect, useRef, useState, useCallback } from 'react';
import { PartyClient } from './client';
import type { C2S, PublicRoomState } from './protocol';

export type ChatMessage = {
  fromSeat: number;
  fromName: string;
  text: string;
  ts: number;
};

export type RoleState = {
  isImposter: boolean;
  word: string | null;
  roundId: number;
};

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type UsePartyRoomOptions = {
  host: string;
  code: string | null;
  name: string;
  asHost?: boolean;
  /** Optional emoji avatar to send with hello. */
  avatar?: string;
};

export type UsePartyRoomResult = {
  state: PublicRoomState | null;
  role: RoleState | null;
  chat: ChatMessage[];
  send: (msg: C2S) => void;
  status: ConnectionStatus;
  lastError: string | null;
};

const CHAT_BUFFER_LIMIT = 100;

export function usePartyRoom(opts: UsePartyRoomOptions): UsePartyRoomResult {
  const { host, code, name, asHost, avatar } = opts;

  const clientRef = useRef<PartyClient | null>(null);

  const [state, setState] = useState<PublicRoomState | null>(null);
  const [role, setRole] = useState<RoleState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  const send = useCallback((msg: C2S) => {
    const c = clientRef.current;
    if (!c) return;
    c.send(msg);
  }, []);

  useEffect(() => {
    if (!code) {
      setStatus('idle');
      return;
    }

    // Reset per-connection state so a code switch doesn't show stale data.
    setState(null);
    setRole(null);
    setChat([]);
    setLastError(null);
    setStatus('connecting');

    const client = new PartyClient({ host });
    clientRef.current = client;

    client.on('state', (next: PublicRoomState) => {
      setState(next);
      // If the round advanced, drop any role kept from a prior round.
      setRole((prev) => {
        if (!prev) return prev;
        if (prev.roundId !== next.roundId) return null;
        return prev;
      });
    });

    client.on('role', (r) => {
      setRole((prev) => {
        // Replace whenever the incoming role is for the current or a newer round.
        if (!prev || r.roundId >= prev.roundId) return r;
        return prev;
      });
    });

    client.on('chat', (m: ChatMessage) => {
      setChat((prev) => {
        const next = prev.concat(m);
        if (next.length > CHAT_BUFFER_LIMIT) {
          return next.slice(next.length - CHAT_BUFFER_LIMIT);
        }
        return next;
      });
    });

    client.on('error', (err) => {
      setLastError(err.message || err.code);
      setStatus((s) => (s === 'connected' ? s : 'error'));
    });

    client.on('kicked', (reason) => {
      setLastError(`kicked: ${reason}`);
      setStatus('error');
    });

    client.on('connected', () => {
      setStatus('connected');
    });

    client.on('disconnected', () => {
      setStatus('disconnected');
    });

    client.connect(code, name, !!asHost, avatar).catch((e: unknown) => {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    });

    return () => {
      client.removeAllListeners();
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
    // We intentionally re-run on code/host/name/asHost/avatar changes.
  }, [host, code, name, asHost, avatar]);

  return { state, role, chat, send, status, lastError };
}

export default usePartyRoom;
