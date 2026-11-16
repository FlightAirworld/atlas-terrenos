-- Presidente de cada país (mundo "tierra").
-- Cuenta solo parcelas de cuentas reales (user_id no nulo).
-- Desempata por quién reclamó antes (created_at más antiguo).
-- La columna "ventaja" son las parcelas de diferencia sobre el segundo:
-- la app puede exigir un mínimo (p. ej. 5) antes de mostrar el título.
--
-- Nota: esta vista calcula el líder en este momento. La regla de
-- "para quitarle el puesto hay que ganar por X" necesita guardar el
-- presidente actual en una tabla aparte.
--
-- Para alcalde de cada ciudad: copiar la vista, cambiar "country" por
-- "city" y llamarla presidentes_ciudad (antes hay que completar las
-- ciudades que faltan en parcels.city).

create or replace view presidentes_pais
with (security_invoker = true) as
with cuenta as (
  select
    country,
    user_id,
    (array_agg(owner order by created_at desc))[1] as apodo,
    count(*)        as parcelas,
    min(created_at) as primera
  from parcels
  where world = 'tierra'
    and user_id is not null
    and country is not null and country <> ''
  group by country, user_id
),
orden as (
  select
    *,
    row_number() over (partition by country order by parcelas desc, primera asc) as pos,
    lead(parcelas)  over (partition by country order by parcelas desc, primera asc) as segundo
  from cuenta
)
select
  country,
  user_id,
  apodo as presidente,
  parcelas,
  coalesce(parcelas - segundo, parcelas) as ventaja
from orden
where pos = 1;

-- Solo el servidor del juego debe leer esta vista; no se expone por la API pública.
revoke all on presidentes_pais from anon, authenticated;
