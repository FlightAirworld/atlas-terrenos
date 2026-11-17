'use strict';
// Aplica en server.js el parche de «Conectados ahora, uno por uno» del panel de administrador (los 4 cambios de PARCHE-server.txt):
//   1) require('./online-live')   2) online-live.track() al abrir la conexión /api/online
//   3) ruta POST /api/online/page   4) campo «live» en onlineRealGet().
// Se ejecuta solo con «npm install» (script postinstall, en el servidor de Render), igual que seo-patch.js.
// Es idempotente (si ya está aplicado no hace nada) y NUNCA falla: si algún punto de anclaje no encaja, o el resultado
// no compila, deja server.js como está y el juego arranca igual.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RETURN_OLD = 'return { ...real, peaks: onlineStats.peaksList(onlinePeaks), shown: onlineShown(), at: Date.now() };';
const RETURN_NEW = "return { ...real, peaks: onlineStats.peaksList(onlinePeaks), shown: onlineShown(), at: Date.now(), live: (() => { try { return onlineLive.list(onlineClients.keys()); } catch (e) { return undefined; } })() };";

const RE_REQUIRE = /^const onlineStats = require\('\.\/online-stats'\);[^\n]*$/m;
const RE_TRACK = /^([ \t]*)if \(cc\) onlineCountryByCid\.set\(cid, cc\);[^\n]*$/m;
const RE_ROUTE = /^([ \t]*)if \(req\.method === 'POST' && pn === '\/api\/online\/pos'\)[^\n]*$/m;

function patch(src) {
  let h = src;
  const once = re => (h.match(new RegExp(re.source, 'gm')) || []).length === 1;
  const steps = [
    { done: "require('./online-live')", ok: () => once(RE_REQUIRE),
      apply: () => { h = h.replace(RE_REQUIRE, m => m + "\nconst onlineLive = require('./online-live');   // detalle en vivo de cada jugador conectado (panel de administrador)"); } },
    { done: 'onlineLive.track(', ok: () => once(RE_TRACK),
      apply: () => { h = h.replace(RE_TRACK, (m, i) => m + '\n' + i + "try { onlineLive.track(cid, req.headers, url.searchParams.get('country')); } catch (e) {}"); } },
    { done: "'/api/online/page'", ok: () => once(RE_ROUTE),
      apply: () => {
        h = h.replace(RE_ROUTE, (m, i) => [
          i + "if (req.method === 'POST' && pn === '/api/online/page') {   // página y sección donde está cada jugador (panel de administrador)",
          i + "  const q = url.searchParams, cid = q.get('cid') || '';",
          i + "  if (/^[\\w-]{8,40}$/.test(cid)) { try { onlineLive.setPage(cid, q.get('p'), q.get('s')); } catch (e) {} }",
          i + '  return { ok: true };',
          i + '}',
          m
        ].join('\n'));
      } },
    { done: 'onlineLive.list(', ok: () => h.split(RETURN_OLD).length === 2,
      apply: () => { h = h.replace(RETURN_OLD, () => RETURN_NEW); } }
  ];
  for (const s of steps) {
    if (h.includes(s.done)) continue;            // ya aplicado
    if (!s.ok()) return null;                    // el anclaje no está (o está repetido): no se toca nada
    s.apply();
  }
  return h;
}

function run(file) {
  try {
    const before = fs.readFileSync(file, 'utf8');
    const after = patch(before);
    if (after === null) { console.warn('live-patch: no encuentro los puntos de anclaje en server.js, no se toca'); return; }
    if (after === before) { console.log('live-patch: server.js ya estaba parcheado'); return; }
    // Salvaguarda: el resultado tiene que compilar y no puede encogerse
    new vm.Script('(function (exports, require, module, __filename, __dirname) {' + after + '\n})', { filename: 'server.js' });
    if (after.length < before.length) { console.warn('live-patch: resultado inesperado, no se toca server.js'); return; }
    fs.writeFileSync(file, after);
    console.log('live-patch: server.js parcheado (' + before.length + ' → ' + after.length + ' caracteres)');
  } catch (e) {
    console.warn('live-patch: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { patch, run };
if (require.main === module) run(path.join(__dirname, 'server.js'));
