'use strict';
// VISITAR UNA CASA: en el panel de una casa que no es tuya sale el botón «🚪 ENTRA A LA CASA».
// Al pulsarlo se abre una escena totalmente automática (~40 s): llamas a la puerta, te dicen «¡PASA, BIENVENIDO!», 2 o 3 personas
// sentadas te ofrecen un refresco, os sentáis todos y charláis (frases y sonidos al azar). Al irte te dicen «HASTA LA PRÓXIMA»
// y te regalan 1 crédito (lo decide el servidor: /api/visit/start y /api/visit/finish en server.js; una vez por casa y día).
// Usa globals de app.js: api(), authToken, refreshCredits(), sfx(), $, selected.
(function () {
  const btn = document.getElementById('enter-house-btn');
  if (!btn) return;
  let running = null;   // la visita en curso

  const st = document.createElement('style');
  st.textContent = `
    #visita { position: fixed; inset: 0; z-index: 3000; background: #000b; display: grid; place-items: center; padding: 12px; }
    #visita .v-card { position: relative; width: min(560px, 100%); background: #2b1d14; border-radius: 16px; padding: 12px 12px 14px; color: #fff; box-shadow: 0 10px 40px #000a; }
    #visita .v-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 800; }
    #visita .v-x { background: #0006; color: #fff; border: 0; border-radius: 999px; width: 34px; height: 34px; font-size: 20px; cursor: pointer; }
    #visita .v-room { position: relative; height: 290px; border-radius: 12px; overflow: hidden; background: linear-gradient(#f3d9a4 0 62%, #b07a45 62% 100%); }
    #visita .v-win { position: absolute; left: 50%; top: 14px; width: 86px; height: 64px; margin-left: -43px; border: 5px solid #7a4b24; background: linear-gradient(#9fd8ff, #d9f1ff); border-radius: 6px; }
    #visita .v-win::after { content: '☀️'; position: absolute; right: 6px; top: 4px; font-size: 22px; }
    #visita .v-lamp { position: absolute; left: 50%; top: -6px; margin-left: -16px; font-size: 30px; }
    #visita .v-pic { position: absolute; top: 24px; font-size: 34px; }
    #visita .v-door { position: absolute; left: 0; bottom: 0; width: 70px; height: 170px; background: #5a3418; border-radius: 6px 6px 0 0; transform-origin: left center; transition: transform .9s ease; z-index: 3; box-shadow: inset 0 0 0 4px #7a4b24; }
    #visita .v-door::after { content: ''; position: absolute; right: 9px; top: 84px; width: 9px; height: 9px; border-radius: 50%; background: #f0c040; }
    #visita .v-door.open { transform: perspective(500px) rotateY(-70deg); }
    #visita .v-frame { position: absolute; left: 0; bottom: 0; width: 70px; height: 170px; background: #1c1209; z-index: 2; }
    #visita .v-table { position: absolute; left: 8%; right: 8%; bottom: 0; height: 46px; background: linear-gradient(#a2672f, #7a4b24); border-radius: 18px 18px 0 0; z-index: 5; box-shadow: 0 -3px 0 #c88a4a inset; }
    #visita .v-p { position: absolute; bottom: 50px; width: 76px; margin-left: -38px; text-align: center; z-index: 4; transition: left 1.6s ease-in-out, transform .6s ease; }
    #visita .v-p .e { display: block; font-size: 54px; line-height: 1; animation: v-bob 2.4s ease-in-out infinite; }
    #visita .v-p .n { display: block; font-size: 11px; font-weight: 800; color: #3b2410; background: #fff8; border-radius: 8px; padding: 0 4px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #visita .v-p.stand { transform: translateY(-22px); }
    #visita .v-p.sit { transform: translateY(4px) scale(.96); }
    #visita .v-p.talk .e { animation: v-talk .35s ease-in-out infinite; }
    #visita .v-p.drinkup .e { animation: v-talk .5s ease-in-out 4; }
    #visita .v-drink { position: absolute; bottom: 36px; font-size: 24px; z-index: 6; margin-left: 14px; opacity: 0; transform: translateY(-12px); transition: opacity .4s, transform .4s; }
    #visita .v-drink.on { opacity: 1; transform: none; }
    #visita .v-bubble { position: absolute; z-index: 8; max-width: 70%; background: #fff; color: #1b1b1b; border-radius: 14px; padding: 7px 11px; font-size: 15px; font-weight: 700; line-height: 1.25; box-shadow: 0 3px 10px #0005; opacity: 0; transform: translateY(6px) scale(.96); transition: opacity .25s, transform .25s; pointer-events: none; }
    #visita .v-bubble.on { opacity: 1; transform: none; }
    #visita .v-bubble::after { content: ''; position: absolute; left: var(--tail, 50%); bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #fff; }
    #visita .v-bubble.big { font-size: 19px; font-weight: 900; }
    #visita .v-gift { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: #000a; text-align: center; font-size: 20px; font-weight: 900; padding: 16px; opacity: 0; pointer-events: none; transition: opacity .4s; }
    #visita .v-gift.on { opacity: 1; }
    #visita .v-gift b { display: block; font-size: 54px; animation: v-pop .8s ease-out; }
    #visita .v-sub { text-align: center; font-size: 12px; opacity: .75; margin-top: 8px; min-height: 16px; }
    @keyframes v-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes v-talk { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-5px) rotate(-4deg); } 75% { transform: translateY(-3px) rotate(4deg); } }
    @keyframes v-pop { 0% { transform: scale(.2); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { #visita .v-p .e, #visita .v-p.talk .e { animation: none; } }
  `;
  document.head.appendChild(st);

  const GENTE = [
    ['Abuela Rosa', '👵'], ['Paco', '👨‍🦳'], ['Marta', '👩‍🦰'], ['Tío Juan', '🧔'], ['Lucía', '👩'], ['Carmen', '👩‍🦱'],
    ['Pedro', '👨'], ['Abuelo Luis', '👴'], ['Sofía', '👱‍♀️'], ['Nacho', '🧑‍🦱']
  ];
  const REFRESCOS = ['🥤', '🧃', '🍹', '🍋', '🫖'];
  // Charla al azar: cada frase la dice una persona; algunas llevan respuesta
  const CHARLAS = [
    ['¡Qué casa tan bonita tienes!', '¡Gracias! Le pusimos mucho cariño.'],
    ['Hoy hace un día estupendo, ¿verdad?', 'Sí, da gusto salir a pasear.'],
    ['¿Has visto lo grande que está el barrio?', '¡Cada día vienen vecinos nuevos!'],
    ['¿Y tú de dónde vienes?', 'De un paseo largo por el mapa del mundo.'],
    ['Yo ayer fui hasta la Luna en cohete.', '¿Y qué tal por allí?', 'Muy tranquilo, pero sin bares.'],
    ['Esta mañana he oído las campanas.', 'Se oyen desde toda la calle.'],
    ['¿Habéis probado ya los juegos del mapa?', 'Yo gané un premio en el rasca y gana.'],
    ['Pronto subirán de nivel las casas de la calle.', '¡Entonces habrá que celebrarlo!'],
    ['Mi abuela decía: «el que ríe, vive más».', '¡Ja, ja, ja! Y tenía razón.'],
    ['¿Habéis visto un tren pasar esta tarde?', 'Sí, y un helicóptero también.'],
    ['Este refresco está buenísimo.', 'Es receta de la casa.'],
    ['Hay que plantar más árboles por aquí.', '¡Muy buena idea!']
  ];
  const REACCIONES = ['¡Ja, ja, ja!', '¿En serio?', '¡Qué bueno!', 'Ay, qué cosas...', '¡Madre mía!', 'Pues tienes razón.', 'Mmm, qué rico.'];
  const SALUDOS_FIN = ['¡Qué rato más agradable!', 'Se me ha pasado volando.', 'Qué bien se está aquí...'];

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const sound = n => { try { if (window.sfx) sfx(n); } catch (e) {} };

  function startVisit(p) {
    if (running || !p || !p.owner) return;
    const token = {}; let dead = false; running = token;
    const sleep = ms => new Promise((res, rej) => { setTimeout(() => (dead ? rej(token) : res()), ms); });
    const host = [p.owner, p.avatar || '🧑'];
    const nOthers = 1 + Math.floor(Math.random() * 2);   // 2 o 3 personas en total con el anfitrión
    const others = shuffle(GENTE).slice(0, nOthers);
    const SLOTS = [16, 38, 62, 84];   // % de ancho; el 38 se queda libre para el visitante hasta que se sienta
    const seatsFor = nOthers === 1 ? [62, 84] : [16, 62, 84];
    const people = [host, ...others].map((x, i) => ({ name: x[0], emoji: x[1], at: seatsFor[i] }));
    const visitor = { name: 'Tú', emoji: '🙂', at: SLOTS[1] };

    const root = document.createElement('div');
    root.id = 'visita'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Visita a la casa de ' + p.owner);
    root.innerHTML = `<div class="v-card">
      <div class="v-top"><span class="v-title"></span><button class="v-x" type="button" aria-label="Salir">×</button></div>
      <div class="v-room"><div class="v-win"></div><div class="v-lamp">🪔</div><div class="v-pic" style="left:10%">🖼️</div><div class="v-pic" style="right:8%">🕰️</div>
        <div class="v-frame"></div><div class="v-door"></div><div class="v-table"></div>
        <div class="v-bubble" aria-live="polite"></div>
        <div class="v-gift"><div><b>🎁</b><span class="v-gt"></span></div></div></div>
      <div class="v-sub"></div></div>`;
    root.querySelector('.v-title').textContent = '🏠 Casa de ' + p.owner;
    document.body.appendChild(root);
    const room = root.querySelector('.v-room'), door = root.querySelector('.v-door'), bubble = root.querySelector('.v-bubble'), sub = root.querySelector('.v-sub');
    const gift = root.querySelector('.v-gift'), gt = root.querySelector('.v-gt');

    const mk = (who, standing) => {
      const el = document.createElement('div');
      el.className = 'v-p ' + (standing ? 'stand' : 'sit'); el.style.left = who.at + '%';
      const e = document.createElement('span'); e.className = 'e'; e.textContent = who.emoji;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = who.name;
      el.append(e, n); room.appendChild(el); who.el = el; return el;
    };
    people.forEach(w => mk(w, false));
    people.forEach((w, i) => { w.el.querySelector('.e').style.animationDelay = (i * 0.5) + 's'; });

    let hideT = null;
    const say = async (who, text, ms, big) => {
      clearTimeout(hideT);
      bubble.textContent = text; bubble.classList.toggle('big', !!big);
      const w = room.clientWidth || 500;
      const x = Math.max(8, Math.min(w - bubble.offsetWidth - 8, w * who.at / 100 - 40));
      bubble.style.left = x + 'px'; bubble.style.top = (who.emoji ? 70 : 70) + 'px';
      bubble.style.setProperty('--tail', Math.max(14, Math.min(bubble.offsetWidth - 14, w * who.at / 100 - x)) + 'px');
      bubble.classList.add('on');
      who.el && who.el.classList.add('talk');
      const len = ms || Math.max(1800, 900 + text.length * 55);
      await sleep(len);
      who.el && who.el.classList.remove('talk');
      bubble.classList.remove('on');
      await sleep(250);
    };
    const drinkAt = who => {
      const d = document.createElement('div'); d.className = 'v-drink'; d.textContent = pick(REFRESCOS); d.style.left = who.at + '%';
      room.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('on')));
    };
    const cleanup = () => { dead = true; clearTimeout(hideT); root.remove(); if (running === token) running = null; document.removeEventListener('keydown', onKey); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} };
    const onKey = e => { if (e.key === 'Escape') cleanup(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.v-x').onclick = cleanup;   // salir antes de tiempo: no hay regalo
    root.addEventListener('pointerdown', e => { if (e.target === root) cleanup(); });

    // El servidor apunta la hora de entrada (sin cuenta la escena se ve igual, pero no hay regalo)
    let info = null;
    const started = Date.now();
    const startP = (async () => { try { info = await api('/api/visit/start', { method: 'POST', body: { id: p.id } }); } catch (e) { info = { error: e.message }; } })();

    (async () => {
      try {
        sub.textContent = 'Llamando a la puerta…';
        await sleep(700); sound('click'); await sleep(350); sound('click'); await sleep(900);
        door.classList.add('open'); sound('puerta'); await sleep(1100);
        const h = people[0], o1 = people[1], o2 = people[2];
        sub.textContent = '';
        await say(h, '¡PASA, BIENVENIDO!', 2600, true);
        // el visitante entra caminando y se queda de pie junto a su silla
        mk(visitor, true); visitor.el.style.left = '5%';
        await sleep(100); visitor.el.style.left = visitor.at + '%'; sound('silla'); await sleep(1700);
        await say(visitor, '¡Buenas! Gracias por invitarme.', 2300);
        await say(h, `Soy ${h.name}. ¿Te ofrezco un refresco?`, 2800);
        await say(visitor, '¡Sí, por favor!', 1800);
        await say(o1, 'Siéntate con nosotros.', 2000);
        visitor.el.classList.remove('stand'); visitor.el.classList.add('sit'); sound('silla'); await sleep(900);
        people.concat([visitor]).forEach((w, i) => setTimeout(() => { if (!dead) drinkAt(w); }, i * 450));
        sound('vasos'); await sleep(2000);
        await say(h, '¡Salud!', 1600, true); sound('vasos');
        // charla al azar
        let last = null;
        const grupo = people.concat([visitor]);
        for (const frase of shuffle(CHARLAS).slice(0, 2 + Math.floor(Math.random() * 2))) {
          for (const linea of frase) {
            let w; do { w = pick(grupo); } while (w === last && grupo.length > 1);
            last = w; sound('charla'); await say(w, linea);
          }
          if (Math.random() < 0.7) {
            let w; do { w = pick(grupo); } while (w === last && grupo.length > 1);
            last = w; sound(Math.random() < 0.6 ? 'risa' : 'charla'); await say(w, pick(REACCIONES), 1700);
          }
        }
        await say(visitor, pick(SALUDOS_FIN) + ' Pero ya me tengo que ir.', 3200);
        await say(h, 'Vuelve cuando quieras.', 2200);
        // despedida
        visitor.el.classList.remove('sit'); visitor.el.classList.add('stand'); sound('silla'); await sleep(900);
        await say(visitor, '¡Gracias por todo!', 1900);
        for (const w of people) { sound('adios'); await say(w, '¡HASTA LA PRÓXIMA!', 1500, true); }
        visitor.el.style.left = '5%'; sound('puerta'); await sleep(1700);
        visitor.el.remove(); door.classList.remove('open'); await sleep(900);
        // regalo: el servidor solo paga si de verdad ha pasado el tiempo de la visita
        await startP;
        let msg = '', ok = false;
        if (!info || info.error) msg = 'Crea tu cuenta o inicia sesión para recibir 1 crédito en tus próximas visitas.';
        else {
          let r = null;
          try { r = await api('/api/visit/finish', { method: 'POST', body: { id: p.id } }); } catch (e) { r = null; }
          if (r && r.rewarded) { ok = true; msg = `¡Te regalan ${r.reward} ${r.reward === 1 ? 'crédito' : 'créditos'}!`; }
          else if (r && r.reason === 'already') msg = 'Hoy ya te regalaron un crédito en esta casa. ¡Vuelve mañana!';
          else if (r && r.reason === 'limit') msg = 'Hoy ya has recibido el máximo de créditos por visitas.';
          else msg = '¡Gracias por la visita!';
        }
        gt.textContent = msg; gift.classList.add('on');
        if (ok) { sound('coin'); sound('gift'); try { if (window.refreshCredits) refreshCredits(); } catch (e) {} }
        sub.textContent = 'Visita terminada';
        await sleep(3800);
        cleanup();
      } catch (e) { if (e !== token) { console.error(e); cleanup(); } }
    })();
  }

  let currentParcel = null;
  btn.onclick = () => startVisit(currentParcel);
  // lo llama showPanel() de app.js: solo se ve en casas con dueño con cuenta que no son tuyas
  window.visitaPanel = p => {
    currentParcel = p || null;
    btn.classList.toggle('hidden', !(p && p.owner && !p.mine && p.giftable));
  };
  window.visitaStart = startVisit;
})();
