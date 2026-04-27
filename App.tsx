import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Button,
  Card,
  Chip,
  DiamondBg,
  Display,
  Eyebrow,
  KilimBg,
  KilimBorder,
  Ku,
  Octagram,
  Pill,
  Screen,
} from './ui';
import {
  ThemeProvider,
  useTheme,
  useThemeColors,
  fonts,
  PALETTES,
} from './theme';
import {
  DEFAULT_CONFIG,
  GameConfig,
  GameState,
  PlayerAssignment,
  WORDS,
  accusedFromTallies,
  dealGame,
  defaultPlayerName,
  formatTime,
} from './game';
import {
  I18nProvider,
  LOCALES,
  LOCALE_LABELS,
  Locale,
  useLocale,
  useT,
} from './i18n';
import { MuteProvider, play, useMuted } from './sound';
import { feedback, haptic } from './haptics';

type ScreenName =
  | 'home'
  | 'how_to_play'
  | 'setup'
  | 'deal'
  | 'discuss'
  | 'vote_pass'
  | 'vote'
  | 'reveal';

// Convert ASCII numerals to Arabic-Indic for ku/ar locales.
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function localizeNumber(n: number | string, locale: Locale): string {
  const s = String(n);
  if (locale === 'en') return s;
  return s.replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

// Color palette per seat — used for avatar dots throughout the flow.
function avatarColors(themeColors: ReturnType<typeof useThemeColors>) {
  return [
    themeColors.pomegranate,
    themeColors.indigo,
    themeColors.gold,
    themeColors.olive,
    themeColors.pomegranateDark,
    themeColors.indigoDark,
  ];
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <MuteProvider>
          <AppInner />
        </MuteProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const [screen, setScreen] = useState<ScreenName>('home');
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [game, setGame] = useState<GameState | null>(null);
  const [accused, setAccused] = useState<number | null>(null);
  // Per-player secret voting state. `voterIndex` is the seat of the player
  // currently casting their vote (0-based). `voteTallies` accumulates votes
  // per seat (length === playerCount). Both reset on every new game.
  const [voterIndex, setVoterIndex] = useState(0);
  const [voteTallies, setVoteTallies] = useState<number[]>([]);

  const start = () => {
    const g = dealGame(config);
    setGame(g);
    setAccused(null);
    setVoterIndex(0);
    setVoteTallies(Array.from({ length: g.assignments.length }, () => 0));
    setScreen('deal');
  };

  // Begin the voting phase: reset tallies + voter index, jump to vote-pass.
  const beginVoting = () => {
    if (!game) return;
    setVoterIndex(0);
    setVoteTallies(Array.from({ length: game.assignments.length }, () => 0));
    setScreen('vote_pass');
  };

  // Record a single voter's pick. If this was the last voter, compute the
  // accused seat from tallies and advance to the reveal screen.
  const submitVote = (pickedSeat: number) => {
    if (!game) return;
    const nextTallies = voteTallies.slice();
    nextTallies[pickedSeat] = (nextTallies[pickedSeat] ?? 0) + 1;
    setVoteTallies(nextTallies);
    const isLastVoter = voterIndex >= game.assignments.length - 1;
    if (isLastVoter) {
      const accusedSeat = accusedFromTallies(nextTallies);
      setAccused(accusedSeat);
      setScreen('reveal');
    } else {
      setVoterIndex(voterIndex + 1);
      setScreen('vote_pass');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      {screen === 'home' && (
        <HomeScreen
          onPlay={() => setScreen('setup')}
          onHowToPlay={() => setScreen('how_to_play')}
        />
      )}
      {screen === 'how_to_play' && <HowToPlayScreen onBack={() => setScreen('home')} />}
      {screen === 'setup' && (
        <SetupScreen
          config={config}
          onConfig={setConfig}
          onStart={start}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'deal' && game && (
        <DealScreen
          game={game}
          onFinish={() => setScreen('discuss')}
          onCancel={() => setScreen('home')}
        />
      )}
      {screen === 'discuss' && game && (
        <DiscussScreen
          game={game}
          onDone={beginVoting}
          onCancel={() => setScreen('home')}
        />
      )}
      {screen === 'vote_pass' && game && (
        <VotePassScreen
          seat={voterIndex}
          total={game.assignments.length}
          name={game.assignments[voterIndex]?.name ?? ''}
          onReady={() => setScreen('vote')}
          onBack={() => setScreen('discuss')}
        />
      )}
      {screen === 'vote' && game && (
        <VotePickScreen
          game={game}
          voterIndex={voterIndex}
          onVote={submitVote}
          onBack={() => setScreen('vote_pass')}
        />
      )}
      {screen === 'reveal' && game && accused !== null && (
        <RevealScreen
          game={game}
          accused={accused}
          onReplay={start}
          onHome={() => setScreen('home')}
        />
      )}
    </SafeAreaView>
  );
}

function useAssignmentWord(): (a: PlayerAssignment) => string {
  const t = useT();
  return (a) => (a.isImposter ? t('deal.reveal.imposter_word') : a.word ?? '');
}

function useCategoryLabel(): (game: GameState) => string {
  const { locale } = useLocale();
  return (game) => {
    if (locale === 'ku') return game.categoryLabelKu;
    if (locale === 'en') return game.categoryLabelEn;
    return game.categoryLabelKu || game.categoryLabelEn || game.categoryKey;
  };
}

// ─── HOME ─────────────────────────────────────────────────────────
function HomeScreen({ onPlay, onHowToPlay }: { onPlay: () => void; onHowToPlay: () => void }) {
  const t = useT();
  const colors = useThemeColors();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const [muted, setMuted] = useMuted();
  const isRTL = locale !== 'en';

  const langs: { id: Locale; label: string; sub: string }[] = [
    { id: 'ku', label: 'کوردی', sub: 'Kurdî' },
    { id: 'ar', label: 'العربية', sub: 'Arabic' },
    { id: 'en', label: 'English', sub: 'EN' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KilimBg color={colors.ink} opacity={theme === 'dark' ? 0.04 : 0.05} />

      {/* Top bar: mute toggle + theme toggle */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 50,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            // Sound feedback fires only when un-muting (so the user actually hears the
            // confirmation tap). Haptic fires both ways — it's a separate channel that
            // confirms the toggle even when going silent.
            const next = !muted;
            setMuted(next);
            haptic('tap');
            if (!next) play('tap');
          }}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgElev,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M4 9v6h4l5 4V5L8 9H4z"
              fill={colors.ink}
            />
            {muted ? (
              <Path
                d="M16 8l6 6M22 8l-6 6"
                stroke={colors.pomegranate}
                strokeWidth={2.2}
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <Path
                d="M16 9c1.2 0.8 1.2 5.2 0 6"
                stroke={colors.ink}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            feedback('tap');
            toggleTheme();
          }}
          accessibilityLabel="Toggle theme"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgElev,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{theme === 'dark' ? '☀' : '☾'}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          position: 'relative',
        }}
      >
        {/* Decorative gold octagram */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 30,
            [isRTL ? 'left' : 'right']: 24,
          }}
        >
          <Octagram size={56} color={colors.gold} />
        </View>
        {/* Faint pomegranate octagram */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 130,
            [isRTL ? 'right' : 'left']: 24,
            opacity: 0.18,
          }}
        >
          <Octagram size={36} color={colors.pomegranate} stroke />
        </View>

        <Eyebrow style={{ marginBottom: 12 }}>{t('home.tagline')}</Eyebrow>
        <Display
          style={{
            fontSize: locale === 'en' ? 72 : 56,
            color: colors.pomegranate,
            lineHeight: locale === 'en' ? 70 : 80,
            textAlign: 'center',
          }}
        >
          {t('home.title')}
        </Display>
        <View style={{ height: 14 }} />
        <View style={{ width: '70%' }}>
          <KilimBorder color={colors.pomegranate} thin />
        </View>
        <View style={{ height: 18 }} />
        <Text
          style={{
            fontSize: 15,
            color: colors.ink2,
            lineHeight: 22,
            maxWidth: 280,
            textAlign: 'center',
            fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
          }}
        >
          {t('home.subtitle')}
        </Text>
      </View>

      {/* CTAs */}
      <View style={{ paddingHorizontal: 24, gap: 12 }}>
        <Button
          title={t('home.btn.new_game')}
          onPress={() => {
            feedback('tap');
            onPlay();
          }}
        />
        <Button
          title={t('home.btn.how_to_play')}
          kind="ghost"
          onPress={() => {
            feedback('tap');
            onHowToPlay();
          }}
        />
      </View>

      {/* Language switcher chips */}
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 }}>
        <Eyebrow style={{ marginBottom: 8 }}>{t('lang.switcher.label')}</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {langs.map((l) => {
            const active = locale === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                onPress={() => setLocale(l.id)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  backgroundColor: active ? colors.ink : colors.bgElev,
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: active ? colors.bg : colors.ink,
                    fontFamily: l.id === 'en' ? fonts.ui : fonts.arabicUI,
                  }}
                >
                  {l.label}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    color: active ? colors.bg : colors.ink,
                    fontFamily: fonts.ui,
                  }}
                >
                  {l.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── HOW-TO-PLAY ─────────────────────────────────────────────────
function HowToPlayScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const colors = useThemeColors();
  const { isRTL } = useLocale();
  const tipAlign = isRTL ? 'right' : 'left';

  const sections = [
    { icon: '🎮', heading: t('howToPlay.intro.heading'), body: t('howToPlay.intro.body') },
    { icon: '👥', heading: t('howToPlay.players.heading'), body: t('howToPlay.players.body') },
    { icon: '🃏', heading: t('howToPlay.deal.heading'), body: t('howToPlay.deal.body') },
    { icon: '💬', heading: t('howToPlay.discuss.heading'), body: t('howToPlay.discuss.body') },
    { icon: '🗳️', heading: t('howToPlay.vote.heading'), body: t('howToPlay.vote.body') },
  ];

  const tips = [
    t('howToPlay.tips.tip_1'),
    t('howToPlay.tips.tip_2'),
    t('howToPlay.tips.tip_3'),
    t('howToPlay.tips.tip_4'),
    t('howToPlay.tips.tip_5'),
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <Octagram size={40} color={colors.gold} />
        </View>
        <Display
          style={{ fontSize: 36, color: colors.pomegranate, marginBottom: 10, textAlign: 'center' }}
        >
          {t('howToPlay.title')}
        </Display>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 160 }}>
            <KilimBorder color={colors.pomegranate} thin />
          </View>
        </View>

        {sections.map((s, i) => (
          <Card key={i} style={{ marginBottom: 14 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  marginEnd: isRTL ? 0 : 10,
                  marginStart: isRTL ? 10 : 0,
                }}
              >
                {s.icon}
              </Text>
              <Ku style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>
                {s.heading}
              </Ku>
            </View>
            <Ku style={{ fontSize: 15, color: colors.textDim, lineHeight: 22 }}>{s.body}</Ku>
          </Card>
        ))}

        <Card style={{ marginBottom: 14, borderColor: colors.olive }}>
          <Ku style={{ fontSize: 20, fontWeight: '800', marginBottom: 10, color: colors.text }}>
            {`🏆 ${t('howToPlay.win.heading')}`}
          </Ku>
          <Ku style={{ fontSize: 15, color: colors.olive, lineHeight: 22, marginBottom: 6 }}>
            {`✓ ${t('howToPlay.win.crew')}`}
          </Ku>
          <Ku style={{ fontSize: 15, color: colors.pomegranate, lineHeight: 22 }}>
            {`✗ ${t('howToPlay.win.imposter')}`}
          </Ku>
        </Card>

        <Card style={{ marginBottom: 14, backgroundColor: colors.cardElev }}>
          <Ku style={{ fontSize: 20, fontWeight: '800', marginBottom: 12, color: colors.pomegranate }}>
            {`💡 ${t('howToPlay.tips.heading')}`}
          </Ku>
          {tips.map((tip, i) => (
            <View
              key={i}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: colors.pomegranate,
                  marginEnd: isRTL ? 0 : 8,
                  marginStart: isRTL ? 8 : 0,
                  marginTop: 2,
                }}
              >
                ◆
              </Text>
              <Ku
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: colors.text,
                  lineHeight: 21,
                  textAlign: tipAlign,
                }}
              >
                {tip}
              </Ku>
            </View>
          ))}
        </Card>
      </ScrollView>

      <Button
        title={t('howToPlay.btn.got_it')}
        onPress={() => {
          feedback('tap');
          onBack();
        }}
      />
      <View style={{ height: 8 }} />
      <Button
        title={t('howToPlay.btn.back')}
        kind="ghost"
        onPress={() => {
          feedback('tap');
          onBack();
        }}
      />
    </Screen>
  );
}

// ─── SETUP ────────────────────────────────────────────────────────
function SetupScreen({
  config,
  onConfig,
  onStart,
  onBack,
}: {
  config: GameConfig;
  onConfig: (c: GameConfig) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const inputAlign = isRTL ? 'right' : 'left';
  const labelAlign = isRTL ? 'right' : 'left';
  const seatColors = avatarColors(colors);

  // Imposter cap: ≤ 3, leave at least 2 non-imposters.
  const imposterMax = Math.max(1, Math.min(3, config.playerCount - 2));

  const setPlayerCount = (v: number) => {
    const newImposterMax = Math.max(1, Math.min(3, v - 2));
    const nextNames = Array.from({ length: v }, (_, i) =>
      config.playerNames[i] ?? ''
    );
    onConfig({
      ...config,
      playerCount: v,
      imposterCount: Math.min(config.imposterCount, newImposterMax),
      playerNames: nextNames,
    });
  };

  return (
    <Screen>
      {/* Back nav */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <TouchableOpacity
          onPress={() => {
            feedback('tap');
            onBack();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgElev,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: colors.ink }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <Eyebrow>{t('setup.subtitle')}</Eyebrow>
        <Display style={{ fontSize: 30, color: colors.ink, marginTop: 6, marginBottom: 22 }}>
          {t('setup.title')}
        </Display>

        {/* Players chips */}
        <View style={{ marginBottom: 22 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <Ku style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>
              {t('setup.players_count')}
            </Ku>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: '800',
                color: colors.pomegranate,
              }}
            >
              {localizeNumber(config.playerCount, locale)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
              <Chip
                key={n}
                label={localizeNumber(n, locale)}
                size={36}
                active={n === config.playerCount}
                onPress={() => setPlayerCount(n)}
              />
            ))}
          </View>
        </View>

        {/* Imposter chips */}
        <View style={{ marginBottom: 22 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <Ku style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>
              {t('setup.imposter_count')}
            </Ku>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: '800',
                color: colors.pomegranate,
              }}
            >
              {localizeNumber(config.imposterCount, locale)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3].map((n) => {
              const enabled = n <= imposterMax;
              return (
                <Chip
                  key={n}
                  flex
                  label={localizeNumber(n, locale)}
                  active={n === config.imposterCount}
                  disabled={!enabled}
                  style={{ opacity: enabled ? 1 : 0.4 }}
                  onPress={() => enabled && onConfig({ ...config, imposterCount: n })}
                />
              );
            })}
          </View>
        </View>

        {/* Word pack tiles */}
        <View style={{ marginBottom: 22 }}>
          <Ku style={{ fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 12 }}>
            {t('setup.category_label')}
          </Ku>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORDS.categories.map((cat, i) => {
              const sel = cat.key === config.categoryKey;
              const emoji = cat.key === 'food_drink' ? '🍅' : cat.key === 'places' ? '🏛' : '🐾';
              const label = locale === 'ku' ? cat.label_ku : locale === 'en' ? cat.label_en : cat.label_ku;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => onConfig({ ...config, categoryKey: cat.key })}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: sel ? colors.ink : colors.bgElev,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: sel ? colors.bg : colors.ink,
                      fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Player names */}
        <View style={{ marginBottom: 22 }}>
          <Ku style={{ fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 12 }}>
            {t('setup.player_names')}
          </Ku>
          <View style={{ gap: 8 }}>
            {Array.from({ length: config.playerCount }).map((_, i) => (
              <View
                key={i}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.bgElev,
                  borderRadius: 14,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: seatColors[i % seatColors.length],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: fonts.display,
                    }}
                  >
                    {localizeNumber(i + 1, locale)}
                  </Text>
                </View>
                <TextInput
                  value={config.playerNames[i] ?? ''}
                  onChangeText={(text) => {
                    const nextNames = [...config.playerNames];
                    while (nextNames.length < config.playerCount) {
                      nextNames.push('');
                    }
                    nextNames[i] = text;
                    onConfig({ ...config, playerNames: nextNames });
                  }}
                  placeholder={t('setup.default_player_name', { n: i + 1 })}
                  placeholderTextColor={colors.ink3}
                  maxLength={24}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: colors.ink,
                    textAlign: inputAlign,
                    fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
                  }}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Round seconds (kept from existing app) */}
        <Card style={{ marginBottom: 16 }}>
          <Ku
            style={{
              color: colors.ink2,
              fontSize: 14,
              marginBottom: 8,
              textAlign: labelAlign,
            }}
          >
            {t('setup.round_seconds')}
          </Ku>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <TouchableOpacity
              onPress={() =>
                onConfig({ ...config, roundSeconds: Math.max(60, config.roundSeconds - 30) })
              }
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: colors.cardElev,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 26, fontWeight: '700', color: colors.ink }}>−</Text>
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: '800',
                color: colors.pomegranate,
              }}
            >
              {formatTime(config.roundSeconds)}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onConfig({ ...config, roundSeconds: Math.min(300, config.roundSeconds + 30) })
              }
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: colors.cardElev,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 26, fontWeight: '700', color: colors.ink }}>+</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <Button
        title={t('setup.btn.start')}
        onPress={() => {
          feedback('tap');
          onStart();
        }}
      />
    </Screen>
  );
}

// ─── DEAL ─────────────────────────────────────────────────────────
function DealScreen({
  game,
  onFinish,
  onCancel,
}: {
  game: GameState;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const [seat, setSeat] = useState(0);
  const [phase, setPhase] = useState<'pass' | 'reveal'>('pass');

  const assignment = game.assignments[seat];
  const isLast = seat === game.assignments.length - 1;

  if (phase === 'pass') {
    return (
      <DealPassView
        seat={seat}
        total={game.assignments.length}
        name={assignment.name}
        onReady={() => setPhase('reveal')}
        onCancel={onCancel}
      />
    );
  }

  return (
    <DealRevealView
      assignment={assignment}
      categoryLabel={useCategoryLabel()(game)}
      isLast={isLast}
      onNext={() => {
        if (isLast) onFinish();
        else {
          setSeat(seat + 1);
          setPhase('pass');
        }
      }}
    />
  );
}

function DealPassView({
  seat,
  total,
  name,
  onReady,
  onCancel,
}: {
  seat: number;
  total: number;
  name: string;
  onReady: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  // Pass screen is always indigo regardless of theme — scene-locked.
  const indigo = PALETTES.dark.indigo;
  const indigoDark = PALETTES.dark.indigoDark;
  const gold = PALETTES.dark.gold;

  return (
    <View style={{ flex: 1, backgroundColor: indigo, paddingTop: 50 }}>
      <DiamondBg color="#FFFFFF" opacity={0.08} size={60} />

      {/* Top progress segments */}
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
      >
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= seat ? gold : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 32,
        }}
      >
        {/* Phone passing icon (simple circle + phone glyph) */}
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 40 }}>📱</Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: locale === 'en' ? 11 : 13,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 12,
            }}
          >
            {t('deal.pass.headline')}
          </Text>
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontSize: locale === 'en' ? 56 : 44,
              fontWeight: '800',
              color: gold,
              textAlign: 'center',
              lineHeight: locale === 'en' ? 60 : 64,
              letterSpacing: -0.5,
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              marginTop: 16,
              fontSize: 14,
              color: 'rgba(255,255,255,0.55)',
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
            }}
          >
            {t('deal.pass.seat_subtitle', {
              n: locale === 'en' ? seat + 1 : (seat + 1).toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]),
              total: locale === 'en' ? total : total.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]),
            })}
          </Text>
        </View>
      </View>

      {/* Tap target */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 28, gap: 10 }}>
        <TouchableOpacity
          onPress={() => {
            feedback('pass');
            onReady();
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: gold,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontWeight: '700',
              fontSize: 20,
              color: indigoDark,
            }}
          >
            {t('deal.pass.btn.ready')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            feedback('tap');
            onCancel();
          }}
          style={{ alignItems: 'center', padding: 12 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            {t('deal.pass.btn.cancel')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DealRevealView({
  assignment,
  categoryLabel,
  isLast,
  onNext,
}: {
  assignment: PlayerAssignment;
  categoryLabel: string;
  isLast: boolean;
  onNext: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();

  // Fire the appropriate reveal cue once when this seat's word becomes visible.
  useEffect(() => {
    if (assignment.isImposter) {
      feedback('reveal_imposter');
    } else {
      feedback('reveal_word');
    }
  }, [assignment.index, assignment.isImposter]);

  if (assignment.isImposter) {
    // Always-dark indigo scene with red shimmer + pomegranate octagram
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
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 16,
            }}
          >
            {t('deal.reveal.shhh')}
          </Text>
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontSize: locale === 'en' ? 44 : 36,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: locale === 'en' ? 50 : 56,
              maxWidth: 280,
              letterSpacing: -0.5,
            }}
          >
            {t('deal.reveal.imposter_word')}
          </Text>

          {/* Hint card */}
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
                fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              }}
            >
              {t('deal.reveal.imposter_hint')}
            </Text>
            <Text
              style={{
                fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                fontSize: 22,
                fontWeight: '700',
                color: colors.gold,
              }}
            >
              {categoryLabel}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 28 }}>
          <TouchableOpacity
            onPress={() => {
              feedback('tap');
              onNext();
            }}
            activeOpacity={0.85}
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
                fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                fontWeight: '600',
                fontSize: 16,
                color: '#FFFFFF',
              }}
            >
              {isLast ? t('deal.reveal.btn.start_discussion') : t('deal.reveal.btn.next_player')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Crewmate reveal — light bg with kilim borders top/bottom, large pomegranate word
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
        <Eyebrow style={{ marginBottom: 12 }}>{t('deal.reveal.your_word_label')}</Eyebrow>
        <View style={{ width: '60%' }}>
          <KilimBorder color={colors.pomegranate} thin />
        </View>
        <View style={{ height: 28 }} />
        <Text
          style={{
            fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
            fontSize: locale === 'en' ? 56 : 64,
            fontWeight: '800',
            color: colors.pomegranate,
            textAlign: 'center',
            lineHeight: locale === 'en' ? 60 : 80,
            letterSpacing: -0.5,
          }}
        >
          {assignment.word ?? ''}
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
            fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
          }}
        >
          {t('deal.reveal.category_prefix', { category: categoryLabel })}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 28 }}>
        <TouchableOpacity
          onPress={() => {
            feedback('tap');
            onNext();
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.ink,
            borderRadius: 24,
            padding: 22,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontWeight: '700',
              fontSize: 18,
              color: colors.bg,
            }}
          >
            {isLast ? t('deal.reveal.btn.start_discussion') : t('deal.reveal.btn.next_player')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── DISCUSS ──────────────────────────────────────────────────────
function DiscussScreen({
  game,
  onDone,
  onCancel,
}: {
  game: GameState;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const [remaining, setRemaining] = useState(game.config.roundSeconds);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  const total = game.config.roundSeconds;
  const pct = total > 0 ? remaining / total : 0;
  const radius = 110;
  const C = 2 * Math.PI * radius;
  const offset = C * (1 - pct);

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  const timeText = locale === 'en' ? `${mm}:${ss}` : `${mm}:${ss}`.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
      <KilimBg color={colors.ink} opacity={0.05} />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
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
            {t('discuss.title')}
          </Text>
        </Pill>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={240} height={240} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
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
            <Eyebrow style={{ marginBottom: 6 }}>{t('discuss.timer_label')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 64,
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
            marginTop: 28,
            fontSize: 15,
            color: colors.ink2,
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 280,
            fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
          }}
        >
          {t('discuss.instructions')}
        </Text>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 10,
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            title={paused ? t('discuss.btn.resume') : t('discuss.btn.pause')}
            kind="ghost"
            onPress={() => {
              feedback('tap');
              setPaused(!paused);
            }}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            title={t('discuss.btn.go_to_vote')}
            onPress={() => {
              feedback('tap');
              onDone();
            }}
          />
        </View>
      </View>
    </View>
  );
}

// ─── VOTE: PASS-THE-PHONE ─────────────────────────────────────────
// Pre-vote pass screen. Same scene-locked indigo + diamond pattern + gold
// CTA as DealPassView, but copy distinguishes the voting phase from the
// dealing phase ("their secret vote" vs "their secret word").
function VotePassScreen({
  seat,
  total,
  name,
  onReady,
  onBack,
}: {
  seat: number;
  total: number;
  name: string;
  onReady: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const indigo = PALETTES.dark.indigo;
  const indigoDark = PALETTES.dark.indigoDark;
  const gold = PALETTES.dark.gold;

  return (
    <View style={{ flex: 1, backgroundColor: indigo, paddingTop: 50 }}>
      <DiamondBg color="#FFFFFF" opacity={0.08} size={60} />

      {/* Top progress segments — one per voter */}
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
      >
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= seat ? gold : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 32,
        }}
      >
        {/* Ballot icon */}
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 40 }}>🗳️</Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: locale === 'en' ? 11 : 13,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 12,
            }}
          >
            {t('vote.pass.subtitle')}
          </Text>
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontSize: locale === 'en' ? 56 : 44,
              fontWeight: '800',
              color: gold,
              textAlign: 'center',
              lineHeight: locale === 'en' ? 60 : 64,
              letterSpacing: -0.5,
            }}
          >
            {t('vote.pass.title', { name })}
          </Text>
          <Text
            style={{
              marginTop: 16,
              fontSize: 14,
              color: 'rgba(255,255,255,0.55)',
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
            }}
          >
            {t('vote.pass.seat_subtitle', {
              n: localizeNumber(seat + 1, locale),
              total: localizeNumber(total, locale),
            })}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 28, gap: 10 }}>
        <TouchableOpacity
          onPress={() => {
            feedback('pass');
            onReady();
          }}
          activeOpacity={0.85}
          style={{
            backgroundColor: gold,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontWeight: '700',
              fontSize: 20,
              color: indigoDark,
            }}
          >
            {t('vote.pass.cta')}
          </Text>
        </TouchableOpacity>
        {/* Back to discuss only matters for the very first voter; otherwise
            it just rewinds to the same pass screen. We keep it visible for
            consistency with the deal-pass flow. */}
        <TouchableOpacity
          onPress={() => {
            feedback('tap');
            onBack();
          }}
          style={{ alignItems: 'center', padding: 12 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            {t('vote.btn.back')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── VOTE: PICK ───────────────────────────────────────────────────
function VotePickScreen({
  game,
  voterIndex,
  onVote,
  onBack,
}: {
  game: GameState;
  voterIndex: number;
  onVote: (seatIndex: number) => void;
  onBack: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { locale } = useLocale();
  // `picked` resets to null each time the voter changes — using voterIndex
  // as the key on the screen-level component is unnecessary because AppInner
  // mounts a fresh VotePickScreen between voters via the vote_pass detour.
  // But we still scope the local state to `voterIndex` for safety.
  const [picked, setPicked] = useState<number | null>(null);
  const [selfHint, setSelfHint] = useState(false);
  const seatColors = avatarColors(colors);
  const voterName = game.assignments[voterIndex]?.name ?? '';

  // Reset selection whenever the voter changes (defensive — AppInner currently
  // routes each voter through vote_pass which remounts this screen, but if
  // that ever changes, we don't want a stale pick to leak).
  useEffect(() => {
    setPicked(null);
    setSelfHint(false);
  }, [voterIndex]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
      <KilimBg color={colors.ink} opacity={0.04} />

      <View style={{ paddingHorizontal: 24, paddingBottom: 4 }}>
        <Eyebrow>{`${t('vote.title')} · ${voterName}`}</Eyebrow>
        <Display style={{ fontSize: 24, color: colors.ink, marginTop: 6 }}>
          {t('vote.pick.title')}
        </Display>
        <Text
          style={{
            fontSize: 14,
            color: selfHint ? colors.pomegranate : colors.ink3,
            fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
            marginTop: 4,
            minHeight: 20,
          }}
        >
          {selfHint ? t('vote.pick.cant_vote_self') : t('vote.instructions')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {game.assignments.map((a, i) => {
            const isSel = picked === a.index;
            const isSelf = a.index === voterIndex;
            return (
              <TouchableOpacity
                key={a.index}
                onPress={() => {
                  if (isSelf) {
                    // Brief inline hint instead of a no-op tap.
                    setSelfHint(true);
                    return;
                  }
                  if (selfHint) setSelfHint(false);
                  setPicked(a.index);
                }}
                activeOpacity={isSelf ? 1 : 0.8}
                disabled={isSelf}
                style={{
                  width: '48%',
                  paddingVertical: 18,
                  paddingHorizontal: 12,
                  backgroundColor: isSel ? colors.ink : colors.bgElev,
                  borderRadius: 18,
                  minHeight: 130,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  opacity: isSelf ? 0.4 : 1,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: seatColors[i % seatColors.length],
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
                    {localizeNumber(i + 1, locale)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: isSel ? colors.bg : colors.ink,
                    fontSize: 14,
                    fontWeight: '600',
                    fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
                    textAlign: 'center',
                    maxWidth: '100%',
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {a.name && a.name.trim().length > 0 ? a.name : `#${localizeNumber(i + 1, locale)}`}
                </Text>
                {isSel && (
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

      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 10 }}>
        <Button
          title={t('vote.pick.cta')}
          onPress={() => {
            if (picked === null) return;
            feedback('vote_confirm');
            onVote(picked);
          }}
          disabled={picked === null}
        />
        <Button
          title={t('vote.btn.back')}
          kind="ghost"
          onPress={() => {
            feedback('tap');
            onBack();
          }}
        />
      </View>
    </View>
  );
}

// ─── REVEAL ───────────────────────────────────────────────────────
function RevealScreen({
  game,
  accused,
  onReplay,
  onHome,
}: {
  game: GameState;
  accused: number;
  onReplay: () => void;
  onHome: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const accusedPlayer = game.assignments[accused];
  const imposters = game.assignments.filter((a) => a.isImposter);
  const groupWon = accusedPlayer.isImposter;

  // Play the outcome sting once when the screen mounts.
  useEffect(() => {
    feedback(groupWon ? 'win' : 'lose');
    // groupWon is derived from props that don't change for the lifetime of this
    // screen instance — we genuinely want this to fire once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group-wins = light themed bg; imposter-wins = always dark indigo.
  const bg = groupWon ? colors.bg : PALETTES.dark.indigoDark;
  const ink = groupWon ? colors.ink : '#FFFFFF';
  const subInk = groupWon ? colors.ink2 : 'rgba(255,255,255,0.7)';
  const subInk2 = groupWon ? colors.ink3 : 'rgba(255,255,255,0.55)';

  const imposterCardBg = groupWon ? colors.ink : colors.pomegranate;
  const wordCardBg = groupWon ? colors.bgElev : 'rgba(255,255,255,0.08)';
  const wordCardBorder = groupWon ? colors.line : 'rgba(255,255,255,0.15)';

  const imposterLabelKey =
    imposters.length > 1 ? 'reveal.imposter_label_plural' : 'reveal.imposter_label_singular';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: 50 }}>
      <DiamondBg
        color={groupWon ? colors.pomegranate : colors.gold}
        opacity={groupWon ? 0.05 : 0.1}
        size={50}
      />

      <View style={{ paddingHorizontal: 24 }}>
        <Pill
          style={{
            backgroundColor: groupWon ? colors.bgElev : 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '500', color: subInk }}>
            {t('reveal.title')}
          </Text>
        </Pill>
      </View>

      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              color: groupWon ? colors.olive : '#E89384',
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 10,
            }}
          >
            {groupWon ? t('reveal.group_wins_label') : t('reveal.imposter_wins_label')}
          </Text>
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontSize: locale === 'en' ? 36 : 28,
              fontWeight: '800',
              color: ink,
              lineHeight: locale === 'en' ? 42 : 40,
              letterSpacing: -0.5,
            }}
          >
            {groupWon ? t('reveal.crew_wins') : t('reveal.imposter_wins')}
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
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
              marginBottom: 8,
            }}
          >
            {t(imposterLabelKey)}
          </Text>
          {imposters.map((imp, i) => (
            <View
              key={imp.index}
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
                  {localizeNumber(imp.index + 1, locale)}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
                  fontSize: locale === 'en' ? 32 : 26,
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
          }}
        >
          <Text
            style={{
              color: subInk2,
              fontFamily: locale === 'en' ? fonts.ui : fonts.arabicUI,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: locale === 'en' ? 1.6 : 0,
              textTransform: locale === 'en' ? 'uppercase' : 'none',
            }}
          >
            {t('reveal.word_was')}
          </Text>
          <Text
            style={{
              fontFamily: locale === 'en' ? fonts.display : fonts.arabicDisplay,
              fontSize: 24,
              fontWeight: '800',
              color: groupWon ? colors.pomegranate : colors.gold,
            }}
          >
            {game.pair.crew}
          </Text>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          paddingTop: 16,
          gap: 10,
        }}
      >
        <Button
          title={t('reveal.btn.play_again')}
          kind={groupWon ? 'primary' : 'gold'}
          onPress={() => {
            feedback('tap');
            onReplay();
          }}
        />
        <Button
          title={t('reveal.btn.home')}
          kind="ghost"
          onPress={() => {
            feedback('tap');
            onHome();
          }}
          style={{
            borderColor: groupWon ? colors.line : 'rgba(255,255,255,0.2)',
          }}
        />
      </View>
    </View>
  );
}
