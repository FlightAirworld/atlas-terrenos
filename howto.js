'use strict';
// "Cómo jugar" / "How to play": ventana de ayuda (botón 📖 dentro de Extras y enlace en la portada).
// Idiomas: los mismos 12 que tiene el juego (es, en, pt, fr, de, it, ar, zh, ru, ja, ko, tr).
// Para añadir otro idioma: copia un bloque de T, tradúcelo y añade su código a ORDER. El árabe se pinta de derecha a izquierda (RTL).
(function () {
  const btn = document.getElementById('howto-btn');
  const st = document.createElement('style');
  st.textContent = `
    #howto { z-index: 5300; }
    #howto .modal-card { max-height: min(86vh, 640px); overflow-y: auto; }
    #howto h3 { margin: 16px 0 4px; font-size: 16px; }
    #howto p, #howto li { font-size: 14px; line-height: 1.45; margin: 4px 0; }
    #howto ul { padding-left: 20px; margin: 4px 0; }
    #howto [dir="rtl"] ul { padding-left: 0; padding-right: 20px; }
    #howto .tip { background: rgba(8,127,91,.12); border-radius: 10px; padding: 8px 10px; margin: 10px 0; }
    #howto .langs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; padding-right: 34px; }
    #howto .langs button { border: 1px solid #087f5b; background: transparent; color: inherit; border-radius: 99px; padding: 4px 12px; font-size: 13px; font-weight: 700; cursor: pointer; }
    #howto .langs button.on { background: #087f5b; color: #fff; }`;
  document.head.appendChild(st);

  // Cada idioma: título, textos de los botones, introducción (opcional), 5 secciones (h = títulos, s1..s4 = listas, life = párrafo), consejo y aviso.
  const T = {
    es: {
      name: 'Español', title: '📖 Cómo jugar', close: 'Cerrar', ok: '¡A jugar!',
      h: ['1. Reclama tu primer terreno', '2. Consigue créditos 🎟️', '3. Produce y mejora', '4. Compite y habla', '5. Un mapa con vida'],
      s1: ['Mueve y acerca el mapa (📍 te lleva a tu ubicación y 🔍 busca cualquier lugar).', 'Toca una parcela libre y pulsa <b>Reclamar este terreno</b>. Cuesta créditos 🎟️.', 'Elige la casa que quieras al reclamarla (es gratis). Cada parcela es única: <b>una vez comprada, nadie más puede quitártela ni comprarla</b>.', 'Para guardar tus terrenos y tu racha, entra con tu cuenta (Google o email).'],
      s2: ['<b>🎁 Regalo diario:</b> entra cada día. Cuantos más días seguidos, más premio; el día 7 es el grande y luego la racha vuelve a empezar.', '<b>🎡 Ruleta diaria:</b> un giro gratis al día (hay que haber iniciado sesión).', '<b>👫 Invita y gana:</b> comparte tu enlace; tú y tu amigo recibís créditos.', '<b>Producción:</b> cada terreno genera créditos solo, hora a hora.', '<b>Comprar créditos</b> (🎟️ en tu píldora de arriba) con tarjeta, Google Pay o PayPal.'],
      s3: ['Abre <b>🏠 Mis terrenos</b> y pulsa <b>Recoger créditos</b>. Se acumulan hasta un máximo de horas sin recoger (por defecto 24), así que pasa a recogerlos al menos una vez al día.', 'Toca uno de tus terrenos para <b>subirlo de nivel</b>: produce más y la casa crece y gana estrellas ⭐.', 'También puedes <b>cambiar la casa</b> cuando quieras (cuesta 1 crédito por defecto).'],
      s4: ['<b>🏆 Ranking:</b> mira quién tiene más terrenos.', '<b>💬 Chat</b> de la zona donde estás mirando.', 'El contador <b>en línea</b> muestra los jugadores conectados.', '<b>🔔 Avisos</b> te mandan avisos al móvil, si los activas.'],
      life: 'Acércate a las calles y verás coches, peatones, trenes, aviones, helicópteros, semáforos, animales y lluvia. Con el botón <b>🏙️ Vida urbana</b> del menú activas además obras, bodas, desfiles, humo, colas en las tiendas y más. Si tu móvil va justo, apágalo desde ahí o desde los botones del menú.',
      tip: '<b>Consejos:</b> entra cada día (regalo + ruleta), recoge tus créditos antes de dormir, compra terrenos en lugares con significado para ti (tu calle, tu pueblo) y sube de nivel los que ya tienes antes de comprar muchos nuevos.',
      note: 'Los terrenos son objetos virtuales: no dan ningún derecho sobre el suelo real. Las cifras exactas (precios, producción, premios) pueden cambiar; fíjate en lo que muestra el juego.'
    },
    en: {
      name: 'English', title: '📖 How to play', close: 'Close', ok: "Let's play!",
      intro: '<b>Redecora El Mundo</b> ("Redecorate the World") is a map of the planet divided into virtual plots of about 111 m. Claim the ones you like, put your name and a house on them, and let them earn credits so you can get more.',
      h: ['1. Claim your first plot', '2. Earn credits 🎟️', '3. Produce and upgrade', '4. Compete and chat', '5. A living map'],
      s1: ['Move and zoom the map (📍 takes you to your location and 🔍 searches any place).', 'Tap a free plot and press <b>Reclamar este terreno</b> (Claim this plot). It costs credits 🎟️.', "Pick the house you want when you claim it (it's free). Every plot is unique: <b>once bought, nobody else can take it or buy it</b>.", 'To save your plots and your streak, sign in with your account (Google or email).'],
      s2: ['<b>🎁 Daily gift:</b> come back every day. The more days in a row, the bigger the prize; day 7 is the big one, then the streak starts over.', '<b>🎡 Daily wheel:</b> one free spin per day (you need to be signed in).', '<b>👫 Invite and earn:</b> share your link; you and your friend both get credits.', '<b>Production:</b> each plot earns credits by itself, hour by hour.', '<b>Buy credits</b> (🎟️ in the pill at the top) with card, Google Pay or PayPal.'],
      s3: ['Open <b>🏠 Mis terrenos</b> (My plots) and press <b>Recoger créditos</b> (Collect credits). They pile up to a maximum number of hours (24 by default), so collect at least once a day.', 'Tap one of your plots to <b>level it up</b>: it earns more, and the house grows and gets stars ⭐.', 'You can also <b>change the house</b> any time (costs 1 credit by default).'],
      s4: ['<b>🏆 Ranking:</b> see who owns the most plots.', "<b>💬 Chat</b> for the area you're looking at.", 'The <b>online</b> counter shows how many players are connected.', '<b>🔔 Alerts</b> send notifications to your phone, if you turn them on.'],
      life: "Zoom in to the streets and you'll see cars, pedestrians, trains, planes, helicopters, traffic lights, animals and rain. The <b>🏙️ Vida urbana</b> (City life) button in the menu adds roadworks, weddings, parades, smoke, shop queues and more. If your phone struggles, turn it off there.",
      tip: '<b>Tips:</b> log in every day (gift + wheel), collect your credits before bed, buy plots in places that mean something to you (your street, your town), and level up the ones you own before buying lots of new ones.',
      note: 'Plots are virtual items: they give no rights over the real land. Exact figures (prices, production, prizes) may change; trust what the game shows.'
    },
    pt: {
      name: 'Português', title: '📖 Como jogar', close: 'Fechar', ok: 'Vamos jogar!',
      intro: '<b>Redecora El Mundo</b> ("Redecore o Mundo") é um mapa do planeta dividido em terrenos virtuais de cerca de 111 m. Reivindique os que você gostar, coloque seu nome e uma casa neles e deixe que gerem créditos para você conseguir mais.',
      h: ['1. Reivindique seu primeiro terreno', '2. Ganhe créditos 🎟️', '3. Produza e melhore', '4. Compita e converse', '5. Um mapa com vida'],
      s1: ['Mova e aproxime o mapa (📍 leva você à sua localização e 🔍 procura qualquer lugar).', 'Toque em um terreno livre e pressione <b>Reivindicar este terreno</b>. Custa créditos 🎟️.', 'Escolha a casa que quiser ao reivindicá-lo (é grátis). Cada terreno é único: <b>depois de comprado, ninguém mais pode tirá-lo de você nem comprá-lo</b>.', 'Para guardar seus terrenos e sua sequência, entre com sua conta (Google ou e-mail).'],
      s2: ['<b>🎁 Presente diário:</b> volte todos os dias. Quanto mais dias seguidos, maior o prêmio; o dia 7 é o grande e depois a sequência recomeça.', '<b>🎡 Roleta diária:</b> um giro grátis por dia (é preciso ter feito login).', '<b>👫 Convide e ganhe:</b> compartilhe seu link; você e seu amigo recebem créditos.', '<b>Produção:</b> cada terreno gera créditos sozinho, hora a hora.', '<b>Compre créditos</b> (🎟️ na pílula do topo) com cartão, Google Pay ou PayPal.'],
      s3: ['Abra <b>🏠 Meus terrenos</b> e pressione <b>Coletar créditos</b>. Eles se acumulam até um máximo de horas sem coletar (24 por padrão), então passe para coletá-los pelo menos uma vez por dia.', 'Toque em um dos seus terrenos para <b>subi-lo de nível</b>: produz mais e a casa cresce e ganha estrelas ⭐.', 'Você também pode <b>trocar a casa</b> quando quiser (custa 1 crédito por padrão).'],
      s4: ['<b>🏆 Ranking:</b> veja quem tem mais terrenos.', '<b>💬 Chat</b> da zona que você está olhando.', 'O contador <b>online</b> mostra os jogadores conectados.', '<b>🔔 Avisos</b> enviam notificações ao seu celular, se você os ativar.'],
      life: 'Aproxime-se das ruas e você verá carros, pedestres, trens, aviões, helicópteros, semáforos, animais e chuva. O botão <b>🏙️ Vida urbana</b> do menu ativa também obras, casamentos, desfiles, fumaça, filas nas lojas e mais. Se o seu celular estiver no limite, desligue por lá.',
      tip: '<b>Dicas:</b> entre todos os dias (presente + roleta), colete seus créditos antes de dormir, compre terrenos em lugares que tenham significado para você (sua rua, sua cidade) e suba de nível os que já tem antes de comprar muitos novos.',
      note: 'Os terrenos são itens virtuais: não dão nenhum direito sobre o solo real. Os valores exatos (preços, produção, prêmios) podem mudar; confie no que o jogo mostrar.'
    },
    fr: {
      name: 'Français', title: '📖 Comment jouer', close: 'Fermer', ok: 'On joue !',
      intro: '<b>Redecora El Mundo</b> (« Redécorer le monde ») est une carte de la planète divisée en terrains virtuels d’environ 111 m. Revendiquez ceux que vous aimez, mettez-y votre nom et une maison, et laissez-les gagner des crédits pour en obtenir d’autres.',
      h: ['1. Revendiquez votre premier terrain', '2. Gagnez des crédits 🎟️', '3. Produisez et améliorez', '4. Rivalisez et discutez', '5. Une carte vivante'],
      s1: ['Déplacez et zoomez la carte (📍 vous emmène à votre position et 🔍 cherche n’importe quel lieu).', 'Touchez un terrain libre et appuyez sur <b>Revendiquer ce terrain</b>. Cela coûte des crédits 🎟️.', 'Choisissez la maison de votre choix en le revendiquant (c’est gratuit). Chaque terrain est unique : <b>une fois acheté, personne d’autre ne peut vous le prendre ni l’acheter</b>.', 'Pour sauvegarder vos terrains et votre série, connectez-vous avec votre compte (Google ou e-mail).'],
      s2: ['<b>🎁 Cadeau quotidien :</b> revenez chaque jour. Plus vous enchaînez de jours, plus le cadeau est gros ; le 7e jour est le grand, puis la série repart de zéro.', '<b>🎡 Roue quotidienne :</b> un tour gratuit par jour (il faut être connecté).', '<b>👫 Invitez et gagnez :</b> partagez votre lien ; vous et votre ami recevez des crédits.', '<b>Production :</b> chaque terrain génère des crédits tout seul, heure après heure.', '<b>Achetez des crédits</b> (🎟️ dans la pastille en haut) par carte, Google Pay ou PayPal.'],
      s3: ['Ouvrez <b>🏠 Mes terrains</b> et appuyez sur <b>Récupérer les crédits</b>. Ils s’accumulent jusqu’à un nombre maximal d’heures sans récupération (24 par défaut), alors passez les récupérer au moins une fois par jour.', 'Touchez l’un de vos terrains pour le <b>faire monter de niveau</b> : il produit plus, et la maison grandit et gagne des étoiles ⭐.', 'Vous pouvez aussi <b>changer de maison</b> quand vous voulez (1 crédit par défaut).'],
      s4: ['<b>🏆 Classement :</b> voyez qui possède le plus de terrains.', '<b>💬 Chat</b> de la zone que vous regardez.', 'Le compteur <b>en ligne</b> indique combien de joueurs sont connectés.', '<b>🔔 Alertes</b> envoie des notifications sur votre téléphone, si vous les activez.'],
      life: 'Approchez-vous des rues et vous verrez des voitures, des piétons, des trains, des avions, des hélicoptères, des feux tricolores, des animaux et de la pluie. Le bouton <b>🏙️ Vie urbaine</b> du menu active en plus des chantiers, des mariages, des défilés, de la fumée, des files d’attente devant les magasins et plus encore. Si votre téléphone peine, désactivez-le depuis là.',
      tip: '<b>Conseils :</b> connectez-vous chaque jour (cadeau + roue), récupérez vos crédits avant de dormir, achetez des terrains dans des lieux qui comptent pour vous (votre rue, votre village) et faites monter de niveau ceux que vous avez avant d’en acheter beaucoup de nouveaux.',
      note: 'Les terrains sont des objets virtuels : ils ne donnent aucun droit sur le sol réel. Les chiffres exacts (prix, production, récompenses) peuvent changer ; fiez-vous à ce que montre le jeu.'
    },
    de: {
      name: 'Deutsch', title: '📖 Spielanleitung', close: 'Schließen', ok: 'Los geht’s!',
      intro: '<b>Redecora El Mundo</b> („Gestalte die Welt neu“) ist eine Karte des Planeten, aufgeteilt in virtuelle Grundstücke von etwa 111 m. Beanspruche die, die dir gefallen, setze deinen Namen und ein Haus darauf und lass sie Credits verdienen, damit du weitere bekommst.',
      h: ['1. Beanspruche dein erstes Grundstück', '2. Verdiene Credits 🎟️', '3. Produziere und verbessere', '4. Wetteifere und chatte', '5. Eine lebendige Karte'],
      s1: ['Bewege und zoome die Karte (📍 bringt dich zu deinem Standort und 🔍 sucht jeden Ort).', 'Tippe auf ein freies Grundstück und drücke <b>Dieses Grundstück beanspruchen</b>. Das kostet Credits 🎟️.', 'Wähle beim Beanspruchen das Haus, das du möchtest (es ist kostenlos). Jedes Grundstück ist einzigartig: <b>Einmal gekauft, kann es dir niemand mehr wegnehmen oder kaufen</b>.', 'Um deine Grundstücke und deine Serie zu speichern, melde dich mit deinem Konto an (Google oder E-Mail).'],
      s2: ['<b>🎁 Tägliches Geschenk:</b> komm jeden Tag wieder. Je mehr Tage in Folge, desto größer die Belohnung; Tag 7 ist der große, danach beginnt die Serie von vorn.', '<b>🎡 Tägliches Glücksrad:</b> ein kostenloser Dreh pro Tag (du musst angemeldet sein).', '<b>👫 Einladen und gewinnen:</b> teile deinen Link; du und dein Freund bekommt Credits.', '<b>Produktion:</b> jedes Grundstück verdient Credits von allein, Stunde für Stunde.', '<b>Credits kaufen</b> (🎟️ in der Anzeige oben) mit Karte, Google Pay oder PayPal.'],
      s3: ['Öffne <b>🏠 Meine Grundstücke</b> und drücke <b>Credits einsammeln</b>. Sie sammeln sich bis zu einer maximalen Zahl von Stunden an (standardmäßig 24), schau also mindestens einmal am Tag vorbei.', 'Tippe auf eines deiner Grundstücke, um es <b>aufzuwerten</b>: Es bringt mehr, und das Haus wächst und bekommt Sterne ⭐.', 'Du kannst auch jederzeit das <b>Haus wechseln</b> (kostet standardmäßig 1 Credit).'],
      s4: ['<b>🏆 Rangliste:</b> sieh, wer die meisten Grundstücke hat.', '<b>💬 Chat</b> für das Gebiet, das du dir ansiehst.', 'Der <b>Online</b>-Zähler zeigt, wie viele Spieler verbunden sind.', '<b>🔔 Hinweise</b> schicken Benachrichtigungen auf dein Handy, wenn du sie aktivierst.'],
      life: 'Zoome auf die Straßen und du siehst Autos, Fußgänger, Züge, Flugzeuge, Hubschrauber, Ampeln, Tiere und Regen. Mit der Schaltfläche <b>🏙️ Stadtleben</b> im Menü schaltest du zusätzlich Baustellen, Hochzeiten, Umzüge, Rauch, Schlangen vor Geschäften und mehr ein. Wenn dein Handy ins Schwitzen kommt, schalte es dort aus.',
      tip: '<b>Tipps:</b> Melde dich jeden Tag an (Geschenk + Glücksrad), sammle deine Credits vor dem Schlafengehen ein, kaufe Grundstücke an Orten, die dir etwas bedeuten (deine Straße, dein Ort), und werte die vorhandenen auf, bevor du viele neue kaufst.',
      note: 'Grundstücke sind virtuelle Objekte: Sie geben keinerlei Rechte am echten Boden. Die genauen Zahlen (Preise, Produktion, Gewinne) können sich ändern; verlass dich auf das, was das Spiel anzeigt.'
    },
    it: {
      name: 'Italiano', title: '📖 Come giocare', close: 'Chiudi', ok: 'Si gioca!',
      intro: '<b>Redecora El Mundo</b> («Ridecora il Mondo») è una mappa del pianeta divisa in terreni virtuali di circa 111 m. Rivendica quelli che ti piacciono, mettici il tuo nome e una casa, e lascia che guadagnino crediti per ottenerne altri.',
      h: ['1. Rivendica il tuo primo terreno', '2. Guadagna crediti 🎟️', '3. Produci e migliora', '4. Competi e chatta', '5. Una mappa viva'],
      s1: ['Sposta e ingrandisci la mappa (📍 ti porta alla tua posizione e 🔍 cerca qualsiasi luogo).', 'Tocca un terreno libero e premi <b>Rivendica questo terreno</b>. Costa crediti 🎟️.', 'Scegli la casa che vuoi quando lo rivendichi (è gratis). Ogni terreno è unico: <b>una volta acquistato, nessun altro può portartelo via né comprarlo</b>.', 'Per salvare i tuoi terreni e la tua serie, accedi con il tuo account (Google o email).'],
      s2: ['<b>🎁 Regalo giornaliero:</b> torna ogni giorno. Più giorni di fila, più grande il premio; il 7º giorno è quello grosso, poi la serie ricomincia.', '<b>🎡 Ruota giornaliera:</b> un giro gratis al giorno (devi aver effettuato l’accesso).', '<b>👫 Invita e vinci:</b> condividi il tuo link; tu e il tuo amico ricevete crediti.', '<b>Produzione:</b> ogni terreno genera crediti da solo, ora dopo ora.', '<b>Compra crediti</b> (🎟️ nella pillola in alto) con carta, Google Pay o PayPal.'],
      s3: ['Apri <b>🏠 I miei terreni</b> e premi <b>Raccogli crediti</b>. Si accumulano fino a un massimo di ore senza raccogliere (24 per impostazione predefinita), quindi passa a raccoglierli almeno una volta al giorno.', 'Tocca uno dei tuoi terreni per <b>farlo salire di livello</b>: produce di più e la casa cresce e ottiene stelle ⭐.', 'Puoi anche <b>cambiare la casa</b> quando vuoi (costa 1 credito per impostazione predefinita).'],
      s4: ['<b>🏆 Classifica:</b> guarda chi ha più terreni.', '<b>💬 Chat</b> della zona che stai guardando.', 'Il contatore <b>online</b> mostra quanti giocatori sono connessi.', '<b>🔔 Avvisi</b> inviano notifiche al tuo telefono, se li attivi.'],
      life: 'Avvicinati alle strade e vedrai auto, pedoni, treni, aerei, elicotteri, semafori, animali e pioggia. Il pulsante <b>🏙️ Vita urbana</b> del menu attiva anche cantieri, matrimoni, sfilate, fumo, code nei negozi e altro. Se il telefono fa fatica, disattivalo da lì.',
      tip: '<b>Consigli:</b> accedi ogni giorno (regalo + ruota), raccogli i tuoi crediti prima di dormire, compra terreni in luoghi che significano qualcosa per te (la tua via, il tuo paese) e fai salire di livello quelli che hai già prima di comprarne tanti nuovi.',
      note: 'I terreni sono oggetti virtuali: non danno alcun diritto sul suolo reale. Le cifre esatte (prezzi, produzione, premi) possono cambiare; fidati di ciò che mostra il gioco.'
    },
    ar: {
      name: 'العربية', rtl: true, title: '📖 كيف تلعب', close: 'إغلاق', ok: 'هيا نلعب!',
      intro: '<b>Redecora El Mundo</b> («أعد تزيين العالم») هي خريطة للكوكب مقسّمة إلى أراضٍ افتراضية مساحة الواحدة نحو 111 م. استحوذ على ما يعجبك منها، وضع عليها اسمك ومنزلاً، ودعها تكسب لك رصيدًا لتحصل على المزيد.',
      h: ['1. استحوذ على أول أرض لك', '2. اكسب الرصيد 🎟️', '3. أنتج وطوّر', '4. نافس وتحدّث', '5. خريطة نابضة بالحياة'],
      s1: ['حرّك الخريطة وقرّبها (📍 يأخذك إلى موقعك و🔍 يبحث عن أي مكان).', 'اضغط على أرض متاحة ثم اضغط <b>استحوذ على هذه الأرض</b>. يكلّف ذلك رصيدًا 🎟️.', 'اختر المنزل الذي تريده عند الاستحواذ (مجانًا). كل أرض فريدة: <b>بمجرد شرائها لا يستطيع أحد غيرك أخذها أو شراءها</b>.', 'لحفظ أراضيك وسلسلة أيامك، سجّل الدخول بحسابك (Google أو البريد الإلكتروني).'],
      s2: ['<b>🎁 الهدية اليومية:</b> عُد كل يوم. كلما زادت الأيام المتتالية زادت الجائزة؛ اليوم السابع هو الأكبر ثم تبدأ السلسلة من جديد.', '<b>🎡 عجلة الحظ اليومية:</b> دورة مجانية واحدة يوميًا (يجب تسجيل الدخول).', '<b>👫 ادعُ واربح:</b> شارك رابطك؛ تحصل أنت وصديقك على رصيد.', '<b>الإنتاج:</b> كل أرض تكسب رصيدًا تلقائيًا، ساعة بعد ساعة.', '<b>اشترِ رصيدًا</b> (🎟️ في الشريط العلوي) بالبطاقة أو Google Pay أو PayPal.'],
      s3: ['افتح <b>🏠 أراضيّ</b> واضغط <b>اجمع الرصيد</b>. يتراكم الرصيد حتى حدّ أقصى من الساعات دون جمع (24 افتراضيًا)، فمرّ لجمعه مرة واحدة على الأقل يوميًا.', 'اضغط على إحدى أراضيك <b>لرفع مستواها</b>: تنتج أكثر ويكبر المنزل ويحصل على نجوم ⭐.', 'يمكنك أيضًا <b>تغيير المنزل</b> متى شئت (يكلّف رصيدًا واحدًا افتراضيًا).'],
      s4: ['<b>🏆 الترتيب:</b> تعرّف على من يملك أكثر الأراضي.', '<b>💬 الدردشة</b> للمنطقة التي تتصفحها.', 'يعرض عدّاد <b>المتصلين</b> عدد اللاعبين المتصلين الآن.', '<b>🔔 التنبيهات</b> ترسل إشعارات إلى هاتفك إن فعّلتها.'],
      life: 'اقترب من الشوارع وسترى سيارات ومشاة وقطارات وطائرات ومروحيات وإشارات مرور وحيوانات ومطرًا. زر <b>🏙️ حياة المدينة</b> في القائمة يضيف أيضًا أعمال البناء وحفلات الزفاف والاستعراضات والدخان وطوابير المتاجر وغيرها. إذا كان هاتفك بطيئًا، أوقفه من هناك.',
      tip: '<b>نصائح:</b> سجّل الدخول كل يوم (الهدية + العجلة)، واجمع رصيدك قبل النوم، واشترِ أراضي في أماكن لها معنى بالنسبة لك (شارعك، بلدتك)، وارفع مستوى ما تملكه قبل شراء الكثير من الجديد.',
      note: 'الأراضي عناصر افتراضية: لا تمنح أي حق على الأرض الحقيقية. قد تتغير الأرقام الدقيقة (الأسعار والإنتاج والجوائز)؛ اعتمد على ما تعرضه اللعبة.'
    },
    zh: {
      name: '中文', title: '📖 玩法说明', close: '关闭', ok: '开始游戏！',
      intro: '<b>Redecora El Mundo</b>（“重新装饰世界”）是一张把地球划分成约 111 米见方虚拟地块的地图。认领你喜欢的地块，写上你的名字、盖上一栋房子，让它们赚取点数，好让你认领更多。',
      h: ['1. 认领你的第一块地', '2. 赚取点数 🎟️', '3. 产出与升级', '4. 竞争与聊天', '5. 一张有生命的地图'],
      s1: ['移动并缩放地图（📍 带你回到所在位置，🔍 可搜索任何地点）。', '点按一块空闲地块，然后按<b>认领这块地</b>。需要消耗点数 🎟️。', '认领时可选择你想要的房子（免费）。每块地都是独一无二的：<b>一旦买下，别人既不能夺走也不能再买</b>。', '要保存你的地块和连续签到记录，请用账号登录（Google 或邮箱）。'],
      s2: ['<b>🎁 每日礼物：</b>每天回来。连续天数越多，奖励越大；第 7 天是大奖，之后连续记录重新开始。', '<b>🎡 每日转盘：</b>每天一次免费转动（需要登录）。', '<b>👫 邀请有奖：</b>分享你的链接；你和朋友都能获得点数。', '<b>产出：</b>每块地会自动赚取点数，一小时接一小时。', '<b>购买点数</b>（顶部胶囊里的 🎟️），支持银行卡、Google Pay 或 PayPal。'],
      s3: ['打开<b>🏠 我的地块</b>，按<b>领取点数</b>。点数最多累积到一定小时数（默认 24 小时），所以请至少每天领取一次。', '点按你的一块地来<b>升级</b>：产出更多，房子会长大并获得星星 ⭐。', '你也可以随时<b>更换房子</b>（默认花费 1 点数）。'],
      s4: ['<b>🏆 排行榜：</b>看看谁拥有最多地块。', '<b>💬 聊天：</b>你正在查看的区域的聊天室。', '<b>在线</b>计数器显示当前连线的玩家数。', '<b>🔔 通知</b>会向你的手机发送提醒（需你开启）。'],
      life: '放大到街道，你会看到汽车、行人、火车、飞机、直升机、红绿灯、动物和下雨。菜单里的<b>🏙️ 城市生活</b>按钮还会开启施工、婚礼、游行、烟雾、商店排队等更多内容。如果你的手机吃力，可以在那里关闭。',
      tip: '<b>小贴士：</b>每天登录（礼物 + 转盘），睡前领取点数，在对你有意义的地方买地（你的街道、你的家乡），并在购买大量新地之前先给已有的地块升级。',
      note: '地块是虚拟物品：不赋予任何对真实土地的权利。具体数字（价格、产出、奖励）可能变化，请以游戏中显示为准。'
    },
    ru: {
      name: 'Русский', title: '📖 Как играть', close: 'Закрыть', ok: 'Играем!',
      intro: '<b>Redecora El Mundo</b> («Переоформи мир») — карта планеты, разделённая на виртуальные участки примерно по 111 м. Занимайте те, что вам нравятся, ставьте на них своё имя и дом, и пусть они приносят кредиты, чтобы вы могли получить ещё.',
      h: ['1. Займите свой первый участок', '2. Зарабатывайте кредиты 🎟️', '3. Производите и улучшайте', '4. Соревнуйтесь и общайтесь', '5. Живая карта'],
      s1: ['Перемещайте и масштабируйте карту (📍 переносит вас к вашему местоположению, а 🔍 ищет любое место).', 'Нажмите на свободный участок и выберите <b>Занять этот участок</b>. Это стоит кредитов 🎟️.', 'Выберите дом, который вам нравится, при занятии (это бесплатно). Каждый участок уникален: <b>после покупки никто другой не сможет его отобрать или купить</b>.', 'Чтобы сохранить участки и серию дней, войдите в аккаунт (Google или email).'],
      s2: ['<b>🎁 Ежедневный подарок:</b> заходите каждый день. Чем больше дней подряд, тем больше награда; 7-й день — самый крупный, затем серия начинается заново.', '<b>🎡 Ежедневная рулетка:</b> одно бесплатное вращение в день (нужно войти в аккаунт).', '<b>👫 Приглашайте и зарабатывайте:</b> поделитесь ссылкой; вы и ваш друг получите кредиты.', '<b>Производство:</b> каждый участок сам приносит кредиты, час за часом.', '<b>Покупайте кредиты</b> (🎟️ в плашке вверху) картой, через Google Pay или PayPal.'],
      s3: ['Откройте <b>🏠 Мои участки</b> и нажмите <b>Собрать кредиты</b>. Они копятся до максимального числа часов без сбора (по умолчанию 24), поэтому заглядывайте за ними хотя бы раз в день.', 'Нажмите на один из своих участков, чтобы <b>повысить его уровень</b>: он приносит больше, а дом растёт и получает звёзды ⭐.', 'Также можно в любой момент <b>сменить дом</b> (по умолчанию стоит 1 кредит).'],
      s4: ['<b>🏆 Рейтинг:</b> смотрите, у кого больше всего участков.', '<b>💬 Чат</b> области, которую вы просматриваете.', 'Счётчик <b>онлайн</b> показывает, сколько игроков подключено.', '<b>🔔 Уведомления</b> присылают оповещения на телефон, если вы их включите.'],
      life: 'Приблизьтесь к улицам — и увидите машины, пешеходов, поезда, самолёты, вертолёты, светофоры, животных и дождь. Кнопка <b>🏙️ Городская жизнь</b> в меню добавляет стройки, свадьбы, парады, дым, очереди в магазинах и многое другое. Если телефон не справляется, отключите её там.',
      tip: '<b>Советы:</b> заходите каждый день (подарок + рулетка), собирайте кредиты перед сном, покупайте участки в значимых для вас местах (ваша улица, ваш город) и повышайте уровень уже имеющихся, прежде чем покупать много новых.',
      note: 'Участки — виртуальные предметы: они не дают никаких прав на настоящую землю. Точные цифры (цены, производство, призы) могут меняться; ориентируйтесь на то, что показывает игра.'
    },
    ja: {
      name: '日本語', title: '📖 遊び方', close: '閉じる', ok: 'さあ、始めよう！',
      intro: '<b>Redecora El Mundo</b>（「世界を飾り直そう」）は、地球を約111 m四方の仮想の区画に分けた地図です。気に入った区画を手に入れ、名前と家を置いて、クレジットを稼がせ、さらに区画を増やしましょう。',
      h: ['1. 最初の区画を手に入れよう', '2. クレジットを稼ごう 🎟️', '3. 生産してレベルアップ', '4. 競って、おしゃべり', '5. 生きている地図'],
      s1: ['地図を動かしてズームします（📍 で現在地へ、🔍 で好きな場所を検索）。', '空いている区画をタップして <b>この区画を手に入れる</b> を押します。クレジット 🎟️ が必要です。', '手に入れるときに好きな家を選べます（無料）。区画はどれも唯一無二：<b>一度買うと、他の人が奪うことも買うこともできません</b>。', '区画と連続記録を保存するには、アカウント（Googleまたはメール）でログインしてください。'],
      s2: ['<b>🎁 毎日のプレゼント：</b>毎日戻ってきましょう。連続日数が多いほど賞品が豪華に。7日目が大きな賞品で、その後は連続記録がリセットされます。', '<b>🎡 毎日のルーレット：</b>1日1回無料で回せます（ログインが必要）。', '<b>👫 招待して稼ぐ：</b>リンクを共有すると、あなたも友達もクレジットがもらえます。', '<b>生産：</b>各区画が自動で1時間ごとにクレジットを生み出します。', '<b>クレジットを購入</b>（上部の 🎟️）：カード、Google Pay、PayPalに対応。'],
      s3: ['<b>🏠 マイ区画</b> を開いて <b>クレジットを集める</b> を押します。集めずに貯められるのは最大時間まで（初期設定は24時間）なので、1日に最低1回は集めに来てください。', '自分の区画をタップして<b>レベルアップ</b>：生産量が増え、家が大きくなって星 ⭐ がつきます。', '家はいつでも<b>変更</b>できます（初期設定では1クレジット）。'],
      s4: ['<b>🏆 ランキング：</b>誰が一番区画を持っているか見られます。', '<b>💬 チャット：</b>見ているエリアのチャットです。', '<b>オンライン</b>カウンターは接続中のプレイヤー数を表示します。', '<b>🔔 通知</b>をオンにすると、スマホに通知が届きます。'],
      life: '道路までズームすると、車、歩行者、電車、飛行機、ヘリコプター、信号、動物、雨が見えます。メニューの <b>🏙️ 街のにぎわい</b> ボタンをオンにすると、工事、結婚式、パレード、煙、お店の行列などもさらに加わります。スマホが重いときは、そこでオフにしてください。',
      tip: '<b>ヒント：</b>毎日ログインして（プレゼント＋ルーレット）、寝る前にクレジットを集め、思い入れのある場所（自分の通り、地元）の区画を買い、新しい区画をたくさん買う前に今ある区画をレベルアップしましょう。',
      note: '区画は仮想のアイテムであり、実際の土地に対する権利は一切ありません。正確な数値（価格、生産量、賞品）は変更されることがあります。ゲーム内の表示をご確認ください。'
    },
    ko: {
      name: '한국어', title: '📖 게임 방법', close: '닫기', ok: '게임 시작!',
      intro: '<b>Redecora El Mundo</b>(“세상을 다시 꾸미자”)는 지구를 약 111m 크기의 가상 부지로 나눈 지도입니다. 마음에 드는 부지를 차지하고, 이름과 집을 올린 뒤, 크레딧을 벌게 해서 더 많은 부지를 얻어 보세요.',
      h: ['1. 첫 번째 부지 차지하기', '2. 크레딧 벌기 🎟️', '3. 생산하고 업그레이드', '4. 경쟁하고 대화하기', '5. 살아 있는 지도'],
      s1: ['지도를 움직이고 확대하세요(📍는 내 위치로, 🔍는 원하는 장소를 검색합니다).', '빈 부지를 탭하고 <b>이 부지 차지하기</b>를 누르세요. 크레딧 🎟️이 필요합니다.', '차지할 때 원하는 집을 고르세요(무료). 모든 부지는 유일합니다: <b>한 번 구매하면 다른 사람이 빼앗거나 살 수 없습니다</b>.', '부지와 연속 기록을 저장하려면 계정(Google 또는 이메일)으로 로그인하세요.'],
      s2: ['<b>🎁 일일 선물:</b> 매일 들어오세요. 연속 일수가 많을수록 보상이 커지고, 7일째가 가장 크며 그 후 연속 기록이 다시 시작됩니다.', '<b>🎡 일일 룰렛:</b> 하루 한 번 무료 회전(로그인 필요).', '<b>👫 초대하고 보상받기:</b> 링크를 공유하면 나와 친구 모두 크레딧을 받습니다.', '<b>생산:</b> 각 부지가 한 시간마다 저절로 크레딧을 벌어 줍니다.', '<b>크레딧 구매</b>(상단 알약의 🎟️): 카드, Google Pay, PayPal.'],
      s3: ['<b>🏠 내 부지</b>를 열고 <b>크레딧 모으기</b>를 누르세요. 모으지 않아도 최대 시간(기본 24시간)까지만 쌓이니, 하루에 최소 한 번은 들러서 모으세요.', '내 부지를 탭해서 <b>레벨업</b>하세요. 더 많이 생산하고, 집이 커지며 별 ⭐을 얻습니다.', '언제든지 <b>집을 바꿀</b> 수도 있습니다(기본 1크레딧).'],
      s4: ['<b>🏆 랭킹:</b> 누가 가장 많은 부지를 가졌는지 확인하세요.', '<b>💬 채팅:</b> 보고 있는 지역의 채팅입니다.', '<b>온라인</b> 카운터는 접속 중인 플레이어 수를 보여 줍니다.', '<b>🔔 알림</b>을 켜면 휴대폰으로 알림을 보냅니다.'],
      life: '거리까지 확대하면 자동차, 보행자, 기차, 비행기, 헬리콥터, 신호등, 동물, 비를 볼 수 있습니다. 메뉴의 <b>🏙️ 도시 생활</b> 버튼을 켜면 공사, 결혼식, 퍼레이드, 연기, 가게 앞 줄 등이 추가됩니다. 휴대폰이 버거우면 그곳에서 끄세요.',
      tip: '<b>팁:</b> 매일 접속하고(선물 + 룰렛), 자기 전에 크레딧을 모으고, 의미 있는 장소(우리 동네, 고향)의 부지를 사고, 새 부지를 많이 사기 전에 가진 부지부터 레벨업하세요.',
      note: '부지는 가상의 아이템이며 실제 토지에 대한 어떤 권리도 부여하지 않습니다. 정확한 수치(가격, 생산량, 상금)는 바뀔 수 있으니 게임에 표시되는 내용을 따르세요.'
    },
    tr: {
      name: 'Türkçe', title: '📖 Nasıl oynanır', close: 'Kapat', ok: 'Oynayalım!',
      intro: '<b>Redecora El Mundo</b> (“Dünyayı Yeniden Dekore Et”), gezegenin yaklaşık 111 m’lik sanal arsalara bölündüğü bir haritadır. Beğendiklerini sahiplen, üzerine adını ve bir ev koy, daha fazlasını alabilmen için kredi kazanmalarını sağla.',
      h: ['1. İlk arsanı sahiplen', '2. Kredi kazan 🎟️', '3. Üret ve geliştir', '4. Yarış ve sohbet et', '5. Yaşayan bir harita'],
      s1: ['Haritayı kaydır ve yakınlaştır (📍 seni konumuna götürür, 🔍 herhangi bir yeri arar).', 'Boş bir arsaya dokun ve <b>Bu arsayı sahiplen</b>’e bas. Kredi 🎟️ harcar.', 'Sahiplenirken istediğin evi seç (ücretsizdir). Her arsa benzersizdir: <b>bir kez satın alındığında kimse onu senden alamaz ya da satın alamaz</b>.', 'Arsalarını ve serini kaydetmek için hesabınla giriş yap (Google veya e-posta).'],
      s2: ['<b>🎁 Günlük hediye:</b> her gün geri gel. Üst üste ne kadar çok gün gelirsen ödül o kadar büyür; 7. gün en büyüğüdür, sonra seri yeniden başlar.', '<b>🎡 Günlük çark:</b> günde bir ücretsiz çevirme (giriş yapmış olmalısın).', '<b>👫 Davet et, kazan:</b> bağlantını paylaş; sen ve arkadaşın kredi kazanırsınız.', '<b>Üretim:</b> her arsa saat saat kendiliğinden kredi kazanır.', '<b>Kredi satın al</b> (üstteki hapta 🎟️) kart, Google Pay veya PayPal ile.'],
      s3: ['<b>🏠 Arsalarım</b>’ı aç ve <b>Kredileri topla</b>’ya bas. Toplanmadan en fazla belirli bir saate kadar birikir (varsayılan 24), bu yüzden günde en az bir kez uğrayıp topla.', 'Arsalarından birine dokunarak <b>seviye atlat</b>: daha çok üretir, ev büyür ve yıldız ⭐ kazanır.', 'İstediğin zaman <b>evi değiştirebilirsin</b> (varsayılan olarak 1 kredi).'],
      s4: ['<b>🏆 Sıralama:</b> en çok arsaya kimin sahip olduğunu gör.', '<b>💬 Sohbet:</b> baktığın bölgenin sohbeti.', '<b>Çevrimiçi</b> sayacı kaç oyuncunun bağlı olduğunu gösterir.', '<b>🔔 Bildirimler</b>, açarsan telefonuna bildirim gönderir.'],
      life: 'Sokaklara yakınlaştığında arabalar, yayalar, trenler, uçaklar, helikopterler, trafik ışıkları, hayvanlar ve yağmur göreceksin. Menüdeki <b>🏙️ Şehir hayatı</b> düğmesi ayrıca inşaatları, düğünleri, geçit törenlerini, dumanı, mağaza kuyruklarını ve daha fazlasını açar. Telefonun zorlanıyorsa oradan kapat.',
      tip: '<b>İpuçları:</b> her gün giriş yap (hediye + çark), uyumadan önce kredilerini topla, senin için anlamlı yerlerden arsa al (sokağın, memleketin) ve çok sayıda yeni arsa almadan önce sahip olduklarını geliştir.',
      note: 'Arsalar sanal öğelerdir: gerçek arazi üzerinde hiçbir hak vermez. Kesin rakamlar (fiyatlar, üretim, ödüller) değişebilir; oyunun gösterdiğine güven.'
    }
  };
  const ORDER = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ar', 'zh', 'ru', 'ja', 'ko', 'tr'];

  const section = (h, items) => `<h3>${h}</h3><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
  function bodyHtml(t) {
    return (t.intro ? `<p>${t.intro}</p>` : '')
      + section(t.h[0], t.s1) + section(t.h[1], t.s2) + section(t.h[2], t.s3) + section(t.h[3], t.s4)
      + `<h3>${t.h[4]}</h3><p>${t.life}</p>`;
  }
  const tipHtml = t => `<div class="tip">${t.tip}</div><p class="muted" style="font-size:12px">${t.note}</p>`;

  // Idioma inicial: el que eligió en esta ventana → el del juego (Menú → Idioma) → el del navegador → inglés
  function pickLang() {
    let s = null;
    try { s = localStorage.getItem('howtoLang'); } catch (e) {}
    if (s && T[s]) return s;
    try { const g = window.i18n && window.i18n.lang; if (g && T[g]) return g; } catch (e) {}
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (const l of list) { const c = String(l).toLowerCase().slice(0, 2); if (T[c]) return c; }
    return 'en';
  }
  let lang = pickLang();

  const box = document.createElement('div');
  box.id = 'howto'; box.className = 'modal hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'howto-title');
  box.innerHTML = `
    <div class="modal-card">
      <button id="howto-close" class="close" type="button" aria-label="Close">×</button>
      <div class="langs" data-notranslate>${ORDER.map(c => `<button type="button" data-lang="${c}" lang="${c}">${T[c].name}</button>`).join('')}</div>
      <h2 id="howto-title" data-notranslate></h2>
      <div id="howto-body" data-notranslate></div>
      <button id="howto-ok" class="primary" type="button"></button>
    </div>`;
  document.body.appendChild(box);

  function render() {
    const t = T[lang], dir = t.rtl ? 'rtl' : 'ltr';
    const title = box.querySelector('#howto-title'), body = box.querySelector('#howto-body');
    title.textContent = t.title; title.dir = dir; title.lang = lang;
    body.innerHTML = bodyHtml(t) + tipHtml(t); body.dir = dir; body.lang = lang;
    box.querySelector('#howto-ok').textContent = t.ok;
    box.querySelector('#howto-close').setAttribute('aria-label', t.close);
    box.querySelectorAll('.langs button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  }
  const open = l => {
    if (l && T[l]) lang = l;
    render(); box.classList.remove('hidden'); box.querySelector('.modal-card').scrollTop = 0;
  };
  const close = () => box.classList.add('hidden');
  window.openHowTo = open;
  if (btn) btn.addEventListener('click', () => open());
  box.querySelectorAll('.langs button').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang; try { localStorage.setItem('howtoLang', lang); } catch (e) {}
    render(); box.querySelector('.modal-card').scrollTop = 0;
  }));
  box.querySelector('#howto-close').addEventListener('click', close);
  box.querySelector('#howto-ok').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
})();
