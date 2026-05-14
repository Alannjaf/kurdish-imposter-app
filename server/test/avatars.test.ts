import { describe, it, expect } from 'vitest';
import { Harness } from './harness';

describe('player avatars', () => {
  it('stores avatar from hello and exposes in snapshot', () => {
    const h = new Harness();
    h.room.onConnect('p0');
    h.room.onMessage('p0', { type: 'hello', playerId: 'p0', name: 'Alan', avatar: '🦊' });
    h.room.onConnect('p1');
    h.room.onMessage('p1', { type: 'hello', playerId: 'p1', name: 'Sara', avatar: '🐯' });
    const players = h.state().players;
    expect(players.find((p) => p.playerId === 'p0')?.avatar).toBe('🦊');
    expect(players.find((p) => p.playerId === 'p1')?.avatar).toBe('🐯');
  });

  it('updates avatar on reconnect with same playerId', () => {
    const h = new Harness();
    h.room.onConnect('p0');
    h.room.onMessage('p0', { type: 'hello', playerId: 'p0', name: 'Alan', avatar: '🦊' });
    h.room.onDisconnect('p0');
    h.room.onConnect('p0');
    h.room.onMessage('p0', { type: 'hello', playerId: 'p0', name: 'Alan', avatar: '🦁' });
    expect(h.state().players[0].avatar).toBe('🦁');
  });

  it('omits avatar when not provided in hello', () => {
    const h = new Harness();
    h.room.onConnect('p0');
    h.room.onMessage('p0', { type: 'hello', playerId: 'p0', name: 'NoAvatar' });
    expect(h.state().players[0].avatar).toBeUndefined();
  });
});
