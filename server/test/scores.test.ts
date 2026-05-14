import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('cumulative scores', () => {
  it('initializes all players at 0', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    expect(h.state().scores).toEqual({ p0: 0, p1: 0, p2: 0 });
  });

  it('awards +1 to each civilian when civilians win', () => {
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
    const imposterSeat = h.state().players.findIndex((_, i) => {
      // Find imposter by sniffing the role sent privately to each player.
      const roles = h.rolesFor(`p${i}`);
      return roles.length > 0 && roles[0].isImposter;
    });
    expect(imposterSeat).toBeGreaterThanOrEqual(0);

    // All civilians vote the imposter.
    for (let i = 0; i < 3; i++) {
      if (i === imposterSeat) continue;
      h.send(`p${i}`, { type: 'vote', targetSeat: imposterSeat, roundId });
    }
    // Imposter abstains (so vote count = 2, accused = imposter, civilians win).
    h.advance(40_000); // expire vote timer

    const scores = h.state().scores;
    // 2 civilians get +1 each; imposter stays at 0.
    let civCount = 0;
    let impCount = 0;
    for (let i = 0; i < 3; i++) {
      const id = `p${i}`;
      if (i === imposterSeat) {
        impCount += scores[id];
      } else {
        civCount += scores[id];
      }
    }
    expect(civCount).toBe(2);
    expect(impCount).toBe(0);
  });

  it('persists scores across rounds', () => {
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
    let roundId = h.state().roundId;
    // p0 votes p1 — only one vote, p1 accused. If p1 is imposter, civilians win.
    // We can't deterministically force outcome without seeding so just play out and
    // verify the score sum increases over rounds, monotonically.
    h.send('p0', { type: 'vote', targetSeat: 1, roundId });
    h.advance(40_000);
    const sumAfter1 = Object.values(h.state().scores).reduce((a, b) => a + b, 0);
    expect(sumAfter1).toBeGreaterThan(0);

    // Next round.
    h.send('p0', { type: 'next_round' });
    h.send('p0', { type: 'to_vote' });
    roundId = h.state().roundId;
    h.send('p0', { type: 'vote', targetSeat: 2, roundId });
    h.advance(40_000);
    const sumAfter2 = Object.values(h.state().scores).reduce((a, b) => a + b, 0);
    expect(sumAfter2).toBeGreaterThan(sumAfter1);
  });

  it('reverses civilian win on a correct steal-guess', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'food_drink',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: true,
    });
    h.send('p0', { type: 'start' });
    h.send('p0', { type: 'to_vote' });
    const roundId = h.state().roundId;

    // Find imposter via private role messages.
    const imposterSeat = [0, 1, 2].find((i) => h.rolesFor(`p${i}`)[0]?.isImposter)!;
    const word = h.rolesFor(`p${[0, 1, 2].find((i) => i !== imposterSeat)!}`)[0].word;

    // Civilians vote the imposter; civilians win normally.
    for (let i = 0; i < 3; i++) {
      if (i === imposterSeat) continue;
      h.send(`p${i}`, { type: 'vote', targetSeat: imposterSeat, roundId });
    }
    h.advance(40_000);
    const scoresPreSteal = { ...h.state().scores };
    expect(h.state().result?.winners).toBe('civilians');
    // Civilians (2 of them) each got +1.
    expect(Object.values(scoresPreSteal).reduce((a, b) => a + b, 0)).toBe(2);

    // Imposter performs correct steal-guess → flips to imposter wins.
    h.send(`p${imposterSeat}`, { type: 'steal_guess', word: word!, roundId });
    expect(h.state().result?.winners).toBe('imposter');
    // Now imposter has +1, civilians back to 0.
    const scoresPost = h.state().scores;
    expect(scoresPost[`p${imposterSeat}`]).toBe(1);
    let civSum = 0;
    for (let i = 0; i < 3; i++) if (i !== imposterSeat) civSum += scoresPost[`p${i}`];
    expect(civSum).toBe(0);
  });
});
