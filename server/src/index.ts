// PartyKit entry point. Thin adapter — all game logic lives in `room.ts`.
//
// One Durable Object per room; the room code is the DO id (the URL path
// `/parties/main/<CODE>`). Connections carry `playerId` as a query param.

import type * as Party from 'partykit/server';
import { RoomState } from './room';
import type { C2S, S2C } from './protocol';

export default class Server implements Party.Server {
  private room: RoomState;

  constructor(readonly party: Party.Party) {
    this.room = new RoomState(this.party.id, {
      send: (playerId, msg) => this.sendTo(playerId, msg),
      broadcast: (msg) => this.party.broadcast(JSON.stringify(msg)),
      now: () => Date.now(),
      setAlarm: (atMs) => {
        if (atMs == null) {
          this.party.storage.deleteAlarm().catch(() => {});
        } else {
          this.party.storage.setAlarm(atMs).catch(() => {});
        }
      },
    });
  }

  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext): void {
    // playerId is carried as the connection id (set by the client when opening
    // the WebSocket). We let the room observe the connect event but seat
    // resolution waits for the first `hello` message.
    this.room.onConnect(conn.id);
  }

  onMessage(message: string, sender: Party.Connection): void {
    let msg: C2S;
    try {
      msg = JSON.parse(message) as C2S;
    } catch {
      sender.send(
        JSON.stringify({
          type: 'error',
          code: 'internal',
          message: 'Malformed JSON',
        } satisfies S2C)
      );
      return;
    }
    this.room.onMessage(sender.id, msg);
  }

  onClose(conn: Party.Connection): void {
    this.room.onDisconnect(conn.id);
  }

  onError(conn: Party.Connection): void {
    this.room.onDisconnect(conn.id);
  }

  async onAlarm(): Promise<void> {
    this.room.tick();
  }

  // -------------------------------------------------------------------------

  private sendTo(playerId: string, msg: S2C): void {
    for (const conn of this.party.getConnections()) {
      if (conn.id === playerId) {
        conn.send(JSON.stringify(msg));
      }
    }
  }
}

Server satisfies Party.Worker;
