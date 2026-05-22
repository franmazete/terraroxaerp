-- ════════════════════════════════════════════════════════════════════
-- terraroxa — Complementos definitivos (Bloco B2)
-- Data: 2026-05-22
--
-- Objetivo: fechar gaps detectados na auditoria schema vs types.ts.
-- Esta migration é idempotente — pode ser re-aplicada com segurança.
--
-- Conteúdo:
--   1. Tabela `permissoes` (matriz perfil × módulo × ação)
--   2. Coluna `atualizado_em` + trigger em entidades editáveis
--   3. Funções utilitárias: próximos números sequenciais, calc_quebra
--   4. Indexes extras para queries comuns
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1) TABELA permissoes (matriz perfil × módulo × ação)
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'modulo_t') then
    create type modulo_t as enum (
      'dashboard', 'usuarios', 'transportadoras', 'motoristas', 'veiculos',
      'terminais', 'locais', 'produtores', 'clientes', 'produtos',
      'contratos', 'cargas', 'reservas', 'ordens_carregamento',
      'notas_fiscais', 'ctes', 'romaneios', 'historico',
      'pendencias', 'relatorios', 'faturamentos'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'acao_t') then
    create type acao_t as enum (
      'visualizar', 'criar', 'editar', 'excluir', 'aprovar',
      'cancelar', 'anexar_doc', 'baixar_doc'
    );
  end if;
end$$;

create table if not exists public.permissoes (
  id uuid primary key default gen_random_uuid(),
  perfil perfil_t not null,
  modulo modulo_t not null,
  acao acao_t not null,
  permitido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique (perfil, modulo, acao)
);

alter table public.permissoes enable row level security;

drop policy if exists "permissoes_select_logado" on public.permissoes;
create policy "permissoes_select_logado" on public.permissoes
  for select using (auth.uid() is not null);

drop policy if exists "permissoes_cud_admin" on public.permissoes;
create policy "permissoes_cud_admin" on public.permissoes
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.permissoes is
  'Matriz de permissões por perfil × módulo × ação. Default sempre nega; só admin pode editar.';

-- Seed inicial: cerealista (admin/comercial/logística/fiscal/financeiro) pode TUDO
insert into public.permissoes (perfil, modulo, acao, permitido)
select p, m, a, true
from unnest(array['admin','comercial','logistica','fiscal','financeiro']::perfil_t[]) p
cross join unnest(enum_range(null::modulo_t)) m
cross join unnest(enum_range(null::acao_t)) a
on conflict (perfil, modulo, acao) do nothing;

-- Transportadora: visualizar cargas/reservas/ordens, criar reserva, anexar docs
insert into public.permissoes (perfil, modulo, acao, permitido) values
  ('transportadora', 'dashboard', 'visualizar', true),
  ('transportadora', 'cargas', 'visualizar', true),
  ('transportadora', 'reservas', 'visualizar', true),
  ('transportadora', 'reservas', 'criar', true),
  ('transportadora', 'ordens_carregamento', 'visualizar', true),
  ('transportadora', 'ordens_carregamento', 'anexar_doc', true),
  ('transportadora', 'motoristas', 'visualizar', true),
  ('transportadora', 'motoristas', 'criar', true),
  ('transportadora', 'veiculos', 'visualizar', true),
  ('transportadora', 'veiculos', 'criar', true),
  ('transportadora', 'pendencias', 'visualizar', true)
on conflict (perfil, modulo, acao) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 2) atualizado_em + trigger em entidades editáveis
-- ════════════════════════════════════════════════════════════════════

-- Função reusável (idempotente)
create or replace function public.tg_set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- Helper: adiciona coluna + trigger em tabela (idempotente)
do $$
declare
  tabela text;
  tabelas text[] := array[
    'transportadoras', 'motoristas', 'veiculos', 'produtores', 'clientes',
    'terminais', 'locais', 'produtos', 'contratos', 'cargas', 'reservas',
    'ordens_carregamento', 'autorizacoes_carregamento',
    'notas_fiscais', 'ctes', 'romaneios', 'solicitacoes_troca_nota',
    'dados_descarga', 'faturamentos', 'pendencias', 'documentos_operacao',
    'tickets_carregamento', 'laudos_classificacao', 'anexos_agendamento',
    'avisos_refugo', 'ctes_retorno', 'estadias', 'quebras',
    'ia_analises_fatura'
  ];
begin
  foreach tabela in array tabelas loop
    -- 1) Adiciona coluna se não existir
    execute format(
      'alter table public.%I add column if not exists atualizado_em timestamptz not null default now()',
      tabela
    );
    -- 2) Drop trigger antigo (se existir) e recria
    execute format('drop trigger if exists trg_%I_atualizado_em on public.%I', tabela, tabela);
    execute format(
      'create trigger trg_%I_atualizado_em before update on public.%I for each row execute function public.tg_set_atualizado_em()',
      tabela, tabela
    );
  end loop;
end$$;

-- ════════════════════════════════════════════════════════════════════
-- 3) RPCs: números sequenciais humanos (CT-2026-0001, OC-2026-0001)
-- ════════════════════════════════════════════════════════════════════

-- Sequence dedicada por ano (resetada manualmente em janeiro se quiser)
create sequence if not exists public.seq_numero_contrato start 1;
create sequence if not exists public.seq_numero_oc start 1;

create or replace function public.proximo_numero_contrato()
returns text language plpgsql security definer set search_path = public as $$
declare
  ano int := extract(year from now())::int;
  n int := nextval('public.seq_numero_contrato');
begin
  return format('CT-%s-%s', ano, lpad(n::text, 4, '0'));
end;
$$;

create or replace function public.proximo_numero_oc()
returns text language plpgsql security definer set search_path = public as $$
declare
  ano int := extract(year from now())::int;
  n int := nextval('public.seq_numero_oc');
begin
  return format('OC-%s-%s', ano, lpad(n::text, 4, '0'));
end;
$$;

-- Inicializa as sequences pela quantidade atual (idempotente)
do $$
declare
  ct int;
  oc int;
begin
  select count(*) into ct from public.contratos;
  select count(*) into oc from public.ordens_carregamento;
  if ct > 0 then perform setval('public.seq_numero_contrato', ct, true); end if;
  if oc > 0 then perform setval('public.seq_numero_oc', oc, true); end if;
end$$;

-- ════════════════════════════════════════════════════════════════════
-- 4) Função utilitária: cálculo de quebra (espelha lib/domain/checklist.ts)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.calcular_quebra(
  peso_carregado_kg integer,
  peso_descarregado_kg integer,
  limite_pct numeric default 0.5
)
returns table (quebra_kg integer, quebra_pct numeric, alerta boolean)
language plpgsql immutable as $$
begin
  quebra_kg := peso_carregado_kg - peso_descarregado_kg;
  quebra_pct := case
    when peso_carregado_kg > 0
      then round((quebra_kg::numeric / peso_carregado_kg::numeric) * 100, 2)
    else 0
  end;
  alerta := quebra_pct > limite_pct;
  return next;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 5) Indexes adicionais
-- ════════════════════════════════════════════════════════════════════

-- Buscas por número (CT-XXX, OC-XXX) — comuns nas listagens
create index if not exists idx_contratos_numero on public.contratos (numero);
create index if not exists idx_contratos_numero_manual on public.contratos (numero_manual) where numero_manual is not null;
create index if not exists idx_oc_numero on public.ordens_carregamento (numero);

-- Período (relatórios)
create index if not exists idx_oc_emitida_em on public.ordens_carregamento (emitida_em desc);
create index if not exists idx_contratos_data_emissao on public.contratos (data_emissao desc) where data_emissao is not null;

-- Lookup por produto/produtor (top-5 dashboards comerciais)
create index if not exists idx_contratos_produto on public.contratos (produto_id);
create index if not exists idx_contratos_produtor on public.contratos (produtor_id);

-- Quebras por OC (relatório fiscal)
create index if not exists idx_quebras_oc on public.quebras (oc_id);
create index if not exists idx_quebras_alerta on public.quebras (alerta) where alerta = true;

-- ════════════════════════════════════════════════════════════════════
-- 6) Comments para Studio (documentação inline)
-- ════════════════════════════════════════════════════════════════════

comment on function public.proximo_numero_contrato() is
  'Gera próximo número humano de contrato no formato CT-YYYY-NNNN. Idempotente, usa sequence dedicada.';

comment on function public.proximo_numero_oc() is
  'Gera próximo número humano de OC no formato OC-YYYY-NNNN.';

comment on function public.calcular_quebra(integer, integer, numeric) is
  'Calcula quebra entre carregado e descarregado. Retorna (kg, %, alerta>limite). Espelha lib/domain/checklist.ts.';
