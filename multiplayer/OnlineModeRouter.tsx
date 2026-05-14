// OnlineModeRouter — single-mount gateway into online multiplayer.
//
// Flow:
//   1. Show OnlineHomeScreen (Create | Join) until the user submits.
//   2. Once submitted, derive a room code (random for Create, typed for Join),
//      mount usePartyRoom with { code, name, asHost }, and render the screen
//      that matches the current server phase.
//   3. Back/Leave returns to the parent (offline home).
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ChatPanel } from './screens/ChatPanel';
import { LobbyScreen } from './screens/LobbyScreen';
import { OnlineClueScreen } from './screens/OnlineClueScreen';
import { OnlineDealScreen } from './screens/OnlineDealScreen';
import {
  OnlineHomeJoinPayload,
  OnlineHomeScreen,
} from './screens/OnlineHomeScreen';
import { OnlineRevealScreen } from './screens/OnlineRevealScreen';
import { OnlineVoteScreen } from './screens/OnlineVoteScreen';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './protocol';
import { usePartyRoom } from './usePartyRoom';
import { useThemeColors } from '../theme';
import { useT } from '../i18n';

// Must be literal `process.env.EXPO_PUBLIC_*` for Metro's static replacement.
const PARTYKIT_HOST =
  process.env.EXPO_PUBLIC_PARTYKIT_URL || 'http://127.0.0.1:1999';

function randomRoomCode(): string {
  const a = ROOM_CODE_ALPHABET;
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += a[Math.floor(Math.random() * a.length)];
  }
  return out;
}

type Session = { code: string; name: string; asHost: boolean };

export function OnlineModeRouter({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(null);

  const handleJoin = (payload: OnlineHomeJoinPayload) => {
    const code = payload.code ?? randomRoomCode();
    setSession({ code, name: payload.name, asHost: payload.asHost });
  };

  if (!session) {
    return <OnlineHomeScreen onJoin={handleJoin} onBack={onExit} />;
  }

  return <RoomShell session={session} onExit={onExit} />;
}

function RoomShell({ session, onExit }: { session: Session; onExit: () => void }) {
  const t = useT();
  const colors = useThemeColors();
  const room = usePartyRoom({
    host: PARTYKIT_HOST,
    code: session.code,
    name: session.name,
    asHost: session.asHost,
  });

  const myPlayerId = useMemo(() => {
    // The hook persists playerId via AsyncStorage; surface it from the state if available.
    if (room.state) {
      const me = room.state.players.find((p) => p.name === session.name);
      if (me) return me.playerId;
    }
    return '';
  }, [room.state, session.name]);

  // Connection / loading screen.
  if (!room.state) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 18 }}>
          {room.status === 'connecting'
            ? t('multiplayer.status.connecting')
            : room.status === 'disconnected'
            ? t('multiplayer.status.disconnected')
            : t('multiplayer.status.connecting')}
        </Text>
        {room.lastError ? (
          <Text style={{ color: colors.pomegranate, marginTop: 12 }}>{room.lastError}</Text>
        ) : null}
      </View>
    );
  }

  const send = room.send;
  const phase = room.state.phase;

  // ChatPanel is rendered above each phase screen via composition inside
  // each child; passing `chat` props through avoids a global overlay layer
  // that conflicts with the screens' own backgrounds.
  switch (phase) {
    case 'lobby':
      return (
        <LobbyScreen
          state={room.state}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
        />
      );
    case 'deal':
      return (
        <OnlineDealScreen
          state={room.state}
          role={room.role}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
        />
      );
    case 'clue':
      return (
        <OnlineClueScreen
          state={room.state}
          role={room.role}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
        />
      );
    case 'vote':
      return (
        <OnlineVoteScreen
          state={room.state}
          role={room.role}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
        />
      );
    case 'reveal':
      return (
        <OnlineRevealScreen
          state={room.state}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
        />
      );
    case 'done':
    default:
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.ink }}>—</Text>
        </View>
      );
  }
}
