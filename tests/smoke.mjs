// E2E smoke against a live PartyKit deploy.
// Usage:
//   node tests/smoke.mjs                          (uses EXPO_PUBLIC_PARTYKIT_URL from .env.local)
//   PARTYKIT_URL=https://host node tests/smoke.mjs
// Exits 0 on PASS, 1 on FAIL.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function loadDotenv(path) {
  try {
    const txt = readFileSync(path, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadDotenv(resolve(here, '..', '.env.local'));
loadDotenv(resolve(here, '..', '.env'));

const URL_RAW = process.env.PARTYKIT_URL || process.env.EXPO_PUBLIC_PARTYKIT_URL;
if (!URL_RAW) {
  console.error('No PARTYKIT_URL or EXPO_PUBLIC_PARTYKIT_URL set.');
  process.exit(2);
}
const HOST = URL_RAW.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const WS_BASE = `wss://${HOST}/parties/main`;
const ROOM = `S${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

function connect(p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/${ROOM}?_pk=${p.id}`);
    p.ws = ws; p.msgs = [];
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'hello', playerId: p.id, name: p.name, asHost: p.asHost }));
      resolve();
    });
    ws.addEventListener('message', (ev) => p.msgs.push(JSON.parse(ev.data)));
    ws.addEventListener('error', (e) => reject(new Error(e.message || String(e))));
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const host = { id: 'p_host', name: 'Host', asHost: true };
const g1   = { id: 'p_g1',   name: 'Guest1', asHost: false };
const g2   = { id: 'p_g2',   name: 'Guest2', asHost: false };

console.log(`Smoke against ${WS_BASE}/${ROOM}`);

await connect(host);
await sleep(300);
await Promise.all([connect(g1), connect(g2)]);
await sleep(800);

const players = [host, g1, g2];
const lobby = players.map(p => p.msgs.filter(m => m.type === 'state' && m.state?.phase === 'lobby').slice(-1)[0]);
const hostId = lobby[0]?.state.hostPlayerId;

host.ws.send(JSON.stringify({
  type: 'set_options',
  categoryKey: 'food_drink',
  imposterCount: 1,
  roundSeconds: 60,
  stealGuess: false,
}));
await sleep(400);
host.ws.send(JSON.stringify({ type: 'start' }));
await sleep(1500);

const deal  = players.map(p => p.msgs.filter(m => m.type === 'state' && m.state?.phase === 'deal').slice(-1)[0]);
const roles = players.map(p => p.msgs.find(m => m.type === 'role'));
const errs  = players.flatMap(p => p.msgs.filter(m => m.type === 'error'));
const imposters = roles.filter(r => r?.isImposter).length;
const word = roles.find(r => !r.isImposter)?.word;
const cat = deal[0]?.state.category?.key;

console.log(`host=${hostId} lobby_players=${lobby[0]?.state.players.length} phase_deal=${deal.every(Boolean)} roles=${roles.filter(Boolean).length}/3 imposters=${imposters} word="${word}" category=${cat}`);
if (errs.length) console.log(`errors=${errs.length} ${JSON.stringify(errs)}`);

players.forEach(p => p.ws.close());
await sleep(200);

const ok =
  hostId === 'p_host' &&
  lobby.every(s => s?.state.players.length === 3) &&
  deal.every(Boolean) &&
  roles.every(Boolean) &&
  imposters === 1 &&
  !!word &&
  errs.length === 0;

console.log(`\nSMOKE ${ok ? 'PASS — Round complete' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
