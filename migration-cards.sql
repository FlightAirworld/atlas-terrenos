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
ALTER TABLE card_packs ADD COLUMN IF NOT EXISTS offered TEXT;   -- cartero: las 3 cartas ofrecidas al abrir un sobre
