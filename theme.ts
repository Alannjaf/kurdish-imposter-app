// Design tokens for Kurdish Imposter.
//
// Migrated from Claude Design canvas (design-output/imposter-game/project/styles.css).
// oklch source values converted to hex equivalents — React Native does not
// support the oklch() color function. Hex values were sampled from the
// design canvas at parity to the intended color, not algorithmically converted.
//
// Theme model:
//   - `colors` is a static export retained for source-diff minimalism. It points
//     at the LIGHT palette (the new design default).
//   - For runtime theme switching, use `useThemeColors()` from this module
//     wrapped via the <ThemeProvider> in App.tsx. The hook returns the same
//     shape so consumers stay token-agnostic.
//
// Old keys (bg, bgElev, card, cardElev, border, text, textDim, textFaint,
// primary, accent, danger, success, imposter, crew) are preserved so existing
// screens don't break during migration. New decorative tokens
// (pomegranate, pomegranateDark, gold, indigo, indigoDark, olive, ink, ink2,
// ink3, line) are added alongside.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'light' | 'dark';

// ─── Light palette — warm cream, default ─────────────────────────
// Mapped from styles.css :root tokens. Pomegranate, indigo, gold, olive
// are scene/accent colors and stay constant across themes.
const LIGHT = {
  // Surfaces
  bg: '#F4F0E5',
  bgElev: '#E8E1CF',
  card: '#E8E1CF',
  cardElev: '#DCD3BD',
  border: '#D4C9AF',
  line: '#D4C9AF',

  // Ink (text)
  text: '#322820',
  textDim: '#5C4F44',
  textFaint: '#8A7E72',
  ink: '#322820',
  ink2: '#5C4F44',
  ink3: '#8A7E72',

  // Brand / accents (constant across themes)
  pomegranate: '#C24B33',
  pomegranateDark: '#A23A24',
  indigo: '#2A285F',
  indigoDark: '#1B1A47',
  gold: '#E5B458',
  goldDark: '#C9963F',
  olive: '#8A8B47',

  // Aliases retained for legacy screens
  primary: '#C24B33',       // pomegranate (was gold)
  primaryHover: '#A23A24',
  accent: '#C24B33',
  danger: '#C24B33',
  success: '#8A8B47',
  imposter: '#C24B33',
  crew: '#8A8B47',
};

// ─── Dark palette — deep indigo ──────────────────────────────────
const DARK: typeof LIGHT = {
  bg: '#1A1A2E',
  bgElev: '#272749',
  card: '#272749',
  cardElev: '#33335E',
  border: '#3D3D6E',
  line: '#3D3D6E',

  text: '#F4F0E5',
  textDim: '#C9C4B5',
  textFaint: '#8B8678',
  ink: '#F4F0E5',
  ink2: '#C9C4B5',
  ink3: '#8B8678',

  pomegranate: '#C24B33',
  pomegranateDark: '#A23A24',
  indigo: '#2A285F',
  indigoDark: '#1B1A47',
  gold: '#E5B458',
  goldDark: '#C9963F',
  olive: '#8A8B47',

  primary: '#C24B33',
  primaryHover: '#A23A24',
  accent: '#C24B33',
  danger: '#C24B33',
  success: '#8A8B47',
  imposter: '#C24B33',
  crew: '#8A8B47',
};

// Static export points at LIGHT (new default). Components that read this
// directly will display the light palette; for theme-aware rendering, use
// the `useThemeColors()` hook below.
export const colors = LIGHT;

export const PALETTES: Record<ThemeName, typeof LIGHT> = {
  light: LIGHT,
  dark: DARK,
};

// Font families. We do NOT load via expo-font in this round; the strings
// resolve to system defaults if the font isn't installed, which is graceful
// on every platform we care about. Web build can pick up Bricolage Grotesque
// from Google Fonts if the host page includes the link.
export const fonts = {
  display: 'Bricolage Grotesque',
  ui: 'Inter',
  arabicDisplay: 'Noto Kufi Arabic',
  arabicUI: 'Noto Naskh Arabic',
  // legacy keys
  ku: 'Noto Kufi Arabic',
  en: 'Inter',
  mono: 'System',
};

export const SCREENS = [
  'home',
  'setup',
  'deal',
  'discuss',
  'vote',
  'reveal',
] as const;

export type ScreenName = (typeof SCREENS)[number];

// ─── Theme context ───────────────────────────────────────────────
type ThemeContextValue = {
  theme: ThemeName;
  colors: typeof LIGHT;
  setTheme: (next: ThemeName) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'app.theme.v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (saved === 'light' || saved === 'dark')) {
          setThemeState(saved);
        }
      } catch {
        // ignore — fall back to default
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (next: ThemeName) => {
    setThemeState(next);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // best effort
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: ThemeName = theme === 'light' ? 'dark' : 'light';
    await setTheme(next);
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, colors: PALETTES[theme], setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  // Match I18nProvider's hydration gate so we don't flash light then dark.
  if (!hydrated) return null;

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback: outside provider, return light palette as a static value.
    return {
      theme: 'light' as ThemeName,
      colors: LIGHT,
      setTheme: async () => {},
      toggleTheme: async () => {},
    };
  }
  return ctx;
}

export function useThemeColors() {
  return useTheme().colors;
}
