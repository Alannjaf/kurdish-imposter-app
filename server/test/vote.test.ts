import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

function startRound(h: Harness, n: number) {
  const ids = connectPlayers(h, n);
  h.send('p0', { type: 'start' });
  // Force into vote phase via host.
  h.send('p0', { type: 'to_vote' });
  return ids;
}

describe('vote', () => {
  it('moves into vote phase and exposes voteEndsAt', () => {
    const h = new Harness();
    startRound(h, 4);
    expect(h.state().phase).toBe('vote');
    expect(h.state().voteEndsAt).toBeGreaterThan(h['now' as never] as never);
  });

  it('rejects votes with stale roundId', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    h.clear();
    h.send(ids[1], { type: 'vote', targetSeat: 0, roundId: 999 });
    const errs = h.errorsFor(ids[1]);
    expect(errs.some((e) => e.code === 'stale_round')).toBe(true);
    expect(h.state().votesCast ?? 0).toBe(0);
  });

  it('rejects voting for self', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    const rid = h.state().roundId;
    h.clear();
    h.send(ids[1], { type: 'vote', targetSeat: 1, roundId: rid });
    const errs = h.errorsFor(ids[1]);
    expect(errs.some((e) => e.code === 'invalid_target')).toBe(true);
  });

  it('counts votes and broadcasts votesCast', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    const rid = h.state().roundId;
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    expect(h.state().votesCast).toBe(1);
    h.send(ids[1], { type: 'vote', targetSeat: 0, roundId: rid });
    expect(h.state().votesCast).toBe(2);
  });

  it('rejects already_voted on second vote from same seat', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    const rid = h.state().roundId;
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    h.clear();
    h.send(ids[0], { type: 'vote', targetSeat: 2, roundId: rid });
    const errs = h.errorsFor(ids[0]);
    expect(errs.some((e) => e.code === 'already_voted')).toBe(true);
  });

  it('after every connected player votes, transitions to reveal automatically', () => {
    const h = new Harness();
    const ids = startRound(h, 3);
    const rid = h.state().roundId;
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    h.send(ids[1], { type: 'vote', targetSeat: 0, roundId: rid });
    h.send(ids[2], { type: 'vote', targetSeat: 0, roundId: rid });
    expect(h.state().phase).toBe('reveal');
    expect(h.state().result).toBeDefined();
  });

  it('vote-timer expiry transitions to reveal even with missing votes', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    const rid = h.state().roundId;
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    // Advance past 30s timer.
    h.advance(30_000 + 1);
    expect(h.state().phase).toBe('reveal');
  });

  it('late vote arriving after timer is ignored (bad_phase)', () => {
    const h = new Harness();
    const ids = startRound(h, 4);
    const rid = h.state().roundId;
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    h.advance(30_001);
    expect(h.state().phase).toBe('reveal');
    h.clear();
    h.send(ids[2], { type: 'vote', targetSeat: 1, roundId: rid });
    const errs = h.errorsFor(ids[2]);
    expect(errs.some((e) => e.code === 'bad_phase')).toBe(true);
  });

  it('tie → imposter wins regardless of who is accused', () => {
    // Force a deterministic deal: with seed 42 and 4 players, find imposter
    // seat by inspecting the role messages, then construct a tie that pulls
    // top-vote between an imposter and a civilian.
    const h = new Harness();
    const ids = connectPlayers(h, 4);
    h.send('p0', { type: 'start' });
    // Find imposter seat from private roles.
    const imposterSeat = ids
      .map((id, i) => ({ i, isImposter: h.rolesFor(id)[0].isImposter }))
      .find((x) => x.isImposter)!.i;
    const civilianSeat = imposterSeat === 0 ? 1 : 0;
    h.send('p0', { type: 'to_vote' });
    const rid = h.state().roundId;
    // Two votes on imposter, two votes on a civilian → tie.
    // Voters must not vote themselves; pick voter seats accordingly.
    const voters = [0, 1, 2, 3];
    const targets = voters.map((v) => {
      // Pair: voters 0,1 → imposterSeat (skip self); voters 2,3 → civilianSeat (skip self).
      const wantImposter = v < 2;
      let target = wantImposter ? imposterSeat : civilianSeat;
      if (target === v) target = wantImposter ? civilianSeat : imposterSeat;
      return target;
    });
    for (let i = 0; i < voters.length; i++) {
      h.send(ids[voters[i]], { type: 'vote', targetSeat: targets[i], roundId: rid });
    }
    expect(h.state().phase).toBe('reveal');
    // Tally must produce a tie at top → winners = imposter.
    expect(h.state().result?.winners).toBe('imposter');
  });
});
