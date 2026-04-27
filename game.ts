// Pure game logic — no UI concerns. Kurdish Imposter state machine.
import pairsJson from './assets/word_pairs.json';

export type WordPair = { crew: string; imposter: string };
export type Category = {
  key: string;
  label_ku: string;
  label_en: string;
  pairs: WordPair[];
};
export type WordBundle = {
  version: number;
  language: string;
  categories: Category[];
};

export const WORDS = pairsJson as WordBundle;

export type GameConfig = {
  playerCount: number;       // 3..15
  imposterCount: number;     // 1..3
  categoryKey: string;
  roundSeconds: number;      // discussion timer
  playerNames: string[];     // length === playerCount; user-editable
};

export type PlayerAssignment = {
  index: number;             // 0-based seat
  name: string;              // display name (from config.playerNames)
  word: string | null;       // null for the imposter — resolved at render time via i18n
  isImposter: boolean;
};

// Default placeholder name for seat index `i` (0-based).
// Kept in English at the data layer; UI replaces empties via t('setup.default_player_name', { n }).
export function defaultPlayerName(i: number): string {
  return `Player ${i + 1}`;
}

export type GameState = {
  config: GameConfig;
  pair: WordPair;
  // Locale-neutral identifiers for the chosen category. The UI resolves these
  // to a label in the active language (or falls back to label_ku / label_en).
  categoryKey: string;
  categoryLabelKu: string;
  categoryLabelEn: string;
  assignments: PlayerAssignment[];
};

export const DEFAULT_CONFIG: GameConfig = {
  playerCount: 5,
  imposterCount: 1,
  categoryKey: 'food_drink',
  roundSeconds: 180,
  playerNames: Array.from({ length: 5 }, () => ''),
};

// Fisher-Yates shuffle.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickCategory(key: string): Category {
  const cat = WORDS.categories.find((c) => c.key === key);
  if (!cat) throw new Error(`Unknown category ${key}`);
  return cat;
}

export function dealGame(config: GameConfig): GameState {
  const cat = pickCategory(config.categoryKey);
  const pair = cat.pairs[Math.floor(Math.random() * cat.pairs.length)];
  const seats = Array.from({ length: config.playerCount }, (_, i) => i);
  const imposterSeats = shuffle(seats).slice(0, config.imposterCount);
  const assignments: PlayerAssignment[] = seats.map((i) => {
    const isImposter = imposterSeats.includes(i);
    const rawName = config.playerNames[i];
    const name =
      rawName && rawName.trim().length > 0 ? rawName.trim() : defaultPlayerName(i);
    return {
      index: i,
      name,
      isImposter,
      // Imposter sees the literal word "Imposter" in the active UI language —
      // resolved at render time via t('deal.reveal.imposter_word'). We store
      // null here so a mid-game language switch shows the correct word.
      word: isImposter ? null : pair.crew,
    };
  });
  return {
    config,
    pair,
    categoryKey: cat.key,
    categoryLabelKu: cat.label_ku,
    categoryLabelEn: cat.label_en,
    assignments,
  };
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.max(0, totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Given a tally (votes per seat), return the accused seat index.
// Rule: most votes wins; on tie, the lowest seat number among the top-voted
// seats is selected (deterministic). If the tally is empty / all-zero, the
// function still returns a valid seat (0) — callers should only invoke it
// once every player has voted.
export function accusedFromTallies(tallies: number[]): number {
  let bestSeat = 0;
  let bestCount = -1;
  for (let i = 0; i < tallies.length; i++) {
    if (tallies[i] > bestCount) {
      bestCount = tallies[i];
      bestSeat = i;
    }
  }
  return bestSeat;
}
