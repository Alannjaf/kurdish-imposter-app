// Re-export word data from the shared game module so the server runs the
// exact same dataset the client ships with.
export { WORDS, pickCategory, dealGame } from '../../game';
export type { WordPair, Category, GameConfig, GameState, PlayerAssignment } from '../../game';
