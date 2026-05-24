-- ════════════════════════════════════════════════════════════════════
-- B19.7 — Triggers para manter saldo_kg e reservado_kg sempre em sync
--
-- Problema: o app fazia recalculos manuais em algumas actions e esquecia
-- em outras (ex: criarReservaAction nunca incrementava reservado_kg).
-- Solucao: o banco passa a ser a fonte da verdade — toda mudanca em
-- cargas/reservas dispara recalculo automatico.
--
-- Regras:
--   cargas.reservado_kg = SUM(reservas.qtd_kg)
--     WHERE reservas.carga_id = X AND status IN ('pendente','aprovada')
--   contratos.saldo_kg = qtd_kg_total - COALESCE(SUM(cargas.total_kg), 0)
--     WHERE cargas.contrato_id = X AND status != 'cancelada'
--
-- Tambem adiciona coluna informativa qtd_kg_origem_erp para guardar
-- o NQTDSALDO do CSV (antes era sobrescrito em saldo_kg na importacao).
-- ════════════════════════════════════════════════════════════════════

-- 1. Nova coluna informativa pra guardar saldo do ERP de origem
alter table public.contratos
  add column if not exists qtd_kg_origem_erp integer;

comment on column public.contratos.qtd_kg_origem_erp is
  'Saldo em kg vindo do ERP de origem (CSV NQTDSALDO). Informativo: o saldo real do sistema esta em saldo_kg e e recalculado por trigger.';

-- 2. Funcao que recalcula cargas.reservado_kg de uma carga especifica
create or replace function public.recalcular_reservado_carga(p_carga_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.cargas
  set reservado_kg = coalesce((
    select sum(qtd_kg)::integer
    from public.reservas
    where carga_id = p_carga_id
      and status in ('pendente', 'aprovada')
  ), 0)
  where id = p_carga_id;
end;
$$;

-- 3. Funcao que recalcula contratos.saldo_kg de um contrato especifico
create or replace function public.recalcular_saldo_contrato(p_contrato_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total integer;
  v_usado integer;
begin
  select qtd_kg_total into v_total from public.contratos where id = p_contrato_id;
  if v_total is null then return; end if;

  select coalesce(sum(total_kg)::integer, 0) into v_usado
  from public.cargas
  where contrato_id = p_contrato_id
    and status != 'cancelada';

  update public.contratos
  set saldo_kg = greatest(0, v_total - v_usado)
  where id = p_contrato_id;
end;
$$;

-- 4. Trigger function: quando reserva muda, recalcula reservado_kg da carga
create or replace function public.trg_reservas_recalc_carga()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalcular_reservado_carga(old.carga_id);
    return old;
  else
    perform public.recalcular_reservado_carga(new.carga_id);
    -- Se mudou a carga (raro), recalcula a antiga tambem
    if (tg_op = 'UPDATE' and old.carga_id is distinct from new.carga_id) then
      perform public.recalcular_reservado_carga(old.carga_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists reservas_recalc_carga on public.reservas;
create trigger reservas_recalc_carga
  after insert or update or delete on public.reservas
  for each row execute function public.trg_reservas_recalc_carga();

-- 5. Trigger function: quando carga muda, recalcula saldo_kg do contrato
create or replace function public.trg_cargas_recalc_contrato()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalcular_saldo_contrato(old.contrato_id);
    return old;
  else
    perform public.recalcular_saldo_contrato(new.contrato_id);
    if (tg_op = 'UPDATE' and old.contrato_id is distinct from new.contrato_id) then
      perform public.recalcular_saldo_contrato(old.contrato_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists cargas_recalc_contrato on public.cargas;
create trigger cargas_recalc_contrato
  after insert or update or delete on public.cargas
  for each row execute function public.trg_cargas_recalc_contrato();

-- 6. Reset inicial: recalcula tudo a partir do estado atual
--    (zera inconsistencias acumuladas por bugs anteriores)
do $$
declare r record;
begin
  for r in select id from public.contratos loop
    perform public.recalcular_saldo_contrato(r.id);
  end loop;
  for r in select id from public.cargas loop
    perform public.recalcular_reservado_carga(r.id);
  end loop;
end$$;
