import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('host promotion', () => {
  it('first player to hello becomes host', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    expect(h.state().hostPlayerId).toBe('p0');
  });

  it('when host disconnects, oldest remaining connected player is promoted', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p0');
    expect(h.state().hostPlayerId).toBe('p1');
    expect(h.state().players.find((p) => p.playerId === 'p0')?.connected).toBe(false);
  });

  it('skips disconnected players when promoting', () => {
    const h = new Harness();
    connectPlayers(h, 4);
    h.disconnect('p1'); // not host
    h.disconnect('p0'); // host leaves; p1 disconnected, so p2 promotes.
    expect(h.state().hostPlayerId).toBe('p2');
  });

  it('does not promote on non-host disconnect', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p2');
    expect(h.state().hostPlayerId).toBe('p0');
  });

  it('host can issue host-only actions; promoted host inherits the role', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p0');
    // Old host trying after disconnect would be a non-host action; just verify
    // the new host (p1) can run set_options.
    h.send('p1', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 90,
      stealGuess: true,
    });
    expect(h.state().options.roundSeconds).toBe(90);
    expect(h.state().options.stealGuess).toBe(true);
  });
});
