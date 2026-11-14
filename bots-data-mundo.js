'use strict';
// Jugadores automáticos del RESTO DEL MUNDO: un jugador por país (los 16 primeros están en bots-data.js).
// Los datos viven en bots-mundo-europa.js, -asia.js, -africa.js, -america.js y -oceania.js, una línea por país:
//   PAÍS|Apodo|Zona horaria|desplazamiento máx. en km|latMín,latMáx,lngMín,lngMáx|Municipio,lat,lng;Municipio,lat,lng;...
// · PAÍS es el código de 2 letras (la bandera sale de él). Kosovo usa XK.
// · El apodo es típico del país. Para cambiarlo sin tocar el código: BOT_NAME_<PAÍS>=Nombre en Render.
// · Los municipios son céntricos y están lejos de la frontera (o con un desplazamiento pequeño en los países diminutos);
//   la caja (latMín,latMáx,lngMín,lngMáx) es una red de seguridad: un punto fuera de ella no se reclama.
// Para añadir o cambiar un país, edita su línea (o añade una nueva) en el fichero de su región.
const AVATARS = ['😀', '😎', '🤠', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '👑', '⚽', '🌟'];   // los permitidos por el servidor (cleanAvatar)
const FILES = ['europa', 'asia', 'africa', 'america', 'oceania'];

const avatarOf = cc => AVATARS[[...cc].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATARS.length];

function parse(text, file) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const f = line.split('|');
    if (f.length !== 6) throw new Error(`bots-mundo-${file}: línea con formato no válido: ${line.slice(0, 40)}`);
    const [cc, name, tz, jit, box, towns] = f;
    const [latMin, latMax, lngMin, lngMax] = box.split(',').map(Number);
    out.push({
      id: 'bot-' + cc.toLowerCase(), cc, name, tz, avatar: avatarOf(cc), jitterKm: Number(jit),
      box: { latMin, latMax, lngMin, lngMax },
      towns: towns.split(';').map(t => { const [n, la, ln] = t.split(','); return [n, Number(la), Number(ln)]; }),
    });
  }
  return out;
}

module.exports = FILES.flatMap(f => parse(require('./bots-mundo-' + f), f));
