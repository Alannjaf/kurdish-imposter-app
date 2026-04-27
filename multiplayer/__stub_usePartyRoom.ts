// Hook stub for Task 3 (UI) so screens compile + can be exercised in
// isolation before Task 2 (the real client + hook) lands.
//
// IMPORTANT: screens in this folder do NOT import this file. They are pure
// prop-driven (state, role, send, myPlayerId), so they're trivially testable
// and don't depend on any hook. This stub exists ONLY as a documentary
// artifact of the shape Task 2 must expose, and so anyone running screens in
// isolation (a sandbox, a Storybook, a screenshot script) can wire one up.
//
// When Task 2 ships `multiplayer/usePartyRoom.ts`, the real hook should
// return the same shape as `UsePartyRoomReturn` below. App.tsx (Task 4)
// is where hook → screens wiring happens.

import type { PublicRoomState, C2S } from './protocol';

export type ChatMessage = {
  fromSeat: number;
  fromName: string;
  text: string;
  ts: number;
};

export type RoleInfo = {
  isImposter: boolean;
  word: string | null;
};

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export type UsePartyRoomReturn = {
  state: PublicRoomState | null;
  role: RoleInfo | null;
  chat: ChatMessage[];
  send: (msg: C2S) => void;
  status: ConnectionStatus;
  lastError: string | null;
};

export function usePartyRoom(): UsePartyRoomReturn {
  return {
    state: null,
    role: null,
    chat: [],
    send: () => {
      /* no-op stub */
    },
    status: 'idle',
    lastError: null,
  };
}
