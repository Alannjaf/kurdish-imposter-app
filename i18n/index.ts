// Lightweight JSON-based i18n.
//
// Three locales: ku (Kurdish Sorani, RTL), ar (Arabic, RTL), en (English, LTR).
// Default = device locale if matched, otherwise 'ku' (the app's original language).
// Persisted via AsyncStorage so the choice survives app launches.
//
// Usage:
//   const t = useT();          //  t('home.btn.new_game') -> string
//   const { locale, setLocale, isRTL } = useLocale();
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager, Platform } from 'react-native';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ku from './ku.json';
import ar from './ar.json';
import en from './en.json';

export type Locale = 'ku' | 'ar' | 'en';
export const LOCALES: Locale[] = ['ku', 'ar', 'en'];

const BUNDLES: Record<Locale, Record<string, string>> = { ku, ar, en };

export const LOCALE_LABELS: Record<Locale, string> = {
  ku: 'کوردی',
  ar: 'العربية',
  en: 'English',
};

export const RTL_LOCALES: Locale[] = ['ku', 'ar'];

const STORAGE_KEY = 'app.locale.v1';

function detectDeviceLocale(): Locale {
  try {
    const locales = Localization.getLocales?.() ?? [];
    const codes = locales.map((l) => (l.languageCode ?? '').toLowerCase());
    if (codes.includes('ku') || codes.includes('ckb')) return 'ku';
    if (codes.includes('ar')) return 'ar';
    if (codes.includes('en')) return 'en';
  } catch {
    // expo-localization may throw on web in some envs; fall through.
  }
  return 'ku';
}

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
  );
}

type I18nContextValue = {
  locale: Locale;
  isRTL: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (next: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Default to Kurdish for first-time users; saved preference still wins on subsequent launches.
  const [locale, setLocaleState] = useState<Locale>('ku');
  const [hydrated, setHydrated] = useState(false);

  // On first mount: try to load the saved locale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved && LOCALES.includes(saved as Locale)) {
          setLocaleState(saved as Locale);
          applyRTL(saved as Locale);
        } else {
          applyRTL(locale);
        }
      } catch {
        applyRTL(locale);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort; UI will still update for this session.
    }
    applyRTL(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const bundle = BUNDLES[locale] ?? BUNDLES.ku;
      const raw = bundle[key] ?? BUNDLES.ku[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, isRTL: isRTL(locale), t, setLocale }),
    [locale, t, setLocale]
  );

  // Avoid a flash of stale text before hydration completes.
  if (!hydrated) return null;

  return React.createElement(I18nContext.Provider, { value }, children);
}

function applyRTL(locale: Locale) {
  const wantRTL = isRTL(locale);
  // On native: I18nManager.forceRTL flips layout direction, but only takes
  // effect after the JS bundle reloads. We still call it so the next launch is
  // correct. On web (react-native-web), I18nManager.isRTL is honored per-render
  // for Text writingDirection without a reload.
  try {
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(wantRTL);
    }
  } catch {
    // some platforms (web) may noop; that's fine.
  }
  // On web, also set the document direction so HTML inherits correctly.
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dir = wantRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx.t;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used inside <I18nProvider>');
  return {
    locale: ctx.locale,
    setLocale: ctx.setLocale,
    isRTL: ctx.isRTL,
  };
}
