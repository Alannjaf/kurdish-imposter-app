import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('lobby', () => {
  it('seats joining players in the order they hello', () => {
    const h = new Harness();
    h.connect('p0', 'Alice');
    h.connect('p1', 'Bob');
    h.connect('p2', 'Carol');
    const s = h.state();
    expect(s.players.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(s.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(s.hostPlayerId).toBe('p0');
    expect(s.phase).toBe('lobby');
  });

  it('host can set options; non-host gets not_host error', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.clear();
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 2,
      roundSeconds: 120,
      stealGuess: true,
    });
    expect(h.state().options).toMatchObject({
      categoryKey: 'food_drink',
      imposterCount: 2,
      roundSeconds: 120,
      stealGuess: true,
    });
    h.send('p1', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 60,
      stealGuess: false,
    });
    const errs = h.errorsFor('p1');
    expect(errs.some((e) => e.code === 'not_host')).toBe(true);
    // Options unchanged.
    expect(h.state().options.imposterCount).toBe(2);
  });

  it('accepts up to 12 players and rejects the 13th with room_full', () => {
    const h = new Harness();
    for (let i = 0; i < 12; i++) h.connect(`p${i}`, `N${i}`);
    expect(h.state().players.length).toBe(12);
    h.connect('p12', 'TooMany');
    expect(h.state().players.length).toBe(12);
    const errs = h.errorsFor('p12');
    expect(errs.some((e) => e.code === 'room_full')).toBe(true);
  });

  it('rejects start with fewer than 3 players', () => {
    const h = new Harness();
    connectPlayers(h, 2);
    h.send('p0', { type: 'start' });
    expect(h.state().phase).toBe('lobby');
    const errs = h.errorsFor('p0');
    expect(errs.some((e) => e.code === 'bad_phase')).toBe(true);
  });
});
