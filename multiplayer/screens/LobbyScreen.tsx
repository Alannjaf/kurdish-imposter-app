// LobbyScreen — pre-game waiting room.
//
// Shows: 4-letter code (large) + copy button, player roster, host options
// (category, imposter count, round seconds, steal-guess switch), Start button.
// ChatPanel is mounted as an overlay so chat works pre-game too.
//
// Host options use `set_options` C2S; only host sees them as interactive.
// Start is enabled when players.length >= MIN_PLAYERS.
//
// Clipboard: web uses navigator.clipboard.writeText; native shows the code so
// users can long-press / hand-copy. We deliberately do NOT introduce a new
// expo-clipboard dep at this stage.
//
// i18n keys used:
//   multiplayer.lobby.title
//   multiplayer.lobby.subtitle
//   multiplayer.lobby.code_label
//   multiplayer.lobby.copy
//   multiplayer.lobby.copied
//   multiplayer.lobby.players_heading
//   multiplayer.lobby.player_host
//   multiplayer.lobby.player_disconnected
//   multiplayer.lobby.options_heading
//   multiplayer.lobby.options.category
//   multiplayer.lobby.options.imposters
//   multiplayer.lobby.options.round_seconds
//   multiplayer.lobby.options.steal_guess
//   multiplayer.lobby.options.steal_guess_on
//   multiplayer.lobby.options.steal_guess_off
//   multiplayer.lobby.options.host_only
//   multiplayer.lobby.start
//   multiplayer.lobby.need_more_players
//   multiplayer.lobby.round_seconds.short
//   multiplayer.lobby.round_seconds.medium
//   multiplayer.lobby.round_seconds.long
//   multiplayer.lobby.round_seconds.xlong

import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Display,
  Eyebrow,
  KilimBg,
  Pill,
  Screen,
} from '../../ui';
import { fonts, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { WORDS } from '../../game';
import {
  C2S,
  MIN_PLAYERS,
  PublicRoomState,
  RoomOptions,
} from '../protocol';
import { ChatPanel } from './ChatPanel';
import { buildWhatsAppShareUrl } from '../shareLink';
import type { ChatMessage } from '../__stub_usePartyRoom';

const ROUND_SECONDS_OPTIONS = [60, 120, 180, 300] as const;
const IMPOSTER_OPTIONS = [1, 2, 3] as const;

type Props = {
  state: PublicRoomState;
  myPlayerId: string;
  send: (msg: C2S) => void;
  /** Optional chat — when omitted, ChatPanel is still mounted but starts empty. */
  chat?: ChatMessage[];
};

export function LobbyScreen({ state, myPlayerId, send, chat = [] }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const [copied, setCopied] = useState(false);

  const isHost = state.hostPlayerId === myPlayerId;
  const me = state.players.find((p) => p.playerId === myPlayerId);
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  const onCopy = async () => {
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(state.code);
      }
    } catch {
      // best effort
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onShareWhatsApp = () => {
    const body = t('multiplayer.lobby.share_message', { code: state.code });
    const url = buildWhatsAppShareUrl(state.code, body);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Linking } = require('react-native');
      Linking.openURL(url).catch(() => {});
    }
  };

  const updateOptions = (patch: Partial<RoomOptions>) => {
    const next: RoomOptions = { ...state.options, ...patch };
    send({
      type: 'set_options',
      categoryKey: next.categoryKey,
      imposterCount: next.imposterCount,
      roundSeconds: next.roundSeconds,
      stealGuess: next.stealGuess,
    });
  };

  const enoughPlayers = state.players.length >= MIN_PLAYERS;

  return (
    <Screen>
      <KilimBg color={colors.ink} opacity={0.05} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Eyebrow>{t('multiplayer.lobby.subtitle')}</Eyebrow>
        <Display style={{ fontSize: 30, color: colors.ink, marginTop: 6, marginBottom: 18 }}>
          {t('multiplayer.lobby.title')}
        </Display>

        {/* Room code card */}
        <Card style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 20 }}>
          <Eyebrow style={{ marginBottom: 8 }}>{t('multiplayer.lobby.code_label')}</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 56,
              fontWeight: '800',
              color: colors.pomegranate,
              letterSpacing: 12,
            }}
          >
            {state.code}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              onPress={onCopy}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: copied ? colors.olive : colors.bgElev,
              }}
            >
              <Text
                style={{
                  color: copied ? '#FFFFFF' : colors.ink,
                  fontFamily: family,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                {copied ? t('multiplayer.lobby.copied') : t('multiplayer.lobby.copy')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onShareWhatsApp}
              accessibilityLabel="share-whatsapp"
              style={{
                paddingVertical: 8,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: '#25D366',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: family,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                {t('multiplayer.lobby.share_whatsapp')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Players */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, fontFamily: family }}>
              {t('multiplayer.lobby.players_heading')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: '800',
                color: colors.pomegranate,
              }}
            >
              {state.players.length}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {state.players.map((p) => {
              const isThisHost = p.playerId === state.hostPlayerId;
              return (
                <View
                  key={p.playerId}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: colors.bgElev,
                    opacity: p.connected ? 1 : 0.5,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: AVATAR[p.seat % AVATAR.length],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFF',
                        fontFamily: fonts.display,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {p.seat + 1}
                    </Text>
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.ink,
                      fontFamily: family,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {state.scores?.[p.playerId] > 0 ? (
                    <Pill style={{ backgroundColor: colors.olive }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>
                        🏆 {state.scores[p.playerId]}
                      </Text>
                    </Pill>
                  ) : null}
                  {isThisHost ? (
                    <Pill style={{ backgroundColor: colors.gold }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.indigoDark }}>
                        {t('multiplayer.lobby.player_host')}
                      </Text>
                    </Pill>
                  ) : null}
                  {!p.connected ? (
                    <Pill>
                      <Text style={{ fontSize: 11, color: colors.ink3 }}>
                        {t('multiplayer.lobby.player_disconnected')}
                      </Text>
                    </Pill>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* Options (host editable; others see read-only) */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, fontFamily: family }}>
              {t('multiplayer.lobby.options_heading')}
            </Text>
            {!isHost ? (
              <Text style={{ fontSize: 12, color: colors.ink3, fontFamily: family }}>
                {t('multiplayer.lobby.options.host_only')}
              </Text>
            ) : null}
          </View>

          {/* Category */}
          <Card style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 13,
                color: colors.ink2,
                marginBottom: 10,
                fontFamily: family,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('multiplayer.lobby.options.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                ...WORDS.categories.map((cat) => ({
                  key: cat.key,
                  label:
                    locale === 'ku'
                      ? cat.label_ku
                      : locale === 'en'
                        ? cat.label_en
                        : cat.label_ku,
                })),
                { key: 'custom', label: t('multiplayer.lobby.options.custom') },
              ].map((cat) => {
                const sel = cat.key === state.options.categoryKey;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    disabled={!isHost}
                    onPress={() =>
                      cat.key === 'custom'
                        ? updateOptions({
                            categoryKey: 'custom',
                            customWords: state.options.customWords ?? [],
                          })
                        : updateOptions({ categoryKey: cat.key })
                    }
                    style={{
                      minWidth: '46%',
                      flexGrow: 1,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: sel ? colors.ink : colors.bgElev,
                      alignItems: 'center',
                      opacity: !isHost && !sel ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: sel ? colors.bg : colors.ink,
                        fontFamily: family,
                        textAlign: 'center',
                      }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {state.options.categoryKey === 'custom' && isHost ? (
              <CustomWordsEditor
                value={state.options.customWords ?? []}
                onCommit={(pairs) =>
                  updateOptions({ categoryKey: 'custom', customWords: pairs })
                }
                isRTL={isRTL}
                family={family}
                t={t}
                colors={colors}
              />
            ) : null}
            {state.options.categoryKey === 'custom' && !isHost ? (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.ink3,
                  fontFamily: family,
                  marginTop: 10,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('multiplayer.lobby.options.custom_pairs_count', {
                  n: state.options.customWords?.length ?? 0,
                })}
              </Text>
            ) : null}
          </Card>

          {/* Imposter count */}
          <Card style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 13,
                color: colors.ink2,
                marginBottom: 10,
                fontFamily: family,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('multiplayer.lobby.options.imposters')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {IMPOSTER_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  flex
                  label={n}
                  active={n === state.options.imposterCount}
                  disabled={!isHost}
                  style={{ opacity: !isHost && n !== state.options.imposterCount ? 0.6 : 1 }}
                  onPress={() => isHost && updateOptions({ imposterCount: n })}
                />
              ))}
            </View>
          </Card>

          {/* Round seconds */}
          <Card style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 13,
                color: colors.ink2,
                marginBottom: 10,
                fontFamily: family,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('multiplayer.lobby.options.round_seconds')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ROUND_SECONDS_OPTIONS.map((s) => {
                const sel = s === state.options.roundSeconds;
                const label = roundSecondsLabel(s, t);
                return (
                  <TouchableOpacity
                    key={s}
                    disabled={!isHost}
                    onPress={() => updateOptions({ roundSeconds: s })}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: sel ? colors.ink : colors.bgElev,
                      alignItems: 'center',
                      opacity: !isHost && !sel ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: sel ? colors.bg : colors.ink,
                        fontFamily: family,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Steal-guess switch */}
          <Card>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: colors.ink,
                  fontFamily: family,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('multiplayer.lobby.options.steal_guess')}
              </Text>
              <TouchableOpacity
                disabled={!isHost}
                onPress={() => updateOptions({ stealGuess: !state.options.stealGuess })}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: state.options.stealGuess ? colors.olive : colors.bgElev,
                  opacity: !isHost ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: state.options.stealGuess ? '#FFFFFF' : colors.ink2,
                    fontSize: 13,
                    fontWeight: '700',
                    fontFamily: family,
                  }}
                >
                  {state.options.stealGuess
                    ? t('multiplayer.lobby.options.steal_guess_on')
                    : t('multiplayer.lobby.options.steal_guess_off')}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Start button (host only) */}
        {isHost ? (
          <View>
            <Button
              title={t('multiplayer.lobby.start')}
              disabled={!enoughPlayers}
              onPress={() => send({ type: 'start' })}
            />
            {!enoughPlayers ? (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: colors.ink3,
                  fontFamily: family,
                  textAlign: 'center',
                }}
              >
                {t('multiplayer.lobby.need_more_players')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ChatPanel chat={chat} send={send} mySeat={me?.seat ?? null} />
    </Screen>
  );
}

function roundSecondsLabel(s: number, t: (k: string) => string): string {
  if (s <= 60) return t('multiplayer.lobby.round_seconds.short');
  if (s <= 120) return t('multiplayer.lobby.round_seconds.medium');
  if (s <= 180) return t('multiplayer.lobby.round_seconds.long');
  return t('multiplayer.lobby.round_seconds.xlong');
}

const AVATAR = ['#C24B33', '#2A285F', '#E5B458', '#8A8B47', '#A23A24', '#1B1A47'];

// ---------------------------------------------------------------------------
// Custom words editor — host enters pairs as "crew|imposter" one per line.

function parseCustomWords(raw: string): { crew: string; imposter: string }[] {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const [crew = '', imposter = ''] = line.split('|');
      return { crew: crew.trim(), imposter: imposter.trim() || crew.trim() };
    })
    .filter((p) => p.crew.length > 0);
}

function CustomWordsEditor({
  value,
  onCommit,
  isRTL,
  family,
  t,
  colors,
}: {
  value: { crew: string; imposter: string }[];
  onCommit: (pairs: { crew: string; imposter: string }[]) => void;
  isRTL: boolean;
  family: string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  colors: { ink: string; ink2: string; ink3: string; bgElev: string; line: string; pomegranate: string; olive: string };
}) {
  const initial = value.map((p) => `${p.crew}|${p.imposter}`).join('\n');
  const [draft, setDraft] = useState(initial);
  const parsed = useMemo(() => parseCustomWords(draft), [draft]);
  const count = parsed.length;
  const minReached = count >= 5;
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      <Text style={{ fontSize: 12, color: colors.ink2, fontFamily: family, textAlign: isRTL ? 'right' : 'left' }}>
        {t('multiplayer.lobby.options.custom_help')}
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => onCommit(parsed)}
        multiline
        numberOfLines={6}
        placeholder={t('multiplayer.lobby.options.custom_placeholder')}
        placeholderTextColor={colors.ink3}
        style={{
          minHeight: 120,
          padding: 10,
          borderRadius: 10,
          backgroundColor: colors.bgElev,
          borderWidth: 1,
          borderColor: minReached ? colors.olive : colors.line,
          fontFamily: family,
          color: colors.ink,
          fontSize: 14,
          textAlign: isRTL ? 'right' : 'left',
          textAlignVertical: 'top',
        }}
      />
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: minReached ? colors.olive : colors.pomegranate,
          fontFamily: family,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {t('multiplayer.lobby.options.custom_pairs_count', { n: count })}
      </Text>
    </View>
  );
}

export default LobbyScreen;
