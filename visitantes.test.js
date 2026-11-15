'use strict';
// Pruebas de visitantes.js: datos de los países, comprensión de lo que escribe el jugador y una conversación completa con un DOM de mentira.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

// ---- DOM y mapa mínimos ----
class El {
  constructor() { this._cls = new Set(); this._q = {}; this._kids = []; this.style = {}; this._ev = {}; this._text = ''; this.value = ''; }
  get classList() { const s = this._cls; return { add: c => s.add(c), remove: c => s.delete(c), toggle: (c, on) => { (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); }, contains: c => s.has(c) }; }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get firstChild() { return this._kids[0] || (this._fc = this._fc || new El()); }
  get children() { return this._kids; }
  get lastChild() { return this._kids[this._kids.length - 1]; }
  get scrollHeight() { return 0; }
  appendChild(c) { this._kids.push(c); return c; }
  removeChild(c) { this._kids = this._kids.filter(x => x !== c); return c; }
  set textContent(t) { this._text = t; if (t === '') this._kids = []; }
  get textContent() { return this._text; }
  set innerHTML(h) { this._html = h; }
  querySelector(sel) { return this._q[sel] || (this._q[sel] = new El()); }
  setAttribute() {} focus() {}
  addEventListener(ev, fn) { this._ev[ev] = fn; }
}
function setup(over = {}) {
  const sandbox = globalThis;
  const body = new El(), head = new El();
  sandbox.window = sandbox;
  sandbox.document = { createElement: () => new El(), body, head, hidden: false, addEventListener() {} };
  sandbox.innerWidth = 400; sandbox.innerHeight = 700;
  const rad = Math.PI / 180, W = z => 256 * Math.pow(2, z);
  sandbox.map = {
    getZoom: () => 17, getSize: () => ({ x: 400, y: 700 }), getCenter: () => ({ lat: 40.4, lng: -3.7 }),
    createPane: () => new El(), getPane: () => new El(), removeLayer: l => l.remove(), on() {}, sizes: () => ({ fp: 1 }),
    project: (ll, z) => ({ x: (ll.lng + 180) / 360 * W(z), y: (0.5 - Math.log(Math.tan(Math.PI / 4 + ll.lat * rad / 2)) / (2 * Math.PI)) * W(z) }),
    unproject: (p, z) => ({ lng: p.x / W(z) * 360 - 180, lat: (2 * Math.atan(Math.exp((0.5 - p.y / W(z)) * 2 * Math.PI)) - Math.PI / 2) / rad }),
    containerPointToLatLng: p => ({ lat: 40.4 - (p.y - 350) * 1e-6, lng: -3.7 + (p.x - 200) * 1e-6 }),
    latLngToContainerPoint: () => ({ x: 100, y: 200 }),
    getBounds: () => { const b = { pad: () => b, contains: () => true }; return b; }
  };
  sandbox.L = { point: (x, y) => ({ x, y }), divIcon: o => o, marker: (ll, o) => { const el = new El(); return { getElement: () => el, addTo() { return this; }, setLatLng() {}, remove() {} }; } };
  sandbox.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 16);
  sandbox.window.Monumentos = { list: () => [{ id: 'x', name: 'la Sagrada Familia', place: 'Barcelona', lat: 40.4005, lng: -3.7 }] };
  sandbox.window.soundOn = () => true;
  sandbox.window.soundPrefs = { set() {}, onChange() {} };
  sandbox.window.addEventListener = () => {};
  sandbox.authToken = over.logged === false ? null : 'tok';
  sandbox.nickOf = () => 'Marta63';
  sandbox.refreshCredits = () => { sandbox.refreshed = (sandbox.refreshed || 0) + 1; };
  sandbox.flashToast = t => { sandbox.toasts.push(t); };
  sandbox.toasts = []; sandbox.apiCalls = [];
  sandbox.api = async (url, opts) => {
    sandbox.apiCalls.push([url, opts && opts.body]);
    if (url.includes('estado')) return { ok: true, left: over.left ?? 3, wait: 0, max: 2, daily: 3 };
    return over.gift || { ok: true, rewarded: true, reward: opts.body.credits, credits: 10, left: 2 };
  };
  sandbox.window.atlasVoice = {
    spoken: [], profile: k => ({ k: 'human', g: k === 'mujer' ? 'f' : 'm' }), stop() {}, hasLang: () => false,
    speak(t, p, o) { this.spoken.push({ t, g: p.g }); if (o && o.onend) setTimeout(o.onend, 2); return true; }
  };
  let ticker = null;
  sandbox.setInterval = fn => { ticker = fn; return 0; };
  vm.runInThisContext(fs.readFileSync(__dirname + '/visitantes.js', 'utf8'), { filename: 'visitantes.js' });
  return { body, head, tick: () => ticker() };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Responde a todo lo que pregunta el visitante hasta que se cierra el panel; devuelve lo dicho
async function drive(ui, pickChip) {
  const panel = ui.body.children[0], log = panel.querySelector('.vz-log'), chips = panel.querySelector('.vz-chips');
  const asked = new Set(), all = [], counts = [], lines = [];   // el panel solo guarda las últimas líneas: las vamos apuntando todas
  for (let i = 0; i < 600; i++) {
    await sleep(15);
    log.children.forEach(c => { if (!all.includes(c.textContent)) all.push(c.textContent); });
    if (log.children.length > 1) lines.push(log.children.length);
    if (panel.classList.contains('hidden') && i > 5) break;
    const btns = chips.children;
    if (btns.length && !asked.has(btns)) {
      asked.add(btns);
      counts.push(btns.length);
      const b = pickChip(btns); b.onclick();
    }
  }
  log.children.forEach(c => { if (!all.includes(c.textContent)) all.push(c.textContent); });
  return { said: all, counts, lines, hidden: panel.classList.contains('hidden'), hasInput: !!panel._q.input || !!panel._q.form };
}

test('hay países de todos los continentes, con nombres de hombre y de mujer y sin duplicados raros', () => {
  const ui = setup(); const C = window.Visitantes._data;
  assert.ok(C.length >= 45);
  assert.strictEqual(new Set(C.map(c => c.cc)).size, C.length);
  for (const c of C) {
    assert.ok(c.flag && c.country && c.hello && c.dish, c.cc);
    assert.ok(c.m.length >= 3 && c.f.length >= 3, c.cc);
    assert.strictEqual([...c.flag].length, 2, 'bandera de 2 símbolos: ' + c.cc);
  }
});

test('entiende lo que escribe el jugador', () => {
  setup(); const I = window.Visitantes._intent;
  assert.strictEqual(I('Sí, claro'), 'yes'); assert.strictEqual(I('no gracias'), 'no'); assert.strictEqual(I('Claro que no'), 'no');
  assert.strictEqual(I('¿Cómo te llamas?'), 'name'); assert.strictEqual(I('¿De dónde eres?'), 'from');
  assert.strictEqual(I('dame créditos'), 'credits'); assert.strictEqual(I('eres tonto'), 'insult');
  assert.strictEqual(I('adiós!'), 'bye'); assert.strictEqual(I('qué guapa eres'), 'compliment'); assert.strictEqual(I('muchas gracias'), 'thanks');
  assert.strictEqual(I('qué hora es'), 'time'); assert.strictEqual(I('Hola'), 'hello'); assert.strictEqual(I('me gusta el helado'), 'other');
  const K = window.Visitantes._country;
  assert.strictEqual(K('soy de Francia').cc, 'FR'); assert.strictEqual(K('vivo en EEUU').cc, 'US'); assert.strictEqual(K('de México').cc, 'MX'); assert.strictEqual(K('de la luna'), undefined);
});

test('un visitante sale, te busca, te pregunta por TikTok y te regala 1-2 créditos', async () => {
  const realRandom = Math.random; Math.random = () => 0.1;   // aleatorio fijo: generoso y siempre se acerca al jugador
  try {
    const ui = setup(); ui.tick();
    const name = window.Visitantes.spawn(); assert.ok(/\(/.test(name), name);
    const cs = window.Visitantes.list(); assert.strictEqual(cs.length, 1);
    // toca al visitante: empieza a hablar
    const marker = ui.body; const panel = ui.body.children[0] || null;
    // el click se registró en el elemento del muñeco; lo buscamos recorriendo el spawn: usamos Visitantes.talk
    assert.ok(window.Visitantes.talk, 'Visitantes.talk existe');
    window.Visitantes.talk(0);
    const out = await drive(ui, btns => btns.find(b => /gift_yes|Aceptar/.test(b.textContent) || /Sí|Muy bien|Pop|Mi casa|Pizza/.test(b.textContent)) || btns[0]);
    const text = out.said.join('\n');
    assert.ok(out.hidden, 'la conversación termina y el panel se cierra');
    assert.ok(/TikTok/.test(text), 'pregunta por TikTok');
    assert.ok(/Marta63/.test(text), 'te llama por tu apodo');
    const g = apiCalls.find(c => c[0].includes('/regalo'));
    assert.ok(g, 'regala créditos: ' + JSON.stringify(apiCalls));
    assert.ok(g[1].credits >= 1 && g[1].credits <= 2, 'regalo de 1 o 2 créditos');
    assert.ok(refreshed >= 1, 'actualiza los créditos');
    assert.ok(window.atlasVoice.spoken.length > 3, 'habla con voz');
    assert.ok(toasts.some(t => /regalado/.test(t)), 'avisa del regalo');
  } finally { Math.random = realRandom; }
});

test('el chat no tiene caja de texto: siempre 5 opciones para pulsar y una sola línea cada vez', async () => {
  const realRandom = Math.random; Math.random = () => 0.1;
  try {
    const ui = setup(); ui.tick(); window.Visitantes.spawn(); window.Visitantes.talk(0);
    const out = await drive(ui, btns => btns.find(b => /Muy bien|Sí|Pop|Mi casa|Pizza|Aceptar/.test(b.textContent)) || btns[0]);
    assert.ok(out.hidden);
    assert.ok(!out.hasInput, 'no hay caja de texto');
    assert.ok(out.counts.length >= 3 && out.counts.every(n => n === 5), 'siempre 5 opciones: ' + out.counts);
    assert.ok(out.lines.length === 0, 'nunca más de una línea a la vez');
    assert.ok(window.Visitantes.talking() === false, 'al terminar ya no habla');
  } finally { Math.random = realRandom; }
});

test('pulsar «Adiós» termina la charla sin regalo', async () => {
  const realRandom = Math.random; Math.random = () => 0.1;
  try {
    const ui = setup(); ui.tick(); window.Visitantes.spawn(); window.Visitantes.talk(0);
    const out = await drive(ui, btns => btns.find(b => /Adiós/.test(b.textContent)));
    assert.ok(out.hidden);
    assert.ok(!apiCalls.some(c => c[0].includes('/regalo')), 'no regala nada');
  } finally { Math.random = realRandom; }
});

test('sin cuenta invita a crearla y no llama al servidor para regalar; sin regalos hoy tampoco', async () => {
  const realRandom = Math.random; Math.random = () => 0.1;
  try {
    let ui = setup({ logged: false }); ui.tick(); window.Visitantes.spawn(); window.Visitantes.talk(0);
    let out = await drive(ui, btns => btns.find(b => /Muy bien|Sí|Pop|Mi casa|Pizza/.test(b.textContent)) || btns[0]);
    assert.ok(!apiCalls.length, 'sin sesión no hay llamadas');
    ui = setup({ left: 0 }); ui.tick(); window.Visitantes.spawn(); window.Visitantes.talk(0);
    out = await drive(ui, btns => btns.find(b => /Muy bien|Sí|Pop|Mi casa|Pizza/.test(b.textContent)) || btns[0]);
    assert.ok(!apiCalls.some(c => c[0].includes('/regalo')), 'con 0 regalos restantes no ofrece nada');
  } finally { Math.random = realRandom; }
});
