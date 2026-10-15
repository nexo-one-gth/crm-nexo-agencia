-- REVISIÓN DE DNI DUPLICADOS EN LEADS (solo lectura, no modifica nada)
-- Regla: se conserva la copia MÁS ANTIGUA de cada DNI; las demás figuran como ELIMINAR.
-- Excepción: si alguna copia tiene alta o cotización, se conserva esa (no se pierde trabajo).
-- Solo leads activos (deleted_at IS NULL). DNI normalizado (solo dígitos).
-- Uso: pegar en Supabase > SQL Editor > Run > "Download CSV".

with n as (
  select l.*, regexp_replace(l.dni, '\D', '', 'g') as d
  from leads l
  where l.deleted_at is null and l.dni is not null and btrim(l.dni) <> ''
),
g as (select d from n where d <> '' group by d having count(*) > 1),
y as (
  select n.*,
         (select count(*) from altas a where a.lead_id = n.id)            as n_altas,
         (select count(*) from lead_cotizaciones c where c.lead_id = n.id) as n_cotizaciones,
         (select count(*) from activities a where a.lead_id = n.id)       as n_historial
  from n join g using (d)
),
x as (
  select y.*,
         row_number() over (partition by d order by (n_altas + n_cotizaciones > 0) desc, created_at, id) as pos,
         row_number() over (partition by d order by created_at, id) as pos_antigua
  from y
)
select x.d as dni,
       x.id as lead_id,
       btrim(x.first_name || ' ' || x.last_name) as nombre,
       coalesce(btrim(p.first_name || ' ' || p.last_name), 'sin asignar') as asesor,
       s.name as etapa,
       x.created_at::date as fecha_carga,
       x.n_altas, x.n_cotizaciones, x.n_historial,
       case when pos = 1 and pos_antigua = 1 then 'CONSERVAR'
            when pos = 1 then 'CONSERVAR (excepcion: tiene alta/cotizacion)'
            else 'ELIMINAR' end as accion
from x
left join profiles p on p.id = x.assigned_to
left join pipeline_stages s on s.id = x.pipeline_stage_id
order by x.d, x.pos;
