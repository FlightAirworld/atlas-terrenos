'use strict';
// VISITANTES FICTICIOS 🌍🧑‍🤝‍🧑: muñecos de distintos países que pasean por el mapa, buscan al jugador, le hablan (con voz), le hacen preguntas
// («¿tienes cuenta en TikTok?»), visitan monumentos y casas y, si caen bien, le regalan créditos.
//   · Cada uno tiene su bandera, su país y un nombre típico de allí (hombres con nombre de hombre; mujeres con nombre de mujer y pelo largo). Todos miran de frente.
//   · Solo se ven con el mapa cerca (zoom >= MIN_ZOOM): desde la vista satélite lejana no se ven.
//   · Aparecen al azar por los bordes de la pantalla. Unos VAN A BUSCAR AL JUGADOR (el centro del mapa, lo siguen si mueves el mapa) y otros van de
//     turismo a un monumento o una casa y, si te ven cerca, se acercan a saludarte. Al tocarlos también hablan contigo.
//   · «Inteligentes»: entienden lo que escribes (sí/no, nombre, país, @ de TikTok, cumplidos, insultos, «dame créditos», hora…), recuerdan en el
//     navegador qué te preguntaron hoy y si tienes TikTok, cambian de humor y solo regalan si les caes bien (si les pides créditos, menos).
//   · Voz: voices.js (síntesis del navegador): voz aguda de mujer o grave de hombre, con el acento del país si hay voz instalada (es-MX, es-AR…) y el
//     saludo en su idioma si el navegador tiene esa voz. Sin voz, las frases salen escritas. Se silencian en 🔊 «Gente y voces».
//   · Regalos: como mucho 2 créditos por regalo y 3 regalos al día por jugador con cuenta (lo decide el servidor: /api/visitantes/regalo).
//   · Se apagan en 🔊 Sonido → «Visitantes del mapa» (o Visitantes.on(false) en la consola).
(function () {
  if (typeof map === 'undefined' || !map || !window.L) return;
  const MIN_ZOOM = 16, REF_Z = 17, MEM = 'vzMem';
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX = SMALL ? 2 : 3;                         // visitantes a la vez
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- Países: [código, bandera, país, idioma de voz, saludo, hombres, mujeres, plato típico, piel(l=clara, m=morena, d=oscura, a=asiática), habla español] ----------
  const C = [
    ['ES', '🇪🇸', 'España', 'es-ES', '¡Hola!', ['Carlos', 'Javier', 'Pablo', 'Álvaro', 'Sergio'], ['Lucía', 'Carmen', 'Marta', 'Paula', 'Elena'], 'la tortilla de patatas', 'l', 1],
    ['MX', '🇲🇽', 'México', 'es-MX', '¡Qué onda!', ['Diego', 'Emiliano', 'Santiago', 'Mateo'], ['Ximena', 'Valentina', 'Guadalupe', 'Renata'], 'los tacos al pastor', 'm', 1],
    ['AR', '🇦🇷', 'Argentina', 'es-AR', '¡Che, hola!', ['Facundo', 'Lautaro', 'Tomás', 'Santino'], ['Camila', 'Abril', 'Milagros', 'Agustina'], 'el asado', 'l', 1],
    ['CO', '🇨🇴', 'Colombia', 'es-CO', '¡Quiubo!', ['Juan David', 'Santiago', 'Sebastián'], ['Mariana', 'Daniela', 'Valentina'], 'la bandeja paisa', 'm', 1],
    ['CL', '🇨🇱', 'Chile', 'es-CL', '¡Hola, qué tal!', ['Matías', 'Benjamín', 'Cristóbal'], ['Antonia', 'Fernanda', 'Constanza'], 'las empanadas de pino', 'm', 1],
    ['PE', '🇵🇪', 'Perú', 'es-PE', '¡Hola, causa!', ['Rodrigo', 'Piero', 'Jhon'], ['Milagros', 'Camila', 'Rosario'], 'el ceviche', 'm', 1],
    ['VE', '🇻🇪', 'Venezuela', 'es-VE', '¡Epa!', ['Luis', 'Andrés', 'Yeferson'], ['Yaritza', 'Gabriela', 'Andreína'], 'las arepas', 'm', 1],
    ['CU', '🇨🇺', 'Cuba', 'es-CU', '¡Asere, qué bolá!', ['Ernesto', 'Yoandry', 'Alexander'], ['Yamilé', 'Dayana', 'Lisandra'], 'el ropa vieja', 'm', 1],
    ['DO', '🇩🇴', 'República Dominicana', 'es-DO', '¡Qué lo qué!', ['Rafael', 'Wander', 'Yeison'], ['Yaneisy', 'Altagracia', 'Massiel'], 'el sancocho', 'm', 1],
    ['EC', '🇪🇨', 'Ecuador', 'es-EC', '¡Hola, ñaño!', ['Kevin', 'Joel', 'Mateo'], ['Doménica', 'Samantha', 'Camila'], 'el encebollado', 'm', 1],
    ['BO', '🇧🇴', 'Bolivia', 'es-BO', '¡Jallalla!', ['Marcelo', 'Rodrigo', 'Álvaro'], ['Valeria', 'Ximena', 'Lupe'], 'las salteñas', 'm', 1],
    ['BR', '🇧🇷', 'Brasil', 'pt-BR', 'Olá!', ['Lucas', 'Gabriel', 'Thiago', 'Rafael'], ['Beatriz', 'Larissa', 'Mariana', 'Juliana'], 'la feijoada', 'm', 0],
    ['PT', '🇵🇹', 'Portugal', 'pt-PT', 'Olá!', ['João', 'Tiago', 'Rui'], ['Inês', 'Beatriz', 'Joana'], 'el bacalao a brás', 'l', 0],
    ['US', '🇺🇸', 'Estados Unidos', 'en-US', 'Hey there!', ['Jake', 'Tyler', 'Ethan', 'Mike'], ['Emily', 'Jessica', 'Madison', 'Ashley'], 'las hamburguesas', 'l', 0],
    ['CA', '🇨🇦', 'Canadá', 'en-CA', 'Hello, eh!', ['Liam', 'Noah', 'Connor'], ['Chloe', 'Emma', 'Megan'], 'la poutine', 'l', 0],
    ['GB', '🇬🇧', 'Reino Unido', 'en-GB', 'Hiya!', ['Oliver', 'Harry', 'George'], ['Charlotte', 'Amelia', 'Poppy'], 'el fish and chips', 'l', 0],
    ['IE', '🇮🇪', 'Irlanda', 'en-IE', 'Howya!', ['Seán', 'Cian', 'Conor'], ['Aoife', 'Niamh', 'Saoirse'], 'el estofado irlandés', 'l', 0],
    ['FR', '🇫🇷', 'Francia', 'fr-FR', 'Bonjour !', ['Louis', 'Hugo', 'Théo', 'Jules'], ['Camille', 'Chloé', 'Manon', 'Inès'], 'los croissants', 'l', 0],
    ['DE', '🇩🇪', 'Alemania', 'de-DE', 'Hallo!', ['Lukas', 'Jonas', 'Felix', 'Maximilian'], ['Lena', 'Anna', 'Hannah', 'Sophie'], 'las salchichas con chucrut', 'l', 0],
    ['IT', '🇮🇹', 'Italia', 'it-IT', 'Ciao!', ['Marco', 'Luca', 'Matteo', 'Giovanni'], ['Giulia', 'Chiara', 'Francesca', 'Sofia'], 'la pizza napolitana', 'l', 0],
    ['NL', '🇳🇱', 'Países Bajos', 'nl-NL', 'Hoi!', ['Daan', 'Sem', 'Bram'], ['Emma', 'Sanne', 'Lotte'], 'los stroopwafels', 'l', 0],
    ['SE', '🇸🇪', 'Suecia', 'sv-SE', 'Hej!', ['Erik', 'Oscar', 'Lars'], ['Astrid', 'Elsa', 'Freja'], 'las albóndigas con mermelada', 'l', 0],
    ['PL', '🇵🇱', 'Polonia', 'pl-PL', 'Cześć!', ['Jakub', 'Kacper', 'Marek'], ['Zuzanna', 'Katarzyna', 'Magdalena'], 'los pierogi', 'l', 0],
    ['RU', '🇷🇺', 'Rusia', 'ru-RU', 'Привет!', ['Dmitri', 'Iván', 'Alekséi'], ['Anastasia', 'Olga', 'Ekaterina'], 'el borsch', 'l', 0],
    ['UA', '🇺🇦', 'Ucrania', 'uk-UA', 'Привіт!', ['Andriy', 'Taras', 'Oleksandr'], ['Olena', 'Sofiia', 'Kateryna'], 'los varenyky', 'l', 0],
    ['TR', '🇹🇷', 'Turquía', 'tr-TR', 'Merhaba!', ['Mehmet', 'Emre', 'Burak'], ['Elif', 'Zeynep', 'Ayşe'], 'el kebab', 'm', 0],
    ['GR', '🇬🇷', 'Grecia', 'el-GR', 'Γεια σου!', ['Nikos', 'Giorgos', 'Dimitris'], ['Eleni', 'Maria', 'Katerina'], 'la moussaka', 'm', 0],
    ['EG', '🇪🇬', 'Egipto', 'ar-EG', 'مرحبا!', ['Omar', 'Youssef', 'Karim'], ['Nour', 'Mariam', 'Salma'], 'el koshari', 'm', 0],
    ['MA', '🇲🇦', 'Marruecos', 'ar-MA', 'Salam!', ['Yassine', 'Hamza', 'Amine'], ['Fatima', 'Salma', 'Imane'], 'el cuscús', 'm', 0],
    ['NG', '🇳🇬', 'Nigeria', 'en-NG', 'How far!', ['Chinedu', 'Emeka', 'Tunde'], ['Ngozi', 'Amaka', 'Folake'], 'el jollof rice', 'd', 0],
    ['KE', '🇰🇪', 'Kenia', 'sw-KE', 'Jambo!', ['Juma', 'Otieno', 'Kamau'], ['Wanjiru', 'Amina', 'Njeri'], 'el ugali', 'd', 0],
    ['ZA', '🇿🇦', 'Sudáfrica', 'en-ZA', 'Howzit!', ['Thabo', 'Sipho', 'Pieter'], ['Lerato', 'Naledi', 'Annelie'], 'el braai', 'd', 0],
    ['ET', '🇪🇹', 'Etiopía', 'am-ET', 'Selam!', ['Abebe', 'Dawit', 'Yonas'], ['Tigist', 'Selam', 'Meron'], 'la injera', 'd', 0],
    ['SN', '🇸🇳', 'Senegal', 'fr-SN', 'Salam!', ['Moussa', 'Ousmane', 'Cheikh'], ['Awa', 'Fatou', 'Mariama'], 'el thieboudienne', 'd', 0],
    ['IN', '🇮🇳', 'India', 'hi-IN', 'Namaste!', ['Arjun', 'Rohan', 'Vikram'], ['Priya', 'Ananya', 'Kavya'], 'el pollo tikka masala', 'm', 0],
    ['PK', '🇵🇰', 'Pakistán', 'ur-PK', 'Assalam o alaikum!', ['Ahmed', 'Bilal', 'Hamza'], ['Ayesha', 'Fatima', 'Zainab'], 'el biryani', 'm', 0],
    ['CN', '🇨🇳', 'China', 'zh-CN', '你好!', ['Wei', 'Jun', 'Hao'], ['Mei', 'Xiu', 'Lin'], 'los dumplings', 'a', 0],
    ['JP', '🇯🇵', 'Japón', 'ja-JP', 'こんにちは!', ['Haruto', 'Kenji', 'Takumi'], ['Sakura', 'Yui', 'Hana'], 'el sushi', 'a', 0],
    ['KR', '🇰🇷', 'Corea del Sur', 'ko-KR', '안녕하세요!', ['Min-jun', 'Ji-hoon', 'Seo-jun'], ['Ji-woo', 'Soo-ah', 'Hana'], 'el kimchi', 'a', 0],
    ['VN', '🇻🇳', 'Vietnam', 'vi-VN', 'Xin chào!', ['Minh', 'Anh', 'Huy'], ['Linh', 'Lan', 'Mai'], 'el pho', 'a', 0],
    ['TH', '🇹🇭', 'Tailandia', 'th-TH', 'Sawasdee!', ['Somchai', 'Ananda', 'Krit'], ['Ploy', 'Nok', 'Mali'], 'el pad thai', 'a', 0],
    ['ID', '🇮🇩', 'Indonesia', 'id-ID', 'Halo!', ['Budi', 'Agus', 'Rizky'], ['Putri', 'Dewi', 'Sari'], 'el nasi goreng', 'a', 0],
    ['PH', '🇵🇭', 'Filipinas', 'fil-PH', 'Kumusta!', ['Juan', 'Jose', 'Miguel'], ['Maria', 'Angelica', 'Jasmine'], 'el adobo', 'a', 0],
    ['SA', '🇸🇦', 'Arabia Saudí', 'ar-SA', 'Marhaba!', ['Faisal', 'Khalid', 'Abdullah'], ['Noura', 'Layla', 'Reem'], 'el kabsa', 'm', 0],
    ['IR', '🇮🇷', 'Irán', 'fa-IR', 'Salaam!', ['Reza', 'Arash', 'Kian'], ['Shirin', 'Parisa', 'Neda'], 'el chelo kebab', 'm', 0],
    ['IL', '🇮🇱', 'Israel', 'he-IL', 'Shalom!', ['Noam', 'Ariel', 'Itai'], ['Yael', 'Noa', 'Maya'], 'el hummus', 'm', 0],
    ['AU', '🇦🇺', 'Australia', 'en-AU', "G'day!", ['Jack', 'Mitch', 'Cooper'], ['Matilda', 'Chloe', 'Mia'], 'las meat pies', 'l', 0],
    ['NZ', '🇳🇿', 'Nueva Zelanda', 'en-NZ', 'Kia ora!', ['Tane', 'Hemi', 'Liam'], ['Aroha', 'Mere', 'Ngaio'], 'el hāngī', 'l', 0]
  ].map(a => ({ cc: a[0], flag: a[1], country: a[2], lang: a[3], hello: a[4], m: a[5], f: a[6], dish: a[7], skin: a[8], es: !!a[9] }));
  const ALIAS = { 'eeuu': 'US', 'usa': 'US', 'ee uu': 'US', 'ee.uu': 'US', 'inglaterra': 'GB', 'uk': 'GB', 'holanda': 'NL', 'corea': 'KR', 'arabia': 'SA', 'dominicana': 'DO', 'rep dominicana': 'DO' };
  function countryIn(text) {
    const t = ' ' + norm(text).replace(/[.,;:!?¡¿]/g, ' ') + ' ';
    for (const k of Object.keys(ALIAS)) if (t.includes(' ' + k + ' ')) return C.find(c => c.cc === ALIAS[k]);
    return C.find(c => t.includes(' ' + norm(c.country) + ' '));
  }

  // ---------- Aspecto ----------
  const SKIN = { l: ['#f6d2b0', '#efc39a', '#e8b98a'], m: ['#e0ac7a', '#c68d5e', '#b98050'], d: ['#8d5a3b', '#6f4630', '#5b3a29'], a: ['#f1cfa4', '#e8bf8f', '#ecc79b'] };
  const HAIR = { l: ['#2b1b10', '#5a3a1a', '#b57e3a', '#8a4b2a', '#d9b36c', '#111'], m: ['#111', '#1a1410', '#2b1b10', '#4a2c17'], d: ['#111', '#1a1410', '#111'], a: ['#111', '#151515', '#1f1511'] };
  const TOPS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#06d6a0', '#ef476f', '#f8f9fa', '#ff6b9d'];
  const BOTS = ['#2b2d42', '#1d3557', '#5c4033', '#3a3a3a', '#6d597a', '#355070'];

  // Muñeco de frente (36×60): las mujeres con pelo largo que cae sobre los hombros y falda; los hombres con pelo corto y pantalón
  function dollSVG(d) {
    const f = d.g === 'f', sk = d.skin, hr = d.hair;
    const legs = f
      ? `<g class="vz-l"><rect x="12.6" y="44" width="4.2" height="11" rx="2" fill="${sk}"/><rect x="11.6" y="53" width="6" height="3.6" rx="1.8" fill="#3b2f2f"/></g>
         <g class="vz-r"><rect x="19.2" y="44" width="4.2" height="11" rx="2" fill="${sk}"/><rect x="18.4" y="53" width="6" height="3.6" rx="1.8" fill="#3b2f2f"/></g>
         <path d="M10 32 L26 32 L29.5 47 L6.5 47 Z" fill="${d.bot}"/>`
      : `<g class="vz-l"><rect x="11.4" y="36" width="6.2" height="19" rx="2.6" fill="${d.bot}"/><rect x="10.8" y="53" width="7" height="3.6" rx="1.8" fill="#2b2b2b"/></g>
         <g class="vz-r"><rect x="18.4" y="36" width="6.2" height="19" rx="2.6" fill="${d.bot}"/><rect x="18.2" y="53" width="7" height="3.6" rx="1.8" fill="#2b2b2b"/></g>`;
    const hairBack = f ? `<path d="M9.4 13 Q9 3.4 18 3.4 Q27 3.4 26.6 13 L28.6 34 Q28.8 38.4 25 38.4 L11 38.4 Q7.2 38.4 7.4 34 Z" fill="${hr}"/>` : '';
    const hairFront = f
      ? `<path d="M10 12.6 Q11 4.4 18 4.2 Q25 4.4 26 12.6 Q21.6 8 18 8.8 Q14.4 8 10 12.6Z" fill="${hr}"/>
         <rect x="8.2" y="12" width="4" height="25" rx="2" fill="${hr}"/><rect x="23.8" y="12" width="4" height="25" rx="2" fill="${hr}"/>`
      : `<path d="M10 11.6 Q9.8 3.8 18 3.6 Q26.2 3.8 26 11.6 Q22 7.2 18 7.8 Q14 7.2 10 11.6Z" fill="${hr}"/>`;
    return `<svg class="vz-svg" width="36" height="60" viewBox="0 0 36 60" aria-hidden="true">
      <ellipse cx="18" cy="57" rx="11" ry="3" fill="rgba(0,0,0,.28)"/>
      ${hairBack}${legs}
      <rect x="10" y="21" width="16" height="${f ? 13 : 17}" rx="5" fill="${d.top}"/>
      <g class="vz-la"><rect x="5.2" y="22.6" width="4.6" height="15" rx="2.3" fill="${d.top}"/><circle cx="7.5" cy="38.2" r="2.4" fill="${sk}"/></g>
      <g class="vz-ra"><rect x="26.2" y="22.6" width="4.6" height="15" rx="2.3" fill="${d.top}"/><circle cx="28.5" cy="38.2" r="2.4" fill="${sk}"/></g>
      <rect x="16" y="18" width="4" height="5" fill="${sk}"/>
      <circle cx="18" cy="13" r="8" fill="${sk}"/>
      ${hairFront}
      <circle cx="14.8" cy="13.6" r="1.15" fill="#222"/><circle cx="21.2" cy="13.6" r="1.15" fill="#222"/>
      ${f ? '<path d="M13 12.6 L14 13 M23 12.6 L22 13" stroke="#222" stroke-width=".6"/><circle cx="12.6" cy="16.2" r="1.6" fill="rgba(255,105,135,.35)"/><circle cx="23.4" cy="16.2" r="1.6" fill="rgba(255,105,135,.35)"/>' : ''}
      <path class="vz-mouth" d="M15.4 17.2 Q18 19.6 20.6 17.2" stroke="${f ? '#c2185b' : '#8a3b3b'}" stroke-width="1" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  const st = document.createElement('style');
  st.textContent = `
    .vz { background: transparent !important; border: 0 !important; }
    .vz-body { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); transform-origin: 50% 100%; display: flex; flex-direction: column; align-items: center; opacity: 0; transition: opacity .4s; cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent; }
    .vz-tag { font: 700 11px/1 system-ui, sans-serif; background: #fff; color: #14213d; border-radius: 10px; padding: 2px 6px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,.35); margin-bottom: 2px; }
    .vz-bub { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 5px; width: max-content; max-width: 190px; background: #fff; color: #14213d; font: 600 12px/1.25 system-ui, sans-serif; text-align: center; padding: 5px 8px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.35); opacity: 0; transition: opacity .25s; pointer-events: none; }
    .vz-bub.show { opacity: 1; }
    .vz-svg { display: block; overflow: visible; }
    .vz-l, .vz-r, .vz-la, .vz-ra { transform-box: fill-box; transform-origin: 50% 4%; }
    .vz-body.walk .vz-svg { animation: vzbob .42s ease-in-out infinite alternate; }
    .vz-body.walk .vz-l, .vz-body.walk .vz-ra { animation: vzswA .42s ease-in-out infinite alternate; }
    .vz-body.walk .vz-r, .vz-body.walk .vz-la { animation: vzswB .42s ease-in-out infinite alternate; }
    .vz-body.wave .vz-ra, .vz-body.talk .vz-ra { animation: vzwave .5s ease-in-out infinite alternate; }
    .vz-body.talk .vz-mouth { animation: vzmouth .22s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 0; }
    .vz-body.iw .vz-ra { animation: vzwave .55s ease-in-out infinite alternate; }
    .vz-body.iw2 .vz-la { animation: vzwaveL .55s ease-in-out infinite alternate; }
    @keyframes vzwaveL { from { transform: rotate(150deg); } to { transform: rotate(178deg); } }
    @keyframes vzbob { from { transform: translateY(0); } to { transform: translateY(-1.6px); } }
    @keyframes vzswA { from { transform: rotate(14deg); } to { transform: rotate(-14deg); } }
    @keyframes vzswB { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
    @keyframes vzwave { from { transform: rotate(-150deg); } to { transform: rotate(-178deg); } }
    @keyframes vzmouth { from { transform: scaleY(.5); } to { transform: scaleY(1.8); } }
    @media (prefers-reduced-motion: reduce) { .vz-body .vz-svg, .vz-body .vz-l, .vz-body .vz-r, .vz-body .vz-la, .vz-body .vz-ra, .vz-body .vz-mouth { animation: none !important; } }
    .vz-chat { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(94vw, 460px); z-index: 1300; box-sizing: border-box; background: var(--card, #fffffff2); color: var(--fg, #14213d); border: 1px solid var(--line, #d8dee9); border-radius: 16px; padding: 10px 12px; box-shadow: 0 8px 28px rgba(0,0,0,.35); backdrop-filter: blur(8px); }
    .vz-chat.hidden { display: none; }
    .vz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 800; margin-bottom: 6px; }
    .vz-head button { padding: 2px 9px; font-size: 18px; line-height: 1.2; }
    .vz-log { max-height: 30vh; overflow-y: auto; font-size: 14px; display: flex; flex-direction: column; gap: 5px; }
    .vz-line { padding: 6px 10px; border-radius: 12px; max-width: 88%; }
    .vz-line.v { background: rgba(120,140,170,.18); align-self: flex-start; }
    .vz-line.me { background: var(--accent, #0b6e4f); color: #fff; align-self: flex-end; }
    .vz-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 6px; }
    .vz-chips button { border-radius: 999px; padding: 6px 12px; font-weight: 700; }
    .vz-form { display: flex; gap: 6px; }
    .vz-form input { flex: 1; min-width: 0; font-size: 16px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line, #d8dee9); background: var(--bg, #fff); color: var(--fg, #14213d); }
    .vz-never { margin-top: 8px; background: none; border: 0; color: var(--muted, #667); font-size: 12px; padding: 0; text-decoration: underline; }`;
  document.head.appendChild(st);
  map.createPane('visitors');
  const pane = map.getPane('visitors');
  pane.style.zIndex = 595;

  // ---------- Estado ----------
  const vs = [];                    // visitantes en el mapa
  let talker = null, convToken = 0, pendingReject = null, running = false, FP = 1, nextSpawn = 8, wasShown = false, lastRemark = 0;
  const ABORT = { abort: 1 }, END = { end: 1 }, TIMEOUT = { timeout: 1 };
  const A = () => window.atlasVoice;
  const enabled = () => !window.soundOn || window.soundOn('visitantes');
  const logged = () => typeof authToken !== 'undefined' && !!authToken;
  const myNick = () => { try { return typeof nickOf === 'function' ? nickOf() : ''; } catch (e) { return ''; } };
  const canShow = () => enabled() && map.getZoom() >= MIN_ZOOM && !document.hidden && !window.houseInside && !window.earthMuted && !window.fightMuted;
  const pcap = (n, min) => window.Perf ? Perf.cap(n, min) : n;     // modo ligero (ligero.js)
  const today = () => new Date().toLocaleDateString('en-CA');

  // Memoria en el navegador: qué te preguntaron hoy, si tienes TikTok y a quién conociste
  function loadMem() {
    let m = {};
    try { m = JSON.parse(localStorage.getItem(MEM) || '{}') || {}; } catch (e) { m = {}; }
    if (m.day !== today()) { m.day = today(); m.asked = {}; }
    m.asked = m.asked || {}; m.met = m.met || {}; m.tiktok = m.tiktok || '';
    return m;
  }
  function saveMem(m) {
    try { const k = Object.keys(m.met); if (k.length > 60) k.slice(0, k.length - 60).forEach(x => delete m.met[x]); localStorage.setItem(MEM, JSON.stringify(m)); } catch (e) {}
  }

  // ---------- Crear visitantes ----------
  function makeVisitor() {
    let c, g, name, tries = 0;
    do {   // sin repetir país ni nombre mientras estén en pantalla
      c = pick(C); g = Math.random() < 0.5 ? 'f' : 'm'; name = pick(g === 'f' ? c.f : c.m); tries++;
    } while (tries < 12 && vs.some(v => v.name === name || v.cc === c.cc));
    const d = { g, skin: pick(SKIN[c.skin]), hair: pick(HAIR[c.skin]), top: pick(TOPS), bot: pick(BOTS) };
    return {
      c, cc: c.cc, g, name, d, voice: A() ? A().profile(g === 'f' ? 'mujer' : 'hombre') : null, vlang: c.es ? c.lang : null,
      giver: Math.random() < 0.55, joker: Math.random() < 0.35, mood: 0.5, turns: 0, upset: false, asked: false,
      mk: null, el: null, bub: null, x: 0, y: 0, age: 0, life: rnd(150, 260), spd: rnd(24, 32), side: Math.random() < 0.5 ? 1 : -1,
      plan: [], phase: 'walk', hold: 0, target: null, greeted: false, walking: null, fpA: 0
    };
  }

  function spawn() {
    const size = map.getSize(), R = 0.5 * Math.hypot(size.x, size.y) * 0.97, a = rnd(0, Math.PI * 2);
    const ll = map.containerPointToLatLng({ x: size.x / 2 + Math.cos(a) * R, y: size.y / 2 + Math.sin(a) * R });
    const v = makeVisitor(), p = map.project(ll, REF_Z);
    v.x = p.x; v.y = p.y;
    const seeker = Math.random() < 0.6;   // unos van a buscar al jugador; otros van de turismo y, si lo ven, se acercan
    v.plan = seeker ? [{ k: 'player' }, ...(Math.random() < 0.5 ? [{ k: 'site' }] : []), { k: 'leave' }]
                    : [{ k: 'site' }, ...(Math.random() < 0.6 ? [{ k: 'player' }] : []), { k: 'leave' }];
    FP = map.sizes ? map.sizes().fp : 1;
    const icon = L.divIcon({
      className: 'vz', iconSize: [44, 90], iconAnchor: [22, 87],
      html: `<div class="vz-body" title="${v.c.flag} ${v.name}"><div class="vz-bub"></div><div class="vz-tag">${v.c.flag} ${v.name}</div>${dollSVG({ ...v.d, g: v.g })}</div>`
    });
    v.mk = L.marker(map.unproject(L.point(v.x, v.y), REF_Z), { icon, pane: 'visitors', keyboard: false }).addTo(map);
    v.el = v.mk.getElement().firstChild; v.bub = v.el.firstChild;
    v.el.addEventListener('click', e => { e.stopPropagation(); onTap(v); });
    vs.push(v); startLoop();
    return v;
  }
  function removeV(v) {
    const i = vs.indexOf(v); if (i < 0) return;
    if (talker === v) endConv();
    try { map.removeLayer(v.mk); } catch (e) {}
    vs.splice(i, 1);
  }
  function clearAll() { endConv(); while (vs.length) removeV(vs[0]); }

  // ---------- Sitios para visitar: monumentos y casas de los jugadores que se ven en pantalla ----------
  const REM_CASA = ['¡Qué casa tan bonita!', 'Me encanta esta casa 😍', '¿Quién vivirá aquí? Seguro que gente maja.', '¡Qué buen vecindario!', 'Uy, qué bien cuidada está esta casa.', 'Algún día me compro una igual.'];
  const REM_MON = [n => `¡Mira, ${n}! ¡Qué pasada!`, n => `${n}… ¡tengo que hacerme una foto! 📸`, n => `Siempre quise ver ${n}.`, n => `¡Increíble! Esto es ${n}.`];
  function pickSite() {
    const size = map.getSize(), out = [];
    const add = (lat, lng, name, kind, place) => {
      const p = map.latLngToContainerPoint({ lat, lng });
      if (!p || p.x < 30 || p.y < 70 || p.x > size.x - 30 || p.y > size.y - 40) return;
      const d = Math.hypot(p.x - size.x / 2, p.y - size.y / 2);
      if (d > 60) out.push({ lat, lng, name, kind, place, d });
    };
    try { (window.Monumentos ? window.Monumentos.list() : []).forEach(m => add(m.lat, m.lng, m.name, 'mon', m.place)); } catch (e) {}
    try { if (typeof ownedFeatures !== 'undefined') ownedFeatures.forEach(f => { const q = f.properties; if (q && q.clat != null) add(q.clat, q.clng, '', 'casa'); }); } catch (e) {}
    const taken = new Set(vs.filter(v => v.target && v.target.k === 'site').map(v => v.target.lat + ',' + v.target.lng));
    const free = out.filter(s => !taken.has(s.lat + ',' + s.lng)).sort((a, b) => a.d - b.d).slice(0, 10);
    return free.length ? pick(free) : null;
  }

  // ---------- Movimiento ----------
  function nextStep(v) {
    v.plan.shift(); v.phase = 'walk'; v.target = null; v.hold = 0;
    if (!v.plan.length) v.plan.push({ k: 'leave' });
  }
  function resolveTarget(v, c, scale) {
    const step = v.plan[0];
    if (step.k === 'player') return { k: 'player' };
    if (step.k === 'site') {
      const s = pickSite();
      if (!s) { nextStep(v); return null; }
      return { k: 'site', ...s };
    }
    if (step.k === 'stroll') {   // quieto mucho rato: da un paseíto por los alrededores
      const a = rnd(0, Math.PI * 2), d = rnd(70, 150) * FP / scale;
      return { k: 'stroll', x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d };
    }
    // leave: se aleja del jugador hasta salir de la pantalla
    const dx = v.x - c.x, dy = v.y - c.y, d = Math.hypot(dx, dy) || 1, far = (Math.max(innerWidth, innerHeight) * 0.9) / scale;
    return { k: 'leave', x: c.x + dx / d * far, y: c.y + dy / d * far };
  }
  function frame(t) {
    if (!vs.length) { running = false; return; }
    const dt = Math.min((t - (frame.last || t)) / 1000, 0.1); frame.last = t;
    if (!document.hidden) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z);
      FP = map.sizes ? map.sizes().fp : 1;
      const c = map.project(map.getCenter(), REF_Z), view = map.getBounds().pad(0.35);
      for (let i = vs.length - 1; i >= 0; i--) {
        const v = vs[i];
        v.age += dt;
        if (v.age > v.life) { removeV(v); continue; }
        if (!v.target && v.phase !== 'talk') v.target = resolveTarget(v, c, scale);
        let moving = false;
        const tg = v.phase === 'talk' ? { k: 'player' } : v.target;
        if (tg && v.phase !== 'look') {
          let tx, ty, stop;
          if (tg.k === 'player') { tx = c.x + v.side * 64 * FP / scale; ty = c.y + 22 * FP / scale; stop = 5 / scale; }
          else if (tg.k === 'site') { const p = map.project({ lat: tg.lat, lng: tg.lng }, REF_Z); tx = p.x; ty = p.y + 30 * FP / scale; stop = 4 / scale; }
          else { tx = tg.x; ty = tg.y; stop = 4 / scale; }
          const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
          if (d <= stop) arrive(v, tg);
          else {
            const sp = Math.min(d, v.spd * FP / scale * dt * (v.phase === 'talk' ? 2.2 : 1));
            v.x += dx / d * sp; v.y += dy / d * sp; moving = true;
            for (const u of vs) {   // no se pisan entre ellos
              if (u === v) continue;
              const ux = v.x - u.x, uy = v.y - u.y, ud = Math.hypot(ux, uy), min = 26 * FP / scale;
              if (ud > 0 && ud < min) { v.x += ux / ud * (min - ud) * 0.1; v.y += uy / ud * (min - ud) * 0.1; }
            }
            if (tg.k === 'player' && v.phase === 'walk' && !v.greeted && d * scale < 190) { v.greeted = true; v.el.classList.add('wave'); remark(v, pick(['¡Eh, oye! 👋', '¡Hola, hola! ¡Espera!', '¡Ey, tú! ¡Quiero conocerte!']), 3500); setTimeout(() => v.el && v.el.classList.remove('wave'), 3200); }
          }
        }
        if (v.phase === 'look') { v.hold -= dt; if (v.hold <= 0) nextStep(v); }
        const ll = map.unproject(L.point(v.x, v.y), REF_Z);
        if (v.age > 6 && !view.contains(ll) && v.phase !== 'talk') { removeV(v); continue; }
        v.mk.setLatLng(ll);
        // Siempre de frente. Quieto: saluda levantando la mano; si lleva mucho rato quieto, saluda con las dos manos; y si no hay nadie que lo mueva, se pone a pasear solo.
        v.still = moving ? 0 : (v.still || 0) + dt;
        const iw = !moving && v.still > 2, iw2 = !moving && v.still > 10;
        if (iw !== v.iw) { v.iw = iw; v.el.classList.toggle('iw', iw); }
        if (iw2 !== v.iw2) { v.iw2 = iw2; v.el.classList.toggle('iw2', iw2); }
        if (!moving && v.phase !== 'talk' && v.still > 14 && v.plan[0] && v.plan[0].k !== 'stroll') { v.plan.unshift({ k: 'stroll' }); v.target = null; v.phase = 'walk'; v.still = 0; }
        if (v.walking !== moving) { v.walking = moving; v.el.classList.toggle('walk', moving); }
        if (v.fpA !== FP) { v.el.style.scale = clamp(FP * 1.2, 0.8, 1.6).toFixed(3); v.fpA = FP; }
        v.el.style.opacity = Math.max(0, Math.min(1, v.age / 1.2, (v.life - v.age) / 2));
      }
    }
    requestAnimationFrame(frame);
  }
  function startLoop() { if (!running) { running = true; frame.last = 0; requestAnimationFrame(frame); } }

  function arrive(v, tg) {
    if (tg.k === 'leave') { removeV(v); return; }
    if (tg.k === 'stroll') { nextStep(v); return; }
    if (tg.k === 'site') {
      v.phase = 'look'; v.hold = rnd(6, 10);
      const line = tg.kind === 'mon' ? pick(REM_MON)(tg.name) + (tg.place && Math.random() < 0.5 ? ` Y en ${tg.place}…` : '') : pick(REM_CASA);
      remark(v, line, 6000);
      return;
    }
    if (tg.k === 'player') {
      if (v.phase === 'talk') return;
      if (talker || !canShow()) { remark(v, '¡Qué pena, está ocupado! Otra vez será.', 3500); nextStep(v); return; }
      startTalk(v);
    }
  }
  function onTap(v) {
    if (talker === v) return;
    if (talker) { remark(v, '¡Ahora estoy esperando mi turno! 🙂', 2500); return; }
    startTalk(v);
  }

  // Frase suelta encima del muñeco (con voz si nadie más está hablando)
  function remark(v, text, ms) {
    if (!v.bub) return;
    v.bub.textContent = text; v.bub.classList.add('show');
    clearTimeout(v.bubT); v.bubT = setTimeout(() => v.bub && v.bub.classList.remove('show'), ms || 4000);
    if (A() && !talker && Date.now() - lastRemark > 6000) { lastRemark = Date.now(); A().speak(text, v.voice, { lang: v.vlang }); }
  }

  // ---------- Panel de conversación ----------
  let P = null;
  function panel() {
    if (P) return P;
    const el = document.createElement('div');
    el.className = 'vz-chat hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="vz-head"><span class="vz-who"></span><button type="button" class="vz-x" aria-label="Cerrar">×</button></div><div class="vz-log"></div><div class="vz-chips"></div>' +
      '<form class="vz-form" autocomplete="off"><input type="text" maxlength="80" placeholder="Escribe tu respuesta…" enterkeyhint="send"><button type="submit" class="primary" style="width:auto;padding:8px 14px">➤</button></form>' +
      '<button type="button" class="vz-never">🚫 No quiero más visitantes</button>';
    document.body.appendChild(el);
    P = { el, who: el.querySelector('.vz-who'), log: el.querySelector('.vz-log'), chips: el.querySelector('.vz-chips'), input: el.querySelector('input'), pending: null };
    el.querySelector('.vz-x').onclick = () => { const v = talker; endConv(); if (v) remark(v, '¡Adiós! 👋', 2500); };
    el.querySelector('.vz-never').onclick = () => { try { window.soundPrefs && window.soundPrefs.set('visitantes', false); } catch (e) {} clearAll(); try { flashToast('Visitantes desactivados. Puedes volver a activarlos en 🔊 Sonido → «Visitantes del mapa».'); } catch (e) {} };
    el.querySelector('form').onsubmit = e => { e.preventDefault(); const t = P.input.value.trim(); if (t && P.pending) { P.input.value = ''; P.pending({ text: t, key: '' }); } };
    return P;
  }
  function addLine(who, text) {
    const p = panel(), d = document.createElement('div');
    d.className = 'vz-line ' + who; d.textContent = text;
    p.log.appendChild(d);
    while (p.log.children.length > 6) p.log.removeChild(p.log.firstChild);
    p.log.scrollTop = p.log.scrollHeight;
  }
  function setChips(list) {
    const p = panel(); p.chips.textContent = '';
    (list || []).forEach(([label, key]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => { if (p.pending) p.pending({ text: label, key }); };
      p.chips.appendChild(b);
    });
  }
  // El visitante vuelve a su camino: se despide con la mano y sigue su plan (o se va)
  function release(v) {
    if (!v) return;
    if (v.el) { v.el.classList.remove('talk'); v.el.classList.add('wave'); setTimeout(() => v.el && v.el.classList.remove('wave'), 2500); }
    v.plan = v.plan.filter(s => s.k !== 'player');
    v.phase = 'walk'; v.target = null; v.greeted = true;
    if (!v.plan.length || v.upset || (v.plan[0].k !== 'leave' && Math.random() < 0.3)) v.plan = [{ k: 'leave' }];
  }
  function endConv() {
    convToken++;
    if (pendingReject) { const r = pendingReject; pendingReject = null; r(ABORT); }
    if (A()) A().stop();
    if (P) { P.el.classList.add('hidden'); P.pending = null; }
    const t = talker; talker = null;
    if (t) release(t);
  }

  // Habla (voz + texto) y espera a que termine; si no hay voz, deja un tiempo para leer
  function speakOne(v, text, lang) {
    return new Promise(res => {
      const ms = 700 + text.length * 55; let t = setTimeout(res, ms + 3500), spoke = false;
      if (A()) spoke = A().speak(text, v.voice, { force: true, lang, onend: () => { clearTimeout(t); setTimeout(res, 180); } });
      if (!spoke) { clearTimeout(t); setTimeout(res, ms); }
    });
  }
  async function say(v, text, pre) {
    const my = convToken;
    if (my !== convToken || talker !== v) throw ABORT;
    addLine('v', (pre ? pre + ' ' : '') + text);
    v.el.classList.add('talk');
    try {
      if (pre) {   // saludo en su idioma: solo se dice si hay voz de ese idioma (o si se puede leer con letras latinas)
        if (A() && A().hasLang(v.c.lang) && !v.c.es) await speakOne(v, pre, v.c.lang);
        else if (/^[\p{Script=Latin}\s!¡?¿'.,-]+$/u.test(pre)) await speakOne(v, pre, v.vlang);
      }
      if (my === convToken) await speakOne(v, text, v.vlang);
    } finally { if (v.el) v.el.classList.remove('talk'); }
    if (my !== convToken) throw ABORT;
  }
  // Espera la respuesta del jugador (botón o texto). Cierra con ABORT si se cierra el panel.
  function ask(v, chips) {
    const p = panel(), my = convToken;
    if (my !== convToken || talker !== v) return Promise.reject(ABORT);
    setChips(chips.concat([['Adiós 👋', 'bye']]));
    return new Promise((res, rej) => {
      pendingReject = rej;
      const timer = setTimeout(() => { if (p.pending === done) { p.pending = null; pendingReject = null; setChips([]); rej(TIMEOUT); } }, 60000);
      const done = r => {
        clearTimeout(timer); p.pending = null; pendingReject = null; setChips([]);
        r.intent = r.key || intentOf(r.text); v.turns++; addLine('me', r.text);
        res(r);
      };
      p.pending = done;
      setTimeout(() => { try { if (!SMALL) p.input.focus({ preventScroll: true }); } catch (e) {} }, 50);
    });
  }

  // ---------- Entender lo que escribe el jugador ----------
  function intentOf(text) {
    const t = ' ' + norm(text).replace(/[.,;:!?¡¿]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const has = re => re.test(t);
    if (has(/ (idiota|tonto|tonta|estupid[oa]|imbecil|gilipollas|callate|callaos|puto|puta|mierda|asco|feo|fea|pesado|pesada|lamentable) /)) return 'insult';
    if (has(/ (adios|chao|chau|hasta luego|hasta pronto|nos vemos|me voy|bye|hasta la vista|hasta mañana) /)) return 'bye';
    if (has(/ (credito|creditos|regalo|regalame|regalas|dame|monedas|dinero|invitame|paga) /)) return 'credits';
    if (has(/ (como te llamas|tu nombre|quien eres|como te llaman) /)) return 'name';
    if (has(/ (de donde eres|de que pais eres|donde vives|de donde vienes|tu pais) /)) return 'from';
    if (has(/ (como estas|que tal estas|como andas|que tal tu|y tu que tal) /)) return 'how';
    if (has(/ (que hora|hora es) /)) return 'time';
    if (has(/ (guapo|guapa|bonit[oa]|simpatic[oa]|genial|majo|maja|buena gente|me caes bien|me gustas|eres buen[oa]|eres un crack|encantad[oa]|que bien hablas) /)) return 'compliment';
    if (/^ no /.test(t) && !has(/ si /)) return 'no';   // «no, gracias» es un no, no un agradecimiento
    if (has(/ (gracias|thanks|thank you|merci|grazie|obrigad[oa]) /)) return 'thanks';
    if (has(/ no /) && !has(/ si /)) return 'no';
    if (has(/ (si|sii+|claro|vale|obvio|aja|dale|yes|sip|por supuesto|desde luego|pues si|ok|okey|exacto|correcto) /)) return 'yes';
    if (has(/ (hola|holaa+|buenas|buenos dias|buenas tardes|buenas noches|hey|hello|ola|ey|saludos) /)) return 'hello';
    return 'other';
  }
  // Respuestas a lo que se salga del guion: devuelve true si ha contestado (luego retoma la pregunta)
  async function side(v, r) {
    const k = r.intent;
    if (k === 'insult') { v.mood = 0; v.upset = true; await say(v, pick(['Pues vaya… ¡qué poca educación! Me voy.', '¡Oye, eso no está bien! Adiós.', 'Vaya, qué mal rollo. Me marcho.'])); throw END; }
    if (k === 'bye') throw END;
    if (k === 'name') { await say(v, `Me llamo ${v.name}, ¿y tú?`); return true; }
    if (k === 'from') { await say(v, `Soy de ${v.c.country} ${v.c.flag}. ¡Mi país es precioso, tienes que visitarlo!`); return true; }
    if (k === 'how') { v.mood += 0.05; await say(v, '¡Muy bien, gracias por preguntar! 😊'); return true; }
    if (k === 'time') { const d = new Date(); await say(v, `Son las ${d.getHours()} y ${String(d.getMinutes()).padStart(2, '0')}. ¡Cómo vuela el tiempo!`); return true; }
    if (k === 'compliment') { v.mood += 0.15; await say(v, pick(['¡Ay, gracias! Tú también me caes genial. 😄', '¡Qué amable! Me has alegrado el día.', '¡Jajaja, gracias! Eres un sol.'])); return true; }
    if (k === 'thanks') { v.mood += 0.05; await say(v, '¡De nada, un placer!'); return true; }
    if (k === 'credits') {
      v.mood -= 0.25; v.asked = true;
      const left = await giftLeft();
      await say(v, left === 0 ? '¡Jaja! Hoy ya te han regalado bastante, vuelve mañana. 😉' : pick(['¡Jaja! Los créditos no se piden, se regalan cuando alguien cae bien. 😉', 'Uy, directo al grano. Mejor charlamos un rato, ¿no?']));
      return true;
    }
    if (k === 'hello' && !r.key) { await say(v, '¡Hola, hola! 😄'); return true; }
    return false;
  }
  async function askTopic(v, q, chips, pre) {
    await say(v, q, pre);
    for (let i = 0; i < 3; i++) {
      const r = await ask(v, chips);
      if (!r.key && await side(v, r)) { await say(v, pick(['Pero a lo que iba…', 'Bueno, y volviendo a lo mío…', 'Por cierto, a lo que iba…']) + ' ' + q); continue; }
      if (r.key === 'bye' || r.intent === 'bye') throw END;
      return r;
    }
    return { text: '', intent: 'other' };
  }

  // ---------- Temas de conversación ----------
  const YN = [['Sí 😀', 'yes'], ['No', 'no']];
  const TOPICS = {
    async tiktok(v, mem) {
      if (mem.tiktok === 'yes') { await say(v, `Oye, ¿sigues subiendo cosas a TikTok? ¡Me acuerdo de que tenías cuenta!`); const r = await ask(v, YN); if (r.intent === 'yes') { v.mood += 0.1; await say(v, '¡Genial! Yo veo vídeos de gatos por horas. 🐱'); } else await side(v, r); return; }
      const r = await askTopic(v, '¿Tienes cuenta en TikTok?', [['Sí 🎵', 'yes'], ['No', 'no'], ['Uso Instagram', 'ig']]);
      if (r.intent === 'yes') {
        mem.tiktok = 'yes'; v.mood += 0.1;
        await say(v, '¡Genial! ¿Qué tipo de vídeos subes? ¿Bailes, humor, viajes…?');
        const h = await ask(v, [['Bailes 💃', 'bail'], ['Humor 😂', 'hum'], ['Solo miro', 'mir']]);
        await say(v, h.key === 'bail' ? '¡Qué arte! Yo tengo dos pies izquierdos, ¡pero me encantaría aprender!' : h.key === 'hum' ? '¡Jajaja! Cuéntame un chiste cuando quieras.' : h.key === 'mir' ? 'Yo también soy de los de mirar. ¡Así no hay presión!' : '¡Qué interesante! Tendré que buscarte.');
      } else if (r.intent === 'no') { mem.tiktok = 'no'; await say(v, '¡Jajaja, qué sano! Yo paso horas viendo vídeos de gatos. 🐱'); }
      else if (r.key === 'ig') { mem.tiktok = 'no'; await say(v, '¡Buen gusto! Yo subo fotos de mis viajes. 📸'); }
      else await say(v, '¡Ja, ja! Tú a lo tuyo, me gusta. 😄');
    },
    async pais(v) {
      const r = await askTopic(v, 'Y tú, ¿de qué país eres?', [['Prefiero no decirlo', 'no']]);
      const c2 = r.key ? null : countryIn(r.text);
      if (c2 && c2.cc === v.cc) { v.mood += 0.15; await say(v, `¡Somos paisanos! ¡Qué casualidad encontrarnos aquí! ${v.c.flag}`); }
      else if (c2) { v.mood += 0.08; await say(v, `¡${c2.country} ${c2.flag}! ¡Qué bien! Allí se come ${c2.dish}, ¿verdad? ¡Qué hambre me da!`); }
      else if (r.key === 'no') await say(v, '¡Ningún problema! Es un misterio, ¡me gusta!');
      else await say(v, 'Mmm, ese sitio no lo conozco. ¡Algún día lo visitaré!');
    },
    async comida(v) {
      const r = await askTopic(v, `En ${v.c.country} lo mejor es ${v.c.dish}. ¿Y tú, cuál es tu comida favorita?`, [['Pizza 🍕', 'pizza'], ['Tacos 🌮', 'tacos'], ['Paella 🥘', 'paella']]);
      const t = r.key ? r.text.replace(/ [^\w ]+$/u, '').trim() : r.text;
      if (norm(t).includes(norm(v.c.dish).replace(/^(el|la|los|las) /, '').split(' ')[0])) { v.mood += 0.15; await say(v, '¡No me lo creo! ¡Esa es mi favorita también!'); }
      else if (t.length > 0 && t.length < 40) { v.mood += 0.05; await say(v, `¡${cap(t)}! Mmm, me has dado hambre. Apunto la receta.`); }
      else await say(v, '¡Qué rico suena eso!');
    },
    async casa(v) {
      const r = await askTopic(v, '¿Cuál es tu sitio favorito de este mapa?', [['Mi casa 🏠', 'casa'], ['Los monumentos 🏛️', 'mon'], ['Aún no lo sé', 'idk']]);
      await say(v, r.key === 'casa' ? '¡Qué suerte, tener casa propia! Yo solo soy un turista con mochila. 🎒' : r.key === 'mon' ? '¡Yo también! Hoy mismo voy a ver alguno. Siempre me hago fotos allí. 📸' : r.key === 'idk' ? 'Pues pasea y descubre, ¡eso hago yo! Cada rincón tiene su historia.' : '¡Buena elección! Apunto ese sitio en mi lista.');
    },
    async viaje(v) {
      const r = await askTopic(v, `¿Has estado alguna vez en ${v.c.country}?`, YN);
      if (r.intent === 'yes') { v.mood += 0.12; await say(v, '¡Qué bien! ¿Te gustó? Mi país es muy especial, ¿a que sí?'); await ask(v, [['¡Me encantó!', 'yes'], ['Un poco', 'no']]).then(x => say(v, x.intent === 'yes' ? '¡Lo sabía! Me haces muy feliz. 😊' : 'Bueno, ¡volverás y te gustará más!')); }
      else { v.mood += 0.04; await say(v, `¡Pues tienes que ir! Te invito a probar ${v.c.dish}.`); }
    },
    async musica(v) {
      const r = await askTopic(v, '¿Qué música te gusta?', [['Pop 🎤', 'pop'], ['Rock 🎸', 'rock'], ['Reguetón 🔥', 'reg'], ['Clásica 🎻', 'cla']]);
      await say(v, r.key === 'pop' ? '¡Pop! Pues yo canto en la ducha, y fatal, pero con mucha pasión. 🎶' : r.key === 'rock' ? '¡Rock! ¡Eso es actitud! 🤘' : r.key === 'reg' ? '¡Dale! ¡Hay que bailar! 🔥' : r.key === 'cla' ? 'Clásica, qué elegante. Me relaja muchísimo.' : '¡Buen gusto! Tendrás que pasarme tu lista.');
    },
    async terrenos(v) {
      const r = await askTopic(v, '¿Ya tienes terrenos en el juego?', YN);
      if (r.intent === 'yes') { v.mood += 0.1; await say(v, '¡Entonces eres un gran propietario! Seguro que tu casa es preciosa. 🏡'); }
      else await say(v, '¡Pues anímate! Hay parcelas por todo el mundo, hasta en mi país. 🌍');
    }
  };

  // ---------- La conversación ----------
  function greeting(v, mem) {
    const h = new Date().getHours(), part = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const nick = myNick(), key = v.cc + v.name, known = !!mem.met[key];
    const rain = window.weatherIntensity && window.weatherIntensity() > 0.25;
    mem.met[key] = (mem.met[key] || 0) + 1;
    if (known) v.mood += 0.15;
    const body = known
      ? `¡Pero si ya nos conocíamos${nick ? ', ' + nick : ''}! Soy ${v.name}, de ${v.c.country} ${v.c.flag}. ¡Qué alegría verte otra vez!`
      : `${nick ? nick + ', s' : 'S'}oy ${v.name}, de ${v.c.country} ${v.c.flag}. ${part}${rain ? ', ¡menuda lluvia!' : ''}. ${nick ? '¿Qué tal el día?' : '¿Cómo te llamas?'}`;
    return body;
  }
  async function greet(v, mem) {
    const nick = myNick();
    // el saludo en su idioma se dice aparte (si hay voz de ese idioma); si habla español, va dentro del texto
    await say(v, (v.c.es ? v.c.hello + ' ' : '') + greeting(v, mem), v.c.es ? '' : v.c.hello);
    const r = await ask(v, [['¡Hola! 😀', 'hello'], ['Muy bien', 'good'], ['Regular', 'meh'], ['¿Y tú de dónde eres?', 'from']]);
    if (r.intent === 'good') { v.mood += 0.1; await say(v, '¡Me alegro mucho! 😊'); }
    else if (r.intent === 'meh') { v.mood += 0.06; await say(v, '¡Ánimo! Ya verás como mejora. Un paseo por el mapa siempre ayuda.'); }
    else if (r.intent === 'hello') { v.mood += 0.05; await say(v, '¡Qué alegría verte! 😄'); }
    else if (!(await side(v, r))) {
      if (r.intent === 'other' && !nick && r.text.length < 25) { v.mood += 0.08; await say(v, `¡Encantado, ${cap(r.text)}! Qué nombre tan bonito.`); }
      else await say(v, '¡Perfecto! Pues vamos a charlar un ratito.');
    }
  }
  function pickTopics(v, mem) {
    const pool = Object.keys(TOPICS).filter(k => !mem.asked[k]);
    if (mem.tiktok !== 'yes' && !mem.asked.tiktok && Math.random() < 0.7) { pool.splice(pool.indexOf('tiktok'), 1); pool.unshift('tiktok'); }
    else pool.sort(() => Math.random() - 0.5);
    const out = pool.slice(0, 3);
    if (out.length < 2) out.push(...Object.keys(TOPICS).sort(() => Math.random() - 0.5).filter(k => !out.includes(k)).slice(0, 2 - out.length));
    return out;
  }
  async function giftLeft() {
    if (!logged()) return null;
    try { const j = await api('/api/visitantes/estado'); return j.left < 1 ? 0 : (j.wait > 0 ? 0.5 : j.left); } catch (e) { return null; }
  }
  async function maybeGift(v) {
    if (v.upset || v.mood < 0.6 || v.turns < 3 || !v.giver) return;
    if (!logged()) {
      await say(v, 'Me caes genial. Si creas tu cuenta, la próxima vez te regalo créditos. 🎁');
      const r = await ask(v, [['Entrar / crear cuenta', 'login'], ['Luego', 'later']]);
      if (r.key === 'login' && typeof openLogin === 'function') openLogin();
      return;
    }
    const left = await giftLeft();
    if (!(left >= 1)) return;
    const n = Math.random() < 0.5 ? 1 : 2;   // 1 o 2 créditos; el servidor no deja pasar de 2
    await say(v, `¡Me has caído genial! Toma, ${n} ${n === 1 ? 'crédito' : 'créditos'} de regalo. 🎁`);
    const r = await ask(v, [['Aceptar 🎁', 'gift_yes'], ['No, gracias', 'gift_no']]);
    if (r.key !== 'gift_yes' && !(r.intent === 'yes' || r.intent === 'thanks')) { await say(v, '¡Como quieras! El ofrecimiento sigue en pie. 😊'); return; }
    try {
      const j = await api('/api/visitantes/regalo', { method: 'POST', body: { credits: n } });
      if (j.rewarded) {
        v.mood = 1;
        try { if (typeof refreshCredits === 'function') refreshCredits(); } catch (e) {}
        const msg = `🎁 ${v.c.flag} ${v.name} te ha regalado ${j.reward} ${j.reward === 1 ? 'crédito' : 'créditos'}`;
        try { (window.giftToast || window.flashToast || (() => {}))(msg); } catch (e) {}
        await say(v, '¡Que los disfrutes! Me ha encantado conocerte. 😊');
      } else await say(v, j.reason === 'limit' ? 'Vaya, hoy ya te han regalado el máximo. ¡Vuelve mañana! 😉' : 'Uy, he llegado demasiado pronto tras el último regalo. ¡Otro día!');
    } catch (e) { await say(v, 'Ay, algo ha fallado y no he podido darte el regalo. ¡Perdona!'); }
  }
  async function conversation(v) {
    const mem = loadMem();
    try {
      await greet(v, mem);
      for (const id of pickTopics(v, mem)) { await TOPICS[id](v, mem); mem.asked[id] = 1; saveMem(mem); }
      await maybeGift(v);
    } catch (e) {
      if (e === ABORT) throw e;
      if (e === TIMEOUT) { await say(v, 'Veo que estás ocupado. ¡Hasta luego!'); return; }
      if (e !== END) throw e;
    } finally { saveMem(mem); }
    if (!v.upset) await say(v, pick(['¡Hasta pronto! Ha sido un placer.', '¡Nos vemos por el mapa!', '¡Que te vaya genial! Adiós. 👋']));
  }
  async function startTalk(v) {
    if (talker || !canShow()) return;
    talker = v; v.phase = 'talk'; v.hold = 0;
    const p = panel(); p.log.textContent = ''; p.chips.textContent = ''; p.who.textContent = `${v.c.flag} ${v.name} · ${v.c.country}`; p.el.classList.remove('hidden');
    const my = ++convToken;
    try { await conversation(v); }
    catch (e) { if (e !== ABORT) console.error('Visitantes:', e); }
    if (my !== convToken) return;   // la conversación se cerró desde fuera (endConv ya lo limpió todo)
    p.el.classList.add('hidden'); talker = null; release(v);
  }

  // ---------- Reloj de aparición ----------
  // Cada segundo: si el mapa está cerca sale el primero a los 6-14 s y después uno cada 35-80 s (hasta MAX a la vez); si no, se van todos.
  setInterval(() => {
    const show = canShow();
    if (!show) { if (vs.length) clearAll(); wasShown = false; return; }
    if (!wasShown) { wasShown = true; nextSpawn = rnd(6, 14); }
    nextSpawn -= 1;
    if (nextSpawn <= 0) {
      if (vs.length < Math.max(1, pcap(MAX, 1))) { try { spawn(); } catch (e) { console.error('Visitantes:', e); } }
      nextSpawn = rnd(35, 80);
    }
  }, 1000);

  map.on('zoomend', () => { if (map.getZoom() < MIN_ZOOM) clearAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && talker) endConv(); });
  if (window.soundPrefs) window.soundPrefs.onChange((c, val) => { if (c === 'visitantes' && !val) clearAll(); });
  window.addEventListener('perfchange', () => { const c = Math.max(1, pcap(MAX, 1)); while (vs.length > c) removeV(vs[vs.length - 1]); });

  // Consola: Visitantes.spawn() saca uno ahora; Visitantes.on(false) los apaga
  window.Visitantes = {
    spawn: () => { if (!canShow()) return 'Acércate al mapa (zoom ≥ ' + MIN_ZOOM + ')'; const v = spawn(); return v.name + ' (' + v.c.country + ')'; },
    on: val => { try { window.soundPrefs.set('visitantes', !!val); } catch (e) {} if (!val) clearAll(); },
    list: () => vs.map(v => ({ nombre: v.name, pais: v.c.country, plan: v.plan.map(s => s.k).join('>') })),
    countries: () => C.length,
    talk: i => { const v = vs[i]; if (v) startTalk(v); return !!v; },   // empieza a hablar con el visitante nº i (pruebas)
    _intent: intentOf, _country: countryIn, _data: C   // para las pruebas (visitantes.test.js)
  };
})();
