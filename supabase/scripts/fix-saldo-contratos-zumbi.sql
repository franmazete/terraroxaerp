-- ════════════════════════════════════════════════════════════════════
-- Script de diagnóstico + correção de contratos com cargas fantasmas.
--
-- Sintoma: saldo_kg = 0 mas você não publicou nenhuma carga daquele
-- contrato. Causa provável: cargas zumbi de testes antigos OU bug
-- antigo do PublicarCargaModal que auto-preenchia total_kg = saldo_kg.
--
-- Como usar:
--   1. Rode a PARTE 1 (diagnóstico) — só SELECT, não muda nada
--   2. Olha a saída — confirma que as cargas listadas realmente são
--      lixo (data antiga, sem reserva, sem OC etc.)
--   3. Rode a PARTE 2 (correção) — cancela as cargas
--   4. O trigger de recalcular_saldo_contrato dispara automaticamente
--      e o saldo_kg volta ao correto
-- ════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — DIAGNÓSTICO (só leitura)                              ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1a. Mostra os contratos afetados com seu saldo atual
select
  c.id,
  c.numero,
  c.numero_manual,
  c.qtd_kg_total,
  c.saldo_kg,
  c.qtd_kg_origem_erp as saldo_erp_csv,
  (c.qtd_kg_total - c.saldo_kg) as somatorio_cargas_calc
from public.contratos c
where c.numero_manual in ('10718', '10719');

-- 1b. Lista TODAS as cargas vinculadas a esses contratos
select
  ca.id          as carga_id,
  ca.contrato_interno,
  ca.total_kg,
  ca.reservado_kg,
  ca.status,
  ca.publicada_em,
  ca.criado_em,
  ca.obs,
  -- existem reservas?
  (select count(*) from public.reservas r where r.carga_id = ca.id) as qtd_reservas,
  -- existem OCs?
  (select count(*) from public.ordens_carregamento o
   where o.carga_id = ca.id) as qtd_ocs
from public.cargas ca
join public.contratos c on c.id = ca.contrato_id
where c.numero_manual in ('10718', '10719')
order by c.numero_manual, ca.criado_em;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — CORREÇÃO                                              ║
-- ║                                                                  ║
-- ║ Marca as cargas-lixo como 'cancelada' (preserva histórico).      ║
-- ║ O trigger cargas_recalc_contrato dispara e o saldo se ajusta.    ║
-- ║                                                                  ║
-- ║ Filtros aplicados (só cancela se TODOS forem verdade):           ║
-- ║   - status atual = 'disponivel' ou 'parcial' (não fechada)       ║
-- ║   - SEM reservas vinculadas                                      ║
-- ║   - SEM OCs vinculadas                                           ║
-- ║                                                                  ║
-- ║ → cargas que nunca foram usadas, são realmente fantasmas.        ║
-- ║                                                                  ║
-- ║ DESCOMENTE pra executar:                                         ║
-- ╚══════════════════════════════════════════════════════════════════╝

/*
update public.cargas ca
set status = 'cancelada',
    obs = coalesce(ca.obs || ' · ', '') || 'Cancelada por script de fix (carga zumbi sem reserva/OC) - ' || current_date::text
from public.contratos c
where ca.contrato_id = c.id
  and c.numero_manual in ('10718', '10719')
  and ca.status in ('disponivel', 'parcial')
  and not exists (select 1 from public.reservas r where r.carga_id = ca.id)
  and not exists (select 1 from public.ordens_carregamento o where o.carga_id = ca.id);
*/

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ PARTE 3 — VERIFICAÇÃO                                            ║
-- ║                                                                  ║
-- ║ Rode depois da PARTE 2 pra confirmar que o saldo voltou ao       ║
-- ║ esperado. Se ainda estiver 0, alguma carga restante ainda está   ║
-- ║ ativa — repete o ciclo investigar/corrigir.                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Verifica saldo após correção
select
  c.numero_manual,
  c.qtd_kg_total                       as total_kg,
  c.saldo_kg                           as saldo_atual,
  (c.qtd_kg_total - c.saldo_kg)        as cargas_ativas_kg,
  -- soma só as cargas não-canceladas
  coalesce((
    select sum(ca.total_kg)
    from public.cargas ca
    where ca.contrato_id = c.id
      and ca.status != 'cancelada'
  ), 0) as soma_real_cargas_ativas
from public.contratos c
where c.numero_manual in ('10718', '10719');

-- Se quiser FORÇAR um recálculo manual sem mexer nas cargas
-- (útil se o saldo não bate com a soma real):
/*
select public.recalcular_saldo_contrato(c.id)
from public.contratos c
where c.numero_manual in ('10718', '10719');
*/
