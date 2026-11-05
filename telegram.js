// Avisos por Telegram al dueño del juego (compras, reembolsos, errores, jugadores nuevos, chat).
// Variables de entorno (Render > Environment):
//   TELEGRAM_TOKEN    token que te dio @BotFather
//   TELEGRAM_CHAT_ID  tu chat_id (escribe /start a tu bot y abre https://api.telegram.org/bot<TOKEN>/getUpdates)
//   TELEGRAM_CHAT=off  (opcional) no reenviar el chat del juego
// Sin las dos primeras variables, todo esto queda apagado y no estorba.
'use strict';

const TOKEN = (process.env.TELEGRAM_TOKEN || '').trim();
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();
const ON = !!(TOKEN && CHAT_ID);
const CHAT_ON = ON && String(process.env.TELEGRAM_CHAT || '').toLowerCase() !== 'off';
const API = `https://api.telegram.org/bot${TOKEN}`;

let queue = Promise.resolve();
let lastWarn = 0;
function warn(...a) {   // console.warn (no console.error) para no entrar en bucle con el enganche de errores
  const now = Date.now();
  if (now - lastWarn < 30_000) return;   // sin inundar los logs
  lastWarn = now;
  console.warn('TELEGRAM:', ...a);
}

// Envía un mensaje. Nunca lanza: si Telegram falla, solo queda anotado en los logs.
function notify(text) {
  if (!ON) return Promise.resolve(false);
  const body = JSON.stringify({ chat_id: CHAT_ID, text: String(text).slice(0, 4000), disable_web_page_preview: true });
  queue = queue.then(async () => {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await fetch(API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10_000) });
        if (r.ok) return true;
        const j = await r.json().catch(() => ({}));
        if (r.status === 429) { await new Promise(res => setTimeout(res, (((j.parameters || {}).retry_after) || 2) * 1000)); continue; }
        warn(`Telegram respondió ${r.status}: ${j.description || ''}`);   // 401 = token mal, 400 "chat not found" = chat_id mal o no has escrito /start al bot
        return false;
      } catch (e) {
        if (intento === 2) warn('no se pudo enviar:', e.message);
        else await new Promise(res => setTimeout(res, 1500));
      }
    }
    return false;
  }).catch(() => false);
  return queue;
}

// Chat del juego: como mucho 1 mensaje cada 3 s, el resto se agrupa
let chatBuf = [], chatTimer = null;
function chat(zona, nick, text) {
  if (!CHAT_ON) return;
  chatBuf.push(`${nick}: ${text}`);
  if (chatBuf.length > 20) chatBuf.shift();
  if (chatTimer) return;
  chatTimer = setTimeout(() => {
    const out = chatBuf.join('\n'); chatBuf = []; chatTimer = null;
    notify('💬 Chat\n' + out);
  }, 3000);
  chatTimer.unref();
}

// Reenvía a Telegram los console.error que piden revisión (pagos, reembolsos...) y los fallos que tumban el servidor
function hookErrors() {
  if (!ON) return;
  const orig = console.error.bind(console);
  console.error = (...a) => {
    orig(...a);
    try {
      const line = a.map(x => (x instanceof Error ? x.message : typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
      if (/REVISAR|REEMBOLSO|PAGO CAPTURADO/.test(line)) notify('⚠️ ' + line);
    } catch {}
  };
  process.on('unhandledRejection', e => notify('🔥 unhandledRejection: ' + (e && e.message || e)));
}

// Al arrancar: comprueba el token y manda un mensaje de prueba. El resultado queda en los logs de Render.
async function start(nombre) {
  if (!ON) {
    console.log('Telegram: apagado (faltan TELEGRAM_TOKEN y/o TELEGRAM_CHAT_ID)');
    return;
  }
  hookErrors();
  try {
    const r = await fetch(API + '/getMe', { signal: AbortSignal.timeout(10_000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.warn(`Telegram: el token no vale (${r.status}: ${j.description || ''})`); return; }
    console.log(`Telegram: conectado como @${j.result.username}`);
  } catch (e) { console.warn('Telegram: no se pudo contactar con Telegram:', e.message); return; }
  const ok = await notify(`✅ ${nombre || 'Servidor'} arrancado (${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })})`);
  console.log(ok ? 'Telegram: mensaje de prueba enviado' : 'Telegram: el mensaje de prueba FALLÓ (revisa TELEGRAM_CHAT_ID y que hayas escrito /start al bot)');
}

module.exports = { ON, notify, chat, start };
