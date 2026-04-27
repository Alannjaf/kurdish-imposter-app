// PartyClient: WebSocket wrapper with reconnect + queue.
//
// Used by the Expo app on web + native. WebSocket is built-in on both.
// `playerId` is persisted in AsyncStorage so reconnects re-seat the same player.

import EventEmitter from 'eventemitter3';
import type { C2S, S2C, PublicRoomState } from './protocol';

// AsyncStorage and expo-crypto are imported lazily/defensively so the module
// stays importable in plain Node test environments where neither is available.
type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

let _asyncStorage: AsyncStorageLike | null | undefined;
function getAsyncStorage(): AsyncStorageLike | null {
  if (_asyncStorage !== undefined) return _asyncStorage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    _asyncStorage = (mod && (mod.default || mod)) as AsyncStorageLike;
  } catch {
    _asyncStorage = null;
  }
  return _asyncStorage;
}

function generateUUID(): string {
  // Prefer the platform-native crypto.randomUUID (RN 0.74+ Hermes, modern web).
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }
  // Try expo-crypto as a fallback for older RN runtimes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoCrypto = require('expo-crypto');
    if (expoCrypto && typeof expoCrypto.randomUUID === 'function') {
      return expoCrypto.randomUUID();
    }
  } catch {
    // ignore
  }
  // Last-resort RFC4122-ish polyfill (sufficient for client-side player ids).
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const hex = (n: number) => n.toString(16);
  const part = (len: number) =>
    Array.from({ length: len }, () => hex(rnd(16))).join('');
  return `${part(8)}-${part(4)}-4${part(3)}-${hex(8 + rnd(4))}${part(3)}-${part(12)}`;
}

const PLAYER_ID_KEY = 'imposter:playerId';
const MAX_QUEUE = 50;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

export type PartyClientEvents = {
  state: (state: PublicRoomState) => void;
  role: (role: { isImposter: boolean; word: string | null; roundId: number }) => void;
  chat: (msg: { fromSeat: number; fromName: string; text: string; ts: number }) => void;
  error: (err: { code: string; message: string }) => void;
  kicked: (reason: string) => void;
  connected: () => void;
  disconnected: () => void;
};

export type PartyClientOptions = {
  host: string;
  // Optional override for tests / non-browser environments.
  WebSocketImpl?: typeof WebSocket;
};

export class PartyClient extends EventEmitter<PartyClientEvents> {
  private host: string;
  private WS: typeof WebSocket;

  private ws: WebSocket | null = null;
  private roomCode: string | null = null;
  private name: string = '';
  private asHost: boolean = false;

  private playerId: string | null = null;
  private playerIdPromise: Promise<string> | null = null;

  private outboundQueue: C2S[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitlyClosed = false;

  constructor(opts: PartyClientOptions) {
    super();
    this.host = opts.host.replace(/\/+$/, '');
    this.WS = opts.WebSocketImpl ?? (globalThis as any).WebSocket;
    if (!this.WS) {
      throw new Error('PartyClient: no WebSocket implementation available');
    }
  }

  /** Reads stored playerId from AsyncStorage; mints a new one on first run. */
  async getOrCreatePlayerId(): Promise<string> {
    if (this.playerId) return this.playerId;
    if (this.playerIdPromise) return this.playerIdPromise;
    this.playerIdPromise = (async () => {
      const storage = getAsyncStorage();
      if (storage) {
        try {
          const existing = await storage.getItem(PLAYER_ID_KEY);
          if (existing && typeof existing === 'string' && existing.length > 0) {
            this.playerId = existing;
            return existing;
          }
        } catch {
          // ignore storage read failure; mint fresh
        }
      }
      const fresh = generateUUID();
      this.playerId = fresh;
      if (storage) {
        try {
          await storage.setItem(PLAYER_ID_KEY, fresh);
        } catch {
          // ignore storage write failure
        }
      }
      return fresh;
    })();
    return this.playerIdPromise;
  }

  async connect(roomCode: string, name: string, asHost: boolean = false): Promise<void> {
    this.explicitlyClosed = false;
    this.roomCode = roomCode;
    this.name = name;
    this.asHost = asHost;
    await this.getOrCreatePlayerId();
    this.openSocket();
  }

  private openSocket(): void {
    if (this.ws) {
      try {
        this.ws.onopen = null as any;
        this.ws.onclose = null as any;
        this.ws.onerror = null as any;
        this.ws.onmessage = null as any;
      } catch {
        /* noop */
      }
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
    if (!this.roomCode) return;
    const url = `${this.host}/parties/main/${this.roomCode}`;
    const ws = new this.WS(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Send hello immediately on every (re)connect with the same playerId.
      const helloMsg: C2S = {
        type: 'hello',
        playerId: this.playerId ?? '',
        name: this.name,
        ...(this.asHost ? { asHost: true } : {}),
      };
      this.rawSend(helloMsg);
      // Flush any queued outbound messages from the disconnected period.
      const queued = this.outboundQueue;
      this.outboundQueue = [];
      for (const msg of queued) this.rawSend(msg);
      this.emit('connected');
    };

    ws.onmessage = (ev: MessageEvent) => {
      let parsed: S2C;
      try {
        parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      this.handleServerMessage(parsed);
    };

    ws.onerror = () => {
      // Surface as an 'error' event but let onclose drive reconnects.
      this.emit('error', { code: 'socket_error', message: 'WebSocket error' });
    };

    ws.onclose = () => {
      this.ws = null;
      this.emit('disconnected');
      if (!this.explicitlyClosed) this.scheduleReconnect();
    };
  }

  private handleServerMessage(msg: S2C): void {
    switch (msg.type) {
      case 'state':
        this.emit('state', msg.state);
        break;
      case 'role':
        this.emit('role', {
          isImposter: msg.isImposter,
          word: msg.word,
          roundId: msg.roundId,
        });
        break;
      case 'chat':
        this.emit('chat', {
          fromSeat: msg.fromSeat,
          fromName: msg.fromName,
          text: msg.text,
          ts: msg.ts,
        });
        break;
      case 'error':
        this.emit('error', { code: msg.code, message: msg.message });
        break;
      case 'kicked':
        this.emit('kicked', msg.reason);
        break;
      default:
        // Unknown message type — ignore for forward-compat.
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.explicitlyClosed) return;
    if (this.reconnectTimer) return;
    const idx = Math.min(this.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1);
    const delay = RECONNECT_DELAYS_MS[idx];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  /** JSON-encodes and sends; queues up to 50 messages while disconnected. */
  send(msg: C2S): void {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.rawSend(msg);
      return;
    }
    if (this.outboundQueue.length >= MAX_QUEUE) {
      // Drop oldest to make room for newest — bounded buffer.
      this.outboundQueue.shift();
    }
    this.outboundQueue.push(msg);
  }

  private rawSend(msg: C2S): void {
    if (!this.ws) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      // If send throws, queue for retry on next reconnect.
      if (this.outboundQueue.length < MAX_QUEUE) this.outboundQueue.push(msg);
    }
  }

  /** Clean close; will not auto-reconnect afterwards. */
  disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
    this.outboundQueue = [];
  }

  /** For tests + integration: current socket readyState (or -1 if none). */
  get readyState(): number {
    return this.ws ? this.ws.readyState : -1;
  }
}

export default PartyClient;
