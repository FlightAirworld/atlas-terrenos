-- Cascada: pérdida acumulada por partida + botes globales compartidos por todos.
ALTER TABLE cascada_stats
  ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cascada_jackpots (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rio BIGINT NOT NULL DEFAULT 0,
  mar BIGINT NOT NULL DEFAULT 0,
  cascada BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0
);
INSERT INTO cascada_jackpots (id, rio, mar, cascada, updated_at)
VALUES (1, 0, 0, 0, (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT)
ON CONFLICT (id) DO NOTHING;
