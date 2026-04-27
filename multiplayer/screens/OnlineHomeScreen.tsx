// OnlineHomeScreen — entry point into multiplayer.
//
// Two big buttons: Create Room | Join Room.
//   - Create flow: prompts for player name, then calls onJoin({ code: undefined, name, asHost: true }).
//   - Join flow: 4-letter code input (uppercased, ROOM_CODE_ALPHABET only) + name → onJoin({ code, name, asHost: false }).
//
// i18n keys used:
//   multiplayer.home.title
//   multiplayer.home.subtitle
//   multiplayer.home.btn.create
//   multiplayer.home.btn.join
//   multiplayer.home.btn.back
//   multiplayer.home.create.title
//   multiplayer.home.create.subtitle
//   multiplayer.home.create.cta
//   multiplayer.home.join.title
//   multiplayer.home.join.subtitle
//   multiplayer.home.join.code_label
//   multiplayer.home.join.code_placeholder
//   multiplayer.home.join.cta
//   multiplayer.home.name_label
//   multiplayer.home.name_placeholder
//   multiplayer.home.invalid_code

import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Display,
  Eyebrow,
  KilimBg,
  KilimBorder,
  Octagram,
  Screen,
} from '../../ui';
import { fonts, useThemeColors } from '../../theme';
import { useLocale, useT } from '../../i18n';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../protocol';

type Mode = 'menu' | 'create' | 'join';

export type OnlineHomeJoinPayload = {
  /** Undefined when creating a fresh room; the server mints the code. */
  code?: string;
  name: string;
  asHost: boolean;
};

type Props = {
  onJoin: (payload: OnlineHomeJoinPayload) => void;
  onBack?: () => void;
  /** Optional default name (e.g. last-used). Defaults to 'Player 1'. */
  defaultName?: string;
};

const ALPHABET_SET = new Set(ROOM_CODE_ALPHABET.split(''));

function sanitizeCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((ch) => ALPHABET_SET.has(ch))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

function sanitizeName(input: string): string {
  return input.replace(/\s+/g, ' ').slice(0, 24);
}

export function OnlineHomeScreen({ onJoin, onBack, defaultName }: Props) {
  const t = useT();
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState(defaultName ?? '');
  const [code, setCode] = useState('');

  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  const fallbackName = useMemo(
    () => t('multiplayer.home.name_placeholder', { n: 1 }),
    [t]
  );

  const submit = (asHost: boolean) => {
    const finalName =
      name.trim().length > 0 ? sanitizeName(name) : fallbackName;
    if (asHost) {
      onJoin({ name: finalName, asHost: true });
    } else {
      const c = sanitizeCode(code);
      if (c.length !== ROOM_CODE_LENGTH) return;
      onJoin({ code: c, name: finalName, asHost: false });
    }
  };

  const goBack = () => {
    if (mode !== 'menu') {
      setMode('menu');
      return;
    }
    onBack?.();
  };

  const codeValid = sanitizeCode(code).length === ROOM_CODE_LENGTH;

  return (
    <Screen>
      <KilimBg color={colors.ink} opacity={0.05} />

      {/* Back arrow */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <TouchableOpacity
          onPress={goBack}
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

      {mode === 'menu' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
          <View style={{ marginBottom: 18 }}>
            <Octagram size={56} color={colors.gold} />
          </View>
          <Eyebrow style={{ marginBottom: 8 }}>{t('multiplayer.home.subtitle')}</Eyebrow>
          <Display
            style={{
              fontSize: locale === 'en' ? 44 : 38,
              color: colors.pomegranate,
              textAlign: 'center',
              lineHeight: locale === 'en' ? 50 : 56,
            }}
          >
            {t('multiplayer.home.title')}
          </Display>
          <View style={{ width: 160, marginTop: 18, marginBottom: 28 }}>
            <KilimBorder color={colors.pomegranate} thin />
          </View>

          <View style={{ width: '100%', gap: 12, paddingHorizontal: 8 }}>
            <Button
              title={t('multiplayer.home.btn.create')}
              onPress={() => {
                setCode('');
                setMode('create');
              }}
            />
            <Button
              title={t('multiplayer.home.btn.join')}
              kind="dark"
              onPress={() => {
                setCode('');
                setMode('join');
              }}
            />
          </View>
        </View>
      )}

      {mode === 'create' && (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <Eyebrow style={{ marginBottom: 6 }}>{t('multiplayer.home.create.subtitle')}</Eyebrow>
          <Display style={{ fontSize: 30, color: colors.ink, marginBottom: 24 }}>
            {t('multiplayer.home.create.title')}
          </Display>

          <NameField
            value={name}
            onChange={setName}
            placeholder={fallbackName}
            t={t}
          />

          <View style={{ flex: 1 }} />
          <Button
            title={t('multiplayer.home.create.cta')}
            onPress={() => submit(true)}
          />
        </View>
      )}

      {mode === 'join' && (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <Eyebrow style={{ marginBottom: 6 }}>{t('multiplayer.home.join.subtitle')}</Eyebrow>
          <Display style={{ fontSize: 30, color: colors.ink, marginBottom: 24 }}>
            {t('multiplayer.home.join.title')}
          </Display>

          {/* Code field */}
          <Text
            style={{
              fontSize: 14,
              color: colors.ink2,
              marginBottom: 8,
              fontFamily: family,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('multiplayer.home.join.code_label')}
          </Text>
          <TextInput
            value={code}
            onChangeText={(c) => setCode(sanitizeCode(c))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t('multiplayer.home.join.code_placeholder')}
            placeholderTextColor={colors.ink3}
            maxLength={ROOM_CODE_LENGTH}
            style={{
              fontSize: 36,
              fontFamily: fonts.display,
              fontWeight: '800',
              letterSpacing: 16,
              color: colors.pomegranate,
              backgroundColor: colors.bgElev,
              borderRadius: 14,
              paddingVertical: 18,
              paddingHorizontal: 24,
              textAlign: 'center',
            }}
          />
          {!codeValid && code.length > 0 ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 13,
                color: colors.pomegranate,
                fontFamily: family,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('multiplayer.home.invalid_code')}
            </Text>
          ) : null}

          <View style={{ height: 22 }} />

          <NameField
            value={name}
            onChange={setName}
            placeholder={fallbackName}
            t={t}
          />

          <View style={{ flex: 1 }} />
          <Button
            title={t('multiplayer.home.join.cta')}
            onPress={() => submit(false)}
            disabled={!codeValid}
          />
        </View>
      )}
    </Screen>
  );
}

function NameField({
  value,
  onChange,
  placeholder,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  t: (k: string) => string;
}) {
  const colors = useThemeColors();
  const { locale, isRTL } = useLocale();
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;

  return (
    <View>
      <Text
        style={{
          fontSize: 14,
          color: colors.ink2,
          marginBottom: 8,
          fontFamily: family,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {t('multiplayer.home.name_label')}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.slice(0, 24))}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        maxLength={24}
        style={{
          fontSize: 18,
          color: colors.ink,
          backgroundColor: colors.bgElev,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontFamily: family,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
    </View>
  );
}

export default OnlineHomeScreen;
