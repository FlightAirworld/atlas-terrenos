'use strict';
// Compartir cartas: lo que ve quien abre un enlace /carta/ID (sin base de datos real: `all` está simulada)
const test = require('node:test');
const assert = require('node:assert');
const makeCards = require('../cards-server');

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function make(rows = {}) {
  const all = async (sql, params) => {
    if (/FROM card_owned/.test(sql)) return rows.owned && Number(params[1]) === rows.owned.id ? [{ user_id: 'u1' }] : [];
    if (/FROM card_black/.test(sql)) return rows.black && params[0] === rows.black.month ? [{ user_id: 'u1' }] : [];
    if (/FROM profiles/.test(sql)) return [{ nickname: 'Ana<b>', avatar: '🦊' }];
    if (/FROM parcels/.test(sql)) return [{ country: 'ES' }];
    return [];
  };
  return makeCards({ pool: {}, run: async () => {}, all, needUser: async () => ({ id: 'u1' }), ensureUserPack: async () => {}, dayKey: () => '2026-11-09', HttpError, rateHit: () => 1, numEnv: (n, d) => d });
}
const sp = id => new URLSearchParams({ id });

test('una carta con dueño devuelve su apodo, avatar y país', async () => {
  const r = await make({ owned: { id: 4321 } }).shareInfo(sp('4321'));
  assert.strictEqual(r.id, '4321'); assert.strictEqual(r.owned, true); assert.strictEqual(r.black, false);
  assert.deepStrictEqual(r.owner, { nick: 'Ana<b>', avatar: '🦊', country: 'ES' });
});
test('una carta sin dueño sale como libre y sin datos de nadie', async () => {
  const r = await make().shareInfo(sp('77'));
  assert.strictEqual(r.owned, false); assert.strictEqual(r.owner, null);
});
test('los ceros a la izquierda se normalizan y la Carta Negra se reconoce', async () => {
  assert.strictEqual((await make().shareInfo(sp('00012'))).id, '12');
  const b = await make({ black: { month: '2026-11' } }).shareInfo(sp('n2026-11'));
  assert.strictEqual(b.black, true); assert.strictEqual(b.month, '2026-11'); assert.strictEqual(b.owned, true);
});
test('ids inventados o fuera de rango dan 404', async () => {
  for (const id of ['0', '10001', 'abc', '12345678', 'N2026-13', "1; DROP TABLE packs", '']) {
    await assert.rejects(() => make().shareInfo(sp(id)), e => e.status === 404, 'debería fallar: ' + id);
  }
});
test('la página /carta/ID escapa el apodo y manda al juego', async () => {
  const html = await make({ owned: { id: 5 } }).sharePage('5', 'https://redecoraelmundo.com');
  assert.ok(html.includes('og:title') && html.includes('url=/?carta=5'));
  assert.ok(!html.includes('Ana<b>') && html.includes('Ana&lt;b&gt;'));
  assert.strictEqual(await make().sharePage('zzz', 'https://x'), null);
});
