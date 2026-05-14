import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('custom word list', () => {
  it('rejects fewer than 5 pairs', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'custom',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: false,
      customWords: [
        { crew: 'cat', imposter: 'dog' },
        { crew: 'sun', imposter: 'moon' },
      ],
    });
    const errs = h.errorsFor('p0');
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.at(-1)?.code).toBe('invalid_target');
  });

  it('accepts ≥5 pairs and uses them when round starts', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    const list = [
      { crew: 'مەلا', imposter: 'سەید' },
      { crew: 'هاوار', imposter: 'بانگ' },
      { crew: 'دلۆپە', imposter: 'باران' },
      { crew: 'شار', imposter: 'گوند' },
      { crew: 'تاو', imposter: 'مانگ' },
    ];
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'custom',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: false,
      customWords: list,
    });
    expect(h.errorsFor('p0').length).toBe(0);
    expect(h.state().options.categoryKey).toBe('custom');
    expect(h.state().options.customWords).toHaveLength(5);

    h.send('p0', { type: 'start' });
    // A civilian's role message should carry a crew word from the list.
    const civRole = ['p0', 'p1', 'p2']
      .map((id) => h.rolesFor(id)[0])
      .find((r) => r && !r.isImposter);
    expect(civRole).toBeDefined();
    const crews = list.map((p) => p.crew);
    expect(crews).toContain(civRole!.word);
  });

  it('trims and filters empty entries before counting', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.send('p0', {
      type: 'set_options',
      categoryKey: 'custom',
      imposterCount: 1,
      roundSeconds: 30,
      stealGuess: false,
      customWords: [
        { crew: '  a  ', imposter: 'b' },
        { crew: '', imposter: 'ignored' },
        { crew: 'c', imposter: 'd' },
        { crew: 'e', imposter: 'f' },
        { crew: 'g', imposter: 'h' },
        { crew: 'i', imposter: 'j' },
      ],
    });
    // 1 empty discarded → 5 remain → accepted.
    expect(h.errorsFor('p0').length).toBe(0);
    expect(h.state().options.customWords).toHaveLength(5);
    expect(h.state().options.customWords?.[0]?.crew).toBe('a');
  });
});
