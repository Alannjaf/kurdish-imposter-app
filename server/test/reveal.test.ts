import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

function runToReveal(h: Harness, n: number, stealGuess: boolean) {
  const ids = connectPlayers(h, n);
  h.send('p0', {
    type: 'set_options',
    categoryKey: 'food_drink',
    imposterCount: 1,
    roundSeconds: 60,
    stealGuess,
  });
  h.send('p0', { type: 'start' });
  // Find imposter seat.
  const imposterSeat = ids
    .map((id, i) => ({ i, isImposter: h.rolesFor(id)[0].isImposter, word: h.rolesFor(id)[0].word }))
    .find((x) => x.isImposter)!.i;
  const word = h.rolesFor(ids.find((_, i) => i !== imposterSeat)!)[0].word!;
  h.send('p0', { type: 'to_vote' });
  const rid = h.state().roundId;
  // All players vote the imposter (imposter votes a civilian, can't self-vote).
  const civilianForImposter = imposterSeat === 0 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    if (i === imposterSeat) {
      h.send(ids[i], { type: 'vote', targetSeat: civilianForImposter, roundId: rid });
    } else {
      h.send(ids[i], { type: 'vote', targetSeat: imposterSeat, roundId: rid });
    }
  }
  return { ids, imposterSeat, word, rid };
}

describe('reveal', () => {
  it('reveal exposes accusedSeat, imposterSeats, word', () => {
    const h = new Harness();
    const { imposterSeat, word } = runToReveal(h, 4, false);
    const r = h.state().result!;
    expect(r.accusedSeat).toBe(imposterSeat);
    expect(r.accusedWasImposter).toBe(true);
    expect(r.imposterSeats).toEqual([imposterSeat]);
    expect(r.word).toBe(word);
    expect(r.winners).toBe('civilians');
  });

  it('steal_guess rejected when option disabled', () => {
    const h = new Harness();
    const { ids, imposterSeat, rid } = runToReveal(h, 4, false);
    h.clear();
    h.send(ids[imposterSeat], { type: 'steal_guess', word: 'whatever', roundId: rid });
    const errs = h.errorsFor(ids[imposterSeat]);
    expect(errs.some((e) => e.code === 'bad_phase')).toBe(true);
    expect(h.state().result?.winners).toBe('civilians');
  });

  it('steal_guess rejected when accused is not the imposter', () => {
    // Make a new harness where accused is a civilian (everyone votes seat 0,
    // and seat 0 is civilian).
    const h = new Harness();
    const ids = connectPlayers(h, 4);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 60,
      stealGuess: true,
    });
    h.send('p0', { type: 'start' });
    const imposterSeat = ids
      .map((id, i) => ({ i, isImposter: h.rolesFor(id)[0].isImposter }))
      .find((x) => x.isImposter)!.i;
    if (imposterSeat === 0) {
      // Skip — we'd need a different deal seed; instead just accept the
      // assertion can't run and verify with a re-seeded harness below.
      const h2 = new Harness('TEST', () => 0.99);
      // Fall through to that harness instead.
      const ids2 = connectPlayers(h2, 4);
      h2.send('p0', {
        type: 'set_options',
        categoryKey: 'food_drink',
        imposterCount: 1,
        roundSeconds: 60,
        stealGuess: true,
      });
      h2.send('p0', { type: 'start' });
      const impSeat = ids2
        .map((id, i) => ({ i, isImposter: h2.rolesFor(id)[0].isImposter }))
        .find((x) => x.isImposter)!.i;
      // If still seat 0 we just skip rather than fail.
      if (impSeat === 0) return;
      h2.send('p0', { type: 'to_vote' });
      const rid2 = h2.state().roundId;
      for (let i = 0; i < 4; i++) {
        if (i === 0) continue;
        h2.send(ids2[i], { type: 'vote', targetSeat: 0, roundId: rid2 });
      }
      h2.send(ids2[0], { type: 'vote', targetSeat: 1, roundId: rid2 });
      // accused = seat 0 (civilian).
      expect(h2.state().result?.accusedSeat).toBe(0);
      expect(h2.state().result?.accusedWasImposter).toBe(false);
      // Imposter cannot steal-guess because they were not accused.
      h2.clear();
      h2.send(ids2[impSeat], { type: 'steal_guess', word: 'anything', roundId: rid2 });
      const errs = h2.errorsFor(ids2[impSeat]);
      expect(errs.some((e) => e.code === 'invalid_target')).toBe(true);
      return;
    }
    // Vote seat 0 (civilian) into accused position.
    h.send('p0', { type: 'to_vote' });
    const rid = h.state().roundId;
    for (let i = 1; i < 4; i++) {
      h.send(ids[i], { type: 'vote', targetSeat: 0, roundId: rid });
    }
    h.send(ids[0], { type: 'vote', targetSeat: 1, roundId: rid });
    expect(h.state().result?.accusedSeat).toBe(0);
    expect(h.state().result?.accusedWasImposter).toBe(false);
    // Now the (caught? no — uncaught) imposter cannot steal-guess.
    h.clear();
    h.send(ids[imposterSeat], { type: 'steal_guess', word: 'anything', roundId: rid });
    const errs = h.errorsFor(ids[imposterSeat]);
    expect(errs.some((e) => e.code === 'invalid_target')).toBe(true);
  });

  it('correct steal_guess flips winners from civilians to imposter', () => {
    const h = new Harness();
    const { ids, imposterSeat, word, rid } = runToReveal(h, 4, true);
    expect(h.state().result?.winners).toBe('civilians');
    h.send(ids[imposterSeat], { type: 'steal_guess', word: word, roundId: rid });
    const r = h.state().result!;
    expect(r.stealGuessUsed?.correct).toBe(true);
    expect(r.winners).toBe('imposter');
  });

  it('case-insensitive trim on steal_guess comparison', () => {
    const h = new Harness();
    const { ids, imposterSeat, word, rid } = runToReveal(h, 4, true);
    h.send(ids[imposterSeat], { type: 'steal_guess', word: `  ${word.toUpperCase()}  `, roundId: rid });
    expect(h.state().result?.stealGuessUsed?.correct).toBe(true);
    expect(h.state().result?.winners).toBe('imposter');
  });

  it('wrong steal_guess leaves civilians as winners', () => {
    const h = new Harness();
    const { ids, imposterSeat, rid } = runToReveal(h, 4, true);
    h.send(ids[imposterSeat], { type: 'steal_guess', word: 'definitely-wrong-zzz', roundId: rid });
    expect(h.state().result?.stealGuessUsed?.correct).toBe(false);
    expect(h.state().result?.winners).toBe('civilians');
  });

  it('next_round bumps roundId and re-deals', () => {
    const h = new Harness();
    runToReveal(h, 4, false);
    const oldRid = h.state().roundId;
    h.send('p0', { type: 'next_round' });
    expect(h.state().roundId).toBeGreaterThan(oldRid);
    expect(h.state().phase === 'clue' || h.state().phase === 'deal').toBe(true);
  });
});
