'use strict';
const test = require('node:test');
const assert = require('node:assert');
const bots = require('./bots');

const ORIGINALS = ['FR', 'AU', 'DE', 'RU', 'CN', 'JP', 'IT', 'MX', 'BR', 'ES', 'PT', 'BE', 'IN', 'SE', 'CH', 'MA'];
// Países que tienen que tener su jugador: los miembros de la ONU (193) + Ciudad del Vaticano, Palestina, Kosovo y Taiwán.
const UN = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW').split(' ');
const REQUIRED = [...UN, 'VA', 'PS', 'XK', 'TW'];
const km = (la1, lo1, la2, lo2) => {
  const R = 6371, d = Math.PI / 180, dLa = (la2 - la1) * d, dLo = (lo2 - lo1) * d;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

test('Bots: hay un jugador en cada país del mundo, con bandera, apodo y zona horaria válidos', () => {
  assert.strictEqual(UN.length, 193);
  assert.strictEqual(new Set(REQUIRED).size, REQUIRED.length, 'códigos repetidos en la lista de países');
  assert.deepStrictEqual(bots.BOTS.map(b => b.cc).sort(), [...REQUIRED].sort());
  for (const cc of ORIGINALS) assert.ok(bots.BOTS.some(b => b.cc === cc), cc + ' falta');
  assert.strictEqual(new Set(bots.BOTS.map(b => b.name)).size, bots.BOTS.length, 'apodos repetidos');
  const AVATARS = ['😀','😎','🤠','🦊','🐱','🐶','🦁','🐼','🚀','👑','⚽','🌟'];   // los que acepta el servidor (cleanAvatar)
  assert.strictEqual(new Set(bots.BOTS.map(b => b.id)).size, bots.BOTS.length, 'ids repetidos');
  for (const b of bots.BOTS) {
    assert.match(b.cc, /^[A-Z]{2}$/);
    assert.ok(b.name.length >= 2 && b.name.length <= 30, b.cc + ': nombre no válido');
    new Intl.DateTimeFormat('en-GB', { timeZone: b.tz });                      // lanza si la zona no existe
    assert.ok(b.towns.length >= 2, b.cc + ': pocos municipios');
    assert.ok(AVATARS.includes(b.avatar), b.cc + ': avatar no permitido');
    assert.ok(b.jitterKm > 0 && b.jitterKm <= 1.4, b.cc + ': desplazamiento no válido');
    const diag = km(b.box.latMin, b.box.lngMin, b.box.latMax, b.box.lngMax);
    if (diag < 120) assert.ok(b.jitterKm <= 0.8, b.cc + ': país pequeño con demasiado desplazamiento');
    if (diag < 40) assert.ok(b.jitterKm <= 0.3, b.cc + ': país diminuto con demasiado desplazamiento');
  }
  assert.strictEqual(bots.BOTS.find(b => b.cc === 'FR').name, 'Francóis');
});
test('Bots: todos los municipios están dentro de la caja de su país y no se repiten', () => {
  for (const b of bots.BOTS) {
    const seen = new Set();
    for (const [n, lat, lng] of b.towns) {
      assert.ok(Number.isFinite(lat) && Number.isFinite(lng), `${b.cc} ${n}: coordenadas no válidas`);
      assert.ok(bots.insideBox(b, lat, lng), `${b.cc} ${n} fuera de su caja`);
      assert.ok(!seen.has(n), `${b.cc} repetido: ${n}`); seen.add(n);
    }
  }
});
test('Bots: 10.000 puntos por país quedan dentro de su caja y cerca de su municipio', () => {
  for (const b of bots.BOTS) for (let i = 0; i < 10000; i++) {
    const s = bots.pickSpot(b);
    assert.ok(bots.insideBox(b, s.lat, s.lng), `${b.cc}: punto fuera de la caja`);
    const t = b.towns.find(x => x[0] === s.town);
    assert.ok(km(t[1], t[2], s.lat, s.lng) <= b.jitterKm + 0.05, `${b.cc}: demasiado lejos del municipio`);
  }
});
test('Bots: Portugal, Bélgica y Suiza usan un desplazamiento menor (países pequeños)', () => {
  for (const cc of ['PT', 'BE', 'CH']) assert.ok(bots.BOTS.find(b => b.cc === cc).jitterKm <= 0.8);
});
test('Bots: la hora de reclamar está entre las 08:00 y las 22:00, es estable y varía según el día y el bot', () => {
  const seen = new Set();
  for (const b of bots.BOTS) for (let d = 1; d <= 28; d++) {
    const day = '2026-03-' + String(d).padStart(2, '0'), m = bots.plannedMinute(b.id, day);
    assert.ok(m >= bots.FROM_MIN && m < bots.TO_MIN);
    assert.strictEqual(m, bots.plannedMinute(b.id, day));
    seen.add(m);
  }
  assert.ok(seen.size > 200, 'las horas deberían variar mucho');
});
test('Bots: cada bot reclama una sola parcela al día, en su país, y otra al día siguiente', async () => {
  const parcels = [], runs = new Set();
  let clock = Date.parse('2026-06-10T21:30:00Z');     // tarde en todas las zonas horarias que cuentan (≥ 22:00 en Asia y < 22:00 en el resto)
  const deps = {
    now: () => clock, manual: true,
    run: async (sql, p) => {
      if (/INSERT INTO bot_runs/.test(sql)) { const k = p[0] + '|' + p[1]; if (runs.has(k)) return { rowCount: 0 }; runs.add(k); return { rowCount: 1 }; }
      if (/DELETE FROM bot_runs/.test(sql)) { runs.delete(p[0] + '|' + p[1]); return { rowCount: 1 }; }
      return { rowCount: 0 };
    },
    q: {
      parcelById: async id => parcels.find(x => x.id === id),
      activeOrderForParcel: async () => null,
      insertParcel: async (id, x, y, owner, o, paid, cur, at, avatar, country, house) => { parcels.push({ id, owner, cur, country, house, at }); },
    },
    parcelFromLatLng: (lat, lng) => { const x = Math.floor((lng + 180) / 0.0005), y = Math.floor((lat + 90) / 0.0005); return { id: x + ':' + y, x, y }; },
    isUniqueViolation: () => false,
  };
  const tick = bots.start(deps);
  await tick(); await tick(); await tick();            // varios ticks el mismo día: no duplican
  const byCountry = c => parcels.filter(p => p.country === c).length;
  for (const p of parcels) { assert.strictEqual(p.cur, 'BOT'); assert.strictEqual(p.house, null); }
  for (const b of bots.BOTS) assert.ok(byCountry(b.cc) <= 1, b.cc + ' reclamó más de una el mismo día');
  assert.ok(parcels.length >= 100, 'a esa hora la mayoría ya debería haber reclamado');
  const first = parcels.length;
  clock += 24 * 3600e3; await tick(); await tick();    // día siguiente
  assert.ok(parcels.length > first, 'al día siguiente reclaman otra');
  clock += 24 * 3600e3; await tick();
  for (const b of bots.BOTS) assert.ok(byCountry(b.cc) <= 3, b.cc + ' reclamó más de una por día');
});
