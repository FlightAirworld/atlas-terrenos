'use strict';
// Traducción automática del juego. El juego está escrito en español; aquí se traduce al vuelo la interfaz a
// inglés, portugués, francés, alemán e italiano.
// Idioma: 1) el que el jugador elija en Menú → 🌐 Idioma; 2) los idiomas de su navegador; 3) si ninguno está disponible,
// el país por su zona horaria; 4) si tampoco, inglés. Español no se toca.
// Cómo ampliarlo: añade una fila a ROWS (español, en, pt, fr, de, it). Los textos que no estén aquí se quedan en español.
// En la consola: i18n.missing() lista los textos en español que aún no tienen traducción.
(function () {
  const SUP = ['es', 'en', 'pt', 'fr', 'de', 'it'];
  const NAMES = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
  const IDX = { en: 0, pt: 1, fr: 2, de: 3, it: 4 };
  const r = (es, en, pt, fr, de, it) => [es, en, pt, fr, de, it];

  const ROWS = [
    // Portada y carga
    r('Reclama terrenos del mapa del mundo y ponles tu nombre.', 'Claim plots on the world map and put your name on them.', 'Reivindique terrenos no mapa do mundo e coloque seu nome neles.', 'Revendiquez des terrains sur la carte du monde et mettez-y votre nom.', 'Beanspruche Grundstücke auf der Weltkarte und gib ihnen deinen Namen.', 'Rivendica terreni sulla mappa del mondo e dai loro il tuo nome.'),
    r('Jugar', 'Play', 'Jogar', 'Jouer', 'Spielen', 'Gioca'),
    r('Privacidad', 'Privacy', 'Privacidade', 'Confidentialité', 'Datenschutz', 'Privacy'),
    r('Condiciones', 'Terms', 'Termos', 'Conditions', 'Bedingungen', 'Condizioni'),
    r('Despertando el servidor…', 'Waking up the server…', 'Acordando o servidor…', 'Réveil du serveur…', 'Server wird gestartet…', 'Risveglio del server…'),
    r('Puede tardar hasta un minuto la primera vez.', 'It can take up to a minute the first time.', 'Pode demorar até um minuto na primeira vez.', 'Cela peut prendre jusqu’à une minute la première fois.', 'Beim ersten Mal kann es bis zu einer Minute dauern.', 'La prima volta può richiedere fino a un minuto.'),
    r('Reintentar', 'Retry', 'Tentar de novo', 'Réessayer', 'Erneut versuchen', 'Riprova'),
    r('en línea', 'online', 'online', 'en ligne', 'online', 'online'),
    r('Menú', 'Menu', 'Menu', 'Menu', 'Menü', 'Menu'),
    r('Cerrar menú', 'Close menu', 'Fechar menu', 'Fermer le menu', 'Menü schließen', 'Chiudi menu'),
    r('Abrir menú', 'Open menu', 'Abrir menu', 'Ouvrir le menu', 'Menü öffnen', 'Apri menu'),
    r('Explora el mapa y acerca el zoom para descubrir terrenos.', 'Explore the map and zoom in to discover plots.', 'Explore o mapa e aproxime o zoom para descobrir terrenos.', 'Explorez la carte et zoomez pour découvrir des terrains.', 'Erkunde die Karte und zoome heran, um Grundstücke zu entdecken.', 'Esplora la mappa e ingrandisci per scoprire i terreni.'),
    r('Redecora El Mundo – Juego de terrenos virtuales: reclama tu terreno en el mapa, la Luna y Marte', 'Redecora El Mundo – Virtual plots game: claim your plot on the map, the Moon and Mars', 'Redecora El Mundo – Jogo de terrenos virtuais: reivindique seu terreno no mapa, na Lua e em Marte', 'Redecora El Mundo – Jeu de terrains virtuels : revendiquez le vôtre sur la carte, la Lune et Mars', 'Redecora El Mundo – Spiel mit virtuellen Grundstücken: beanspruche deins auf der Karte, dem Mond und dem Mars', 'Redecora El Mundo – Gioco di terreni virtuali: rivendica il tuo sulla mappa, sulla Luna e su Marte'),
    // Panel del terreno
    r('Tu terreno', 'Your plot', 'Seu terreno', 'Votre terrain', 'Dein Grundstück', 'Il tuo terreno'),
    r('Compartir este terreno', 'Share this plot', 'Compartilhar este terreno', 'Partager ce terrain', 'Dieses Grundstück teilen', 'Condividi questo terreno'),
    r('Propiedad de', 'Owned by', 'Propriedade de', 'Propriété de', 'Besitzer:', 'Proprietà di'),
    r('Comprar créditos', 'Buy credits', 'Comprar créditos', 'Acheter des crédits', 'Credits kaufen', 'Compra crediti'),
    r('Este terreno ya tiene propietario.', 'This plot already has an owner.', 'Este terreno já tem proprietário.', 'Ce terrain a déjà un propriétaire.', 'Dieses Grundstück hat bereits einen Besitzer.', 'Questo terreno ha già un proprietario.'),
    r('REGALAR CRÉDITOS', 'GIFT CREDITS', 'PRESENTEAR CRÉDITOS', 'OFFRIR DES CRÉDITS', 'CREDITS VERSCHENKEN', 'REGALA CREDITI'),
    r('CAMBIAR CASA (1 🎟️)', 'CHANGE HOUSE (1 🎟️)', 'TROCAR CASA (1 🎟️)', 'CHANGER DE MAISON (1 🎟️)', 'HAUS ÄNDERN (1 🎟️)', 'CAMBIA CASA (1 🎟️)'),
    r('Este terreno está libre.', 'This plot is free.', 'Este terreno está livre.', 'Ce terrain est libre.', 'Dieses Grundstück ist frei.', 'Questo terreno è libero.'),
    r('Nombre que aparecerá en el terreno', 'Name that will appear on the plot', 'Nome que aparecerá no terreno', 'Nom qui apparaîtra sur le terrain', 'Name, der auf dem Grundstück erscheint', 'Nome che apparirà sul terreno'),
    r('Tu casa', 'Your house', 'Sua casa', 'Votre maison', 'Dein Haus', 'La tua casa'),
    r('Tu avatar', 'Your avatar', 'Seu avatar', 'Votre avatar', 'Dein Avatar', 'Il tuo avatar'),
    r('Tu país', 'Your country', 'Seu país', 'Votre pays', 'Dein Land', 'Il tuo paese'),
    r('Te quedan', 'You have', 'Você tem', 'Il vous reste', 'Du hast noch', 'Ti restano'),
    r('terrenos', 'plots left', 'terrenos restantes', 'terrains', 'Grundstücke', 'terreni'),
    r('Reclamar terreno', 'Claim plot', 'Reivindicar terreno', 'Revendiquer le terrain', 'Grundstück beanspruchen', 'Rivendica terreno'),
    r('Reclamar este terreno', 'Claim this plot', 'Reivindicar este terreno', 'Revendiquer ce terrain', 'Dieses Grundstück beanspruchen', 'Rivendica questo terreno'),
    r('Tu código:', 'Your code:', 'Seu código:', 'Votre code :', 'Dein Code:', 'Il tuo codice:'),
    r('Guárdalo: lo necesitas para recuperar tus terrenos si cambias de móvil o borras los datos del navegador.', 'Keep it safe: you need it to recover your plots if you change phones or clear your browser data.', 'Guarde-o: você precisa dele para recuperar seus terrenos se trocar de celular ou apagar os dados do navegador.', 'Gardez-le : il vous servira à récupérer vos terrains si vous changez de téléphone ou effacez les données du navigateur.', 'Bewahre ihn auf: Du brauchst ihn, um deine Grundstücke wiederherzustellen, wenn du das Handy wechselst oder die Browserdaten löschst.', 'Conservalo: ti serve per recuperare i tuoi terreni se cambi telefono o cancelli i dati del browser.'),
    r('Entra para comprar', 'Log in to buy', 'Entre para comprar', 'Connectez-vous pour acheter', 'Zum Kaufen anmelden', 'Accedi per acquistare'),
    r('Elige tu pack de créditos', 'Choose your credit pack', 'Escolha seu pacote de créditos', 'Choisissez votre pack de crédits', 'Wähle dein Credit-Paket', 'Scegli il tuo pacchetto di crediti'),
    r('Pagar con tarjeta', 'Pay by card', 'Pagar com cartão', 'Payer par carte', 'Mit Karte bezahlen', 'Paga con carta'),
    r('Pagar con', 'Pay with', 'Pagar com', 'Payer avec', 'Bezahlen mit', 'Paga con'),
    r('o con PayPal', 'or with PayPal', 'ou com PayPal', 'ou avec PayPal', 'oder mit PayPal', 'oppure con PayPal'),
    r('Simular pago (modo demo)', 'Simulate payment (demo mode)', 'Simular pagamento (modo demo)', 'Simuler le paiement (mode démo)', 'Zahlung simulieren (Demo-Modus)', 'Simula pagamento (modalità demo)'),
    r('¿Ya tienes un código?', 'Already have a code?', 'Já tem um código?', 'Vous avez déjà un code ?', 'Hast du schon einen Code?', 'Hai già un codice?'),
    r('Recuperar mis terrenos', 'Recover my plots', 'Recuperar meus terrenos', 'Récupérer mes terrains', 'Meine Grundstücke wiederherstellen', 'Recupera i miei terreni'),
    // Regalo, ranking, población
    r('Regalo diario', 'Daily gift', 'Presente diário', 'Cadeau quotidien', 'Tägliches Geschenk', 'Regalo giornaliero'),
    r('Cargando…', 'Loading…', 'Carregando…', 'Chargement…', 'Wird geladen…', 'Caricamento…'),
    r('Reclamar regalo', 'Claim gift', 'Resgatar presente', 'Récupérer le cadeau', 'Geschenk abholen', 'Riscatta il regalo'),
    r('Mayores propietarios', 'Top owners', 'Maiores proprietários', 'Plus grands propriétaires', 'Größte Besitzer', 'Maggiori proprietari'),
    r('Descubre quién posee más terrenos.', 'See who owns the most plots.', 'Descubra quem tem mais terrenos.', 'Découvrez qui possède le plus de terrains.', 'Finde heraus, wer die meisten Grundstücke besitzt.', 'Scopri chi possiede più terreni.'),
    r('Por países', 'By country', 'Por país', 'Par pays', 'Nach Ländern', 'Per paese'),
    r('Toca un país para ver sus ciudades.', 'Tap a country to see its cities.', 'Toque em um país para ver suas cidades.', 'Touchez un pays pour voir ses villes.', 'Tippe auf ein Land, um seine Städte zu sehen.', 'Tocca un paese per vedere le sue città.'),
    r('Volver', 'Back', 'Voltar', 'Retour', 'Zurück', 'Indietro'),
    r('Población', 'Population', 'População', 'Population', 'Bevölkerung', 'Popolazione'),
    // Cuenta
    r('Tu cuenta', 'Your account', 'Sua conta', 'Votre compte', 'Dein Konto', 'Il tuo account'),
    r('Entra para guardar tus terrenos para siempre, recuperarlos en cualquier móvil y reclamar tu regalo diario.', 'Log in to keep your plots forever, recover them on any phone and claim your daily gift.', 'Entre para guardar seus terrenos para sempre, recuperá-los em qualquer celular e resgatar seu presente diário.', 'Connectez-vous pour garder vos terrains pour toujours, les retrouver sur n’importe quel téléphone et récupérer votre cadeau quotidien.', 'Melde dich an, um deine Grundstücke für immer zu behalten, sie auf jedem Handy wiederherzustellen und dein tägliches Geschenk abzuholen.', 'Accedi per conservare i tuoi terreni per sempre, recuperarli su qualsiasi telefono e riscattare il regalo giornaliero.'),
    r('Entrar con Google', 'Sign in with Google', 'Entrar com o Google', 'Se connecter avec Google', 'Mit Google anmelden', 'Accedi con Google'),
    r('— o con tu email —', '— or with your email —', '— ou com seu e-mail —', '— ou avec votre e-mail —', '— oder mit deiner E-Mail —', '— oppure con la tua email —'),
    r('Entrar con email', 'Sign in with email', 'Entrar com e-mail', 'Se connecter par e-mail', 'Mit E-Mail anmelden', 'Accedi con email'),
    r('Crear cuenta nueva', 'Create new account', 'Criar nova conta', 'Créer un nouveau compte', 'Neues Konto erstellen', 'Crea nuovo account'),
    r('Al continuar aceptas las', 'By continuing you accept the', 'Ao continuar, você aceita os', 'En continuant, vous acceptez les', 'Mit dem Fortfahren akzeptierst du die', 'Continuando accetti i'),
    r('Condiciones del Servicio', 'Terms of Service', 'Termos de Serviço', 'Conditions d’utilisation', 'Nutzungsbedingungen', 'Condizioni di Servizio'),
    r('y la', 'and the', 'e a', 'et la', 'und die', 'e l’'),
    r('Política de Privacidad', 'Privacy Policy', 'Política de Privacidade', 'Politique de confidentialité', 'Datenschutzerklärung', 'Informativa sulla Privacy'),
    r('Has entrado como', 'You signed in as', 'Você entrou como', 'Vous êtes connecté en tant que', 'Du bist angemeldet als', 'Hai effettuato l’accesso come'),
    r('Tus terrenos y tu racha del regalo diario están guardados en tu cuenta.', 'Your plots and daily gift streak are saved to your account.', 'Seus terrenos e sua sequência do presente diário estão salvos na sua conta.', 'Vos terrains et votre série de cadeaux quotidiens sont enregistrés sur votre compte.', 'Deine Grundstücke und deine Serie des täglichen Geschenks sind in deinem Konto gespeichert.', 'I tuoi terreni e la tua serie del regalo giornaliero sono salvati nel tuo account.'),
    r('Tu apodo (aparecerá en tus terrenos)', 'Your nickname (it will appear on your plots)', 'Seu apelido (aparecerá nos seus terrenos)', 'Votre pseudo (il apparaîtra sur vos terrains)', 'Dein Spitzname (erscheint auf deinen Grundstücken)', 'Il tuo soprannome (apparirà sui tuoi terreni)'),
    r('Guardar apodo', 'Save nickname', 'Salvar apelido', 'Enregistrer le pseudo', 'Spitzname speichern', 'Salva soprannome'),
    r('Cerrar sesión', 'Log out', 'Sair', 'Se déconnecter', 'Abmelden', 'Esci'),
    r('Mis terrenos', 'My plots', 'Meus terrenos', 'Mes terrains', 'Meine Grundstücke', 'I miei terreni'),
    r('Recoger créditos', 'Collect credits', 'Coletar créditos', 'Récupérer les crédits', 'Credits einsammeln', 'Raccogli crediti'),
    r('Los créditos sirven para reclamar terrenos, subirlos de nivel y cambiar la casa.', 'Credits are used to claim plots, level them up and change the house.', 'Os créditos servem para reivindicar terrenos, subir de nível e trocar a casa.', 'Les crédits servent à revendiquer des terrains, les améliorer et changer de maison.', 'Mit Credits beanspruchst du Grundstücke, stufst sie auf und änderst das Haus.', 'I crediti servono per rivendicare terreni, farli salire di livello e cambiare casa.'),
    r('Buscar un lugar', 'Search for a place', 'Buscar um lugar', 'Rechercher un lieu', 'Ort suchen', 'Cerca un luogo'),
    r('Buscar', 'Search', 'Buscar', 'Rechercher', 'Suchen', 'Cerca'),
    r('Invita y gana', 'Invite and win', 'Convide e ganhe', 'Invitez et gagnez', 'Einladen und gewinnen', 'Invita e vinci'),
    r('Compartir mi enlace', 'Share my link', 'Compartilhar meu link', 'Partager mon lien', 'Meinen Link teilen', 'Condividi il mio link'),
    r('Copiar enlace', 'Copy link', 'Copiar link', 'Copier le lien', 'Link kopieren', 'Copia link'),
    r('Tu enlace de invitación', 'Your invite link', 'Seu link de convite', 'Votre lien d’invitation', 'Dein Einladungslink', 'Il tuo link d’invito'),
    // Instalar la app
    r('Descargar la app', 'Download the app', 'Baixar o app', 'Télécharger l’appli', 'App herunterladen', 'Scarica l’app'),
    r('En Android (Chrome):', 'On Android (Chrome):', 'No Android (Chrome):', 'Sur Android (Chrome) :', 'Auf Android (Chrome):', 'Su Android (Chrome):'),
    r('Toca los', 'Tap the', 'Toque nos', 'Touchez les', 'Tippe auf die', 'Tocca i'),
    r('tres puntos ⋮', 'three dots ⋮', 'três pontos ⋮', 'trois points ⋮', 'drei Punkte ⋮', 'tre puntini ⋮'),
    r('de arriba a la derecha del navegador.', 'at the top right of the browser.', 'no canto superior direito do navegador.', 'en haut à droite du navigateur.', 'oben rechts im Browser.', 'in alto a destra del browser.'),
    r('Elige', 'Choose', 'Escolha', 'Choisissez', 'Wähle', 'Scegli'),
    r('«Instalar aplicación»', '“Install app”', '“Instalar aplicativo”', '« Installer l’application »', '„App installieren“', '«Installa app»'),
    r('o', 'or', 'ou', 'ou', 'oder', 'o'),
    r('«Añadir a la pantalla de inicio»', '“Add to Home screen”', '“Adicionar à tela inicial”', '« Ajouter à l’écran d’accueil »', '„Zum Startbildschirm hinzufügen“', '«Aggiungi alla schermata Home»'),
    r('Pulsa', 'Tap', 'Toque em', 'Appuyez sur', 'Tippe auf', 'Premi'),
    r('Instalar', 'Install', 'Instalar', 'Installer', 'Installieren', 'Installa'),
    r('¡Listo! Tendrás el icono en tu móvil y se abrirá a pantalla completa.', 'Done! You’ll have the icon on your phone and it will open full screen.', 'Pronto! Você terá o ícone no celular e ele abrirá em tela cheia.', 'C’est prêt ! Vous aurez l’icône sur votre téléphone et elle s’ouvrira en plein écran.', 'Fertig! Das Symbol erscheint auf deinem Handy und öffnet sich im Vollbild.', 'Fatto! Avrai l’icona sul telefono e si aprirà a schermo intero.'),
    r('En iPhone o iPad (Safari):', 'On iPhone or iPad (Safari):', 'No iPhone ou iPad (Safari):', 'Sur iPhone ou iPad (Safari) :', 'Auf iPhone oder iPad (Safari):', 'Su iPhone o iPad (Safari):'),
    r('Toca el botón', 'Tap the button', 'Toque no botão', 'Touchez le bouton', 'Tippe auf die Schaltfläche', 'Tocca il pulsante'),
    r('Compartir', 'Share', 'Compartilhar', 'Partager', 'Teilen', 'Condividi'),
    r('(el cuadrado con la flecha hacia arriba).', '(the square with the arrow pointing up).', '(o quadrado com a seta para cima).', '(le carré avec la flèche vers le haut).', '(das Quadrat mit dem Pfeil nach oben).', '(il quadrato con la freccia verso l’alto).'),
    r('«Añadir a pantalla de inicio»', '“Add to Home Screen”', '“Adicionar à Tela de Início”', '« Sur l’écran d’accueil »', '„Zum Home-Bildschirm“', '«Aggiungi alla schermata Home»'),
    r('Añadir', 'Add', 'Adicionar', 'Ajouter', 'Hinzufügen', 'Aggiungi'),
    r('¡Listo! Se abrirá a pantalla completa, como una app.', 'Done! It will open full screen, like an app.', 'Pronto! Abrirá em tela cheia, como um app.', 'C’est prêt ! Elle s’ouvrira en plein écran, comme une appli.', 'Fertig! Es öffnet sich im Vollbild wie eine App.', 'Fatto! Si aprirà a schermo intero, come un’app.'),
    // Primeros pasos
    r('Toca una parcela del mapa y hazla tuya', 'Tap a plot on the map and make it yours', 'Toque em um terreno no mapa e faça dele seu', 'Touchez un terrain sur la carte et faites-en le vôtre', 'Tippe auf ein Grundstück auf der Karte und mach es zu deinem', 'Tocca un terreno sulla mappa e rendilo tuo'),
    r('Ir a mi ubicación', 'Go to my location', 'Ir para minha localização', 'Aller à ma position', 'Zu meinem Standort', 'Vai alla mia posizione'),
    r('Explorar', 'Explore', 'Explorar', 'Explorer', 'Erkunden', 'Esplora'),
    r('Saltar ✕', 'Skip ✕', 'Pular ✕', 'Passer ✕', 'Überspringen ✕', 'Salta ✕'),
    r('Empezar', 'Start', 'Começar', 'Commencer', 'Starten', 'Inizia'),
    r('Activar sonido', 'Turn sound on', 'Ativar som', 'Activer le son', 'Ton einschalten', 'Attiva audio'),
    r('Elige tu casa (o deja el dado, que la elige por ti) y pulsa «Reclamar terreno». El nombre es opcional.', 'Choose your house (or keep the dice, which picks one for you) and tap “Claim this plot”. The name is optional.', 'Escolha sua casa (ou deixe o dado, que escolhe por você) e toque em “Reivindicar este terreno”. O nome é opcional.', 'Choisissez votre maison (ou gardez le dé, qui choisit pour vous) et touchez « Revendiquer ce terrain ». Le nom est facultatif.', 'Wähle dein Haus (oder lass den Würfel für dich wählen) und tippe auf „Dieses Grundstück beanspruchen“. Der Name ist optional.', 'Scegli la tua casa (o lascia il dado, che sceglie per te) e premi «Rivendica questo terreno». Il nome è facoltativo.'),
    r('Ir al botón', 'Go to the button', 'Ir ao botão', 'Aller au bouton', 'Zur Schaltfläche', 'Vai al pulsante'),
    // Botones del menú
    r('Jugadores en línea', 'Players online', 'Jogadores online', 'Joueurs en ligne', 'Spieler online', 'Giocatori online'),
    r('Regalar créditos', 'Gift credits', 'Presentear créditos', 'Offrir des crédits', 'Credits verschenken', 'Regala crediti'),
    r('Regalar créditos a otro jugador', 'Gift credits to another player', 'Presentear créditos a outro jogador', 'Offrir des crédits à un autre joueur', 'Credits an einen anderen Spieler verschenken', 'Regala crediti a un altro giocatore'),
    r('Ruleta diaria', 'Daily wheel', 'Roleta diária', 'Roue quotidienne', 'Tägliches Glücksrad', 'Ruota giornaliera'),
    r('Premios del mes', 'Monthly prizes', 'Prêmios do mês', 'Prix du mois', 'Preise des Monats', 'Premi del mese'),
    r('Población de los pueblos', 'Town populations', 'População das cidades', 'Population des villes', 'Einwohner der Orte', 'Popolazione dei paesi'),
    r('Cómo jugar', 'How to play', 'Como jogar', 'Comment jouer', 'Spielanleitung', 'Come giocare'),
    r('Compartir pantalla', 'Share screen', 'Compartilhar tela', 'Partager l’écran', 'Bildschirm teilen', 'Condividi schermo'),
    r('Mi ubicación', 'My location', 'Minha localização', 'Ma position', 'Mein Standort', 'La mia posizione'),
    r('Ranking', 'Ranking', 'Ranking', 'Classement', 'Rangliste', 'Classifica'),
    r('Chat de la zona', 'Area chat', 'Chat da região', 'Chat de la zone', 'Chat der Umgebung', 'Chat della zona'),
    r('Mundos', 'Worlds', 'Mundos', 'Mondes', 'Welten', 'Mondi'),
    r('Mundos: viajar a la Luna y a todos los planetas', 'Worlds: travel to the Moon and all the planets', 'Mundos: viajar para a Lua e todos os planetas', 'Mondes : voyagez sur la Lune et toutes les planètes', 'Welten: Reise zum Mond und zu allen Planeten', 'Mondi: viaggia sulla Luna e su tutti i pianeti'),
    r('Sonidos', 'Sounds', 'Sons', 'Sons', 'Töne', 'Suoni'),
    // Modo ligero (ligero.js)
    r('Modo ligero', 'Lite mode', 'Modo leve', 'Mode léger', 'Sparmodus', 'Modalità leggera'),
    r('Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto'),
    r('Sí', 'Yes', 'Sim', 'Oui', 'Ja', 'Sì'),
    r('No', 'No', 'Não', 'Non', 'Nein', 'No'),
    r('Modo ligero: automático', 'Lite mode: automatic', 'Modo leve: automático', 'Mode léger : automatique', 'Sparmodus: automatisch', 'Modalità leggera: automatica'),
    r('Modo ligero: activado', 'Lite mode: on', 'Modo leve: ativado', 'Mode léger : activé', 'Sparmodus: an', 'Modalità leggera: attiva'),
    r('Modo ligero: desactivado', 'Lite mode: off', 'Modo leve: desativado', 'Mode léger : désactivé', 'Sparmodus: aus', 'Modalità leggera: disattivata'),
    r('se activa solo si el juego va lento.', 'it turns on by itself if the game runs slowly.', 'ativa-se sozinho se o jogo estiver lento.', 'il s’active tout seul si le jeu ralentit.', 'schaltet sich von selbst ein, wenn das Spiel ruckelt.', 'si attiva da solo se il gioco va lento.'),
    r('menos coches, gente y animales.', 'fewer cars, people and animals.', 'menos carros, pessoas e animais.', 'moins de voitures, de gens et d’animaux.', 'weniger Autos, Leute und Tiere.', 'meno auto, persone e animali.'),
    r('todo al máximo.', 'everything at maximum.', 'tudo no máximo.', 'tout au maximum.', 'alles auf Maximum.', 'tutto al massimo.'),
    r('El juego iba lento: se ha activado el modo ligero (menos coches y gente). Puedes cambiarlo en Menú → Modo ligero.', 'The game was running slowly, so lite mode is on (fewer cars and people). You can change it in Menu → Lite mode.', 'O jogo estava lento, então o modo leve foi ativado (menos carros e pessoas). Você pode mudar em Menu → Modo leve.', 'Le jeu ramait : le mode léger est activé (moins de voitures et de gens). Tu peux le changer dans Menu → Mode léger.', 'Das Spiel ruckelte, deshalb ist der Sparmodus an (weniger Autos und Leute). Du kannst ihn unter Menü → Sparmodus ändern.', 'Il gioco andava lento, quindi la modalità leggera è attiva (meno auto e persone). Puoi cambiarla in Menu → Modalità leggera.'),
    r('Sigue yendo justo: modo muy ligero activado. Puedes cambiarlo en Menú → Modo ligero.', 'Still struggling: very light mode is on. You can change it in Menu → Lite mode.', 'Ainda está pesado: modo muito leve ativado. Você pode mudar em Menu → Modo leve.', 'Ça rame encore : mode très léger activé. Tu peux le changer dans Menu → Mode léger.', 'Läuft immer noch zäh: Ultra-Sparmodus an. Du kannst ihn unter Menü → Sparmodus ändern.', 'Va ancora a fatica: modalità molto leggera attiva. Puoi cambiarla in Menu → Modalità leggera.'),
    r('Cuenta', 'Account', 'Conta', 'Compte', 'Konto', 'Account'),
    r('Entrar', 'Log in', 'Entrar', 'Se connecter', 'Anmelden', 'Accedi'),
    r('Avisos', 'Alerts', 'Avisos', 'Alertes', 'Hinweise', 'Avvisi'),
    r('Avisos al móvil', 'Phone alerts', 'Avisos no celular', 'Alertes sur le téléphone', 'Handy-Benachrichtigungen', 'Avvisi sul telefono'),
    r('Descargar app', 'Get the app', 'Baixar app', 'Télécharger l’appli', 'App herunterladen', 'Scarica l’app'),
    r('Mis terrenos y créditos', 'My plots and credits', 'Meus terrenos e créditos', 'Mes terrains et crédits', 'Meine Grundstücke und Credits', 'I miei terreni e crediti'),
    r('Mis créditos', 'My credits', 'Meus créditos', 'Mes crédits', 'Meine Credits', 'I miei crediti'),
    r('Casa del propietario', 'Owner’s house', 'Casa do proprietário', 'Maison du propriétaire', 'Haus des Besitzers', 'Casa del proprietario'),
    r('Escribe tu nombre', 'Type your name', 'Digite seu nome', 'Écrivez votre nom', 'Gib deinen Namen ein', 'Scrivi il tuo nome'),
    r('Vecinos de al lado', 'Next-door neighbors', 'Vizinhos ao lado', 'Voisins d’à côté', 'Nachbarn nebenan', 'Vicini di fianco'),
    r('Aún no tienes vecinos', 'You have no neighbors yet', 'Você ainda não tem vizinhos', 'Vous n’avez pas encore de voisins', 'Du hast noch keine Nachbarn', 'Non hai ancora vicini'),
    r('Invita a un amigo y gana créditos', 'Invite a friend and earn credits', 'Convide um amigo e ganhe créditos', 'Invitez un ami et gagnez des crédits', 'Lade einen Freund ein und verdiene Credits', 'Invita un amico e guadagna crediti'),
    r('Recoger', 'Collect', 'Recolher', 'Récupérer', 'Einsammeln', 'Raccogli'),
    r('Créditos listos para recoger', 'Credits ready to collect', 'Créditos prontos para recolher', 'Crédits prêts à récupérer', 'Credits zum Einsammeln bereit', 'Crediti pronti da raccogliere'),
    r('Un terreno está a punto de llenarse: recoge para no perder producción', 'A plot is about to fill up: collect so you don’t lose production', 'Um terreno está quase cheio: recolha para não perder produção', 'Un terrain est presque plein : récupérez pour ne pas perdre de production', 'Ein Grundstück ist fast voll: einsammeln, damit nichts verloren geht', 'Un terreno sta per riempirsi: raccogli per non perdere produzione'),
    r('Ahora tienes', 'You now have', 'Agora você tem', 'Vous avez maintenant', 'Du hast jetzt', 'Ora hai'),
    r('¡Cobra hoy el regalo para no perder la racha!', 'Claim today’s gift to keep your streak!', 'Receba o presente de hoje para não perder a sequência!', 'Récupérez le cadeau du jour pour garder votre série !', 'Hol dir heute das Geschenk, um deine Serie zu behalten!', 'Ritira il regalo di oggi per non perdere la serie!'),
    r('Racha de días seguidos', 'Day streak', 'Dias seguidos', 'Jours d’affilée', 'Tage in Folge', 'Giorni di fila'),
    r('Opcional: si lo dejas vacío te ponemos uno', 'Optional: leave it empty and we pick one', 'Opcional: se deixar vazio, escolhemos um', 'Facultatif : si vous le laissez vide, on en choisit un', 'Optional: leer lassen, dann wählen wir einen', 'Facoltativo: se lo lasci vuoto ne scegliamo uno'),
    r('✏️ Personalizar nombre, avatar y país (opcional)', '✏️ Customize name, avatar and country (optional)', '✏️ Personalizar nome, avatar e país (opcional)', '✏️ Personnaliser nom, avatar et pays (facultatif)', '✏️ Name, Avatar und Land anpassen (optional)', '✏️ Personalizza nome, avatar e paese (facoltativo)'),
    r('Contraseña (mínimo 6 caracteres)', 'Password (at least 6 characters)', 'Senha (mínimo de 6 caracteres)', 'Mot de passe (6 caractères minimum)', 'Passwort (mindestens 6 Zeichen)', 'Password (minimo 6 caratteri)'),
    r('Tu apodo', 'Your nickname', 'Seu apelido', 'Votre pseudo', 'Dein Spitzname', 'Il tuo soprannome'),
    r('Ciudad, calle, monumento…', 'City, street, landmark…', 'Cidade, rua, monumento…', 'Ville, rue, monument…', 'Stadt, Straße, Sehenswürdigkeit…', 'Città, via, monumento…'),
    r('Cerrar', 'Close', 'Fechar', 'Fermer', 'Schließen', 'Chiudi'),
    // Sonidos
    r('Activa o desactiva cada tipo de sonido.', 'Turn each type of sound on or off.', 'Ative ou desative cada tipo de som.', 'Activez ou désactivez chaque type de son.', 'Schalte jede Art von Ton ein oder aus.', 'Attiva o disattiva ogni tipo di suono.'),
    r('Activar todo', 'Turn all on', 'Ativar tudo', 'Tout activer', 'Alle einschalten', 'Attiva tutto'),
    r('Silenciar todo', 'Mute all', 'Silenciar tudo', 'Tout couper', 'Alle stummschalten', 'Silenzia tutto'),
    r('Listo', 'Done', 'Pronto', 'Terminé', 'Fertig', 'Fatto'),
    r('Música', 'Music', 'Música', 'Musique', 'Musik', 'Musica'),
    r('Efectos y botones', 'Effects and buttons', 'Efeitos e botões', 'Effets et boutons', 'Effekte und Schaltflächen', 'Effetti e pulsanti'),
    r('Gente y voces', 'People and voices', 'Pessoas e vozes', 'Gens et voix', 'Menschen und Stimmen', 'Persone e voci'),
    r('Coches, bocinas y sirenas', 'Cars, horns and sirens', 'Carros, buzinas e sirenes', 'Voitures, klaxons et sirènes', 'Autos, Hupen und Sirenen', 'Auto, clacson e sirene'),
    r('Trenes', 'Trains', 'Trens', 'Trains', 'Züge', 'Treni'),
    r('Aviones y helicópteros', 'Planes and helicopters', 'Aviões e helicópteros', 'Avions et hélicoptères', 'Flugzeuge und Hubschrauber', 'Aerei ed elicotteri'),
    r('Animales', 'Animals', 'Animais', 'Animaux', 'Tiere', 'Animali'),
    r('Marcianos y platillos', 'Martians and saucers', 'Marcianos e discos voadores', 'Martiens et soucoupes', 'Marsmenschen und Untertassen', 'Marziani e dischi volanti'),
    r('Lluvia y truenos', 'Rain and thunder', 'Chuva e trovões', 'Pluie et tonnerre', 'Regen und Donner', 'Pioggia e tuoni'),
    r('Campanas', 'Bells', 'Sinos', 'Cloches', 'Glocken', 'Campane'),
    // Idioma
    r('Idioma', 'Language', 'Idioma', 'Langue', 'Sprache', 'Lingua'),
    r('Automático', 'Automatic', 'Automático', 'Automatique', 'Automatisch', 'Automatico'),
    r('Elige el idioma del juego.', 'Choose the game language.', 'Escolha o idioma do jogo.', 'Choisissez la langue du jeu.', 'Wähle die Sprache des Spiels.', 'Scegli la lingua del gioco.'),
    // Tutorial
    r('Saltar tutorial', 'Skip tutorial', 'Pular tutorial', 'Passer le tutoriel', 'Tutorial überspringen', 'Salta il tutorial'),
    r('Atrás', 'Back', 'Voltar', 'Retour', 'Zurück', 'Indietro'),
    r('Siguiente', 'Next', 'Próximo', 'Suivant', 'Weiter', 'Avanti'),
    r('¡A jugar!', 'Let’s play!', 'Vamos jogar!', 'Jouons !', 'Los geht’s!', 'Si gioca!'),
    r('Entrar ahora', 'Log in now', 'Entrar agora', 'Se connecter maintenant', 'Jetzt anmelden', 'Accedi ora'),
    r('¡Bienvenido a Redecora El Mundo!', 'Welcome to Redecora El Mundo!', 'Bem-vindo ao Redecora El Mundo!', 'Bienvenue dans Redecora El Mundo !', 'Willkommen bei Redecora El Mundo!', 'Benvenuto in Redecora El Mundo!'),
    r('Este mapa es el mundo real. Cada cuadradito es un terreno virtual que puedes hacer tuyo, ponerle tu nombre y una casa. ¡Te lo enseño en 1 minuto!', 'This map is the real world. Every little square is a virtual plot you can make yours, with your name and a house on it. I’ll show you in 1 minute!', 'Este mapa é o mundo real. Cada quadradinho é um terreno virtual que você pode tornar seu, com seu nome e uma casa. Eu mostro em 1 minuto!', 'Cette carte est le monde réel. Chaque petit carré est un terrain virtuel que vous pouvez faire vôtre, avec votre nom et une maison. Je vous montre en 1 minute !', 'Diese Karte ist die echte Welt. Jedes Quadrat ist ein virtuelles Grundstück, das du zu deinem machen kannst – mit deinem Namen und einem Haus. In 1 Minute zeige ich dir, wie!', 'Questa mappa è il mondo reale. Ogni quadratino è un terreno virtuale che puoi rendere tuo, con il tuo nome e una casa. Te lo mostro in 1 minuto!'),
    r('Muévete por el mapa', 'Move around the map', 'Mova-se pelo mapa', 'Déplacez-vous sur la carte', 'Bewege dich über die Karte', 'Muoviti sulla mappa'),
    r('Arrastra con el dedo para moverte y pellizca (o usa la rueda del ratón) para acercarte. Acércate hasta ver las parcelas y la vida de la ciudad.', 'Drag with your finger to move and pinch (or use the mouse wheel) to zoom in. Zoom in until you see the plots and the life of the city.', 'Arraste com o dedo para se mover e faça o gesto de pinça (ou use a roda do mouse) para aproximar. Aproxime até ver os terrenos e a vida da cidade.', 'Faites glisser le doigt pour vous déplacer et pincez (ou utilisez la molette) pour zoomer. Zoomez jusqu’à voir les terrains et la vie de la ville.', 'Zieh mit dem Finger, um dich zu bewegen, und zoome mit zwei Fingern (oder dem Mausrad) hinein. Zoome, bis du die Grundstücke und das Stadtleben siehst.', 'Trascina con il dito per muoverti e pizzica (o usa la rotellina) per ingrandire. Avvicinati finché non vedi i terreni e la vita della città.'),
    r('El Menú', 'The Menu', 'O Menu', 'Le Menu', 'Das Menü', 'Il Menu'),
    r('Aquí está el Menú: 📍 tu ubicación, 🔍 buscar cualquier lugar, 🏆 ranking, 💬 chat de la zona, 🌎 Mundos (¡puedes viajar a la Luna!) y 🔊 Sonidos.', 'Here’s the Menu: 📍 your location, 🔍 search any place, 🏆 ranking, 💬 area chat, 🌎 Worlds (you can travel to the Moon!) and 🔊 Sounds.', 'Aqui está o Menu: 📍 sua localização, 🔍 buscar qualquer lugar, 🏆 ranking, 💬 chat da região, 🌎 Mundos (você pode viajar para a Lua!) e 🔊 Sons.', 'Voici le Menu : 📍 votre position, 🔍 rechercher un lieu, 🏆 classement, 💬 chat de la zone, 🌎 Mondes (vous pouvez voyager sur la Lune !) et 🔊 Sons.', 'Hier ist das Menü: 📍 dein Standort, 🔍 beliebige Orte suchen, 🏆 Rangliste, 💬 Chat der Umgebung, 🌎 Welten (du kannst zum Mond reisen!) und 🔊 Töne.', 'Ecco il Menu: 📍 la tua posizione, 🔍 cerca qualsiasi luogo, 🏆 classifica, 💬 chat della zona, 🌎 Mondi (puoi viaggiare sulla Luna!) e 🔊 Suoni.'),
    r('Elige un terreno libre', 'Pick a free plot', 'Escolha um terreno livre', 'Choisissez un terrain libre', 'Wähle ein freies Grundstück', 'Scegli un terreno libero'),
    r('Toca cualquier parcela libre del mapa. Se abrirá un panel con sus datos. Una vez comprada, nadie más puede quitártela.', 'Tap any free plot on the map. A panel with its details will open. Once bought, nobody else can take it from you.', 'Toque em qualquer terreno livre no mapa. Um painel com os dados será aberto. Depois de comprado, ninguém pode tirá-lo de você.', 'Touchez n’importe quel terrain libre sur la carte. Un panneau avec ses infos s’ouvrira. Une fois acheté, personne ne peut vous l’enlever.', 'Tippe auf ein beliebiges freies Grundstück auf der Karte. Ein Fenster mit den Details öffnet sich. Einmal gekauft, kann es dir niemand mehr wegnehmen.', 'Tocca qualsiasi terreno libero sulla mappa. Si aprirà un pannello con i suoi dati. Una volta acquistato, nessuno può portartelo via.'),
    r('Hazlo tuyo', 'Make it yours', 'Faça dele seu', 'Faites-en le vôtre', 'Mach es zu deinem', 'Rendilo tuo'),
    r('En el panel escribe el nombre que verá la gente, elige tu casa y pulsa «Reclamar terreno». Cuesta créditos 🎟️.', 'In the panel type the name people will see, choose your house and tap “Claim this plot”. It costs credits 🎟️.', 'No painel, escreva o nome que as pessoas verão, escolha sua casa e toque em “Reivindicar este terreno”. Custa créditos 🎟️.', 'Dans le panneau, écrivez le nom que les gens verront, choisissez votre maison et touchez « Revendiquer ce terrain ». Cela coûte des crédits 🎟️.', 'Gib im Fenster den Namen ein, den die Leute sehen, wähle dein Haus und tippe auf „Dieses Grundstück beanspruchen“. Das kostet Credits 🎟️.', 'Nel pannello scrivi il nome che vedranno gli altri, scegli la tua casa e premi «Rivendica questo terreno». Costa crediti 🎟️.'),
    r('Tus créditos', 'Your credits', 'Seus créditos', 'Vos crédits', 'Deine Credits', 'I tuoi crediti'),
    r('Aquí ves cuántos créditos tienes. Tócalo para ver tus terrenos y recoger lo que producen cada hora.', 'Here you see how many credits you have. Tap it to see your plots and collect what they produce every hour.', 'Aqui você vê quantos créditos tem. Toque para ver seus terrenos e coletar o que eles produzem a cada hora.', 'Ici, vous voyez combien de crédits vous avez. Touchez-le pour voir vos terrains et récupérer ce qu’ils produisent chaque heure.', 'Hier siehst du, wie viele Credits du hast. Tippe darauf, um deine Grundstücke zu sehen und einzusammeln, was sie jede Stunde erzeugen.', 'Qui vedi quanti crediti hai. Toccalo per vedere i tuoi terreni e raccogliere ciò che producono ogni ora.'),
    r('Más créditos gratis', 'More free credits', 'Mais créditos grátis', 'Plus de crédits gratuits', 'Mehr Gratis-Credits', 'Più crediti gratis'),
    r('En Extras tienes 🎁 el regalo diario, 🎡 la ruleta, 👫 Invita y gana y 📖 Cómo jugar. ¡Entra cada día!', 'In Extras you’ll find 🎁 the daily gift, 🎡 the wheel, 👫 Invite and win and 📖 How to play. Come back every day!', 'Em Extras você tem 🎁 o presente diário, 🎡 a roleta, 👫 Convide e ganhe e 📖 Como jogar. Entre todos os dias!', 'Dans Extras, vous avez 🎁 le cadeau quotidien, 🎡 la roue, 👫 Invitez et gagnez et 📖 Comment jouer. Revenez chaque jour !', 'Unter Extras findest du 🎁 das tägliche Geschenk, 🎡 das Glücksrad, 👫 Einladen und gewinnen und 📖 Spielanleitung. Komm jeden Tag vorbei!', 'In Extras trovi 🎁 il regalo giornaliero, 🎡 la ruota, 👫 Invita e vinci e 📖 Come giocare. Entra ogni giorno!'),
    r('Entra para guardar todo', 'Log in to save everything', 'Entre para guardar tudo', 'Connectez-vous pour tout sauvegarder', 'Melde dich an, um alles zu speichern', 'Accedi per salvare tutto'),
    r('Inicia sesión (Google o email) para guardar tus terrenos y tu racha, y recibir tu regalo de bienvenida.', 'Log in (Google or email) to save your plots and your streak, and get your welcome gift.', 'Entre (Google ou e-mail) para guardar seus terrenos e sua sequência e receber seu presente de boas-vindas.', 'Connectez-vous (Google ou e-mail) pour sauvegarder vos terrains et votre série, et recevoir votre cadeau de bienvenue.', 'Melde dich an (Google oder E-Mail), um deine Grundstücke und deine Serie zu speichern und dein Willkommensgeschenk zu erhalten.', 'Accedi (Google o email) per salvare i tuoi terreni e la tua serie e ricevere il regalo di benvenuto.'),
    // Campeonato de luchas
    r('Campeonato', 'Championship', 'Campeonato', 'Championnat', 'Meisterschaft', 'Campionato'),
    r('Campeonato de luchas', 'Fighting championship', 'Campeonato de lutas', 'Championnat de combats', 'Kampfmeisterschaft', 'Campionato di lotta'),
    r('Luchar', 'Fight', 'Lutar', 'Combattre', 'Kämpfen', 'Combatti'),
    r('🥊 ¡Luchar!', '🥊 Fight!', '🥊 Lutar!', '🥊 Combattre !', '🥊 Kämpfen!', '🥊 Combatti!'),
    r('Saltar ⏭', 'Skip ⏭', 'Pular ⏭', 'Passer ⏭', 'Überspringen ⏭', 'Salta ⏭'),
    r('Clasificación', 'Leaderboard', 'Classificação', 'Classement', 'Rangliste', 'Classifica'),
    r('Elige tu carta (tu terreno):', 'Pick your card (your plot):', 'Escolha sua carta (seu terreno):', 'Choisissez votre carte (votre terrain) :', 'Wähle deine Karte (dein Grundstück):', 'Scegli la tua carta (il tuo terreno):'),
    r('¡Luchar!', 'Fight!', 'Lutar!', 'Combattre !', 'Kämpfen!', 'Combatti!'),
    r('Vuelve mañana', 'Come back tomorrow', 'Volte amanhã', 'Revenez demain', 'Komm morgen wieder', 'Torna domani'),
    r('⏳ Vuelve mañana', '⏳ Come back tomorrow', '⏳ Volte amanhã', '⏳ Revenez demain', '⏳ Komm morgen wieder', '⏳ Torna domani'),
    r('💥 Has perdido. ¡Otra vez será!', '💥 You lost. Better luck next time!', '💥 Você perdeu. Da próxima vez!', '💥 Perdu. Ce sera pour la prochaine fois !', '💥 Verloren. Beim nächsten Mal klappt es!', '💥 Hai perso. Sarà per la prossima volta!'),
    // Tutorial automático (escenas nuevas)
    r('Viaja a una ciudad', 'Travel to a city', 'Viaje para uma cidade', 'Voyagez vers une ville', 'Reise in eine Stadt', 'Viaggia in una città'),
    r('Para ir a cualquier sitio usa 🔍 buscar (en el Menú): escribes una ciudad y el mapa vuela hasta allí. Vamos a una ciudad de ejemplo.', 'To go anywhere, use 🔍 search (in the Menu): type a city and the map flies there. Let’s go to a sample city.', 'Para ir a qualquer lugar, use 🔍 buscar (no Menu): digite uma cidade e o mapa voa até lá. Vamos a uma cidade de exemplo.', 'Pour aller n’importe où, utilisez 🔍 rechercher (dans le Menu) : tapez une ville et la carte s’y envole. Allons dans une ville d’exemple.', 'Um irgendwohin zu kommen, nutze 🔍 Suchen (im Menü): Gib eine Stadt ein und die Karte fliegt dorthin. Wir fliegen zu einer Beispielstadt.', 'Per andare ovunque usa 🔍 cerca (nel Menu): scrivi una città e la mappa vola fin lì. Andiamo in una città di esempio.'),
    r('Acércate a una manzana', 'Zoom in to a block', 'Aproxime-se de um quarteirão', 'Zoomez sur un pâté de maisons', 'Zoome auf einen Block', 'Avvicinati a un isolato'),
    r('Haz zoom hasta ver las manzanas entre las calles. Dentro de cada manzana están las parcelas, los terrenos que puedes comprar.', 'Zoom in until you see the blocks between the streets. Inside each block are the plots, the land you can buy.', 'Aproxime até ver os quarteirões entre as ruas. Dentro de cada quarteirão estão as parcelas, os terrenos que você pode comprar.', 'Zoomez jusqu’à voir les pâtés de maisons entre les rues. Dans chaque pâté se trouvent les parcelles, les terrains que vous pouvez acheter.', 'Zoome, bis du die Häuserblöcke zwischen den Straßen siehst. In jedem Block liegen die Parzellen, die Grundstücke, die du kaufen kannst.', 'Ingrandisci finché vedi gli isolati tra le strade. Dentro ogni isolato ci sono le parcelle, i terreni che puoi comprare.'),
    r('Acércate a un terreno vacío', 'Zoom in to an empty plot', 'Aproxime-se de um terreno vazio', 'Approchez-vous d’un terrain vide', 'Zoome auf ein leeres Grundstück', 'Avvicinati a un terreno vuoto'),
    r('Vamos a volar a un terreno de verdad, sin casas. Haz zoom hasta verlo a pie de suelo para que te lo explique encima.', 'We’re going to fly to a real plot with no houses. Zoom in until you see it at ground level so I can explain it right on top of it.', 'Vamos voar até um terreno de verdade, sem casas. Aproxime até vê-lo ao nível do chão para eu explicar bem em cima dele.', 'Nous allons voler jusqu’à un vrai terrain, sans maisons. Zoomez jusqu’à le voir au ras du sol pour que je vous l’explique dessus.', 'Wir fliegen zu einem echten Grundstück ohne Häuser. Zoome bis auf Bodenhöhe, damit ich es dir direkt vor Ort erklären kann.', 'Voliamo su un vero terreno, senza case. Zooma fino a vederlo a livello del suolo, così te lo spiego proprio lì sopra.'),
    r('Voz activada', 'Voice on', 'Voz ativada', 'Voix activée', 'Stimme an', 'Voce attiva'),
    r('Voz desactivada', 'Voice off', 'Voz desativada', 'Voix désactivée', 'Stimme aus', 'Voce disattivata'),
    r('Terreno libre, sin casa', 'Free plot, no house', 'Terreno livre, sem casa', 'Terrain libre, sans maison', 'Freies Grundstück, ohne Haus', 'Terreno libero, senza casa'),
    r('Así se ve un terreno libre a pie de calle: solo hierba y el borde de la parcela, sin ninguna casa. Mide unos 45 × 56 m y no tiene dueño todavía.', 'This is a free plot at street level: just grass and the edge of the parcel, with no house at all. It is about 45 × 56 m and has no owner yet.', 'Assim se vê um terreno livre ao nível da rua: só grama e a borda da parcela, sem nenhuma casa. Mede cerca de 45 × 56 m e ainda não tem dono.', 'Voici un terrain libre vu depuis la rue : seulement de l’herbe et le bord de la parcelle, sans aucune maison. Il mesure environ 45 × 56 m et n’a pas encore de propriétaire.', 'So sieht ein freies Grundstück auf Straßenebene aus: nur Gras und der Rand der Parzelle, ohne irgendein Haus. Es misst etwa 45 × 56 m und hat noch keinen Besitzer.', 'Ecco un terreno libero a livello strada: solo erba e il bordo della parcella, senza nessuna casa. Misura circa 45 × 56 m e non ha ancora un proprietario.'),
    r('Terreno libre', 'Free plot', 'Terreno livre', 'Terrain libre', 'Freies Grundstück', 'Terreno libero'),
    r('Sin casa, sin dueño', 'No house, no owner', 'Sem casa, sem dono', 'Sans maison, sans propriétaire', 'Kein Haus, kein Besitzer', 'Senza casa, senza proprietario'),
    r('Mapa de ejemplo', 'Sample map', 'Mapa de exemplo', 'Carte d’exemple', 'Beispielkarte', 'Mappa di esempio'),
    r('Terrenos libres', 'Free plots', 'Terrenos livres', 'Terrains libres', 'Freie Grundstücke', 'Terreni liberi'),
    r('Mira: aquí todavía no vive nadie. Cada cuadrado es una parcela libre, ¡y puede ser tuya!', 'Look: nobody lives here yet. Every square is a free plot, and it can be yours!', 'Olhe: ninguém mora aqui ainda. Cada quadrado é um terreno livre e pode ser seu!', 'Regardez : personne n’habite encore ici. Chaque carré est un terrain libre, et il peut être à vous !', 'Schau: Hier wohnt noch niemand. Jedes Quadrat ist ein freies Grundstück – und kann dir gehören!', 'Guarda: qui non abita ancora nessuno. Ogni quadrato è un terreno libero e può essere tuo!'),
    r('¡Tu casa aparece!', 'Your house appears!', 'Sua casa aparece!', 'Votre maison apparaît !', 'Dein Haus erscheint!', 'La tua casa appare!'),
    r('Al reclamarlo, tu casa aparece al instante en el mapa con tu nombre. Solo es tuya: nadie puede quitártela.', 'Once you claim it, your house appears on the map instantly with your name. It’s only yours: nobody can take it away.', 'Ao reivindicar, sua casa aparece no mapa na hora, com o seu nome. É só sua: ninguém pode tirá-la.', 'Dès que vous le réclamez, votre maison apparaît aussitôt sur la carte avec votre nom. Elle n’est qu’à vous : personne ne peut vous la prendre.', 'Sobald du es beanspruchst, erscheint dein Haus sofort mit deinem Namen auf der Karte. Es gehört nur dir – niemand kann es dir wegnehmen.', 'Appena lo rivendichi, la tua casa appare subito sulla mappa con il tuo nome. È solo tua: nessuno può togliertela.'),
    r('Llegan los vecinos', 'The neighbors arrive', 'Chegam os vizinhos', 'Les voisins arrivent', 'Die Nachbarn kommen', 'Arrivano i vicini'),
    r('Poco a poco llegan vecinos y el mapa se llena de casas. ¡Así se ve donde ya se juega!', 'Little by little neighbors arrive and the map fills with houses. This is how it looks where people already play!', 'Aos poucos chegam vizinhos e o mapa se enche de casas. Assim fica onde já se joga!', 'Peu à peu, les voisins arrivent et la carte se remplit de maisons. Voilà à quoi cela ressemble là où l’on joue déjà !', 'Nach und nach kommen Nachbarn und die Karte füllt sich mit Häusern. So sieht es dort aus, wo schon gespielt wird!', 'A poco a poco arrivano i vicini e la mappa si riempie di case. Ecco come appare dove si gioca già!'),
    // Guía de las primeras parcelas gratis (primeras.js)
    r('Cerrar guía', 'Close guide', 'Fechar guia', 'Fermer le guide', 'Anleitung schließen', 'Chiudi guida'),
    r('No he encontrado un terreno libre cerca. Mueve el mapa y toca uno.', 'I couldn’t find a free plot nearby. Move the map and tap one.', 'Não encontrei um terreno livre por perto. Mova o mapa e toque em um.', 'Je n’ai pas trouvé de terrain libre à proximité. Déplacez la carte et touchez-en un.', 'Ich habe in der Nähe kein freies Grundstück gefunden. Verschiebe die Karte und tippe auf eines.', 'Non ho trovato un terreno libero nelle vicinanze. Sposta la mappa e toccane uno.'),
    r('Crea tu primera parcela', 'Create your first plot', 'Crie seu primeiro terreno', 'Créez votre première parcelle', 'Erstelle dein erstes Grundstück', 'Crea il tuo primo terreno'),
    r('Ahora tu parcela', 'Now your plot', 'Agora seu terreno', 'Maintenant votre terrain', 'Jetzt dein Grundstück', 'Ora il tuo terreno'),
    r('de', 'of', 'de', 'sur', 'von', 'di'),
    r('parcela gratis', 'free plot', 'terreno grátis', 'terrain gratuit', 'kostenloses Grundstück', 'terreno gratis'),
    r('parcelas gratis', 'free plots', 'terrenos grátis', 'terrains gratuits', 'kostenlose Grundstücke', 'terreni gratis'),
    r('Te llevo a un terreno libre…', 'Taking you to a free plot…', 'Levando você a um terreno livre…', 'Je vous emmène sur un terrain libre…', 'Ich bringe dich zu einem freien Grundstück…', 'Ti porto a un terreno libero…'),
    r('Volando…', 'Flying…', 'Voando…', 'En vol…', 'Flug läuft…', 'In volo…'),
    r('Este terreno está libre y es tuyo gratis. Elige tu casa 🏠 (o deja el dado, que la elige por ti) y pulsa «Reclamar terreno».', 'This plot is free and yours at no cost. Pick your house 🏠 (or leave the dice and it picks one for you) and tap “Claim plot”.', 'Este terreno está livre e é seu de graça. Escolha sua casa 🏠 (ou deixe o dado, que escolhe por você) e toque em «Reivindicar terreno».', 'Ce terrain est libre et il est à vous gratuitement. Choisissez votre maison 🏠 (ou laissez le dé choisir pour vous) et touchez «Revendiquer le terrain».', 'Dieses Grundstück ist frei und gehört dir kostenlos. Wähle dein Haus 🏠 (oder lass den Würfel für dich wählen) und tippe auf „Grundstück beanspruchen“.', 'Questo terreno è libero e tuo gratis. Scegli la tua casa 🏠 (o lascia che il dado scelga per te) e tocca «Rivendica terreno».'),
    r('Toca una parcela libre del mapa para hacerla tuya, o te llevo yo a una.', 'Tap a free plot on the map to make it yours, or I’ll take you to one.', 'Toque em um terreno livre no mapa para torná-lo seu, ou eu levo você a um.', 'Touchez un terrain libre sur la carte pour le faire vôtre, ou je vous en montre un.', 'Tippe auf ein freies Grundstück auf der Karte, um es zu deinem zu machen, oder ich bringe dich zu einem.', 'Tocca un terreno libero sulla mappa per renderlo tuo, oppure ti porto io a uno.'),
    r('Llévame a un terreno libre', 'Take me to a free plot', 'Leve-me a um terreno livre', 'Emmenez-moi sur un terrain libre', 'Bring mich zu einem freien Grundstück', 'Portami a un terreno libero'),
    r('¡Primera parcela tuya! Vamos a por la siguiente.', 'Your first plot! Let’s go for the next one.', 'Seu primeiro terreno! Vamos ao próximo.', 'Votre premier terrain ! Passons au suivant.', 'Dein erstes Grundstück! Auf zum nächsten.', 'Il tuo primo terreno! Passiamo al prossimo.'),
    r('Crea tu cuenta para guardar tus parcelas y seguir jugando 🎁', 'Create your account to save your plots and keep playing 🎁', 'Crie sua conta para guardar seus terrenos e continuar jogando 🎁', 'Créez votre compte pour sauvegarder vos terrains et continuer à jouer 🎁', 'Erstelle dein Konto, um deine Grundstücke zu speichern und weiterzuspielen 🎁', 'Crea il tuo account per salvare i tuoi terreni e continuare a giocare 🎁'),
    r('parcela conseguida', 'plot claimed', 'terreno conquistado', 'terrain obtenu', 'Grundstück erhalten', 'terreno ottenuto'),
    r('parcelas conseguidas', 'plots claimed', 'terrenos conquistados', 'terrains obtenus', 'Grundstücke erhalten', 'terreni ottenuti'),
    r('¡Ya eres propietario!', 'You’re a landowner now!', 'Você já é proprietário!', 'Vous êtes propriétaire !', 'Du bist jetzt Eigentümer!', 'Ora sei proprietario!'),
    r('Crea tu cuenta con Google o con tu email para guardar tus parcelas y seguir jugando.', 'Create your account with Google or your email to save your plots and keep playing.', 'Crie sua conta com Google ou com seu e-mail para guardar seus terrenos e continuar jogando.', 'Créez votre compte avec Google ou votre e-mail pour sauvegarder vos terrains et continuer à jouer.', 'Erstelle dein Konto mit Google oder deiner E-Mail, um deine Grundstücke zu speichern und weiterzuspielen.', 'Crea il tuo account con Google o con la tua email per salvare i tuoi terreni e continuare a giocare.'),
    r('Te regalamos', 'We’re giving you', 'Damos a você', 'Nous vous offrons', 'Wir schenken dir', 'Ti regaliamo'),
    r('créditos de bienvenida', 'welcome credits', 'créditos de boas-vindas', 'crédits de bienvenue', 'Willkommens-Credits', 'crediti di benvenuto'),
    r('Sin cuenta podrías perderlas.', 'Without an account you could lose them.', 'Sem conta você pode perdê-los.', 'Sans compte, vous pourriez les perdre.', 'Ohne Konto könntest du sie verlieren.', 'Senza un account potresti perderli.'),
    r('Crear mi cuenta', 'Create my account', 'Criar minha conta', 'Créer mon compte', 'Mein Konto erstellen', 'Crea il mio account'),
    r('Empieza a jugar', 'Start playing', 'Comece a jogar', 'Commencez à jouer', 'Spiel starten', 'Inizia a giocare'),
    r('Crea tu cuenta y empieza', 'Create your account and start', 'Crie sua conta e comece', 'Créez votre compte et commencez', 'Erstelle dein Konto und leg los', 'Crea il tuo account e inizia'),
    r('Entra con Google o con tu email para reclamar tu primer terreno.', 'Sign in with Google or your email to claim your first plot.', 'Entre com Google ou com seu e-mail para reivindicar seu primeiro terreno.', 'Connectez-vous avec Google ou votre e-mail pour revendiquer votre premier terrain.', 'Melde dich mit Google oder deiner E-Mail an, um dein erstes Grundstück zu beanspruchen.', 'Accedi con Google o con la tua email per rivendicare il tuo primo terreno.'),
    r('Entrar con Google o email', 'Sign in with Google or email', 'Entrar com Google ou e-mail', 'Se connecter avec Google ou e-mail', 'Mit Google oder E-Mail anmelden', 'Accedi con Google o email'),
    r('Entra para reclamar tu primer terreno 🎁', 'Sign in to claim your first plot 🎁', 'Entre para reivindicar seu primeiro terreno 🎁', 'Connectez-vous pour revendiquer votre premier terrain 🎁', 'Melde dich an, um dein erstes Grundstück zu beanspruchen 🎁', 'Accedi per rivendicare il tuo primo terreno 🎁'),
    r('Cuenta creada', 'Account created', 'Conta criada', 'Compte créé', 'Konto erstellt', 'Account creato'),
    r('¡Todo guardado!', 'All saved!', 'Tudo guardado!', 'Tout est sauvegardé !', 'Alles gespeichert!', 'Tutto salvato!'),
    r('Tu parcela ya es de tu cuenta.', 'Your plot now belongs to your account.', 'Seu terreno agora é da sua conta.', 'Votre terrain appartient maintenant à votre compte.', 'Dein Grundstück gehört jetzt zu deinem Konto.', 'Il tuo terreno ora è nel tuo account.'),
    r('Tus parcelas ya son de tu cuenta.', 'Your plots now belong to your account.', 'Seus terrenos agora são da sua conta.', 'Vos terrains appartiennent maintenant à votre compte.', 'Deine Grundstücke gehören jetzt zu deinem Konto.', 'I tuoi terreni ora sono nel tuo account.'),
    r('Tienes', 'You have', 'Você tem', 'Vous avez', 'Du hast', 'Hai'),
    r('crédito', 'credit', 'crédito', 'crédit', 'Credit', 'credito'),
    r('créditos', 'credits', 'créditos', 'crédits', 'Credits', 'crediti'),
    r('para reclamar más terrenos.', 'to claim more plots.', 'para reivindicar mais terrenos.', 'pour revendiquer d’autres terrains.', 'zum Beanspruchen weiterer Grundstücke.', 'per rivendicare altri terreni.'),
    r('Sigue jugando y reclamando terrenos.', 'Keep playing and claiming plots.', 'Continue jogando e reivindicando terrenos.', 'Continuez à jouer et à revendiquer des terrains.', 'Spiele weiter und beanspruche Grundstücke.', 'Continua a giocare e a rivendicare terreni.'),
    r('Buscar otra parcela', 'Find another plot', 'Procurar outro terreno', 'Chercher un autre terrain', 'Weiteres Grundstück suchen', 'Cerca un altro terreno'),
    r('No se han podido preparar tus parcelas gratis.', 'We couldn’t prepare your free plots.', 'Não foi possível preparar seus terrenos grátis.', 'Impossible de préparer vos terrains gratuits.', 'Deine kostenlosen Grundstücke konnten nicht vorbereitet werden.', 'Non è stato possibile preparare i tuoi terreni gratis.'),
    r('Parcelas gratis', 'Free plots', 'Terrenos grátis', 'Terrains gratuits', 'Kostenlose Grundstücke', 'Terreni gratis'),
    r('Preparando tus parcelas…', 'Preparing your plots…', 'Preparando seus terrenos…', 'Préparation de vos terrains…', 'Deine Grundstücke werden vorbereitet…', 'Preparazione dei tuoi terreni…'),
    r('Un momento, te regalo tus primeras parcelas.', 'One moment, I’m giving you your first plots.', 'Um momento, estou dando seus primeiros terrenos.', 'Un instant, je vous offre vos premiers terrains.', 'Einen Moment, ich schenke dir deine ersten Grundstücke.', 'Un momento, ti regalo i tuoi primi terreni.'),
  ];

  // Textos con números: se traducen con plantilla ($1, $2…)
  const PATS = [
    [/^Paso (\d+) de (\d+)$/, ['Step $1 of $2', 'Passo $1 de $2', 'Étape $1 sur $2', 'Schritt $1 von $2', 'Passo $1 di $2']],
    [/^Tienes (\d+) (?:crédito|créditos)\. Toca una parcela libre del mapa para hacerla tuya\.$/, ['You have $1 credit(s). Tap a free plot on the map to make it yours.', 'Você tem $1 crédito(s). Toque em um terreno livre no mapa para torná-lo seu.', 'Vous avez $1 crédit(s). Touchez un terrain libre sur la carte pour le faire vôtre.', 'Du hast $1 Credit(s). Tippe auf ein freies Grundstück auf der Karte, um es zu deinem zu machen.', 'Hai $1 crediti. Tocca un terreno libero sulla mappa per renderlo tuo.']]
  ];

  // ---------- Motor ----------
  const LEAD = /^([^\p{L}\p{N}¿¡«»“„(]*)([\s\S]+)$/u;
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const strip = s => { const m = LEAD.exec(s); return m ? m[2] : s; };
  const FULL = {}, CORE = {};
  Object.keys(IDX).forEach(l => { FULL[l] = new Map(); CORE[l] = new Map(); });
  ROWS.forEach(row => {
    const k = norm(row[0]);
    Object.keys(IDX).forEach(l => {
      const t = row[1 + IDX[l]];
      FULL[l].set(k, t);
      if (!CORE[l].has(strip(k))) CORE[l].set(strip(k), strip(t));
    });
  });

  let lang = 'es';
  const missing = new Set();
  function tr(s) {
    if (lang === 'es' || !FULL[lang]) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    if (!core) return s;
    const key = norm(core);
    let hit = FULL[lang].get(key);
    if (hit == null) for (const p of PATS) if (p[0].test(key)) { hit = key.replace(p[0], p[1][IDX[lang]]); break; }
    if (hit == null) {
      const lm = LEAD.exec(key);
      if (lm && lm[1]) { const h = CORE[lang].get(lm[2]); if (h != null) hit = lm[1] + h; }
    }
    if (hit == null) { if (/[¿¡áéíóúñÁÉÍÓÚ]|\b(el|la|de|que|tu|tus|para|con|una?)\b/i.test(key) && key.length > 3) missing.add(key); return s; }
    return m[1] + hit + m[3];
  }

  // ---------- Detección del idioma ----------
  const TZ = [
    [/^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta|America\/(Mexico_City|Bogota|Lima|Santiago|Caracas|Montevideo|Guayaquil|La_Paz|Asuncion|Costa_Rica|Panama|Havana|Guatemala|El_Salvador|Tegucigalpa|Managua|Santo_Domingo|Monterrey|Merida|Cancun|Tijuana|Hermosillo|Argentina\/.*)|America\/Buenos_Aires|Pacific\/Easter)$/, 'es'],
    [/^(America\/(Sao_Paulo|Bahia|Fortaleza|Manaus|Recife|Belem|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Noronha|Araguaina|Maceio|Santarem|Boa_Vista|Eirunepe)|Europe\/Lisbon|Atlantic\/(Azores|Madeira)|Africa\/(Luanda|Maputo))$/, 'pt'],
    [/^(Europe\/(Paris|Brussels|Luxembourg|Monaco)|Africa\/(Algiers|Tunis|Casablanca|Dakar|Abidjan|Kinshasa)|America\/Martinique|America\/Guadeloupe|Indian\/Reunion|Pacific\/Tahiti)$/, 'fr'],
    [/^Europe\/(Berlin|Vienna|Zurich|Vaduz|Busingen)$/, 'de'],
    [/^Europe\/(Rome|Vatican|San_Marino|Malta)$/, 'it']
  ];
  function fromTimezone() {
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    for (const [re, l] of TZ) if (re.test(tz)) return l;
    return null;
  }
  function detect() {
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (const l of list) { const c = String(l).slice(0, 2).toLowerCase(); if (SUP.includes(c)) return c; }
    return fromTimezone() || 'en';
  }
  function saved() { try { const v = localStorage.getItem('lang'); return SUP.includes(v) ? v : null; } catch (e) { return null; } }

  // ---------- Aplicar al DOM ----------
  const ATTRS = ['title', 'aria-label', 'placeholder', 'data-label', 'alt'];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|CODE|PRE|NOSCRIPT|SVG|CANVAS)$/i;
  const tn = new WeakMap(), an = new WeakMap();   // original y traducido de cada texto / atributo

  const skipEl = el => !el || SKIP.test(el.tagName) || (el.closest && el.closest('#map,[data-notranslate]'));
  function doText(n) {
    const rec = tn.get(n), v = n.nodeValue;
    const orig = rec && v === rec.t ? rec.o : v;
    const t = tr(orig);
    if (t !== v) n.nodeValue = t;
    if (t !== orig) tn.set(n, { o: orig, t }); else tn.delete(n);
  }
  function doAttr(el, a) {
    const v = el.getAttribute(a); if (v == null) return;
    const rec = an.get(el) || {}, r0 = rec[a];
    const orig = r0 && v === r0.t ? r0.o : v;
    const t = tr(orig);
    if (t !== v) el.setAttribute(a, t);
    if (t !== orig) { rec[a] = { o: orig, t }; an.set(el, rec); } else if (r0) { delete rec[a]; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipEl(root.parentElement)) doText(root); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 ? (skipEl(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT
    });
    ATTRS.forEach(a => { if (root.hasAttribute(a)) doAttr(root, a); });
    root.querySelectorAll('[title],[aria-label],[placeholder],[data-label],[alt]').forEach(el => { if (!skipEl(el)) ATTRS.forEach(a => { if (el.hasAttribute(a)) doAttr(el, a); }); });
    let n; while ((n = tw.nextNode())) doText(n);
  }
  let obs = null;
  function startObs() {
    if (obs) return;
    obs = new MutationObserver(list => {
      if (lang === 'es') return;
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
        else if (m.type === 'characterData') { if (!skipEl(m.target.parentElement)) doText(m.target); }
        else if (m.type === 'attributes' && !skipEl(m.target)) doAttr(m.target, m.attributeName);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  let titleOrig = null;
  function applyTitle() {
    if (titleOrig == null) titleOrig = document.title;
    document.title = tr(titleOrig);
  }
  function apply(l) {
    lang = l;
    document.documentElement.lang = l;
    if (l !== 'es') startObs();
    walk(document.body);
    applyTitle();
  }

  // ---------- Selector de idioma (Menú → 🌐 Idioma y enlace en la portada) ----------
  function buildPicker() {
    const st = document.createElement('style');
    st.textContent = `
#lang-modal{z-index:5400}
#lang-modal .modal-card{max-height:min(86vh,560px);overflow-y:auto}
#lang-modal h2{margin:0 0 4px;font-size:20px}
#lang-modal .lang-sub{margin:0 0 10px;font-size:13px;opacity:.75}
#lang-modal .lang-list{display:flex;flex-direction:column;gap:6px}
#lang-modal .lang-list button{min-height:46px;border-radius:12px;border:1px solid rgba(120,120,120,.4);background:transparent;color:inherit;font:700 16px system-ui,sans-serif;text-align:left;padding:0 14px;cursor:pointer}
#lang-modal .lang-list button.on{background:#087f5b;border-color:#087f5b;color:#fff}`;
    document.head.appendChild(st);
    const box = document.createElement('div');
    box.id = 'lang-modal'; box.className = 'modal hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'lang-title');
    box.innerHTML = '<div class="modal-card"><button id="lang-close" class="close" type="button" aria-label="Cerrar">×</button><h2 id="lang-title">🌐 Idioma</h2><p class="lang-sub">Elige el idioma del juego.</p><div class="lang-list"></div></div>';
    document.body.appendChild(box);
    const list = box.querySelector('.lang-list');
    const items = [['auto', 'Automático'], ...SUP.map(c => [c, NAMES[c]])];
    items.forEach(([c, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.l = c; b.textContent = label;
      if (c !== 'auto') b.setAttribute('data-notranslate', '');
      b.addEventListener('click', () => { set(c); box.classList.add('hidden'); });
      list.appendChild(b);
    });
    const close = () => box.classList.add('hidden');
    box.querySelector('#lang-close').addEventListener('click', close);
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
    const sync = () => { const s = saved() || 'auto'; list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.l === s)); };
    const open = () => { sync(); box.classList.remove('hidden'); };
    const menu = document.getElementById('menu-items');
    if (menu && !document.getElementById('lang-btn')) {
      const b = document.createElement('button');
      b.id = 'lang-btn'; b.type = 'button'; b.setAttribute('data-label', 'Idioma'); b.title = 'Idioma'; b.setAttribute('aria-label', 'Idioma'); b.textContent = '🌐';
      menu.insertBefore(b, document.getElementById('account-btn') || null);
      b.addEventListener('click', open);
    }
    const cl = document.querySelector('.cover-links');
    if (cl && !document.getElementById('cover-lang')) {
      const b = document.createElement('button');
      b.id = 'cover-lang'; b.type = 'button'; b.setAttribute('data-nosound', ''); b.textContent = '🌐 Idioma';
      cl.appendChild(b);
      b.addEventListener('click', e => { e.stopPropagation(); open(); });
    }
  }

  function set(c) {   // 'auto' o un código de idioma
    try { if (c === 'auto') localStorage.removeItem('lang'); else localStorage.setItem('lang', c); } catch (e) {}
    apply(c === 'auto' ? detect() : c);
  }

  window.i18n = { get lang() { return lang; }, set, detect, t: tr, missing: () => [...missing].sort() };

  const init = saved() || detect();
  buildPicker();
  if (init !== 'es') apply(init);
})();
