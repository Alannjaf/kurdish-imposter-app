// Realistic PublicRoomState fixtures for every phase. Used by Task 4 (App.tsx
// wiring) to render screens in isolation, by future snapshot tests, and by
// dev tools. These are NOT runtime data — they are static examples.
//
// Conventions:
//   - hostPlayerId is "p1" everywhere; "myPlayerId" in callers should also be
//     "p1" for host views and "p2" for non-host views.
//   - 5 players, 1 imposter (seat 2), category "food_drink".
//   - Word is "Pomegranate" (only revealed in `reveal` snapshot).

import type { PublicRoomState } from '../protocol';
import type { ChatMessage, RoleInfo } from '../__stub_usePartyRoom';

const NOW = 1735689600000; // fixed epoch so renders are deterministic

const PLAYERS = [
  { seat: 0, playerId: 'p1', name: 'Alan', connected: true },
  { seat: 1, playerId: 'p2', name: 'Sara', connected: true },
  { seat: 2, playerId: 'p3', name: 'Adam', connected: true },
  { seat: 3, playerId: 'p4', name: 'Lana', connected: true },
  { seat: 4, playerId: 'p5', name: 'Hewa', connected: false },
];

const OPTIONS = {
  categoryKey: 'food_drink',
  imposterCount: 1,
  roundSeconds: 180,
  stealGuess: true,
};

const CATEGORY = {
  key: 'food_drink',
  label_ku: 'خواردن و خواردنەوە',
  label_en: 'Food & Drinks',
};

export const SAMPLE_LOBBY: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'lobby',
  options: OPTIONS,
  players: PLAYERS,
  roundId: 0,
  scores: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 },
};

export const SAMPLE_DEAL: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'deal',
  options: OPTIONS,
  players: PLAYERS,
  category: CATEGORY,
  roundId: 1,
  scores: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 },
};

export const SAMPLE_CLUE: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'clue',
  options: OPTIONS,
  players: PLAYERS,
  category: CATEGORY,
  clueEndsAt: NOW + 90_000, // 90s remaining
  roundId: 1,
  scores: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 },
};

export const SAMPLE_VOTE: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'vote',
  options: OPTIONS,
  players: PLAYERS,
  category: CATEGORY,
  votesCast: 2,
  voteEndsAt: NOW + 22_000, // 22s remaining
  roundId: 1,
  scores: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 },
};

export const SAMPLE_REVEAL_CIVS_WIN: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'reveal',
  options: OPTIONS,
  players: PLAYERS,
  category: CATEGORY,
  result: {
    accusedSeat: 2,
    accusedWasImposter: true,
    word: 'Pomegranate',
    imposterSeats: [2],
    winners: 'civilians',
  },
  roundId: 1,
  scores: { p1: 1, p2: 1, p3: 0, p4: 1, p5: 0 },
};

export const SAMPLE_REVEAL_IMPOSTER_WIN: PublicRoomState = {
  code: 'KRDS',
  hostPlayerId: 'p1',
  phase: 'reveal',
  options: OPTIONS,
  players: PLAYERS,
  category: CATEGORY,
  result: {
    accusedSeat: 1,
    accusedWasImposter: false,
    word: 'Pomegranate',
    imposterSeats: [2],
    winners: 'imposter',
  },
  roundId: 1,
  scores: { p1: 0, p2: 0, p3: 1, p4: 0, p5: 0 },
};

// Role samples (private — would be received via S2C 'role' message).
export const SAMPLE_ROLE_CIVILIAN: RoleInfo = {
  isImposter: false,
  word: 'Pomegranate',
};

export const SAMPLE_ROLE_IMPOSTER: RoleInfo = {
  isImposter: true,
  word: null,
};

// Chat fixture — used by ChatPanel previews.
export const SAMPLE_CHAT: ChatMessage[] = [
  { fromSeat: 0, fromName: 'Alan', text: 'Hey everyone!', ts: NOW - 60_000 },
  { fromSeat: 1, fromName: 'Sara', text: 'Ready when you are.', ts: NOW - 45_000 },
  { fromSeat: 3, fromName: 'Lana', text: 'Let’s go 🔥', ts: NOW - 20_000 },
];
