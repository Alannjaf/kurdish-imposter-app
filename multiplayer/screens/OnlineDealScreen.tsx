// OnlineDealScreen — per-player private role/word reveal.
//
// Civilians: light bg + KilimBorder around the word + category label
//            (mirrors offline DealRevealView civilian branch).
// Imposter:  dark indigo bg + DiamondBg + pomegranate Octagram + category hint
//            (mirrors offline DealRevealView imposter branch).
//
// "Got it" is informational — no per-player ready in v1. Auto-advances when
// the host taps "to vote" (which transitions phase server-side; this screen
// just unmounts when phase changes).
//
// i18n keys used:
//   multiplayer.deal.your_word_label
//   multiplayer.deal.imposter_word
//   multiplayer.deal.imposter_hint
//   multiplayer.deal.shhh
//   multiplayer.deal.category_prefix
//   multiplayer.deal.btn.got_it
//   multiplayer.deal.waiting_for_host
//   multiplayer.deal.role_pending

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { DiamondBg, Eyebrow, KilimBg, KilimBorder, Octagram } from '../../ui';
import { fonts, PALETTES, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { C2S, PublicRoomState } from '../protocol';
import { ChatPanel } from './ChatPanel';
import type { ChatMessage, RoleInfo } from '../__stub_usePartyRoom';

type Props = {
  state: PublicRoomState;
  /** Private role/word — null until the server's `role` message arrives. */
  role: RoleInfo | null;
  myPlayerId: string;
  send: (msg: C2S) => void;
  chat?: ChatMessage[];
};

export function OnlineDealScreen({ state, role, myPlayerId, send, chat = [] }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale } = useLocale();
  const me = state.players.find((p) => p.playerId === myPlayerId);
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;
  const display = locale === 'en' ? fonts.display : fonts.arabicDisplay;
  const categoryLabel =
    state.category != null
      ? locale === 'ku'
        ? state.category.label_ku
        : locale === 'en'
          ? state.category.label_en
          : state.category.label_ku
      : '';

  // Role hasn't arrived yet — show a neutral placeholder.
  if (role == null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
        <KilimBg color={colors.ink} opacity={0.05} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Eyebrow style={{ marginBottom: 10 }}>{t('multiplayer.deal.role_pending')}</Eyebrow>
          <Text
            style={{
              fontFamily: display,
              fontSize: 28,
              fontWeight: '700',
              color: colors.ink,
              textAlign: 'center',
            }}
          >
            …
          </Text>
        </View>
        <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
      </View>
    );
  }

  if (role.isImposter) {
    const indigoDark = PALETTES.dark.indigoDark;
    return (
      <View style={{ flex: 1, backgroundColor: indigoDark, paddingTop: 50 }}>
        <DiamondBg color={colors.pomegranate} opacity={0.12} size={80} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
          }}
        >
          <View style={{ marginBottom: 24 }}>
            <Octagram size={56} color={colors.pomegranate} />
          </View>
          <Text
            style={{
              color: '#E89384',
              fontFamily: family,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 16,
            }}
          >
            {t('multiplayer.deal.shhh')}
          </Text>
          <Text
            style={{
              fontFamily: display,
              fontSize: locale === 'en' ? 44 : 36,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: locale === 'en' ? 50 : 56,
              maxWidth: 280,
              letterSpacing: -0.5,
            }}
          >
            {t('multiplayer.deal.imposter_word')}
          </Text>

          <View
            style={{
              marginTop: 28,
              paddingVertical: 14,
              paddingHorizontal: 20,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 12,
                marginBottom: 4,
                fontFamily: family,
              }}
            >
              {t('multiplayer.deal.imposter_hint')}
            </Text>
            <Text
              style={{
                fontFamily: display,
                fontSize: 22,
                fontWeight: '700',
                color: colors.gold,
              }}
            >
              {categoryLabel}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 90 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            // "Got it" is a UI-only acknowledgement — no server message in v1.
            onPress={() => {
              /* informational; phase advances when host calls to_vote */
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: 22,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: display,
                fontWeight: '600',
                fontSize: 16,
                color: '#FFFFFF',
              }}
            >
              {t('multiplayer.deal.btn.got_it')}
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              marginTop: 10,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 12,
              fontFamily: family,
            }}
          >
            {t('multiplayer.deal.waiting_for_host')}
          </Text>
        </View>

        <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
      </View>
    );
  }

  // Civilian view
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
      <KilimBg color={colors.ink} opacity={0.06} />

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Eyebrow style={{ marginBottom: 12 }}>{t('multiplayer.deal.your_word_label')}</Eyebrow>
        <View style={{ width: '60%' }}>
          <KilimBorder color={colors.pomegranate} thin />
        </View>
        <View style={{ height: 28 }} />
        <Text
          style={{
            fontFamily: display,
            fontSize: locale === 'en' ? 56 : 64,
            fontWeight: '800',
            color: colors.pomegranate,
            textAlign: 'center',
            lineHeight: locale === 'en' ? 60 : 80,
            letterSpacing: -0.5,
          }}
        >
          {role.word ?? ''}
        </Text>
        <View style={{ height: 28 }} />
        <View style={{ width: '60%' }}>
          <KilimBorder color={colors.pomegranate} thin />
        </View>
        <Text
          style={{
            marginTop: 28,
            fontSize: 14,
            color: colors.ink3,
            fontFamily: family,
          }}
        >
          {t('multiplayer.deal.category_prefix', { category: categoryLabel })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 90 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            /* informational; phase advances when host calls to_vote */
          }}
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 22,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: display,
              fontWeight: '700',
              fontSize: 18,
              color: colors.bg,
            }}
          >
            {t('multiplayer.deal.btn.got_it')}
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            marginTop: 10,
            textAlign: 'center',
            color: colors.ink3,
            fontSize: 12,
            fontFamily: family,
          }}
        >
          {t('multiplayer.deal.waiting_for_host')}
        </Text>
      </View>

      <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
    </View>
  );
}

// Note: i18n string for `multiplayer.deal.category_prefix` should accept
// {category} interpolation — Task 5 must include that var.

export default OnlineDealScreen;
