// Runtime-agnostic room state machine for Kurdish Imposter online multiplayer.
//
// This module knows nothing about PartyKit / WebSockets. It exposes a class
// with `onConnect`, `onMessage`, `onDisconnect`, plus a `tick(now)` method
// driven by an external alarm. Tests instantiate it directly with synthetic
// callbacks; `index.ts` wires it to partyserver at runtime.

import {
  C2S,
  S2C,
  Phase,
  PublicRoomState,
  RoomOptions,
  RoundResult,
  PublicPlayer,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  VOTE_TIMER_MS,
  CHAT_MAX_LEN,
  CHAT_RATE_PER_PLAYER_PER_SEC,
} from './protocol';

import { dealGame, pickCategory, WORDS, type WordPair } from './words';

// ---------------------------------------------------------------------------
// Types

export type SendFn = (playerId: string, msg: S2C) => void;
export type BroadcastFn = (msg: S2C) => void;
export type NowFn = () => number;
/**
 * Schedules a one-shot alarm. The room calls `setAlarm(absoluteMs)` to ask the
 * host runtime to invoke `tick()` at that wall-clock time. Passing `null`
 * cancels any pending alarm. The host runtime is free to coalesce alarms.
 */
export type SetAlarmFn = (atMs: number | null) => void;

export type RoomDeps = {
  send: SendFn;
  broadcast: BroadcastFn;
  now?: NowFn;
  setAlarm?: SetAlarmFn;
  /** Used by tests to make `dealGame` deterministic. */
  rng?: () => number;
};

type InternalPlayer = {
  seat: number;
  playerId: string;
  name: string;
  connected: boolean;
  lastChatMs: number;
};

type ActiveRound = {
  roundId: number;
  pair: WordPair;
  imposterSeats: Set<number>;
  category: { key: string; label_ku: string; label_en: string };
  votes: Map<number, number>; // voterSeat -> targetSeat
  result?: RoundResult;
};

const DEFAULT_OPTIONS: RoomOptions = {
  categoryKey: 'food_drink',
  imposterCount: 1,
  roundSeconds: 180,
  stealGuess: false,
};

/** Grace window after a host's WS closes before the next player is promoted.
 *  Lets refresh / brief network blips recover host status when the original
 *  client reconnects with the same persisted playerId. */
const HOST_RECLAIM_GRACE_MS = 8000;

// ---------------------------------------------------------------------------
// Helpers

export function generateRoomCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Room

export class RoomState {
  readonly code: string;
  private players: InternalPlayer[] = [];
  private hostPlayerId: string | null = null;
  private phase: Phase = 'lobby';
  private options: RoomOptions = { ...DEFAULT_OPTIONS };
  private roundId = 0;
  private round: ActiveRound | null = null;
  private clueEndsAt: number | null = null;
  private voteEndsAt: number | null = null;
  /** When set, a host's WS just dropped — promotion deferred until this wall
   *  clock if the original host hasn't reconnected. */
  private hostReclaimDeadlineMs: number | null = null;
  /** Cumulative wins per playerId for the lifetime of this room. */
  private scores: Map<string, number> = new Map();

  private readonly send: SendFn;
  private readonly broadcast: BroadcastFn;
  private readonly nowFn: NowFn;
  private readonly setAlarmFn: SetAlarmFn;
  private readonly rng: () => number;

  constructor(code: string, deps: RoomDeps) {
    this.code = code;
    this.send = deps.send;
    this.broadcast = deps.broadcast;
    this.nowFn = deps.now ?? (() => Date.now());
    this.setAlarmFn = deps.setAlarm ?? (() => {});
    this.rng = deps.rng ?? Math.random;
  }

  // -------------------------------------------------------------------------
  // Public API

  /**
   * Called when a WebSocket attaches. Player seat resolution happens on
   * `hello` (we may not yet know the playerId at WS open time).
   */
  onConnect(_playerId: string): void {
    // Nothing to do until `hello` arrives — playerId is the trusted identity.
  }

  /** Called when a WebSocket detaches. */
  onDisconnect(playerId: string): void {
    const p = this.findPlayer(playerId);
    if (!p) return;
    p.connected = false;
    if (this.hostPlayerId === playerId) {
      const hasOtherConnected = this.players.some(
        (o) => o.playerId !== playerId && o.connected
      );
      if (hasOtherConnected) {
        // Defer promotion — original host has a grace window to reconnect.
        this.hostReclaimDeadlineMs = this.nowFn() + HOST_RECLAIM_GRACE_MS;
        this.rescheduleAlarm();
      } else {
        this.promoteHost();
      }
    }
    this.broadcastState();
  }

  onMessage(playerId: string, msg: C2S): void {
    switch (msg.type) {
      case 'hello':
        return this.handleHello(playerId, msg);
      case 'set_options':
        return this.handleSetOptions(playerId, msg);
      case 'start':
        return this.handleStart(playerId);
      case 'to_vote':
        return this.handleToVote(playerId);
      case 'vote':
        return this.handleVote(playerId, msg);
      case 'steal_guess':
        return this.handleStealGuess(playerId, msg);
      case 'next_round':
        return this.handleNextRound(playerId);
      case 'chat':
        return this.handleChat(playerId, msg);
      case 'leave':
        return this.handleLeave(playerId);
    }
  }

  /** Called by the runtime when the previously scheduled alarm fires. */
  tick(): void {
    const now = this.nowFn();
    // Process host reclaim first so phase transitions broadcast the final host.
    if (this.hostReclaimDeadlineMs != null && now >= this.hostReclaimDeadlineMs) {
      this.hostReclaimDeadlineMs = null;
      const stillDisconnected =
        this.hostPlayerId != null && !this.findPlayer(this.hostPlayerId)?.connected;
      if (stillDisconnected) {
        this.promoteHost();
        this.broadcastState();
      }
    }
    if (this.phase === 'clue' && this.clueEndsAt != null && now >= this.clueEndsAt) {
      this.enterVote();
      return;
    }
    if (this.phase === 'vote' && this.voteEndsAt != null && now >= this.voteEndsAt) {
      this.tallyAndReveal();
      return;
    }
    // No phase transition consumed the alarm; re-arm any remaining deadlines.
    this.rescheduleAlarm();
  }

  /** Inspector for tests. Returns the canonical broadcast snapshot. */
  publicState(): PublicRoomState {
    return this.snapshot();
  }

  // -------------------------------------------------------------------------
  // hello / join

  private handleHello(
    playerId: string,
    msg: Extract<C2S, { type: 'hello' }>
  ): void {
    const existing = this.findPlayer(playerId);
    if (existing) {
      // Reconnect: re-attach to existing seat. Name is allowed to update.
      existing.connected = true;
      if (msg.name && msg.name.trim()) existing.name = msg.name.trim().slice(0, 32);
      // Host reclaim: the original host returned inside the grace window.
      if (
        this.hostReclaimDeadlineMs != null &&
        existing.playerId === this.hostPlayerId
      ) {
        this.hostReclaimDeadlineMs = null;
        this.rescheduleAlarm();
      }
      this.broadcastState();
      // Push private role if a round is in progress so the client can resume.
      if (this.round && this.phase !== 'lobby' && this.phase !== 'done') {
        this.sendRoleTo(existing);
      }
      return;
    }
    if (this.players.length >= MAX_PLAYERS) {
      this.send(playerId, {
        type: 'error',
        code: 'room_full',
        message: 'Room is full (12 players max).',
      });
      return;
    }
    const name = (msg.name?.trim() || `Player ${this.players.length + 1}`).slice(0, 32);
    const seat = this.players.length;
    const player: InternalPlayer = {
      seat,
      playerId,
      name,
      connected: true,
      lastChatMs: 0,
    };
    this.players.push(player);
    if (!this.hostPlayerId) this.hostPlayerId = playerId;
    this.broadcastState();
    // Mid-round join: seat-only; no role until next round (they'll be in next deal).
  }

  // -------------------------------------------------------------------------
  // Lobby

  private handleSetOptions(
    playerId: string,
    msg: Extract<C2S, { type: 'set_options' }>
  ): void {
    if (!this.requireHost(playerId)) return;
    if (!this.requirePhase(playerId, 'lobby')) return;
    const cat = WORDS.categories.find((c) => c.key === msg.categoryKey);
    if (!cat) {
      this.send(playerId, {
        type: 'error',
        code: 'invalid_target',
        message: `Unknown category ${msg.categoryKey}`,
      });
      return;
    }
    this.options = {
      categoryKey: msg.categoryKey,
      imposterCount: clamp(msg.imposterCount, 1, 3),
      roundSeconds: clamp(msg.roundSeconds, 30, 600),
      stealGuess: !!msg.stealGuess,
    };
    this.broadcastState();
  }

  private handleStart(playerId: string): void {
    if (!this.requireHost(playerId)) return;
    if (!this.requirePhase(playerId, 'lobby')) return;
    const seated = this.players.length;
    if (seated < MIN_PLAYERS) {
      this.send(playerId, {
        type: 'error',
        code: 'bad_phase',
        message: `Need at least ${MIN_PLAYERS} players (have ${seated}).`,
      });
      return;
    }
    this.dealNewRound();
  }

  // -------------------------------------------------------------------------
  // Deal / Clue

  private dealNewRound(): void {
    this.roundId += 1;
    const cfg = {
      playerCount: this.players.length,
      imposterCount: clamp(this.options.imposterCount, 1, Math.max(1, this.players.length - 1)),
      categoryKey: this.options.categoryKey,
      roundSeconds: this.options.roundSeconds,
      playerNames: this.players.map((p) => p.name),
    };
    // Seed `dealGame` with our injectable RNG so tests stay deterministic.
    const origRandom = Math.random;
    Math.random = this.rng;
    let gs;
    try {
      gs = dealGame(cfg);
    } finally {
      Math.random = origRandom;
    }
    const cat = pickCategory(this.options.categoryKey);
    const imposterSeats = new Set<number>(
      gs.assignments.filter((a) => a.isImposter).map((a) => a.index)
    );
    this.round = {
      roundId: this.roundId,
      pair: gs.pair,
      imposterSeats,
      category: { key: cat.key, label_ku: cat.label_ku, label_en: cat.label_en },
      votes: new Map(),
      result: undefined,
    };
    this.phase = 'deal';
    this.clueEndsAt = null;
    this.voteEndsAt = null;
    this.broadcastState();
    // Push private role to each connected player.
    for (const p of this.players) {
      if (p.connected) this.sendRoleTo(p);
    }
    // Auto-advance to clue immediately. Clients render their own "ready" UI;
    // server doesn't gate on a per-player ack in v1 to keep the protocol small.
    this.enterClue();
  }

  private enterClue(): void {
    this.phase = 'clue';
    const now = this.nowFn();
    this.clueEndsAt = now + this.options.roundSeconds * 1000;
    this.voteEndsAt = null;
    this.broadcastState();
    this.setAlarmFn(this.clueEndsAt);
  }

  private handleToVote(playerId: string): void {
    if (!this.requireHost(playerId)) return;
    if (this.phase !== 'clue') {
      this.send(playerId, {
        type: 'error',
        code: 'bad_phase',
        message: 'to_vote only allowed during clue phase',
      });
      return;
    }
    this.enterVote();
  }

  private enterVote(): void {
    this.phase = 'vote';
    const now = this.nowFn();
    this.voteEndsAt = now + VOTE_TIMER_MS;
    this.clueEndsAt = null;
    if (this.round) this.round.votes = new Map();
    this.broadcastState();
    this.setAlarmFn(this.voteEndsAt);
  }

  // -------------------------------------------------------------------------
  // Vote

  private handleVote(
    playerId: string,
    msg: Extract<C2S, { type: 'vote' }>
  ): void {
    const p = this.findPlayer(playerId);
    if (!p) return;
    if (this.phase !== 'vote' || !this.round) {
      this.send(playerId, { type: 'error', code: 'bad_phase', message: 'Not in vote phase' });
      return;
    }
    if (msg.roundId !== this.roundId) {
      this.send(playerId, { type: 'error', code: 'stale_round', message: 'Stale roundId' });
      return;
    }
    if (msg.targetSeat < 0 || msg.targetSeat >= this.players.length) {
      this.send(playerId, { type: 'error', code: 'invalid_target', message: 'No such seat' });
      return;
    }
    if (msg.targetSeat === p.seat) {
      this.send(playerId, { type: 'error', code: 'invalid_target', message: 'Cannot vote self' });
      return;
    }
    if (this.round.votes.has(p.seat)) {
      this.send(playerId, { type: 'error', code: 'already_voted', message: 'Already voted' });
      return;
    }
    this.round.votes.set(p.seat, msg.targetSeat);
    this.broadcastState();
    // Early-finish: every connected non-imposter+imposter eligible voter has voted.
    const eligible = this.players.filter((pl) => pl.connected).length;
    if (this.round.votes.size >= eligible) {
      this.tallyAndReveal();
    }
  }

  private tallyAndReveal(): void {
    if (!this.round) return;
    const tallies = new Array(this.players.length).fill(0);
    for (const target of this.round.votes.values()) {
      if (target >= 0 && target < tallies.length) tallies[target] += 1;
    }
    // Find highest tally and detect tie.
    let topCount = -1;
    for (const t of tallies) if (t > topCount) topCount = t;
    const topSeats: number[] = [];
    for (let i = 0; i < tallies.length; i++) if (tallies[i] === topCount) topSeats.push(i);
    const isTie = topSeats.length > 1 || topCount === 0;
    const accusedSeat = topSeats[0]; // lowest-indexed top seat (deterministic).
    const accusedWasImposter = this.round.imposterSeats.has(accusedSeat);
    // Tie rule: imposter wins regardless of who was accused.
    const winners: 'civilians' | 'imposter' =
      isTie ? 'imposter' : accusedWasImposter ? 'civilians' : 'imposter';
    const voteBreakdown = [...this.round.votes.entries()]
      .map(([voterSeat, targetSeat]) => ({ voterSeat, targetSeat }))
      .sort((a, b) => a.voterSeat - b.voterSeat);
    const result: RoundResult = {
      accusedSeat,
      accusedWasImposter,
      word: this.round.pair.crew,
      imposterSeats: [...this.round.imposterSeats].sort((a, b) => a - b),
      winners,
      voteBreakdown,
    };
    this.round.result = result;
    this.phase = 'reveal';
    this.voteEndsAt = null;
    this.clueEndsAt = null;
    this.applyRoundScores(null);
    this.broadcastState();
    this.setAlarmFn(null);
  }

  /** Increment cumulative wins for the round-winning team. If `prevWinners`
   *  is non-null, undo that prior application first (used when steal-guess
   *  flips the result mid-reveal). */
  private applyRoundScores(prevWinners: 'civilians' | 'imposter' | null): void {
    if (!this.round?.result) return;
    const imposters = this.round.imposterSeats;
    const apply = (winners: 'civilians' | 'imposter', sign: 1 | -1) => {
      for (const p of this.players) {
        const wasImposter = imposters.has(p.seat);
        const won = winners === 'imposter' ? wasImposter : !wasImposter;
        if (won) {
          this.scores.set(p.playerId, (this.scores.get(p.playerId) ?? 0) + sign);
        }
      }
    };
    if (prevWinners) apply(prevWinners, -1);
    apply(this.round.result.winners, 1);
  }

  // -------------------------------------------------------------------------
  // Steal-guess + Next round

  private handleStealGuess(
    playerId: string,
    msg: Extract<C2S, { type: 'steal_guess' }>
  ): void {
    const p = this.findPlayer(playerId);
    if (!p || !this.round || !this.round.result) {
      this.send(playerId, { type: 'error', code: 'bad_phase', message: 'No round to steal in' });
      return;
    }
    if (this.phase !== 'reveal') {
      this.send(playerId, { type: 'error', code: 'bad_phase', message: 'Not in reveal phase' });
      return;
    }
    if (msg.roundId !== this.roundId) {
      this.send(playerId, { type: 'error', code: 'stale_round', message: 'Stale roundId' });
      return;
    }
    if (!this.options.stealGuess) {
      this.send(playerId, {
        type: 'error',
        code: 'bad_phase',
        message: 'Steal-guess disabled by host',
      });
      return;
    }
    // Only the accused player, AND only if they were the imposter, may steal-guess.
    const accusedSeat = this.round.result.accusedSeat;
    const accusedWasImposter = this.round.result.accusedWasImposter;
    if (!accusedWasImposter || p.seat !== accusedSeat) {
      this.send(playerId, {
        type: 'error',
        code: 'invalid_target',
        message: 'Only a caught imposter may steal-guess',
      });
      return;
    }
    if (this.round.result.stealGuessUsed) {
      this.send(playerId, {
        type: 'error',
        code: 'already_voted',
        message: 'Steal-guess already used',
      });
      return;
    }
    const guess = (msg.word ?? '').trim().toLowerCase();
    const truth = this.round.pair.crew.trim().toLowerCase();
    const correct = guess.length > 0 && guess === truth;
    this.round.result.stealGuessUsed = { word: msg.word, correct };
    if (correct) {
      this.round.result.winners = 'imposter';
      this.applyRoundScores('civilians');
    }
    this.broadcastState();
  }

  private handleNextRound(playerId: string): void {
    if (!this.requireHost(playerId)) return;
    if (this.phase !== 'reveal') {
      this.send(playerId, { type: 'error', code: 'bad_phase', message: 'Not in reveal phase' });
      return;
    }
    if (this.players.length < MIN_PLAYERS) {
      this.send(playerId, {
        type: 'error',
        code: 'bad_phase',
        message: 'Not enough players to continue.',
      });
      return;
    }
    this.dealNewRound();
  }

  // -------------------------------------------------------------------------
  // Chat

  private handleChat(
    playerId: string,
    msg: Extract<C2S, { type: 'chat' }>
  ): void {
    const p = this.findPlayer(playerId);
    if (!p) return;
    const now = this.nowFn();
    const minGap = 1000 / Math.max(1, CHAT_RATE_PER_PLAYER_PER_SEC);
    if (now - p.lastChatMs < minGap) {
      this.send(playerId, {
        type: 'error',
        code: 'rate_limit',
        message: 'Slow down — 1 message per second.',
      });
      return;
    }
    const text = (msg.text ?? '').slice(0, CHAT_MAX_LEN);
    if (text.trim().length === 0) return;
    p.lastChatMs = now;
    this.broadcast({
      type: 'chat',
      fromSeat: p.seat,
      fromName: p.name,
      text,
      ts: now,
    });
  }

  // -------------------------------------------------------------------------
  // Leave

  private handleLeave(playerId: string): void {
    const idx = this.players.findIndex((p) => p.playerId === playerId);
    if (idx < 0) return;
    const wasHost = this.hostPlayerId === playerId;
    this.players.splice(idx, 1);
    // Renumber seats so the player array invariant (seat === index) holds.
    this.players.forEach((p, i) => (p.seat = i));
    if (wasHost) this.promoteHost();
    if (this.players.length === 0) this.hostPlayerId = null;
    this.broadcastState();
  }

  // -------------------------------------------------------------------------
  // Internals

  private requireHost(playerId: string): boolean {
    if (this.hostPlayerId !== playerId) {
      this.send(playerId, { type: 'error', code: 'not_host', message: 'Host only' });
      return false;
    }
    return true;
  }

  private requirePhase(playerId: string, ...allowed: Phase[]): boolean {
    if (!allowed.includes(this.phase)) {
      this.send(playerId, {
        type: 'error',
        code: 'bad_phase',
        message: `Action not allowed in phase ${this.phase}`,
      });
      return false;
    }
    return true;
  }

  private findPlayer(playerId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.playerId === playerId);
  }

  private promoteHost(): void {
    const next = this.players.find((p) => p.connected);
    this.hostPlayerId = next ? next.playerId : (this.players[0]?.playerId ?? null);
  }

  /** Pick the earliest pending deadline (clue / vote timer / host reclaim) and
   *  arm the single coalesced alarm for it. Null cancels. */
  private rescheduleAlarm(): void {
    const candidates: number[] = [];
    if (this.phase === 'clue' && this.clueEndsAt != null) candidates.push(this.clueEndsAt);
    if (this.phase === 'vote' && this.voteEndsAt != null) candidates.push(this.voteEndsAt);
    if (this.hostReclaimDeadlineMs != null) candidates.push(this.hostReclaimDeadlineMs);
    this.setAlarmFn(candidates.length > 0 ? Math.min(...candidates) : null);
  }

  private snapshot(): PublicRoomState {
    const publicPlayers: PublicPlayer[] = this.players.map((p) => ({
      seat: p.seat,
      playerId: p.playerId,
      name: p.name,
      connected: p.connected,
    }));
    const scores: Record<string, number> = {};
    for (const p of this.players) {
      scores[p.playerId] = this.scores.get(p.playerId) ?? 0;
    }
    const state: PublicRoomState = {
      code: this.code,
      hostPlayerId: this.hostPlayerId ?? '',
      phase: this.phase,
      options: { ...this.options },
      players: publicPlayers,
      roundId: this.roundId,
      scores,
    };
    if (this.round && this.phase !== 'lobby') {
      state.category = { ...this.round.category };
    }
    if (this.phase === 'vote' && this.round) {
      state.votesCast = this.round.votes.size;
    }
    if (this.phase === 'clue' && this.clueEndsAt != null) {
      state.clueEndsAt = this.clueEndsAt;
    }
    if (this.phase === 'vote' && this.voteEndsAt != null) {
      state.voteEndsAt = this.voteEndsAt;
    }
    if (this.phase === 'reveal' && this.round?.result) {
      state.result = { ...this.round.result };
    }
    return state;
  }

  private broadcastState(): void {
    this.broadcast({ type: 'state', state: this.snapshot() });
  }

  private sendRoleTo(p: InternalPlayer): void {
    if (!this.round) return;
    const isImposter = this.round.imposterSeats.has(p.seat);
    this.send(p.playerId, {
      type: 'role',
      isImposter,
      word: isImposter ? null : this.round.pair.crew,
      roundId: this.round.roundId,
    });
  }
}
