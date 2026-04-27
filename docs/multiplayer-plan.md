# Kurdish Imposter — Online Multiplayer Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add online multiplayer (room codes + text chat) to the Kurdish Imposter Expo app, while preserving the existing offline pass-the-phone mode.

**Architecture:** Cloudflare PartyKit (one Durable Object per room) holds authoritative game state and broadcasts to all WebSocket-connected clients. Existing `game.ts` pure logic is shared between offline and online paths; the server runs `dealGame()` and only emits private "your role" messages per-player so the imposter assignment never reaches non-imposters' clients.

**Tech Stack:** Cloudflare Workers + PartyKit (server), Expo / React Native + react-native-web (client), TypeScript end-to-end. AsyncStorage for `playerId` persistence. No DB — all state lives in the Durable Object until the room is empty.

---

## Goals

- Anyone can tap **Online → Create Room** to mint a 4-letter code and share with friends.
- Anyone can tap **Online → Join Room** and enter a code to join an existing room.
- 3–12 players per room. Names per player. Server is authoritative.
- Word + role dealt server-side; imposter sees only "you are the imposter," civilians see the word.
- In-room **text chat** during all phases (rides the same WebSocket).
- Phases: `lobby → deal → clue → vote → reveal → done` (replay loop).
- **Plurality voting** with a 30s timer; ties → imposter wins.
- **Optional steal-guess** for caught imposter (host toggle when creating room, default off).
- **Auto-promote host** if the host disconnects.
- Reconnect: client stores `playerId` in AsyncStorage and re-attaches on reload.
- Offline mode untouched.

## Non-goals (v2 / later)

- Voice chat (LiveKit later).
- Quick-Play matchmaking queue.
- Persistent player accounts / leaderboards.
- Spectators.
- Custom word packs uploaded by users.

---

## File Layout

```
kurdish-imposter-app/                        (existing repo)
├── App.tsx                                  modify: add Online button on home, route to multiplayer screens
├── game.ts                                  reuse as-is on server (pure logic)
├── i18n/{en,ku,ar}.json                     add multiplayer.* keys
├── multiplayer/                             NEW client-side multiplayer module
│   ├── protocol.ts                          shared types (client + server import this)
│   ├── client.ts                            WebSocket connection + reconnect + state mirror
│   ├── usePartyRoom.ts                      React hook exposing { state, send } to UI
│   └── screens/
│       ├── OnlineHomeScreen.tsx             entry: Create Room | Join Room
│       ├── LobbyScreen.tsx                  pre-game: roster, host options, Start
│       ├── OnlineDealScreen.tsx             reveal role/word (per-player, no pass-phone)
│       ├── OnlineClueScreen.tsx             clue rounds (or "discuss freely + timer")
│       ├── OnlineVoteScreen.tsx             tap-vote, simultaneous reveal
│       ├── OnlineRevealScreen.tsx           result + optional imposter steal-guess
│       └── ChatPanel.tsx                    text chat overlay/drawer used in all phases
└── server/                                  NEW PartyKit worker
    ├── partykit.json                        wrangler-style config
    ├── package.json                         deps: partykit, partyserver, typescript
    ├── tsconfig.json
    └── src/
        ├── index.ts                         RoomDO export, WebSocket handler
        ├── room.ts                          RoomState + handlers per phase
        ├── protocol.ts                      symlinked or copied from client/multiplayer/protocol.ts
        └── words.ts                         imports ../../assets/word_pairs.json
```

---

## Message Protocol (the contract — defines parallel boundaries)

All messages are JSON over a single WebSocket per client. Discriminated union by `type`.

### Client → Server

```ts
type C2S =
  | { type: 'hello';      playerId: string;  name: string;  asHost?: boolean }
  | { type: 'set_options'; categoryKey: string; imposterCount: number; roundSeconds: number; stealGuess: boolean }
  | { type: 'start' }
  | { type: 'vote';       targetSeat: number }
  | { type: 'steal_guess'; word: string }
  | { type: 'next_round' }
  | { type: 'chat';       text: string }
  | { type: 'leave' };
```

### Server → Client (broadcast unless noted)

```ts
type S2C =
  | { type: 'state';      state: PublicRoomState }                 // broadcast: full snapshot
  | { type: 'role';       isImposter: boolean; word: string | null } // private: only to that player
  | { type: 'chat';       fromSeat: number; fromName: string; text: string; ts: number }
  | { type: 'error';      code: string; message: string }
  | { type: 'kicked';     reason: string };                        // private
```

### Public room state (broadcast to all)

```ts
type Phase = 'lobby' | 'deal' | 'clue' | 'vote' | 'reveal' | 'done';

type PublicRoomState = {
  code: string;                            // 4-letter room code
  hostPlayerId: string;
  phase: Phase;
  options: {
    categoryKey: string;
    imposterCount: number;
    roundSeconds: number;
    stealGuess: boolean;
  };
  players: Array<{
    seat: number;
    playerId: string;
    name: string;
    connected: boolean;
  }>;
  // populated only in deal+
  category?: { key: string; label_ku: string; label_en: string };
  // populated only in vote+; tallies hidden until vote ends
  votesCast?: number;                      // count of votes cast, not who voted whom
  // populated only in reveal
  result?: {
    accusedSeat: number;
    accusedWasImposter: boolean;
    word: string;
    imposterSeats: number[];
    stealGuessUsed?: { word: string; correct: boolean };
    winners: 'civilians' | 'imposter';
  };
  roundId: number;                         // monotonic; bumps on next_round
};
```

**Critical invariants**

- `role` is the ONLY message that reveals imposter assignment. It is sent privately to each player and never logged in `PublicRoomState`.
- `votesCast` count is broadcast during voting; `accusedSeat` and `imposterSeats` are only filled in `reveal`.
- Server validates `roundId` on every C2S except `chat` and `hello` to reject stale clients.

---

## Phases (FSM)

Server-authoritative. Transitions:

```
lobby ──start──▶ deal ─(after each player taps "ready")─▶ clue
clue  ─(roundSeconds elapsed OR host taps "to vote")─▶ vote
vote  ─(N/N votes OR 30s timer)─▶ reveal
reveal ─(stealGuess used OR skipped + host taps next)─▶ deal       (if next_round)
                                                       ─done       (if host ends)
```

**Edge cases**

- Player joins mid-round → see `phase` ≠ `lobby`, screen shows "round in progress, you're seated for next round" + chat enabled.
- Host disconnects → server promotes oldest remaining player's `playerId` to `hostPlayerId`, broadcasts new state.
- All players disconnect → DO sleeps; game state lost. Acceptable for v1.
- Vote race close (timer + last vote arriving simultaneously) → server uses single transition, ignores late votes.

---

## Tasks (parallelizable after Task 0)

### Task 0 — Lock the protocol (sequential, must come first)

**Owner:** main session
**Files:** `multiplayer/protocol.ts`
**Deliverable:** Final TypeScript types for all C2S/S2C messages + `PublicRoomState` + `Phase`. Both server and client import from one source.
**Test:** None — this is types only. Compiles cleanly.

### Task 1 — PartyKit server (parallel)

**Owner:** subagent A
**Files:**
- Create: `server/package.json`, `server/partykit.json`, `server/tsconfig.json`
- Create: `server/src/index.ts`, `server/src/room.ts`, `server/src/words.ts`
- Copy/symlink: `server/src/protocol.ts` from `multiplayer/protocol.ts`

**Deliverable:** A PartyKit `Server` (one DO per room code) that:
- Generates a 4-char room code on create.
- Handles all C2S messages above.
- Runs phase FSM with timers (uses `ctx.storage.setAlarm` for the 30s vote timer).
- Reuses `dealGame` from existing `../game.ts` (path-relative import).
- Persists nothing across DO eviction (in-memory state). Acceptable.
- Validates `roundId` on every state-mutating message.

**Tests (TDD):** Use Vitest + a fake WebSocket pair to drive the server.
- `lobby.test.ts` — host can set options, players can join up to 12, 13th rejected.
- `deal.test.ts` — `start` deals roles; each connected client receives one `role` msg; non-imposters see word, imposters see `null`.
- `vote.test.ts` — votes tally, late vote ignored after timer, ties → imposter wins.
- `reveal.test.ts` — stealGuess only allowed if `options.stealGuess === true` AND imposter accused; correct word flips winners.
- `host_promotion.test.ts` — host disconnects, oldest connected player becomes new host.
- `reconnect.test.ts` — same `playerId` returning gets re-seated, missed `state` snapshot pushed on reconnect.

### Task 2 — Client multiplayer module (parallel, mocks server with stubs)

**Owner:** subagent B
**Files:**
- Create: `multiplayer/client.ts`, `multiplayer/usePartyRoom.ts`

**Deliverable:**
- `client.ts` — WebSocket connection wrapper. API: `connect(code, name)`, `send(C2S)`, exposes EventEmitter for `'state'`, `'role'`, `'chat'`, `'error'`, `'connected'`, `'disconnected'`. Generates `playerId` on first run via `crypto.randomUUID()` and stores in AsyncStorage.
- `usePartyRoom.ts` — React hook returning `{ state: PublicRoomState | null, role: { isImposter, word } | null, chat: ChatMessage[], send, connectionStatus }`.

**Tests:** Use a mock WebSocket. Verify reconnect re-sends `hello`, drops outbound messages while disconnected (queues for reconnect), and merges `state` snapshots correctly.

### Task 3 — Online lobby + room screens (parallel, depends on Task 0 protocol; uses Task 2 hook once it exists, otherwise stubs)

**Owner:** subagent C
**Files:**
- Create: `multiplayer/screens/OnlineHomeScreen.tsx`
- Create: `multiplayer/screens/LobbyScreen.tsx`
- Create: `multiplayer/screens/OnlineDealScreen.tsx`
- Create: `multiplayer/screens/OnlineClueScreen.tsx`
- Create: `multiplayer/screens/OnlineVoteScreen.tsx`
- Create: `multiplayer/screens/OnlineRevealScreen.tsx`
- Create: `multiplayer/screens/ChatPanel.tsx`

**Deliverable:** Screens that consume `usePartyRoom()` and render the existing v2 visuals (`theme.ts`, components from `ui.tsx`) for each phase. ChatPanel slides in from bottom across all phases.

**Tests:** Snapshot tests + interaction tests with stubbed hook fixtures (Detox-free; React Native Testing Library is fine).

### Task 4 — App.tsx integration + offline preservation (sequential after Tasks 2 + 3)

**Owner:** main session or subagent D after others land
**Files:**
- Modify: `App.tsx` — add Online button on home screen, mount multiplayer screen tree, gate by `mode: 'offline' | 'online'` state. Default offline, no regression.

**Acceptance:** Manual smoke — both flows playable. Offline screenshots match existing previews.

### Task 5 — i18n (parallel with anything)

**Owner:** subagent E
**Files:**
- Modify: `i18n/en.json`, `i18n/ku.json`, `i18n/ar.json`

**Deliverable:** `multiplayer.*` namespace covering: home buttons, room code, lobby, host options, phase headers, chat placeholder, vote prompts, reveal copy, error messages (room full, invalid code, connection lost, kicked).

**Test:** Snapshot all three files in three locales render screens without missing-key warnings.

### Task 6 — Deploy (sequential, last)

**Owner:** main session
**Files:**
- Create/modify: `server/partykit.json` with project name `kurdish-imposter`.
- Add: GitHub Actions workflow `.github/workflows/deploy-server.yml` (deploy on push to `main` to PartyKit Cloud).

**Run:** `npx partykit deploy` once locally to bootstrap, capture URL, set `EXPO_PUBLIC_PARTYKIT_URL` in app config.

---

## Test plan (E2E manual smoke before merge)

1. Two browsers on web build → Create + Join with 4-letter code.
2. Add a third on phone via Expo Go (or dev build) → all three in same room.
3. Start → each player sees own role privately.
4. Discuss in chat → messages broadcast.
5. Vote → simultaneous reveal.
6. Replay round → words shuffle, roles re-deal.
7. Close host tab mid-round → second player auto-promoted, chat continues.
8. Reload tab mid-round → reconnects, state restored.
9. Kill internet on one client for 10s → reconnects, no duplicate seat.
10. Toggle UI to Kurdish + Arabic → all multiplayer screens render correctly RTL.

## Deploy plan

- **Backend:** PartyKit Cloud (free tier covers thousands of rooms). Deploy via `npx partykit deploy` from `server/`. URL pattern: `kurdish-imposter.<user>.partykit.dev`.
- **Web build:** Existing GH Pages deploy — bundle includes `EXPO_PUBLIC_PARTYKIT_URL` at build time.
- **Mobile:** EAS dev build → TestFlight + Play internal test track.

## Risks

- PartyKit cold-start may hit ~200ms on first connect. Acceptable.
- Word list file is committed in repo — if monetized later, gate via signed URL at deploy time.
- Plain-text chat could be abused — v1 ships without filter; revisit if it goes viral.

---

## Execution

Subagent-driven: dispatch Tasks 1, 2, 3, 5 in parallel after Task 0 (protocol) is committed. Task 4 + Task 6 run sequentially in the main session at the end.
