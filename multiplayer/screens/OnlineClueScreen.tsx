// OnlineClueScreen — clue / discussion phase with countdown timer.
//
// Mirrors the offline DiscussScreen visual: large circular timer + category
// pill + roster strip. ChatPanel is the primary interaction surface; host has
// a "Skip to Vote" button that fires `to_vote`. Auto-advances when timer 0
// (server-driven; this screen just unmounts when phase changes).
//
// i18n keys used:
//   multiplayer.clue.title
//   multiplayer.clue.timer_label
//   multiplayer.clue.instructions
//   multiplayer.clue.players_label
//   multiplayer.clue.btn.skip_to_vote
//   multiplayer.clue.category_prefix
//   multiplayer.clue.waiting_for_host

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Button, Eyebrow, KilimBg, Pill } from '../../ui';
import { fonts, PALETTES, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { C2S, PublicRoomState } from '../protocol';
import { ChatPanel } from './ChatPanel';
import type { ChatMessage, RoleInfo } from '../__stub_usePartyRoom';

type Props = {
  state: PublicRoomState;
  /** Private role/word — visible to this player only. Persisted across deal→clue→vote. */
  role: RoleInfo | null;
  myPlayerId: string;
  send: (msg: C2S) => void;
  chat?: ChatMessage[];
  /** Override `Date.now()` for tests / fixtures. */
  nowFn?: () => number;
};

export function OnlineClueScreen({ state, role, myPlayerId, send, chat = [], nowFn }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const isHost = state.hostPlayerId === myPlayerId;
  const me = state.players.find((p) => p.playerId === myPlayerId);
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  const totalMs = state.options.roundSeconds * 1000;
  const endsAt = state.clueEndsAt ?? (nowFn?.() ?? Date.now()) + totalMs;
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, endsAt - (nowFn?.() ?? Date.now()))
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = nowFn?.() ?? Date.now();
      setRemainingMs(Math.max(0, endsAt - now));
    };
    tick();
    tickRef.current = setInterval(tick, 500);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [endsAt, nowFn]);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = totalMs > 0 ? remainingMs / totalMs : 0;
  const radius = 110;
  const C = 2 * Math.PI * radius;
  const offset = C * (1 - pct);

  const mm = Math.floor(remainingSec / 60).toString().padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  const timeText = `${mm}:${ss}`;

  const categoryLabel =
    state.category != null
      ? locale === 'ku'
        ? state.category.label_ku
        : locale === 'en'
          ? state.category.label_en
          : state.category.label_ku
      : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
      <KilimBg color={colors.ink} opacity={0.05} />

      {/* Persistent role/word badge — server auto-advances deal→clue too fast for
          users to read the reveal screen, so we keep it visible through the round. */}
      {role ? (
        <View
          style={{
            marginHorizontal: 24,
            marginBottom: 12,
            padding: 14,
            borderRadius: 14,
            backgroundColor: role.isImposter ? PALETTES.dark.indigoDark : colors.bgElev,
            borderWidth: role.isImposter ? 0 : 1,
            borderColor: colors.ink3,
            alignItems: 'center',
          }}
        >
          <Eyebrow
            style={{
              marginBottom: 4,
              color: role.isImposter ? '#E89384' : colors.ink2,
            }}
          >
            {role.isImposter
              ? t('multiplayer.deal.imposter_word')
              : t('multiplayer.deal.your_word_label')}
          </Eyebrow>
          {!role.isImposter && role.word ? (
            <Text
              style={{
                fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                fontSize: 24,
                fontWeight: '700',
                color: colors.ink,
              }}
            >
              {role.word}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          marginBottom: 8,
        }}
      >
        <Pill>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.olive,
              marginEnd: 6,
            }}
          />
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.ink2 }}>
            {t('multiplayer.clue.title')}
          </Text>
        </Pill>
        {state.category ? (
          <Pill>
            <Text style={{ fontSize: 13, color: colors.ink2 }}>
              {t('multiplayer.clue.category_prefix', { category: categoryLabel })}
            </Text>
          </Pill>
        ) : null}
      </View>

      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: 16,
        }}
      >
        <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
          <Svg
            width={240}
            height={240}
            style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
          >
            <Circle cx={120} cy={120} r={radius} stroke={colors.bgElev} strokeWidth={10} fill="none" />
            <Circle
              cx={120}
              cy={120}
              r={radius}
              stroke={colors.pomegranate}
              strokeWidth={10}
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </Svg>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Eyebrow style={{ marginBottom: 6 }}>{t('multiplayer.clue.timer_label')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 60,
                fontWeight: '800',
                color: colors.ink,
                letterSpacing: -2,
              }}
            >
              {timeText}
            </Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: 22,
            fontSize: 15,
            color: colors.ink2,
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 300,
            fontFamily: family,
          }}
        >
          {t('multiplayer.clue.instructions')}
        </Text>
      </View>

      {/* Players strip */}
      <View style={{ paddingTop: 18, paddingHorizontal: 16 }}>
        <Eyebrow style={{ marginBottom: 8, marginStart: 6 }}>
          {t('multiplayer.clue.players_label')}
        </Eyebrow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
          {state.players.map((p) => (
            <View
              key={p.playerId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: colors.bgElev,
                opacity: p.connected ? 1 : 0.4,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: p.connected ? colors.olive : colors.ink3,
                }}
              />
              <Text style={{ fontSize: 13, color: colors.ink, fontFamily: family }}>
                {p.avatar ? `${p.avatar} ` : ''}{p.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ paddingHorizontal: 24, paddingBottom: 90 }}>
        {isHost ? (
          <Button
            title={t('multiplayer.clue.btn.skip_to_vote')}
            onPress={() => send({ type: 'to_vote' })}
          />
        ) : (
          <Text
            style={{
              textAlign: 'center',
              color: colors.ink3,
              fontSize: 13,
              fontFamily: family,
            }}
          >
            {t('multiplayer.clue.waiting_for_host')}
          </Text>
        )}
      </View>

      <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
    </View>
  );
}

export default OnlineClueScreen;
