import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('reconnect', () => {
  it('returning playerId re-attaches to existing seat', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p1');
    expect(h.state().players[1].connected).toBe(false);
    // Same playerId reconnects — same seat.
    h.connect('p1', 'Bob');
    const seats = h.state().players.map((p) => p.seat);
    expect(seats).toEqual([0, 1, 2]);
    expect(h.state().players[1].playerId).toBe('p1');
    expect(h.state().players[1].connected).toBe(true);
  });

  it('reconnect during a round receives a fresh role message', () => {
    const h = new Harness();
    const ids = connectPlayers(h, 3);
    h.send('p0', { type: 'start' });
    const initialRole = h.rolesFor(ids[1])[0];
    h.disconnect('p1');
    h.clear();
    h.connect('p1', 'Bob');
    const roles = h.rolesFor('p1');
    expect(roles.length).toBeGreaterThanOrEqual(1);
    const r = roles[roles.length - 1];
    expect(r.roundId).toBe(h.state().roundId);
    // Same role assignment (deterministic).
    expect(r.isImposter).toBe(initialRole.isImposter);
    expect(r.word).toBe(initialRole.word);
  });

  it('reconnect does not exceed MAX_PLAYERS even at 12', () => {
    const h = new Harness();
    for (let i = 0; i < 12; i++) h.connect(`p${i}`, `N${i}`);
    h.disconnect('p5');
    h.clear();
    // Reconnect — must not be rejected as room_full.
    h.connect('p5', 'N5');
    const errs = h.errorsFor('p5');
    expect(errs.some((e) => e.code === 'room_full')).toBe(false);
    expect(h.state().players.length).toBe(12);
    expect(h.state().players[5].connected).toBe(true);
  });

  it('reconnect after a state change pushes the latest snapshot', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 90,
      stealGuess: true,
    });
    h.disconnect('p1');
    h.clear();
    h.connect('p1', 'Bob');
    // After reconnect, a state broadcast must have happened.
    const states = h.states();
    expect(states.length).toBeGreaterThanOrEqual(1);
    const last = states[states.length - 1] as any;
    expect(last.state.options.stealGuess).toBe(true);
  });
});
