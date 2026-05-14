import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('vote breakdown', () => {
  it('exposes the full voter→target map in RoundResult.voteBreakdown', () => {
    const h = new Harness();
    connectPlayers(h, 4);

    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: false,
    });
    h.send('p0', { type: 'start' });
    h.send('p0', { type: 'to_vote' });

    const roundId = h.state().roundId;
    // p0→2, p1→2, p2→0, p3→0 → tally: seat 0=2, seat 2=2 → tie → imposter wins
    h.send('p0', { type: 'vote', targetSeat: 2, roundId });
    h.send('p1', { type: 'vote', targetSeat: 2, roundId });
    h.send('p2', { type: 'vote', targetSeat: 0, roundId });
    h.send('p3', { type: 'vote', targetSeat: 0, roundId });

    const result = h.state().result;
    expect(result).toBeDefined();
    const breakdown = result!.voteBreakdown;
    expect(breakdown).toBeDefined();
    expect(breakdown).toHaveLength(4);
    // Sorted by voterSeat ascending.
    expect(breakdown).toEqual([
      { voterSeat: 0, targetSeat: 2 },
      { voterSeat: 1, targetSeat: 2 },
      { voterSeat: 2, targetSeat: 0 },
      { voterSeat: 3, targetSeat: 0 },
    ]);
  });

  it('omits abstentions: if a player never voted, no entry for them', () => {
    const h = new Harness();
    connectPlayers(h, 3);

    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: false,
    });
    h.send('p0', { type: 'start' });
    h.send('p0', { type: 'to_vote' });

    const roundId = h.state().roundId;
    // Only p0 + p1 vote; p2 abstains.
    h.send('p0', { type: 'vote', targetSeat: 1, roundId });
    h.send('p1', { type: 'vote', targetSeat: 0, roundId });
    // Advance past vote timer so server tallies on timer expire.
    h.advance(40_000);

    const breakdown = h.state().result?.voteBreakdown;
    expect(breakdown).toBeDefined();
    expect(breakdown).toHaveLength(2);
    expect(breakdown!.find((v) => v.voterSeat === 2)).toBeUndefined();
  });
});
