import { describe, it, expect } from 'vitest';
import { Harness, connectPlayers } from './harness';

describe('rtc_signal relay', () => {
  it('forwards an offer from sender to target with from=senderId', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.clear();
    h.send('p0', {
      type: 'rtc_signal',
      to: 'p1',
      kind: 'offer',
      sdp: 'v=0\r\no=alan ...',
    });
    const forwarded = h.log.filter(
      (c) => c.kind === 'send' && c.to === 'p1' && c.msg.type === 'rtc_signal'
    );
    expect(forwarded).toHaveLength(1);
    const m = forwarded[0].msg as Extract<typeof forwarded[0]['msg'], { type: 'rtc_signal' }>;
    expect(m.from).toBe('p0');
    expect(m.kind).toBe('offer');
    expect(m.sdp).toContain('v=0');
  });

  it('forwards ice candidates', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.clear();
    h.send('p2', {
      type: 'rtc_signal',
      to: 'p0',
      kind: 'ice',
      candidate: { candidate: 'a=candidate:1 ...', sdpMLineIndex: 0 },
    });
    const m = h.log
      .filter((c) => c.kind === 'send' && c.to === 'p0' && c.msg.type === 'rtc_signal')
      .map((c) => c.msg as Extract<typeof c.msg, { type: 'rtc_signal' }>)[0];
    expect(m.from).toBe('p2');
    expect(m.kind).toBe('ice');
    expect(m.candidate).toBeDefined();
  });

  it('silently drops signals to unknown target playerIds', () => {
    const h = new Harness();
    connectPlayers(h, 3);
    h.clear();
    h.send('p0', {
      type: 'rtc_signal',
      to: 'p999_ghost',
      kind: 'offer',
      sdp: 'x',
    });
    const forwarded = h.log.filter((c) => c.kind === 'send' && c.msg.type === 'rtc_signal');
    expect(forwarded).toHaveLength(0);
  });
});
