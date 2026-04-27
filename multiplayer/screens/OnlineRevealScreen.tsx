// OnlineRevealScreen — round result + optional imposter steal-guess.
//
// Mirrors offline RevealScreen: light bg if civilians win, dark indigo if
// imposter wins. Shows accused player, whether they were imposter, the actual
// word, and the seat(s) of the actual imposter(s).
//
// If state.options.stealGuess && state.result.accusedWasImposter && I am that
// accused imposter, show TextInput + "Steal" button that fires `steal_guess`.
// After a steal_guess attempt resolves, the result is reflected in
// state.result.stealGuessUsed.
//
// Host gets "Next Round" button; non-hosts wait.
//
// i18n keys used:
//   multiplayer.reveal.title
//   multiplayer.reveal.crew_wins_label
//   multiplayer.reveal.imposter_wins_label
//   multiplayer.reveal.crew_wins
//   multiplayer.reveal.imposter_wins
//   multiplayer.reveal.imposter_label_singular
//   multiplayer.reveal.imposter_label_plural
//   multiplayer.reveal.word_was
//   multiplayer.reveal.steal.title
//   multiplayer.reveal.steal.subtitle
//   multiplayer.reveal.steal.placeholder
//   multiplayer.reveal.steal.btn
//   multiplayer.reveal.steal.correct
//   multiplayer.reveal.steal.wrong
//   multiplayer.reveal.btn.next_round
//   multiplayer.reveal.waiting_for_host

import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button, DiamondBg, Octagram, Pill } from '../../ui';
import { fonts, PALETTES, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { C2S, PublicRoomState } from '../protocol';
import { ChatPanel } from './ChatPanel';
import type { ChatMessage } from '../__stub_usePartyRoom';

type Props = {
  state: PublicRoomState;
  myPlayerId: string;
  send: (msg: C2S) => void;
  chat?: ChatMessage[];
};

export function OnlineRevealScreen({ state, myPlayerId, send, chat = [] }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const me = state.players.find((p) => p.playerId === myPlayerId);
  const isHost = state.hostPlayerId === myPlayerId;
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;
  const display = locale === 'en' ? fonts.display : fonts.arabicDisplay;

  const result = state.result;

  // Defensive: if a reveal screen ever renders before the server populated
  // `result`, show a soft placeholder rather than crashing.
  if (!result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.ink2, fontFamily: family }}>…</Text>
        </View>
        <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
      </View>
    );
  }

  const groupWon = result.winners === 'civilians';
  const accused = state.players.find((p) => p.seat === result.accusedSeat);
  const imposterPlayers = state.players.filter((p) =>
    result.imposterSeats.includes(p.seat)
  );

  const myImposterEntry = imposterPlayers.find((p) => p.playerId === myPlayerId);
  const isCaughtImposter =
    state.options.stealGuess &&
    result.accusedWasImposter &&
    myImposterEntry != null &&
    myImposterEntry.seat === result.accusedSeat &&
    !result.stealGuessUsed;

  const bg = groupWon ? colors.bg : PALETTES.dark.indigoDark;
  const ink = groupWon ? colors.ink : '#FFFFFF';
  const subInk = groupWon ? colors.ink2 : 'rgba(255,255,255,0.7)';
  const subInk2 = groupWon ? colors.ink3 : 'rgba(255,255,255,0.55)';

  const imposterCardBg = groupWon ? colors.ink : colors.pomegranate;
  const wordCardBg = groupWon ? colors.bgElev : 'rgba(255,255,255,0.08)';
  const wordCardBorder = groupWon ? colors.line : 'rgba(255,255,255,0.15)';

  const imposterLabelKey =
    imposterPlayers.length > 1
      ? 'multiplayer.reveal.imposter_label_plural'
      : 'multiplayer.reveal.imposter_label_singular';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: 50 }}>
      <DiamondBg
        color={groupWon ? colors.pomegranate : colors.gold}
        opacity={groupWon ? 0.05 : 0.1}
        size={50}
      />

      <View style={{ paddingHorizontal: 24 }}>
        <Pill style={{ backgroundColor: groupWon ? colors.bgElev : 'rgba(255,255,255,0.1)' }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: subInk }}>
            {t('multiplayer.reveal.title')}
          </Text>
        </Pill>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              color: groupWon ? colors.olive : '#E89384',
              fontFamily: family,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 8,
            }}
          >
            {groupWon
              ? t('multiplayer.reveal.crew_wins_label')
              : t('multiplayer.reveal.imposter_wins_label')}
          </Text>
          <Text
            style={{
              fontFamily: display,
              fontSize: locale === 'en' ? 32 : 26,
              fontWeight: '800',
              color: ink,
              lineHeight: locale === 'en' ? 38 : 38,
              letterSpacing: -0.5,
            }}
          >
            {groupWon
              ? t('multiplayer.reveal.crew_wins', { name: accused?.name ?? '' })
              : t('multiplayer.reveal.imposter_wins', { name: accused?.name ?? '' })}
          </Text>
        </View>

        {/* Imposter card */}
        <View
          style={{
            backgroundColor: imposterCardBg,
            borderRadius: 22,
            padding: 22,
            marginBottom: 14,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -10,
              right: -10,
              opacity: 0.15,
            }}
          >
            <Octagram size={90} color="#FFFFFF" />
          </View>
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontFamily: family,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 8,
            }}
          >
            {t(imposterLabelKey)}
          </Text>
          {imposterPlayers.map((imp, i) => (
            <View
              key={imp.playerId}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
                marginTop: i > 0 ? 8 : 0,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontWeight: '800',
                    fontSize: 18,
                    color: colors.indigoDark,
                  }}
                >
                  {imp.seat + 1}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: display,
                  fontSize: locale === 'en' ? 28 : 24,
                  fontWeight: '800',
                  color: '#FFFFFF',
                }}
              >
                {imp.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Word card */}
        <View
          style={{
            backgroundColor: wordCardBg,
            borderRadius: 22,
            paddingVertical: 16,
            paddingHorizontal: 22,
            borderWidth: 1.5,
            borderColor: wordCardBorder,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              color: subInk2,
              fontFamily: family,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
            }}
          >
            {t('multiplayer.reveal.word_was')}
          </Text>
          <Text
            style={{
              fontFamily: display,
              fontSize: 24,
              fontWeight: '800',
              color: groupWon ? colors.pomegranate : colors.gold,
            }}
          >
            {result.word}
          </Text>
        </View>

        {/* Steal-guess input — only for the caught imposter, only if not yet used */}
        {isCaughtImposter ? (
          <StealGuessCard
            ink={ink}
            subInk={subInk}
            family={family}
            display={display}
            send={send}
            roundId={state.roundId}
          />
        ) : null}

        {/* Steal-guess outcome (visible to everyone once it lands) */}
        {result.stealGuessUsed ? (
          <View
            style={{
              backgroundColor: result.stealGuessUsed.correct ? colors.pomegranate : colors.olive,
              borderRadius: 18,
              padding: 16,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: display,
                fontWeight: '700',
                fontSize: 16,
                marginBottom: 4,
              }}
            >
              {result.stealGuessUsed.correct
                ? t('multiplayer.reveal.steal.correct')
                : t('multiplayer.reveal.steal.wrong')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: family }}>
              "{result.stealGuessUsed.word}"
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 90, gap: 10 }}>
        {isHost ? (
          <Button
            title={t('multiplayer.reveal.btn.next_round')}
            kind={groupWon ? 'primary' : 'gold'}
            onPress={() => send({ type: 'next_round' })}
          />
        ) : (
          <Text
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: subInk2,
              fontFamily: family,
            }}
          >
            {t('multiplayer.reveal.waiting_for_host')}
          </Text>
        )}
      </View>

      <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
    </View>
  );
}

function StealGuessCard({
  ink,
  subInk,
  family,
  display,
  send,
  roundId,
}: {
  ink: string;
  subInk: string;
  family: string;
  display: string;
  send: (msg: C2S) => void;
  roundId: number;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { isRTL } = useLocale();

  const submit = () => {
    const w = guess.trim();
    if (!w) return;
    send({ type: 'steal_guess', word: w, roundId });
    setSubmitted(true);
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          fontFamily: display,
          fontSize: 18,
          fontWeight: '800',
          color: ink,
          marginBottom: 4,
        }}
      >
        {t('multiplayer.reveal.steal.title')}
      </Text>
      <Text style={{ fontFamily: family, fontSize: 13, color: subInk, marginBottom: 12 }}>
        {t('multiplayer.reveal.steal.subtitle')}
      </Text>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TextInput
          value={guess}
          onChangeText={(v) => setGuess(v.slice(0, 60))}
          editable={!submitted}
          placeholder={t('multiplayer.reveal.steal.placeholder')}
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={{
            flex: 1,
            fontSize: 16,
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            fontFamily: family,
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
        <TouchableOpacity
          onPress={submit}
          disabled={submitted || guess.trim().length === 0}
          style={{
            backgroundColor:
              submitted || guess.trim().length === 0 ? 'rgba(255,255,255,0.15)' : colors.gold,
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              color: submitted || guess.trim().length === 0 ? 'rgba(255,255,255,0.5)' : colors.indigoDark,
              fontFamily: display,
              fontWeight: '700',
              fontSize: 14,
            }}
          >
            {t('multiplayer.reveal.steal.btn')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default OnlineRevealScreen;
