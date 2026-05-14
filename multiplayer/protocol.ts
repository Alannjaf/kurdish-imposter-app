// Wire protocol shared by Expo client and PartyKit server.
// Single source of truth — server copies/symlinks this file at build time.

export type Phase = 'lobby' | 'deal' | 'clue' | 'vote' | 'reveal' | 'done';

export type RoomOptions = {
  categoryKey: string;
  imposterCount: number;
  roundSeconds: number;
  stealGuess: boolean;
  /** Only used when categoryKey === 'custom'. Each pair is [crew, imposter]
   *  (imposter may equal crew if the host wants the imposter to share the
   *  word — uncommon but allowed). Minimum 5 pairs enforced by server. */
  customWords?: { crew: string; imposter: string }[];
};

export type PublicPlayer = {
  /** Zero-indexed seat assigned by the server in hello-arrival order. */
  seat: number;
  playerId: string;
  name: string;
  connected: boolean;
  /** Optional emoji avatar picked at the join screen. */
  avatar?: string;
};

export type RoundResult = {
  accusedSeat: number;
  accusedWasImposter: boolean;
  word: string;
  imposterSeats: number[];
  stealGuessUsed?: { word: string; correct: boolean };
  winners: 'civilians' | 'imposter';
  /** Full voter→target breakdown for the "who voted whom" reveal display. */
  voteBreakdown?: { voterSeat: number; targetSeat: number }[];
};

export type PublicRoomState = {
  code: string;
  hostPlayerId: string;
  phase: Phase;
  options: RoomOptions;
  players: PublicPlayer[];
  category?: { key: string; label_ku: string; label_en: string };
  votesCast?: number;
  voteEndsAt?: number;
  clueEndsAt?: number;
  result?: RoundResult;
  roundId: number;
  /** Cumulative wins per playerId across rounds played in this room. */
  scores: Record<string, number>;
};

// Client → Server
export type C2S =
  | { type: 'hello'; playerId: string; name: string; asHost?: boolean; avatar?: string }
  | {
      type: 'set_options';
      categoryKey: string;
      imposterCount: number;
      roundSeconds: number;
      stealGuess: boolean;
      customWords?: { crew: string; imposter: string }[];
    }
  | { type: 'start' }
  | { type: 'to_vote' }
  | { type: 'vote'; targetSeat: number; roundId: number }
  | { type: 'steal_guess'; word: string; roundId: number }
  | { type: 'next_round' }
  | { type: 'chat'; text: string }
  | { type: 'leave' };

// Server → Client
export type S2C =
  | { type: 'state'; state: PublicRoomState }
  | { type: 'role'; isImposter: boolean; word: string | null; roundId: number }
  | { type: 'chat'; fromSeat: number; fromName: string; text: string; ts: number }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'kicked'; reason: string };

export type ErrorCode =
  | 'room_full'
  | 'invalid_code'
  | 'name_taken'
  | 'not_host'
  | 'bad_phase'
  | 'stale_round'
  | 'invalid_target'
  | 'already_voted'
  | 'rate_limit'
  | 'internal';

// Helpers consumed by both sides ----------------------------------------------

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 3;
export const VOTE_TIMER_MS = 30_000;
export const CHAT_MAX_LEN = 240;
export const CHAT_RATE_PER_PLAYER_PER_SEC = 1;
