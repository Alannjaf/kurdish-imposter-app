// OnlineVoteScreen — tap-vote on suspected imposter; simultaneous reveal.
//
// Grid of player cards (matches offline VotePickScreen). Tap one →
// `{ type: 'vote', targetSeat, roundId: state.roundId }`. Own card disabled.
// After voting, the local UI shows "you voted X" and the card is locked
// (server is the source of truth — late changes aren't allowed in v1).
//
// Header shows votesCast / N counter and a countdown to voteEndsAt.
// Auto-advances on phase transition (server-driven; this screen unmounts).
//
// i18n keys used:
//   multiplayer.vote.title
//   multiplayer.vote.subtitle
//   multiplayer.vote.instructions
//   multiplayer.vote.cant_vote_self
//   multiplayer.vote.you_voted
//   multiplayer.vote.locked
//   multiplayer.vote.counter
//   multiplayer.vote.timer_label
//   multiplayer.vote.btn.lock_in
//   multiplayer.vote.no_pick

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, Display, Eyebrow, KilimBg } from '../../ui';
import { fonts, PALETTES, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { C2S, PublicRoomState } from '../protocol';
import { ChatPanel } from './ChatPanel';
import type { ChatMessage, RoleInfo } from '../__stub_usePartyRoom';

const AVATAR = ['#C24B33', '#2A285F', '#E5B458', '#8A8B47', '#A23A24', '#1B1A47'];

type Props = {
  state: PublicRoomState;
  /** Private role/word — visible to this player only. */
  role: RoleInfo | null;
  myPlayerId: string;
  send: (msg: C2S) => void;
  chat?: ChatMessage[];
  nowFn?: () => number;
};

export function OnlineVoteScreen({ state, role, myPlayerId, send, chat = [], nowFn }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale } = useLocale();
  const me = state.players.find((p) => p.playerId === myPlayerId);
  const mySeat = me?.seat ?? -1;

  const [picked, setPicked] = useState<number | null>(null);
  const [submittedSeat, setSubmittedSeat] = useState<number | null>(null);
  const [selfHint, setSelfHint] = useState(false);

  // Reset local pick if the round changes mid-screen (defensive).
  const prevRound = useRef(state.roundId);
  useEffect(() => {
    if (prevRound.current !== state.roundId) {
      setPicked(null);
      setSubmittedSeat(null);
      setSelfHint(false);
      prevRound.current = state.roundId;
    }
  }, [state.roundId]);

  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  // Countdown
  const totalMs = 30_000;
  const endsAt = state.voteEndsAt ?? (nowFn?.() ?? Date.now()) + totalMs;
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, endsAt - (nowFn?.() ?? Date.now()))
  );
  useEffect(() => {
    const tick = () => {
      const now = nowFn?.() ?? Date.now();
      setRemainingMs(Math.max(0, endsAt - now));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt, nowFn]);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const lockIn = () => {
    if (picked == null) return;
    if (picked === mySeat) return;
    send({ type: 'vote', targetSeat: picked, roundId: state.roundId });
    setSubmittedSeat(picked);
  };

  const submittedName =
    submittedSeat != null
      ? state.players.find((p) => p.seat === submittedSeat)?.name ?? ''
      : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
      <KilimBg color={colors.ink} opacity={0.04} />

      {/* Persistent role/word reminder — same as clue screen. */}
      {role ? (
        <View
          style={{
            marginHorizontal: 24,
            marginBottom: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: role.isImposter ? PALETTES.dark.indigoDark : colors.bgElev,
            borderWidth: role.isImposter ? 0 : 1,
            borderColor: colors.ink3,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: locale === 'en' ? 1.2 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              color: role.isImposter ? '#E89384' : colors.ink2,
              fontFamily: family,
            }}
          >
            {role.isImposter
              ? t('multiplayer.deal.imposter_word')
              : t('multiplayer.deal.your_word_label')}
          </Text>
          {!role.isImposter && role.word ? (
            <Text
              style={{
                fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                fontSize: 18,
                fontWeight: '700',
                color: colors.ink,
              }}
            >
              · {role.word}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 24, paddingBottom: 4 }}>
        <Eyebrow>{t('multiplayer.vote.subtitle')}</Eyebrow>
        <Display style={{ fontSize: 26, color: colors.ink, marginTop: 6 }}>
          {t('multiplayer.vote.title')}
        </Display>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: selfHint ? colors.pomegranate : colors.ink3,
              fontFamily: family,
              flex: 1,
            }}
          >
            {selfHint
              ? t('multiplayer.vote.cant_vote_self')
              : submittedSeat != null
                ? t('multiplayer.vote.you_voted', { name: submittedName })
                : t('multiplayer.vote.instructions')}
          </Text>
          <Text style={{ fontSize: 12, color: colors.ink3, fontFamily: family }}>
            {t('multiplayer.vote.counter', {
              cast: state.votesCast ?? 0,
              total: state.players.length,
            })}
            {'  ·  '}
            {t('multiplayer.vote.timer_label', { seconds: remainingSec })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {state.players.map((p) => {
            const isSelf = p.seat === mySeat;
            const isSel = picked === p.seat;
            const isSubmitted = submittedSeat === p.seat;
            const locked = submittedSeat != null;

            return (
              <TouchableOpacity
                key={p.playerId}
                onPress={() => {
                  if (locked) return;
                  if (isSelf) {
                    setSelfHint(true);
                    return;
                  }
                  if (selfHint) setSelfHint(false);
                  setPicked(p.seat);
                }}
                activeOpacity={isSelf || locked ? 1 : 0.8}
                disabled={isSelf || locked}
                style={{
                  width: '48%',
                  paddingVertical: 18,
                  paddingHorizontal: 12,
                  backgroundColor: isSubmitted
                    ? colors.pomegranate
                    : isSel
                      ? colors.ink
                      : colors.bgElev,
                  borderRadius: 18,
                  minHeight: 130,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  opacity: isSelf ? 0.4 : !p.connected ? 0.6 : 1,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: AVATAR[p.seat % AVATAR.length],
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: 20,
                      fontWeight: '800',
                      fontFamily: fonts.display,
                    }}
                  >
                    {p.seat + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    color: isSubmitted || isSel ? colors.bg : colors.ink,
                    fontSize: 14,
                    fontWeight: '600',
                    fontFamily: family,
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {p.name}
                </Text>
                {(isSel || isSubmitted) && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.gold,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={12} height={12} viewBox="0 0 12 12">
                      <Path
                        d="M2 6l3 3 5-6"
                        stroke={colors.indigoDark}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 90, gap: 8 }}>
        <Button
          title={
            submittedSeat != null
              ? t('multiplayer.vote.locked')
              : t('multiplayer.vote.btn.lock_in')
          }
          onPress={lockIn}
          disabled={picked == null || submittedSeat != null}
        />
      </View>

      <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
    </View>
  );
}

export default OnlineVoteScreen;
