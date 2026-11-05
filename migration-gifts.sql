-- Regalos entre jugadores y paga mensual del dueño (el servidor ya lo ejecuta solo al arrancar; esto es por si prefieres hacerlo a mano en el SQL Editor de Supabase)
CREATE TABLE IF NOT EXISTS gifts (
  id BIGSERIAL PRIMARY KEY,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  from_nick TEXT NOT NULL,
  to_nick TEXT NOT NULL,
  credits INT NOT NULL CHECK (credits > 0),
  note TEXT,
  created_at BIGINT NOT NULL,
  seen_at BIGINT
);
CREATE INDEX IF NOT EXISTS gifts_to ON gifts (to_user, id);
CREATE INDEX IF NOT EXISTS gifts_from ON gifts (from_user, created_at);

CREATE TABLE IF NOT EXISTS owner_grants (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  credits INT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, month)
);
