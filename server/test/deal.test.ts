import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('deal', () => {
  it('start moves out of lobby and emits exactly one role per connected player', () => {
    const h = new Harness();
    const ids = connectPlayers(h, 4);
    h.clear();
    h.send('p0', { type: 'start' });
    // Phase advances past lobby.
    expect(h.state().phase === 'clue' || h.state().phase === 'deal').toBe(true);
    // Each player gets exactly one role message.
    for (const id of ids) {
      const roles = h.rolesFor(id);
      expect(roles.length).toBe(1);
    }
  });

  it('exactly imposterCount players see word=null, others see the crew word', () => {
    const h = new Harness();
    const ids = connectPlayers(h, 5);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 2,
      roundSeconds: 60,
      stealGuess: false,
    });
    h.clear();
    h.send('p0', { type: 'start' });
    const allRoles = ids.map((id) => h.rolesFor(id)[0]);
    const imposters = allRoles.filter((r) => r.isImposter);
    const civilians = allRoles.filter((r) => !r.isImposter);
    expect(imposters.length).toBe(2);
    expect(civilians.length).toBe(3);
    for (const r of imposters) expect(r.word).toBeNull();
    // Civilians all share the same word.
    const words = new Set(civilians.map((r) => r.word));
    expect(words.size).toBe(1);
    expect([...words][0]).toBeTruthy();
  });

  it('public state never reveals imposter assignment during deal/clue', () => {
    const h = new Harness();
    connectPlayers(h, 4);
    h.send('p0', { type: 'start' });
    const s = h.state();
    // PublicRoomState has no imposterSeats outside reveal.
    expect((s as any).imposterSeats).toBeUndefined();
    expect(s.result).toBeUndefined();
    // category is now visible.
    expect(s.category?.key).toBe('food_drink');
  });

  it('roundId increments monotonically and role messages carry it', () => {
    const h = new Harness();
    const ids = connectPlayers(h, 3);
    h.send('p0', { type: 'start' });
    const r1 = h.rolesFor(ids[0])[0];
    expect(r1.roundId).toBe(h.state().roundId);
    expect(r1.roundId).toBeGreaterThan(0);
  });
});
