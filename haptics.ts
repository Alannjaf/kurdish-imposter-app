// Haptic feedback (tactile) — companion to sound.ts.
//
// Why: iOS silent switch overrides browser audio, so users in silent mode get
// no sound feedback at all. Haptics fire through silent mode, providing a
// tactile channel that always works on a capable device.
//
// On native (iOS/Android via Expo), we use expo-haptics' Impact and
// Notification generators — these map to UIKit's UIImpactFeedbackGenerator /
// UINotificationFeedbackGenerator on iOS and the Vibrator API on Android.
//
// On web, we call `navigator.vibrate()` directly with custom patterns chosen
// to match the "feel" of each event (short blip for tap, longer for reveals,
// celebratory pattern for win, sustained for lose). Android Chrome supports
// this; iOS Safari does NOT — that's an accepted gap. The native iOS app
// (when shipped via Expo) gets full UIKit haptics regardless.
//
// Mute coupling: haptics fire INDEPENDENTLY of the sound mute toggle. They're
// a separate accessibility/silent-mode channel, so a user who has muted audio
// (e.g. they're in a meeting) still wants tactile feedback for game events.
// No separate mute control for haptics — keeping UX simple.
//
// Usage:
//   import { feedback } from './haptics';
//   feedback('tap');             // fires both sound + haptic
//   haptic('reveal_imposter');   // haptic only (rare — usually use feedback)

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { play, SoundName } from './sound';

export type HapticName = SoundName;

// ─── Web vibration patterns ──────────────────────────────────────
// Pattern shape: number = single buzz of N ms; number[] = alternating
// vibrate/pause durations in ms (e.g. [20, 30, 20] = buzz 20, pause 30, buzz 20).
const WEB_PATTERNS: Record<HapticName, number | number[]> = {
  tap: 10,
  pass: 30,
  reveal_word: [20, 30, 20],
  reveal_imposter: 80,
  vote_confirm: 30,
  win: [30, 50, 30, 50, 30],
  lose: 120,
};

// ─── Native (iOS/Android) mappings ───────────────────────────────
// On native, dispatch to the appropriate Expo generator. We use
// notificationAsync for outcome events (reveal_word, reveal_imposter, win,
// lose) since iOS' UINotificationFeedbackGenerator gives a richer multi-tap
// pattern; impactAsync for single-event UI cues (tap, pass, vote_confirm).
function nativeHaptic(name: HapticName): void {
  try {
    switch (name) {
      case 'tap':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      case 'pass':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      case 'vote_confirm':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      case 'reveal_word':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return;
      case 'reveal_imposter':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      case 'win':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return;
      case 'lose':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
    }
  } catch {
    // best-effort — never break the UI for a haptic failure
  }
}

// ─── Web fallback via navigator.vibrate ──────────────────────────
type NavWithVibrate = Navigator & { vibrate?: (pattern: number | number[]) => boolean };

function webHaptic(name: HapticName): void {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const nav = navigator as NavWithVibrate;
    if (typeof nav.vibrate !== 'function') return; // iOS Safari: no-op
    const pattern = WEB_PATTERNS[name];
    if (pattern === undefined) return;
    nav.vibrate(pattern);
  } catch {
    // best-effort
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Trigger tactile feedback for a named event. No-op on platforms without
 * haptic support (iOS Safari web, devices without a vibration motor).
 *
 * Haptics fire regardless of the sound mute state — they're a separate
 * channel intended to work through silent mode.
 */
export function haptic(name: HapticName): void {
  if (Platform.OS === 'web') {
    webHaptic(name);
  } else {
    nativeHaptic(name);
  }
}

/**
 * Combined audio + tactile feedback. Replaces direct `play()` calls at
 * event sites so every game event gets both channels (sound respects the
 * mute toggle; haptics always fire).
 */
export function feedback(name: HapticName): void {
  play(name);
  haptic(name);
}
