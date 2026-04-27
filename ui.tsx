// Shared UI primitives for Kurdish Imposter.
//
// Components:
//   - Screen: full-flex container with theme-aware bg + safe padding
//   - Ku, En: text primitives that auto-flip RTL/LTR per locale
//   - Button: theme-aware tappable with primary/secondary/ghost/danger/gold/dark variants
//   - Card: theme-aware rounded surface
//   - Octagram: 8-pointed star (Kurdish/Islamic geometric motif) — react-native-svg
//   - KilimBorder: diamond pattern row — react-native-svg
//   - KilimBg: subtle dotted background — pure View dots (lightweight, no extra deps)
//   - Pill, Chip, Eyebrow: small composable bits matching design canvas
//
// Notes:
//   - oklch() values from the design CSS are NOT used here. Hex equivalents come
//     from theme.ts. RN doesn't support oklch.
//   - boxShadow / linear-gradient / radial-gradient from the design are mapped
//     to RN's `shadow*` props (with `elevation` for Android) or onto SVG patterns
//     where backgrounds are decorative. We deliberately under-shadow to match
//     the visual without fighting the platform.
import React from 'react';
import {
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Svg, { Polygon, Defs, Pattern, Rect } from 'react-native-svg';
import { fonts, useThemeColors } from './theme';
import { useLocale } from './i18n';

// ─── Layout ──────────────────────────────────────────────────────
export function Screen({ children, style, ...rest }: ViewProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 60 },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

// ─── Text ────────────────────────────────────────────────────────
// Body text that flips between RTL (ku/ar) and LTR (en) automatically.
export function Ku({ children, style, ...rest }: TextProps) {
  const { isRTL, locale } = useLocale();
  const colors = useThemeColors();
  const dir: TextStyle = isRTL
    ? { writingDirection: 'rtl', textAlign: 'right' }
    : { writingDirection: 'ltr', textAlign: 'left' };
  const family = locale === 'en' ? fonts.ui : fonts.arabicUI;
  return (
    <Text
      style={[
        { color: colors.text, fontSize: 20, fontFamily: family },
        dir,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// Display heading variant — uses Bricolage Grotesque (or Arabic Kufi) for big titles.
export function Display({ children, style, ...rest }: TextProps) {
  const { isRTL, locale } = useLocale();
  const colors = useThemeColors();
  const dir: TextStyle = isRTL
    ? { writingDirection: 'rtl', textAlign: 'right' }
    : { writingDirection: 'ltr', textAlign: 'left' };
  const family = locale === 'en' ? fonts.display : fonts.arabicDisplay;
  return (
    <Text
      style={[
        { color: colors.text, fontFamily: family, fontWeight: '800', letterSpacing: -0.5 },
        dir,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// Subtitle / accent text — short ALL-CAPS or eyebrow labels.
export function En({ children, style, ...rest }: TextProps) {
  const colors = useThemeColors();
  return (
    <Text
      style={[
        { color: colors.text, fontSize: 16, fontFamily: fonts.ui, letterSpacing: 1.2 },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children, style, ...rest }: TextProps) {
  const { locale } = useLocale();
  const colors = useThemeColors();
  // RTL eyebrow: not all-caps, less letter spacing
  const isLatin = locale === 'en';
  return (
    <Text
      style={[
        {
          color: colors.ink3,
          fontFamily: isLatin ? fonts.ui : fonts.arabicUI,
          fontSize: isLatin ? 11 : 13,
          fontWeight: '600',
          letterSpacing: isLatin ? 1.6 : 0,
          textTransform: isLatin ? 'uppercase' : 'none',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ─── Button ──────────────────────────────────────────────────────
type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'dark';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  kind?: ButtonKind;
  subtitle?: string;
};

export function Button({
  title,
  subtitle,
  kind = 'primary',
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const { isRTL, locale } = useLocale();
  const colors = useThemeColors();
  const palette: Record<ButtonKind, { bg: string; fg: string; borderColor?: string; shadowColor?: string }> = {
    primary: { bg: colors.pomegranate, fg: '#FFFFFF', shadowColor: colors.pomegranateDark },
    secondary: { bg: colors.cardElev, fg: colors.text },
    ghost: { bg: 'transparent', fg: colors.text, borderColor: colors.line },
    danger: { bg: colors.danger, fg: '#FFFFFF' },
    gold: { bg: colors.gold, fg: colors.indigoDark, shadowColor: colors.goldDark },
    dark: { bg: colors.indigo, fg: '#FFFFFF', shadowColor: colors.indigoDark },
  };
  const p = palette[kind];

  const dir: TextStyle = {
    writingDirection: isRTL ? 'rtl' : 'ltr',
    textAlign: 'center',
  };
  const family = locale === 'en' ? fonts.display : fonts.arabicDisplay;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      style={[
        styles.btn,
        {
          backgroundColor: p.bg,
          opacity: disabled ? 0.4 : 1,
          borderWidth: kind === 'ghost' ? 1.5 : 0,
          borderColor: p.borderColor ?? 'transparent',
          // Soft drop shadow on iOS / elevation on Android — only for filled buttons
          ...(p.shadowColor
            ? {
                shadowColor: p.shadowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 0,
                elevation: 4,
              }
            : null),
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          { fontSize: 19, fontWeight: '700', fontFamily: family, color: p.fg },
          dir,
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.btnSubtitle, dir, { color: p.fg, opacity: 0.7 }]}>{subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Card ────────────────────────────────────────────────────────
export function Card({ children, style, ...rest }: ViewProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

// ─── Pill / Chip ─────────────────────────────────────────────────
type PillProps = ViewProps & { children: React.ReactNode };
export function Pill({ children, style, ...rest }: PillProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: colors.bgElev,
          alignSelf: 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      {typeof children === 'string' ? (
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.ink2 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

type ChipProps = TouchableOpacityProps & {
  label: string | number;
  active?: boolean;
  size?: number;
  flex?: boolean;
};
export function Chip({ label, active, size = 44, flex, style, ...rest }: ChipProps) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        {
          width: flex ? undefined : size,
          height: size,
          flex: flex ? 1 : undefined,
          borderRadius: 14,
          backgroundColor: active ? colors.ink : colors.bgElev,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontWeight: '700',
          fontSize: 16,
          color: active ? colors.bg : colors.ink,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Octagram (8-pointed star) ───────────────────────────────────
// Kurdish/Islamic geometric motif. Two overlapping squares rotated 22.5deg.
// Uses the SAME polygon path as design-output/imposter-game/project/screens-1.jsx.
export function Octagram({
  size = 60,
  color = '#C24B33',
  stroke = false,
}: {
  size?: number;
  color?: string;
  stroke?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon
        points="50,2 61,39 98,50 61,61 50,98 39,61 2,50 39,39"
        fill={stroke ? 'none' : color}
        stroke={stroke ? color : 'none'}
        strokeWidth={3}
      />
      <Polygon
        points="50,15 58,42 85,50 58,58 50,85 42,58 15,50 42,42"
        fill={stroke ? 'none' : color}
        fillOpacity={stroke ? 1 : 0.5}
        stroke={stroke ? color : 'none'}
        strokeWidth={2}
        transform="rotate(22.5 50 50)"
      />
    </Svg>
  );
}

// ─── Kilim diamond border row ────────────────────────────────────
export function KilimBorder({
  color = '#C24B33',
  thin,
  width = '100%',
  style,
}: {
  color?: string;
  thin?: boolean;
  width?: number | string;
  style?: ViewStyle;
}) {
  const h = thin ? 14 : 22;
  // unique-ish pattern id per color so multiple instances coexist
  const id = `kilim-${color.replace(/[^a-z0-9]/gi, '')}-${thin ? 't' : 'f'}`;
  return (
    <View style={[{ width: width as any, height: h }, style]}>
      <Svg width="100%" height={h} viewBox="0 0 200 22" preserveAspectRatio="none">
        <Defs>
          <Pattern id={id} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <Polygon points="11,2 20,11 11,20 2,11" fill="none" stroke={color} strokeWidth={2} />
            <Polygon points="11,7 15,11 11,15 7,11" fill={color} />
          </Pattern>
        </Defs>
        <Rect width="200" height="22" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// ─── Kilim background dot pattern ────────────────────────────────
// Lightweight: rendered as SVG at parent size with a tiny dot pattern.
// `pointerEvents: none` so it never intercepts taps.
export function KilimBg({
  opacity = 0.05,
  color = '#322820',
}: {
  opacity?: number;
  color?: string;
}) {
  const id = `kbg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="2" height="2" rx="1" fill={color} />
            <Rect x="24" y="24" width="2" height="2" rx="1" fill={color} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// ─── Diamond pattern background (for Pass / Reveal-Imposter scenes) ──
export function DiamondBg({
  opacity = 0.08,
  color = '#FFFFFF',
  size = 60,
}: {
  opacity?: number;
  color?: string;
  size?: number;
}) {
  const id = `dia-${color.replace(/[^a-z0-9]/gi, '')}-${size}`;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} x="0" y="0" width={size} height={size} patternUnits="userSpaceOnUse">
            <Polygon
              points={`${size / 2},${size * 0.07} ${size * 0.93},${size / 2} ${size / 2},${size * 0.93} ${size * 0.07},${size / 2}`}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
            />
            <Polygon
              points={`${size / 2},${size * 0.3} ${size * 0.7},${size / 2} ${size / 2},${size * 0.7} ${size * 0.3},${size / 2}`}
              fill={color}
              fillOpacity={0.5}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  btnSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
});
