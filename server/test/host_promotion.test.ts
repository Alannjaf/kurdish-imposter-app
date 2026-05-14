import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('host promotion', () => {
  it('first player to hello becomes host', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    expect(h.state().hostPlayerId).toBe('p0');
  });

  it('when host disconnects, promotion defers until the grace window expires', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p0');
    // Inside the grace window: original host is still on the throne, just offline.
    expect(h.state().hostPlayerId).toBe('p0');
    expect(h.state().players.find((p) => p.playerId === 'p0')?.connected).toBe(false);
    // Past the grace window: oldest remaining connected player is promoted.
    h.advance(9000);
    expect(h.state().hostPlayerId).toBe('p1');
  });

  it('reconnecting host within the grace window cancels promotion', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p0');
    h.advance(3000);
    h.connect('p0', 'Name0'); // reconnect inside the window
    h.advance(10000); // and now past the deadline
    expect(h.state().hostPlayerId).toBe('p0');
    expect(h.state().players.find((p) => p.playerId === 'p0')?.connected).toBe(true);
  });

  it('skips disconnected players when promoting after grace expires', () => {
    const h = new Harness();
    connectPlayers(h, 4);
    h.disconnect('p1'); // not host
    h.disconnect('p0'); // host leaves; p1 disconnected, p2 should promote
    h.advance(9000);
    expect(h.state().hostPlayerId).toBe('p2');
  });

  it('does not promote on non-host disconnect', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p2');
    expect(h.state().hostPlayerId).toBe('p0');
  });

  it('host can issue host-only actions; promoted host inherits the role after grace', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.disconnect('p0');
    h.advance(9000); // promotion fires here
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

  it('immediate promotion if no other connected player when host disconnects', () => {
    const h = new Harness();
    connectPlayers(h, 2);
    h.disconnect('p1'); // non-host first
    h.disconnect('p0'); // host disconnects with no one connected
    // No grace — the room has no one to defer for.
    expect(h.state().hostPlayerId).toBe('p0'); // promoteHost picks first connected; none, falls back to players[0]
  });
});
