-- Cascada: tres botes globales e independientes.
-- Ejecutar una sola vez en Supabase > SQL Editor.
CREATE TABLE IF NOT EXISTS public.cascada_jackpots (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  rio BIGINT NOT NULL DEFAULT 0,
  mar BIGINT NOT NULL DEFAULT 0,
  cas BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

INSERT INTO public.cascada_jackpots (id, rio, mar, cas, updated_at)
VALUES (1, 0, 0, 0, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
ON CONFLICT (id) DO NOTHING;

-- Solo accede el servidor mediante su conexión privada de base de datos.
ALTER TABLE public.cascada_jackpots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cascada_jackpots FROM anon, authenticated;
