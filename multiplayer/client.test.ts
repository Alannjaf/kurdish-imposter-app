// Vitest unit tests for PartyClient. Hand-rolled mock WebSocket — keeps the
// dep surface small and makes the open/close lifecycle fully deterministic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory AsyncStorage mock — must be registered BEFORE importing client.ts
// so the lazy require() inside client.ts picks this up.
const memStore = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (memStore.has(k) ? memStore.get(k)! : null),
    setItem: async (k: string, v: string) => {
      memStore.set(k, v);
    },
  },
}));

import { PartyClient } from './client';
import type { C2S, S2C } from './protocol';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type MockSocketHandlers = {
  onopen: ((this: any, ev: any) => any) | null;
  onclose: ((this: any, ev: any) => any) | null;
  onerror: ((this: any, ev: any) => any) | null;
  onmessage: ((this: any, ev: any) => any) | null;
};

class MockWebSocket implements MockSocketHandlers {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((this: any, ev: any) => any) | null = null;
  onclose: ((this: any, ev: any) => any) | null = null;
  onerror: ((this: any, ev: any) => any) | null = null;
  onmessage: ((this: any, ev: any) => any) | null = null;

  sentRaw: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentRaw.push(data);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose.call(this, { code: 1000, reason: 'closed' });
  }

  // Test helpers -----------------------------------------------------------

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen.call(this, {});
  }

  simulateMessage(payload: S2C) {
    if (this.onmessage) {
      this.onmessage.call(this, { data: JSON.stringify(payload) });
    }
  }

  simulateRemoteClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose.call(this, { code: 1006, reason: 'lost' });
  }

  get sent(): C2S[] {
    return this.sentRaw.map((s) => JSON.parse(s) as C2S);
  }
}

function lastInstance(): MockWebSocket {
  const inst = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!inst) throw new Error('no MockWebSocket instance created yet');
  return inst;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartyClient', () => {
  beforeEach(() => {
    memStore.clear();
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends hello automatically on open after connect()', async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    await client.connect('ABCD', 'Alan');
    const ws = lastInstance();
    expect(ws.url).toBe('wss://example.test/parties/main/ABCD');

    ws.simulateOpen();

    expect(ws.sent.length).toBe(1);
    const hello = ws.sent[0];
    expect(hello.type).toBe('hello');
    if (hello.type === 'hello') {
      expect(hello.name).toBe('Alan');
      expect(typeof hello.playerId).toBe('string');
      expect(hello.playerId.length).toBeGreaterThan(0);
    }
  });

  it('queues messages while disconnected and flushes on (re)connect', async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    // Send before connect — should queue.
    client.send({ type: 'chat', text: 'hello-while-offline' });

    await client.connect('ROOM', 'Bob');
    const ws = lastInstance();
    // Still not OPEN yet — additional sends keep queuing.
    client.send({ type: 'start' });

    expect(ws.sent.length).toBe(0);

    ws.simulateOpen();

    // After open: hello first, then queued messages flushed in order.
    const types = ws.sent.map((m) => m.type);
    expect(types[0]).toBe('hello');
    expect(types).toContain('chat');
    expect(types).toContain('start');
    // Order: hello, then chat (queued first), then start.
    expect(types).toEqual(['hello', 'chat', 'start']);
  });

  it('reconnects with the same playerId after remote close', async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    await client.connect('ROOM', 'Carol');
    const ws1 = lastInstance();
    ws1.simulateOpen();
    const hello1 = ws1.sent[0];
    expect(hello1.type).toBe('hello');
    const firstPlayerId =
      hello1.type === 'hello' ? hello1.playerId : '<missing>';

    // Simulate connection drop.
    ws1.simulateRemoteClose();

    // Advance timer past first reconnect delay (1000ms).
    await vi.advanceTimersByTimeAsync(1100);

    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = lastInstance();
    ws2.simulateOpen();

    const hello2 = ws2.sent[0];
    expect(hello2.type).toBe('hello');
    if (hello2.type === 'hello') {
      expect(hello2.playerId).toBe(firstPlayerId);
      expect(hello2.name).toBe('Carol');
    }
  });

  it("emits 'state' event with the parsed payload", async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    await client.connect('ROOM', 'D');
    const ws = lastInstance();
    ws.simulateOpen();

    const received: any[] = [];
    client.on('state', (s) => received.push(s));

    const snapshot = {
      type: 'state' as const,
      state: {
        code: 'ROOM',
        hostPlayerId: 'p1',
        phase: 'lobby' as const,
        options: {
          categoryKey: 'general',
          imposterCount: 1,
          roundSeconds: 90,
          stealGuess: false,
        },
        players: [
          { seat: 0, playerId: 'p1', name: 'D', connected: true },
        ],
        roundId: 0,
        scores: { p1: 0 },
      },
    };
    ws.simulateMessage(snapshot);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual(snapshot.state);
  });

  it("emits 'role' event with parsed payload", async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    await client.connect('ROOM', 'E');
    const ws = lastInstance();
    ws.simulateOpen();

    const received: any[] = [];
    client.on('role', (r) => received.push(r));

    ws.simulateMessage({
      type: 'role',
      isImposter: true,
      word: null,
      roundId: 4,
    });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual({ isImposter: true, word: null, roundId: 4 });
  });

  it('does not auto-reconnect after explicit disconnect()', async () => {
    const client = new PartyClient({
      host: 'wss://example.test',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    await client.connect('ROOM', 'F');
    const ws = lastInstance();
    ws.simulateOpen();

    expect(MockWebSocket.instances.length).toBe(1);

    client.disconnect();

    // Advance well past the longest backoff window.
    await vi.advanceTimersByTimeAsync(20_000);

    expect(MockWebSocket.instances.length).toBe(1);
  });
});
