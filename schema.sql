-- Esquema de Atlas Terrenos (refleja la base de datos real de Supabase).
-- server.js ya crea/actualiza estas tablas al arrancar (CREATE ... IF NOT EXISTS); este archivo es la referencia
-- versionada y sirve para montar una base nueva a mano en el SQL Editor de Supabase. Es seguro ejecutarlo varias veces.
-- RLS: el servidor entra con DATABASE_URL (rol postgres, que se salta RLS). Las tablas llevan RLS activado y SIN políticas,
-- así la clave pública (anon) de Supabase no puede leer ni escribir nada directamente.

CREATE TABLE IF NOT EXISTS parcels (
  id TEXT PRIMARY KEY, x INT NOT NULL, y INT NOT NULL, owner TEXT NOT NULL, order_id TEXT, paid TEXT, currency TEXT,
  created_at BIGINT NOT NULL, avatar TEXT, country TEXT, user_id UUID, house TEXT, level SMALLINT NOT NULL DEFAULT 1,
  level_at BIGINT, city TEXT, city_try BIGINT, rotation SMALLINT NOT NULL DEFAULT 0, house_at BIGINT, house_prev TEXT,
  world TEXT NOT NULL DEFAULT 'tierra'   -- tierra, luna, marte, mercurio, venus, jupiter, saturno, urano, neptuno, pluton (cada mundo tiene sus parcelas; fuera de la Tierra el id es '<mundo>:x:y')
);
CREATE INDEX IF NOT EXISTS parcels_country_city ON parcels (country, city);
CREATE INDEX IF NOT EXISTS parcels_x_y ON parcels (x, y);
CREATE INDEX IF NOT EXISTS parcels_world_x_y ON parcels (world, x, y);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS world TEXT NOT NULL DEFAULT 'tierra';

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY, parcel_id TEXT NOT NULL, owner TEXT NOT NULL, status TEXT NOT NULL,
  expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL, avatar TEXT
);

CREATE TABLE IF NOT EXISTS packs (
  code TEXT PRIMARY KEY, credits INT NOT NULL CHECK (credits >= 0), created_at BIGINT NOT NULL, last_daily TEXT,
  streak INT NOT NULL DEFAULT 0, user_id UUID UNIQUE, last_collect BIGINT, prod_carry DOUBLE PRECISION DEFAULT 0,
  roulette_carry NUMERIC(6,2) NOT NULL DEFAULT 0, free_spins INT NOT NULL DEFAULT 0, free_upgrades INT NOT NULL DEFAULT 0
);

-- Packs VIP (los crea el administrador con POST /api/admin/vip): apodo y país fijos, se usan sin iniciar sesión
ALTER TABLE packs ADD COLUMN IF NOT EXISTS fixed_nick TEXT;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS fixed_country TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS packs_fixed_nick ON packs (lower(fixed_nick)) WHERE fixed_nick IS NOT NULL;

CREATE TABLE IF NOT EXISTS pack_orders (
  order_id TEXT PRIMARY KEY, status TEXT NOT NULL, code TEXT, created_at BIGINT NOT NULL, pack_credits INT, pack_price TEXT,
  user_id TEXT, capture_id TEXT, refunded_cents INT NOT NULL DEFAULT 0, disputed_cents INT NOT NULL DEFAULT 0,
  clawed_credits INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pack_orders_capture ON pack_orders (capture_id);

CREATE TABLE IF NOT EXISTS refund_events (event_id TEXT PRIMARY KEY, order_id TEXT, created_at BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS profiles (user_id UUID PRIMARY KEY, nickname TEXT NOT NULL, created_at BIGINT NOT NULL, avatar TEXT);

CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, ip_hash TEXT NOT NULL, PRIMARY KEY (day, ip_hash));
CREATE TABLE IF NOT EXISTS daily_ip (day TEXT NOT NULL, ip_hash TEXT NOT NULL, PRIMARY KEY (day, ip_hash));
CREATE TABLE IF NOT EXISTS last_claim_pos (key TEXT PRIMARY KEY, lat DOUBLE PRECISION, lng DOUBLE PRECISION, at BIGINT);

CREATE TABLE IF NOT EXISTS welcome_gifts (user_id TEXT PRIMARY KEY, credits INT NOT NULL, created_at BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS gifts (
  id BIGSERIAL PRIMARY KEY, from_user TEXT NOT NULL, to_user TEXT NOT NULL, from_nick TEXT NOT NULL, to_nick TEXT NOT NULL,
  credits INT NOT NULL CHECK (credits > 0), note TEXT, created_at BIGINT NOT NULL, seen_at BIGINT
);
CREATE INDEX IF NOT EXISTS gifts_to ON gifts (to_user, id);
CREATE INDEX IF NOT EXISTS gifts_from ON gifts (from_user, created_at);

CREATE TABLE IF NOT EXISTS owner_grants (
  user_id TEXT NOT NULL, month TEXT NOT NULL, credits INT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, month)
);
CREATE TABLE IF NOT EXISTS president_grants (
  city TEXT NOT NULL, month TEXT NOT NULL, user_id TEXT NOT NULL, credits INT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (city, month)
);
CREATE TABLE IF NOT EXISTS monthly_rewards (
  user_id TEXT NOT NULL, month TEXT NOT NULL, streak INT NOT NULL DEFAULT 0, last_day TEXT, PRIMARY KEY (user_id, month)
);
CREATE TABLE IF NOT EXISTS roulette_spins (
  user_id TEXT NOT NULL, day DATE NOT NULL, prize NUMERIC(8,2) NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS ref_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL, last_ip TEXT);
CREATE TABLE IF NOT EXISTS referrals (
  invitee_id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, created_at BIGINT NOT NULL, ip_hash TEXT, rewarded_at BIGINT,
  inviter_credits INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals (inviter_id);

CREATE TABLE IF NOT EXISTS chat_msgs (
  id BIGSERIAL PRIMARY KEY, zone TEXT NOT NULL, user_id TEXT NOT NULL, nick TEXT NOT NULL, avatar TEXT, country TEXT,
  text TEXT NOT NULL, created_at BIGINT NOT NULL, lat DOUBLE PRECISION, lng DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS chat_msgs_zone ON chat_msgs (zone, id);
CREATE INDEX IF NOT EXISTS chat_msgs_lat ON chat_msgs (lat);
CREATE TABLE IF NOT EXISTS chat_reacts (msg_id BIGINT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (msg_id, user_id));
CREATE TABLE IF NOT EXISTS friends (user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, friend_id));

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, tz TEXT, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs (user_id);
CREATE TABLE IF NOT EXISTS push_state (
  user_id TEXT PRIMARY KEY, last_seen BIGINT, unseen INT NOT NULL DEFAULT 0, last_any BIGINT, last_prod_push BIGINT,
  last_daily_push TEXT, last_full_push BIGINT, last_pres_push TEXT
);

CREATE TABLE IF NOT EXISTS arson_log (
  id BIGSERIAL PRIMARY KEY, parcel_id TEXT NOT NULL, x INT, y INT, owner TEXT, user_id TEXT, house TEXT, level SMALLINT,
  started_at BIGINT NOT NULL, ended_at BIGINT
);
CREATE TABLE IF NOT EXISTS arson_notices (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, parcel_id TEXT, house TEXT, created_at BIGINT NOT NULL,
  seen BOOLEAN NOT NULL DEFAULT FALSE, reward INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS santa_log (
  id BIGSERIAL PRIMARY KEY, parcel_id TEXT NOT NULL, x INT, y INT, owner TEXT, user_id TEXT, house TEXT,
  started_at BIGINT NOT NULL, gifted BOOLEAN NOT NULL DEFAULT FALSE, ended_at BIGINT
);
CREATE TABLE IF NOT EXISTS santa_notices (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, parcel_id TEXT, house TEXT, created_at BIGINT NOT NULL,
  reward INT NOT NULL DEFAULT 0, seen BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS santa_notices_user ON santa_notices (user_id, seen);

-- Retos: misiones diarias/semanales, logros y "me gusta" en terrenos
CREATE TABLE IF NOT EXISTS mission_progress (user_id TEXT NOT NULL, period TEXT NOT NULL, key TEXT NOT NULL, n INT NOT NULL DEFAULT 0, claimed BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY (user_id, period, key));
CREATE TABLE IF NOT EXISTS achievements (user_id TEXT NOT NULL, key TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, key));
CREATE TABLE IF NOT EXISTS parcel_likes (parcel_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (parcel_id, user_id));
CREATE INDEX IF NOT EXISTS parcel_likes_at ON parcel_likes (created_at);
CREATE INDEX IF NOT EXISTS parcel_likes_user ON parcel_likes (user_id);
CREATE TABLE IF NOT EXISTS retos_seen (user_id TEXT PRIMARY KEY, likes_seen BIGINT NOT NULL DEFAULT 0);

-- Álbum, clanes
CREATE TABLE IF NOT EXISTS album_claims (user_id TEXT NOT NULL, key TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, key));
CREATE TABLE IF NOT EXISTS clans (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, leader_id TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS clans_name_lower ON clans (lower(name));
CREATE TABLE IF NOT EXISTS clan_members (user_id TEXT PRIMARY KEY, clan_id BIGINT NOT NULL, joined_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS clan_members_clan ON clan_members (clan_id);

-- Pase Oro y diario
CREATE TABLE IF NOT EXISTS passes (user_id TEXT PRIMARY KEY, until BIGINT NOT NULL, bought_at BIGINT NOT NULL, times INT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS activity_seen (user_id TEXT PRIMARY KEY, seen_at BIGINT NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS fights (
  id BIGSERIAL PRIMARY KEY, day TEXT NOT NULL, attacker_user TEXT NOT NULL, attacker_parcel TEXT NOT NULL, defender_user TEXT NOT NULL,
  defender_parcel TEXT NOT NULL, chance SMALLINT NOT NULL, won BOOLEAN NOT NULL, prize INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS fights_attacker_day ON fights (attacker_user, day);
CREATE TABLE IF NOT EXISTS fight_stats (
  user_id TEXT NOT NULL, month TEXT NOT NULL, wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, last_at BIGINT NOT NULL, PRIMARY KEY (user_id, month)
);
CREATE INDEX IF NOT EXISTS fight_stats_rank ON fight_stats (month, wins DESC, losses, last_at);

-- RLS activado en todas (sin políticas: solo el servidor accede, con DATABASE_URL)
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Jugadores automáticos (Francóis 🇫🇷): una fila por bot y día, así solo reclama una parcela al día
CREATE TABLE IF NOT EXISTS bot_runs (bot TEXT NOT NULL, day TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (bot, day));
ALTER TABLE bot_runs ENABLE ROW LEVEL SECURITY;

-- Cartas coleccionables (el servidor ya las crea solo al arrancar; esto es por si prefieres hacerlo a mano en el SQL Editor de Supabase)
CREATE TABLE IF NOT EXISTS card_owned (season TEXT NOT NULL, card_id INT NOT NULL, user_id TEXT NOT NULL, obtained_at BIGINT NOT NULL, source TEXT, PRIMARY KEY (season, card_id));
CREATE INDEX IF NOT EXISTS card_owned_user ON card_owned (user_id, season);
CREATE TABLE IF NOT EXISTS card_packs (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, season TEXT NOT NULL, kind TEXT NOT NULL, source TEXT, created_at BIGINT NOT NULL, opened_at BIGINT, card_id INT);
CREATE INDEX IF NOT EXISTS card_packs_user ON card_packs (user_id, opened_at);
CREATE TABLE IF NOT EXISTS card_daily (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE TABLE IF NOT EXISTS card_claims (user_id TEXT NOT NULL, season TEXT NOT NULL, key TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, season, key));
CREATE TABLE IF NOT EXISTS card_trades (id BIGSERIAL PRIMARY KEY, season TEXT NOT NULL, from_user TEXT NOT NULL, to_user TEXT NOT NULL, from_nick TEXT NOT NULL, to_nick TEXT NOT NULL, offer_card INT, want_card INT, price INT, status TEXT NOT NULL DEFAULT 'open', created_at BIGINT NOT NULL, resolved_at BIGINT);
CREATE INDEX IF NOT EXISTS card_trades_to ON card_trades (to_user, status);
CREATE INDEX IF NOT EXISTS card_trades_from ON card_trades (from_user, status);
-- Ofertas de compra con créditos, avisos (punto rojo) y puja mensual de la Carta Negra 🖤
ALTER TABLE card_trades ADD COLUMN IF NOT EXISTS price INT;
ALTER TABLE card_trades ALTER COLUMN offer_card DROP NOT NULL;
CREATE TABLE IF NOT EXISTS card_notifs (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created_at BIGINT NOT NULL, seen_at BIGINT);
CREATE INDEX IF NOT EXISTS card_notifs_user ON card_notifs (user_id, seen_at);
CREATE TABLE IF NOT EXISTS card_auctions (month TEXT PRIMARY KEY, ends_at BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'open', winner_id TEXT, winner_nick TEXT, winning_bid INT, closed_at BIGINT);
CREATE TABLE IF NOT EXISTS card_bids (id BIGSERIAL PRIMARY KEY, month TEXT NOT NULL, user_id TEXT NOT NULL, nick TEXT NOT NULL, amount INT NOT NULL, created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS card_bids_month ON card_bids (month, amount DESC);
CREATE TABLE IF NOT EXISTS card_black (month TEXT PRIMARY KEY, user_id TEXT NOT NULL, nick TEXT, bid INT NOT NULL, obtained_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS card_black_user ON card_black (user_id);
ALTER TABLE card_notifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_black ENABLE ROW LEVEL SECURITY;
