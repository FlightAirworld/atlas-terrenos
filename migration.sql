-- Cascada: columna para acumular las pérdidas de cada partida individual.
ALTER TABLE cascada_stats
  ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0;
