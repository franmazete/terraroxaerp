/* ════════════════════════════════════════════════════════════════════
 * B6 — Importação de Contratos via CSV
 *
 * Mudanças no schema:
 *   1. RENAME: data_vencimento → data_vencto_financeiro
 *   2. ADD: safra, data_inicio, data_fim, empresa_origem_codigo,
 *           numero_origem, origem_descricao, valor_unitario_saca,
 *           valor_saldo
 *   3. Bucket Storage "importacoes" (privado) + RLS
 *   4. Tabela importacao_log para auditoria
 * ════════════════════════════════════════════════════════════════════ */

-- ─── 1. Rename limpo ────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='contratos' and column_name='data_vencimento'
  ) then
    alter table public.contratos rename column data_vencimento to data_vencto_financeiro;
  end if;
end $$;

-- ─── 2. Colunas novas + relaxar local_origem_id ─────────────────────
alter table public.contratos
  add column if not exists safra text,
  add column if not exists data_inicio date,
  add column if not exists data_fim date,
  add column if not exists empresa_origem_codigo text,
  add column if not exists numero_origem text,
  add column if not exists origem_descricao text,
  add column if not exists valor_unitario_saca numeric,
  add column if not exists valor_saldo numeric,
  add column if not exists operacao text;

create index if not exists ix_contratos_operacao on public.contratos(operacao) where operacao is not null;

-- Importação CSV não traz local_origem_id como UUID — vincula depois manualmente.
alter table public.contratos alter column local_origem_id drop not null;

comment on column public.contratos.safra is 'Safra do contrato (ex: "26-2026") — vem do CSV DESCSAFRA';
comment on column public.contratos.empresa_origem_codigo is 'Código do estabelecimento no ERP de origem — INFORMATIVO, não relaciona com nada';
comment on column public.contratos.numero_origem is 'Número do contrato no ERP de origem (ex: "5.328")';
comment on column public.contratos.origem_descricao is 'Texto livre da origem do CSV ("Cidade-UF, Razão Social") — não linka com locais';
comment on column public.contratos.valor_unitario_saca is 'R$ por saca de 60kg (convenção do mercado de grãos)';

-- Index pra busca por numero_origem (re-import)
create index if not exists ix_contratos_numero_origem on public.contratos(numero_origem) where numero_origem is not null;

-- ─── 3. Bucket Storage "importacoes" ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('importacoes', 'importacoes', false)
on conflict (id) do nothing;

-- RLS Storage: apenas admin e comercial podem ler/gravar
drop policy if exists "importacoes_select_cerealista" on storage.objects;
create policy "importacoes_select_cerealista" on storage.objects
  for select using (
    bucket_id = 'importacoes'
    and public.perfil_atual() in ('admin','comercial')
  );

drop policy if exists "importacoes_insert_cerealista" on storage.objects;
create policy "importacoes_insert_cerealista" on storage.objects
  for insert with check (
    bucket_id = 'importacoes'
    and public.perfil_atual() in ('admin','comercial')
  );

drop policy if exists "importacoes_update_cerealista" on storage.objects;
create policy "importacoes_update_cerealista" on storage.objects
  for update using (
    bucket_id = 'importacoes'
    and public.perfil_atual() in ('admin','comercial')
  );

drop policy if exists "importacoes_delete_cerealista" on storage.objects;
create policy "importacoes_delete_cerealista" on storage.objects
  for delete using (
    bucket_id = 'importacoes'
    and public.perfil_atual() in ('admin','comercial')
  );

-- ─── 4. Tabela de log das importações ───────────────────────────────
create table if not exists public.importacao_log (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('contratos','produtos','produtores','clientes','locais')),
  arquivo text not null,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  total_linhas int default 0,
  importadas int default 0,
  rejeitadas int default 0,
  produtores_criados int default 0,
  arquivo_erros text,
  status text not null default 'processando' check (status in ('processando','sucesso','sucesso_parcial','erro')),
  erro_geral text,
  executada_por uuid references public.usuarios(id),
  payload_amostra jsonb
);

create index if not exists ix_importacao_log_iniciada_em on public.importacao_log(iniciada_em desc);

comment on table public.importacao_log is 'Histórico de importações de CSV. Uma row por arquivo processado.';

-- RLS: cerealistas leem; só admin/comercial inserem
alter table public.importacao_log enable row level security;

drop policy if exists "importacao_log_select" on public.importacao_log;
create policy "importacao_log_select" on public.importacao_log
  for select using (public.is_cerealista());

drop policy if exists "importacao_log_insert" on public.importacao_log;
create policy "importacao_log_insert" on public.importacao_log
  for insert with check (public.perfil_atual() in ('admin','comercial'));

drop policy if exists "importacao_log_update" on public.importacao_log;
create policy "importacao_log_update" on public.importacao_log
  for update using (public.perfil_atual() in ('admin','comercial'));
