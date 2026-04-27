// Test harness — drives RoomState with synthetic messages and captures outputs.
// No real WebSockets, no PartyKit runtime.

import { RoomState } from '../src/room';
import type { C2S, S2C } from '../src/protocol';

export type Captured =
  | { kind: 'broadcast'; msg: S2C }
  | { kind: 'send'; to: string; msg: S2C };

export class Harness {
  room: RoomState;
  log: Captured[] = [];
  now = 1_000_000; // synthetic clock; tests advance with `advance()`.
  alarmAt: number | null = null;

  constructor(code = 'TEST', rng?: () => number) {
    this.room = new RoomState(code, {
      send: (to, msg) => this.log.push({ kind: 'send', to, msg }),
      broadcast: (msg) => this.log.push({ kind: 'broadcast', msg }),
      now: () => this.now,
      setAlarm: (at) => {
        this.alarmAt = at;
      },
      rng: rng ?? makeSeededRng(42),
    });
  }

  // ----- Driving -----

  connect(playerId: string, name: string): void {
    this.room.onConnect(playerId);
    this.room.onMessage(playerId, { type: 'hello', playerId, name });
  }

  send(playerId: string, msg: C2S): void {
    this.room.onMessage(playerId, msg);
  }

  disconnect(playerId: string): void {
    this.room.onDisconnect(playerId);
  }

  advance(ms: number): void {
    this.now += ms;
    if (this.alarmAt != null && this.now >= this.alarmAt) {
      this.alarmAt = null;
      this.room.tick();
    }
  }

  // ----- Assertions / helpers -----

  state() {
    return this.room.publicState();
  }

  /** All broadcasts of type `state`, newest last. */
  states(): S2C[] {
    return this.log.filter((c) => c.kind === 'broadcast' && c.msg.type === 'state').map((c) => c.msg);
  }

  /** All `role` messages received by a given playerId. */
  rolesFor(playerId: string): Array<Extract<S2C, { type: 'role' }>> {
    return this.log
      .filter(
        (c): c is Extract<Captured, { kind: 'send' }> =>
          c.kind === 'send' && c.to === playerId && c.msg.type === 'role'
      )
      .map((c) => c.msg as Extract<S2C, { type: 'role' }>);
  }

  /** All errors received by a given playerId. */
  errorsFor(playerId: string): Array<Extract<S2C, { type: 'error' }>> {
    return this.log
      .filter(
        (c): c is Extract<Captured, { kind: 'send' }> =>
          c.kind === 'send' && c.to === playerId && c.msg.type === 'error'
      )
      .map((c) => c.msg as Extract<S2C, { type: 'error' }>);
  }

  /** All chat broadcasts. */
  chats(): Array<Extract<S2C, { type: 'chat' }>> {
    return this.log
      .filter(
        (c): c is Extract<Captured, { kind: 'broadcast' }> =>
          c.kind === 'broadcast' && c.msg.type === 'chat'
      )
      .map((c) => c.msg as Extract<S2C, { type: 'chat' }>);
  }

  clear(): void {
    this.log = [];
  }
}

// ----- Deterministic RNG -----

export function makeSeededRng(seed: number): () => number {
  // Mulberry32 — small, deterministic, good enough for tests.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helper: connect N players named P0..P(N-1). Returns their playerIds. */
export function connectPlayers(h: Harness, n: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p${i}`;
    h.connect(id, `Name${i}`);
    ids.push(id);
  }
  return ids;
}
