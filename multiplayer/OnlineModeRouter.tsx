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
import { useVoiceChat } from './useVoiceChat';
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

type Session = { code: string; name: string; asHost: boolean; avatar?: string };

export function OnlineModeRouter({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(null);

  const handleJoin = (payload: OnlineHomeJoinPayload) => {
    const code = payload.code ?? randomRoomCode();
    setSession({ code, name: payload.name, asHost: payload.asHost, avatar: payload.avatar });
  };

  if (!session) {
    return <OnlineHomeScreen onJoin={handleJoin} onBack={onExit} />;
  }

  // Drop the session — RoomShell unmounts, its WebSocket tears down, and the
  // OnlineHomeScreen re-renders so the user can create / join another room.
  const handleLeaveRoom = () => setSession(null);

  return <RoomShell session={session} onLeaveRoom={handleLeaveRoom} />;
}

function RoomShell({
  session,
  onLeaveRoom,
}: {
  session: Session;
  /** Called after the user confirms "Leave room". RoomShell sends the leave
   *  message + tears down its WebSocket on next render via unmount; this
   *  callback is what asks OnlineModeRouter to drop the session and route
   *  back to OnlineHomeScreen. */
  onLeaveRoom: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const room = usePartyRoom({
    host: PARTYKIT_HOST,
    code: session.code,
    name: session.name,
    asHost: session.asHost,
    avatar: session.avatar,
  });

  const handleLeave = React.useCallback(() => {
    // Best-effort tell the server we're leaving so it can clean us up
    // before our WS closes; works even if the connection is mid-tear-down.
    try {
      room.send?.({ type: 'leave' });
    } catch {
      // ignore — the unmount below disconnects either way
    }
    onLeaveRoom();
  }, [room, onLeaveRoom]);

  const myPlayerId = useMemo(() => {
    // The hook persists playerId via AsyncStorage; surface it from the state if available.
    if (room.state) {
      const me = room.state.players.find((p) => p.name === session.name);
      if (me) return me.playerId;
    }
    return '';
  }, [room.state, session.name]);

  // Hooks must run unconditionally — compute peers + voice handle BEFORE any
  // early return for the loading screen below.
  const peerIds = useMemo(
    () =>
      (room.state?.players ?? [])
        .map((p) => p.playerId)
        .filter((id) => id !== myPlayerId),
    [room.state, myPlayerId]
  );
  const voice = useVoiceChat({
    client: room.client,
    myPlayerId,
    peers: peerIds,
  });

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
          voice={voice}
          onLeave={handleLeave}
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
          onLeave={handleLeave}
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
          onLeave={handleLeave}
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
          onLeave={handleLeave}
        />
      );
    case 'reveal':
      return (
        <OnlineRevealScreen
          state={room.state}
          myPlayerId={myPlayerId}
          send={send}
          chat={room.chat}
          onLeave={handleLeave}
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
