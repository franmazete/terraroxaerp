-- ════════════════════════════════════════════════════════════════════
-- terraroxa — Schema completo
-- Data: 2026-05-20
-- Cobre: Bloco A (fundação) + G (refinamentos) + I (TMS/fiscal) + J (gating)
-- KG canônico em pesos. Single-tenant — sem coluna org_id por enquanto.
-- RLS: habilitada nas tabelas mas SEM POLICIES (vem na próxima migration 0002).
-- ════════════════════════════════════════════════════════════════════

-- ─── Extensões ───────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- emails case-insensitive

-- ════════════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════════════

create type perfil_t as enum (
  'admin', 'comercial', 'logistica', 'fiscal', 'financeiro',
  'transportadora', 'motorista', 'cliente'
);

create type role_t as enum ('cerealista', 'transportadora');

create type transp_status_t as enum ('ativa', 'inativa', 'pendente');

create type tipo_veiculo_t as enum ('Bitrem', 'Rodotrem', 'Treminhão', 'Carreta Simples', 'Truck');

create type tipo_produtor_t as enum ('vendedor', 'comprador', 'ambos');

create type tipo_terminal_t as enum ('terminal', 'armazem', 'porto', 'cliente');

create type tipo_local_t as enum ('fazenda', 'armazem_origem', 'destino', 'porto', 'terminal');

create type contrato_status_t as enum ('ativo', 'concluido', 'cancelado', 'rascunho');

create type tipo_contrato_t as enum ('compra', 'venda');

create type carga_status_t as enum ('disponivel', 'parcial', 'fechada', 'cancelada');

create type reserva_status_t as enum ('pendente', 'aprovada', 'reprovada', 'cancelada');

create type reserva_etapa_t as enum (
  'reserva_pendente', 'reserva_aprovada', 'aguard_docs', 'docs_ok',
  'aguard_ordem', 'ordem_emitida', 'carregando', 'em_transito',
  'descarregado', 'finalizado'
);

create type oc_origem_t as enum ('automatica_reserva', 'manual_logistica');

create type oc_status_t as enum (
  'emitida', 'aguardando_docs', 'em_carregamento', 'em_transito',
  'descarregada', 'finalizada', 'cancelada'
);

create type oc_status_operacional_t as enum (
  'aguardando_autorizacao', 'oc_emitida', 'carregando', 'em_transito',
  'aguardando_descarga', 'descarregado', 'operacional_concluido'
);

create type oc_status_fiscal_t as enum (
  'aguardando_nf', 'nf_recebida', 'nf_em_analise', 'troca_solicitada',
  'troca_aprovada', 'nf_substituida', 'nf_validada', 'aguardando_cte',
  'cte_recebido', 'liberado_faturamento'
);

create type oc_status_financeiro_t as enum (
  'aguardando_liberacao', 'calculado', 'fatura_anexada', 'em_conferencia',
  'divergencia', 'pago', 'finalizado'
);

create type nf_status_t as enum ('ativa', 'substituida', 'cancelada');

create type cte_status_sefaz_t as enum (
  'rascunho', 'transmitido', 'autorizado', 'rejeitado', 'cancelado'
);

create type cte_origem_t as enum ('emissao', 'substituicao_manual');

create type troca_nota_status_t as enum ('pendente', 'aprovada', 'rejeitada', 'cancelada');

create type faturamento_status_t as enum (
  'aguardando_liberacao_fiscal', 'calculado', 'fatura_anexada',
  'em_conferencia', 'divergencia', 'aprovado', 'pago'
);

create type pendencia_setor_t as enum (
  'comercial', 'logistica', 'fiscal', 'financeiro', 'transportadora'
);

create type pendencia_categoria_t as enum (
  'aprovar_reserva', 'anexar_autorizacao_carreg', 'anexar_ticket_carreg',
  'registrar_descarga', 'validar_descarga', 'anexar_ticket_descarga',
  'anexar_laudo', 'anexar_nf', 'validar_nf', 'aprovar_troca_nf',
  'anexar_nova_nf', 'anexar_cte', 'liberar_faturamento', 'anexar_fatura',
  'processar_pagamento',
  -- Bloco J
  'anexar_agendamento', 'confirmar_refugo', 'anexar_cte_retorno',
  'calc_quebra', 'conferir_fatura_ia', 'conferir_fatura_fiscal'
);

create type pendencia_status_t as enum ('aberta', 'resolvida', 'cancelada');

create type categoria_documento_t as enum (
  'autorizacao_carregamento', 'ticket_carregamento', 'comprovante_fazenda',
  'peso_origem', 'ticket_descarga', 'laudo_classificacao',
  'comprovante_porto', 'canhoto', 'peso_descarga', 'nota_fiscal', 'cte',
  'fatura_transp', 'comprovante_pagamento', 'outros',
  -- Bloco J
  'anexo_agendamento', 'aviso_refugo', 'cte_retorno', 'estadia'
);

create type doc_operacao_status_t as enum (
  'enviado', 'em_analise', 'aprovado', 'rejeitado', 'substituido'
);

create type aviso_refugo_status_t as enum (
  'aguardando_confirmacao', 'confirmado', 'rejeitado'
);

create type ia_status_t as enum ('pendente', 'aprovada', 'divergencia', 'erro');

create type ia_campo_t as enum ('valor_frete', 'transportadora', 'prestador', 'numero_cte');

create type historico_tipo_t as enum ('g', 'a', 'b', 'r', 't');

create type historico_acao_t as enum (
  'criou', 'editou', 'aprovou', 'reprovou', 'cancelou', 'publicou',
  'anexou', 'substituiu', 'validou', 'rejeitou', 'solicitou_troca',
  'aprovou_troca', 'rejeitou_troca', 'liberou_faturamento',
  'anexou_fatura', 'pagou', 'finalizou'
);

create type notificacao_tipo_t as enum ('info', 'alerta', 'sucesso', 'erro');

create type vinculo_local_t as enum ('terminal', 'produtor', 'cliente');

-- ════════════════════════════════════════════════════════════════════
-- CADASTROS BASE
-- ════════════════════════════════════════════════════════════════════

-- USUARIOS — sincronizado com auth.users via trigger (user_id == auth.uid())
create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email citext not null unique,
  nome text not null,
  perfil perfil_t not null,
  transp_id uuid, -- FK adicionada após transportadoras
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- PRODUTOS
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

-- PRODUTORES
create table public.produtores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  razao_social text,
  cpf_cnpj text not null,
  tipo tipo_produtor_t default 'vendedor',
  cidade text not null,
  uf char(2) not null,
  contato text not null,
  email citext,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- CLIENTES
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text not null,
  cidade text not null,
  uf char(2) not null,
  contato text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- TERMINAIS
create table public.terminais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null,
  cidade text not null,
  uf char(2) not null,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cep text,
  contato text not null,
  tipo tipo_terminal_t not null,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- LOCAIS
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_local_t not null,
  cidade text not null,
  uf char(2) not null,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cep text,
  vinculado_entidade vinculo_local_t,
  vinculado_id uuid,
  -- Bloco J: contato + maps
  contato_nome text,
  contato_whatsapp text,
  contato_email citext,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  criado_em timestamptz not null default now()
);

-- TRANSPORTADORAS
create table public.transportadoras (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj_cpf text not null unique,
  inscricao_estadual text,
  rntrc text,
  telefone text not null,
  email citext not null,
  responsavel text not null,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf char(2),
  endereco_cep text,
  status transp_status_t not null default 'pendente',
  criada_em timestamptz not null default now()
);

-- agora podemos referenciar transportadoras a partir de usuarios
alter table public.usuarios
  add constraint usuarios_transp_id_fkey
  foreign key (transp_id) references public.transportadoras(id) on delete set null;

-- MOTORISTAS (entidade global identificada por CPF)
create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null unique,
  cnh text not null,
  celular text not null,
  email citext,
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- N:N motorista × transportadora (autônomos rodam pra várias)
create table public.motorista_transportadoras (
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  transp_id uuid not null references public.transportadoras(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (motorista_id, transp_id)
);

-- VEÍCULOS (entidade global identificada por placa)
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa_cavalo text not null unique,
  placa_carreta text,
  tipo tipo_veiculo_t not null,
  capacidade_kg integer not null check (capacidade_kg > 0),
  crlv_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- N:N veiculo × transportadora
create table public.veiculo_transportadoras (
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  transp_id uuid not null references public.transportadoras(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (veiculo_id, transp_id)
);

-- ════════════════════════════════════════════════════════════════════
-- CONTRATOS / CARGAS / RESERVAS / OCs
-- ════════════════════════════════════════════════════════════════════

-- CONTRATOS
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  numero_manual text,
  tipo_contrato tipo_contrato_t,
  produtor_id uuid not null references public.produtores(id) on delete restrict,
  local_origem_id uuid not null references public.locais(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  qtd_kg_total integer not null check (qtd_kg_total > 0),
  saldo_kg integer not null check (saldo_kg >= 0),
  quantidade_cotas integer,
  cliente_id uuid references public.clientes(id) on delete set null,
  destino_local_id uuid references public.locais(id) on delete set null,
  terminal_id uuid references public.terminais(id) on delete set null,
  porto_id uuid references public.terminais(id) on delete set null,
  data_emissao date,
  data_vencimento date,
  valor_unitario numeric(12, 4),
  valor_total numeric(14, 2),
  observacoes text,
  status contrato_status_t not null default 'ativo',
  disponivel boolean not null default false,
  criado_por_user_id uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- ANEXOS DO CONTRATO
create table public.contrato_anexos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  nome_arquivo text not null,
  url text not null,
  anexado_em timestamptz not null default now()
);

-- CARGAS
create table public.cargas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  contrato_interno text not null,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  produto text not null,
  tipo_carga text not null,
  origem_local_id uuid not null references public.locais(id) on delete restrict,
  destino_local_id uuid references public.locais(id) on delete set null,
  origem text not null,
  destino text,
  total_kg integer not null check (total_kg > 0),
  reservado_kg integer not null default 0 check (reservado_kg >= 0),
  data_carg date not null,
  obs text,
  status carga_status_t not null default 'disponivel',
  publicada_em date not null default current_date,
  criado_em timestamptz not null default now()
);

-- ALLOWLIST DE TRANSPORTADORAS POR CARGA
create table public.carga_transps_permitidas (
  carga_id uuid not null references public.cargas(id) on delete cascade,
  transp_id uuid not null references public.transportadoras(id) on delete cascade,
  primary key (carga_id, transp_id)
);

-- RESERVAS
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references public.cargas(id) on delete cascade,
  transp_id uuid not null references public.transportadoras(id) on delete restrict,
  transp_nome text not null,
  motorista_id uuid references public.motoristas(id) on delete set null,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  motorista text,
  placa text,
  carreta text,
  cpf text,
  cnh text,
  tipo_veiculo text,
  rntrc_motorista text,
  qtd_kg integer not null check (qtd_kg > 0),
  frete_ton numeric(10, 2) not null check (frete_ton > 0),
  status reserva_status_t not null default 'pendente',
  etapa reserva_etapa_t default 'reserva_pendente',
  data date not null default current_date,
  obs text,
  criada_em timestamptz not null default now()
);

-- AUTORIZAÇÃO DE CARREGAMENTO (Bloco I — dispara OC)
create table public.autorizacoes_carregamento (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references public.reservas(id) on delete restrict,
  carga_id uuid not null references public.cargas(id) on delete restrict,
  transp_id uuid not null references public.transportadoras(id) on delete restrict,
  arquivo_url text not null,
  nome_arquivo text not null,
  observacoes text,
  anexada_por_user_id uuid references public.usuarios(id) on delete set null,
  anexada_por_nome text not null,
  anexada_em timestamptz not null default now()
);

-- ORDENS DE CARREGAMENTO
create table public.ordens_carregamento (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  carga_id uuid not null references public.cargas(id) on delete restrict,
  reserva_id uuid references public.reservas(id) on delete set null,
  transp_id uuid not null references public.transportadoras(id) on delete restrict,
  motorista_id uuid references public.motoristas(id) on delete set null,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  local_carg_id uuid not null references public.locais(id) on delete restrict,
  destino_local_id uuid references public.locais(id) on delete set null,
  terminal_id uuid references public.terminais(id) on delete set null,
  peso_previsto_kg integer not null check (peso_previsto_kg > 0),
  status oc_status_t not null default 'emitida',
  origem oc_origem_t not null,
  emitida_por_user_id uuid references public.usuarios(id) on delete set null,
  emitida_por_nome text not null,
  observacoes text,
  -- 3 trilhas paralelas
  status_operacional oc_status_operacional_t,
  status_fiscal oc_status_fiscal_t,
  status_financeiro oc_status_financeiro_t,
  -- FKs preenchidos ao longo do fluxo
  nota_fiscal_id uuid,
  cte_id uuid,
  romaneio_id uuid,
  autorizacao_id uuid references public.autorizacoes_carregamento(id) on delete set null,
  descarga_id uuid,
  faturamento_id uuid,
  -- Bloco J
  ticket_carregamento_id uuid,
  laudo_classificacao_id uuid,
  anexo_agendamento_id uuid,
  aviso_refugo_id uuid,
  cte_retorno_id uuid,
  estadia_id uuid,
  quebra_id uuid,
  ia_analise_id uuid,
  refugada boolean not null default false,
  emitida_em date not null default current_date,
  criada_em timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- FISCAL — NFs / CTEs / ROMANEIOS / TROCA NF
-- ════════════════════════════════════════════════════════════════════

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  numero text not null,
  chave_nfe text,
  valor numeric(14, 2) not null check (valor >= 0),
  emitida_em date not null,
  xml_url text,
  status nf_status_t default 'ativa',
  substitui_nf_id uuid references public.notas_fiscais(id) on delete set null,
  substituida_por_nf_id uuid references public.notas_fiscais(id) on delete set null,
  motivo_substituicao text,
  trocada_em timestamptz,
  trocada_por_user_id uuid references public.usuarios(id) on delete set null,
  criada_em timestamptz not null default now()
);

create table public.ctes (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  numero text not null,
  chave_cte text,
  status_sefaz cte_status_sefaz_t not null,
  emitido_em date not null,
  xml_url text,
  origem cte_origem_t,
  substitui_cte_id uuid references public.ctes(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.romaneios (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  numero text not null,
  peso_bruto_kg integer not null check (peso_bruto_kg > 0),
  peso_tara_kg integer not null check (peso_tara_kg >= 0),
  peso_liquido_kg integer not null check (peso_liquido_kg >= 0),
  emitido_em date not null,
  anexo_url text,
  criado_em timestamptz not null default now()
);

create table public.solicitacoes_troca_nota (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  nf_original_id uuid not null references public.notas_fiscais(id) on delete restrict,
  motivo text not null,
  solicitada_por_user_id uuid references public.usuarios(id) on delete set null,
  solicitada_por_nome text not null,
  status troca_nota_status_t not null default 'pendente',
  decidida_em timestamptz,
  decidida_por_user_id uuid references public.usuarios(id) on delete set null,
  observacao_fiscal text,
  nova_nf_id uuid references public.notas_fiscais(id) on delete set null,
  solicitada_em timestamptz not null default now()
);

-- FKs do OC pra NFs / CTEs / Romaneios (agora que tabelas existem)
alter table public.ordens_carregamento
  add constraint ordens_carregamento_nf_fkey
  foreign key (nota_fiscal_id) references public.notas_fiscais(id) on delete set null;
alter table public.ordens_carregamento
  add constraint ordens_carregamento_cte_fkey
  foreign key (cte_id) references public.ctes(id) on delete set null;
alter table public.ordens_carregamento
  add constraint ordens_carregamento_romaneio_fkey
  foreign key (romaneio_id) references public.romaneios(id) on delete set null;

-- ════════════════════════════════════════════════════════════════════
-- BLOCO I — Descarga / Faturamento / Pagamento / Pendências / Documentos
-- ════════════════════════════════════════════════════════════════════

create table public.dados_descarga (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  peso_descarregado_kg integer not null check (peso_descarregado_kg >= 0),
  ticket_descarga_url text,
  laudo_classificacao_url text,
  comprovante_porto_url text,
  canhoto_url text,
  descarregado_por_user_id uuid references public.usuarios(id) on delete set null,
  observacoes text,
  validado_em timestamptz,
  validado_por_user_id uuid references public.usuarios(id) on delete set null,
  rejeitado_em timestamptz,
  rejeitado_por_user_id uuid references public.usuarios(id) on delete set null,
  motivo_rejeicao text,
  descarregado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_descarga_fkey
  foreign key (descarga_id) references public.dados_descarga(id) on delete set null;

create table public.faturamentos (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  peso_base_kg integer not null check (peso_base_kg > 0),
  frete_ton numeric(10, 2) not null check (frete_ton >= 0),
  valor_calculado numeric(14, 2) not null check (valor_calculado >= 0),
  valor_informado numeric(14, 2),
  divergencia numeric(14, 2),
  justificativa_divergencia text,
  fatura_url text,
  cte_id uuid references public.ctes(id) on delete set null,
  numero_fatura text,
  ia_analise_id uuid, -- FK depois (referência circular)
  status faturamento_status_t not null,
  liberado_em timestamptz,
  liberado_por_user_id uuid references public.usuarios(id) on delete set null,
  fiscal_conferida_em timestamptz,
  fiscal_conferida_por_user_id uuid references public.usuarios(id) on delete set null,
  fiscal_observacao text,
  criado_em timestamptz not null default now()
);

-- N:N múltiplos CTEs por faturamento (Bloco J)
create table public.faturamento_ctes (
  faturamento_id uuid not null references public.faturamentos(id) on delete cascade,
  cte_id uuid not null references public.ctes(id) on delete cascade,
  primary key (faturamento_id, cte_id)
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_faturamento_fkey
  foreign key (faturamento_id) references public.faturamentos(id) on delete set null;

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  faturamento_id uuid not null references public.faturamentos(id) on delete restrict,
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  valor_pago numeric(14, 2) not null check (valor_pago >= 0),
  data_pagamento date not null,
  comprovante_url text,
  pago_por_user_id uuid references public.usuarios(id) on delete set null,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid references public.ordens_carregamento(id) on delete cascade,
  reserva_id uuid references public.reservas(id) on delete cascade,
  transp_id uuid references public.transportadoras(id) on delete cascade,
  categoria pendencia_categoria_t not null,
  descricao text not null,
  setor_responsavel pendencia_setor_t not null,
  sla_horas integer not null check (sla_horas > 0),
  vence_em timestamptz not null,
  status pendencia_status_t not null default 'aberta',
  resolvida_em timestamptz,
  resolvida_por_user_id uuid references public.usuarios(id) on delete set null,
  criada_em timestamptz not null default now()
);

create table public.documentos_operacao (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  categoria categoria_documento_t not null,
  arquivo_url text not null,
  nome_original text not null,
  mime_type text,
  tamanho_bytes bigint,
  versao integer not null default 1 check (versao > 0),
  versao_anterior_id uuid references public.documentos_operacao(id) on delete set null,
  status doc_operacao_status_t not null default 'enviado',
  observacao text,
  enviado_por_user_id uuid references public.usuarios(id) on delete set null,
  enviado_por_nome text not null,
  decidido_em timestamptz,
  decidido_por_user_id uuid references public.usuarios(id) on delete set null,
  ativo boolean not null default true,
  enviado_em timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- BLOCO J — Gating sequencial (anexos por passo)
-- ════════════════════════════════════════════════════════════════════

create table public.tickets_carregamento (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  peso_bruto_kg integer not null check (peso_bruto_kg > 0),
  peso_tara_kg integer not null check (peso_tara_kg >= 0),
  peso_liquido_kg integer not null check (peso_liquido_kg >= 0),
  arquivo_url text not null,
  nome_arquivo text not null,
  carregado_por_user_id uuid references public.usuarios(id) on delete set null,
  carregado_por_nome text not null,
  observacoes text,
  carregado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_ticket_fkey
  foreign key (ticket_carregamento_id) references public.tickets_carregamento(id) on delete set null;

create table public.laudos_classificacao (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  arquivo_url text not null,
  nome_arquivo text not null,
  umidade_pct numeric(5, 2),
  impurezas_pct numeric(5, 2),
  avariados_pct numeric(5, 2),
  observacoes text,
  emitido_em date,
  anexado_por_user_id uuid references public.usuarios(id) on delete set null,
  anexado_por_nome text not null,
  anexado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_laudo_fkey
  foreign key (laudo_classificacao_id) references public.laudos_classificacao(id) on delete set null;

create table public.anexos_agendamento (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  data_agendamento date not null,
  horario_inicio time,
  horario_fim time,
  arquivo_url text not null,
  nome_arquivo text not null,
  observacoes text,
  anexado_por_user_id uuid references public.usuarios(id) on delete set null,
  anexado_por_nome text not null,
  anexado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_agendamento_fkey
  foreign key (anexo_agendamento_id) references public.anexos_agendamento(id) on delete set null;

create table public.avisos_refugo (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  motivo text not null,
  arquivo_url text,
  nome_arquivo text,
  avisado_por_user_id uuid references public.usuarios(id) on delete set null,
  avisado_por_nome text not null,
  avisado_em timestamptz not null default now(),
  status aviso_refugo_status_t not null default 'aguardando_confirmacao',
  decidido_em timestamptz,
  decidido_por_user_id uuid references public.usuarios(id) on delete set null,
  decidido_por_nome text,
  observacao_cerealista text
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_aviso_refugo_fkey
  foreign key (aviso_refugo_id) references public.avisos_refugo(id) on delete set null;

create table public.ctes_retorno (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  aviso_refugo_id uuid not null references public.avisos_refugo(id) on delete restrict,
  numero text not null,
  chave_cte text,
  emitido_em date not null,
  arquivo_url text not null,
  nome_arquivo text not null,
  anexado_por_user_id uuid references public.usuarios(id) on delete set null,
  anexado_por_nome text not null,
  observacoes text,
  anexado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_cte_retorno_fkey
  foreign key (cte_retorno_id) references public.ctes_retorno(id) on delete set null;

create table public.estadias (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  horas_estadia integer not null check (horas_estadia > 0),
  valor numeric(14, 2) not null check (valor >= 0),
  justificativa text not null,
  arquivo_url text,
  nome_arquivo text,
  anexada_por_user_id uuid references public.usuarios(id) on delete set null,
  anexada_por_nome text not null,
  anexada_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_estadia_fkey
  foreign key (estadia_id) references public.estadias(id) on delete set null;

create table public.quebras (
  id uuid primary key default gen_random_uuid(),
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  peso_carregado_kg integer not null check (peso_carregado_kg > 0),
  peso_descarregado_kg integer not null check (peso_descarregado_kg >= 0),
  quebra_kg integer not null,
  quebra_pct numeric(6, 2) not null,
  alerta boolean not null,
  justificativa_transp text,
  observacao_fiscal text,
  validado_em timestamptz,
  validado_por_user_id uuid references public.usuarios(id) on delete set null,
  validado_por_nome text,
  calculado_por_user_id uuid references public.usuarios(id) on delete set null,
  calculado_em timestamptz not null default now()
);

alter table public.ordens_carregamento
  add constraint ordens_carregamento_quebra_fkey
  foreign key (quebra_id) references public.quebras(id) on delete set null;

create table public.ia_analises_fatura (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references public.faturamentos(id) on delete cascade,
  oc_id uuid not null references public.ordens_carregamento(id) on delete cascade,
  status ia_status_t not null,
  divergencias_count integer not null default 0,
  resumo text not null,
  analisada_em timestamptz not null default now()
);

create table public.ia_itens_analise (
  id uuid primary key default gen_random_uuid(),
  ia_analise_id uuid not null references public.ia_analises_fatura(id) on delete cascade,
  campo ia_campo_t not null,
  esperado text not null,
  encontrado text not null,
  match boolean not null,
  observacao text
);

alter table public.faturamentos
  add constraint faturamentos_ia_analise_fkey
  foreign key (ia_analise_id) references public.ia_analises_fatura(id) on delete set null;

alter table public.ordens_carregamento
  add constraint ordens_carregamento_ia_analise_fkey
  foreign key (ia_analise_id) references public.ia_analises_fatura(id) on delete set null;

-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA / NOTIFICAÇÕES
-- ════════════════════════════════════════════════════════════════════

create table public.historico_eventos (
  id bigserial primary key,
  quando timestamptz not null default now(),
  quem text not null,
  o_que text not null,
  tipo historico_tipo_t not null,
  entity_type text,
  entity_id uuid,
  perfil_no_momento perfil_t,
  acao historico_acao_t,
  valor_antes jsonb,
  valor_depois jsonb,
  motivo text
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.usuarios(id) on delete cascade,
  oc_id uuid references public.ordens_carregamento(id) on delete cascade,
  pendencia_id uuid references public.pendencias(id) on delete cascade,
  tipo notificacao_tipo_t not null,
  titulo text not null,
  body text not null,
  link text,
  lida boolean not null default false,
  lida_em timestamptz,
  criada_em timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES — performance pra consultas dos dashboards
-- ════════════════════════════════════════════════════════════════════

create index idx_usuarios_auth on public.usuarios(auth_user_id);
create index idx_usuarios_transp on public.usuarios(transp_id);
create index idx_motorista_transp on public.motorista_transportadoras(transp_id);
create index idx_veiculo_transp on public.veiculo_transportadoras(transp_id);

create index idx_contratos_disponivel on public.contratos(disponivel) where disponivel = true;
create index idx_contratos_status on public.contratos(status);
create index idx_cargas_status on public.cargas(status);
create index idx_cargas_contrato on public.cargas(contrato_id);
create index idx_reservas_carga on public.reservas(carga_id);
create index idx_reservas_transp on public.reservas(transp_id);
create index idx_reservas_status on public.reservas(status);

create index idx_oc_transp on public.ordens_carregamento(transp_id);
create index idx_oc_status_op on public.ordens_carregamento(status_operacional);
create index idx_oc_status_fiscal on public.ordens_carregamento(status_fiscal);
create index idx_oc_status_financeiro on public.ordens_carregamento(status_financeiro);
create index idx_oc_refugada on public.ordens_carregamento(refugada) where refugada = true;

create index idx_pendencias_status on public.pendencias(status) where status = 'aberta';
create index idx_pendencias_setor on public.pendencias(setor_responsavel);
create index idx_pendencias_transp on public.pendencias(transp_id);
create index idx_pendencias_oc on public.pendencias(oc_id);
create index idx_pendencias_vence on public.pendencias(vence_em);

create index idx_nf_oc on public.notas_fiscais(oc_id);
create index idx_cte_oc on public.ctes(oc_id);
create index idx_descarga_oc on public.dados_descarga(oc_id);
create index idx_doc_oc on public.documentos_operacao(oc_id, categoria, ativo) where ativo = true;

create index idx_hist_entity on public.historico_eventos(entity_type, entity_id);
create index idx_notif_user_lida on public.notificacoes(user_id, lida) where lida = false;

-- ════════════════════════════════════════════════════════════════════
-- TRIGGERS — atualizado_em + auto-sync auth.users ↔ usuarios
-- ════════════════════════════════════════════════════════════════════

create or replace function public.tg_set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_usuarios_atualizado_em
  before update on public.usuarios
  for each row execute function public.tg_set_atualizado_em();

-- Quando um usuário é criado em auth.users (via signup ou invite),
-- cria entrada em public.usuarios com perfil placeholder.
-- O perfil real é definido pelo admin posteriormente.
create or replace function public.tg_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (auth_user_id, email, nome, perfil, ativo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce((new.raw_user_meta_data->>'perfil')::perfil_t, 'logistica'),
    true
  )
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_on_auth_user_created();

-- ════════════════════════════════════════════════════════════════════
-- RLS habilitada (POLICIES vêm na próxima migration 0002)
-- ════════════════════════════════════════════════════════════════════

alter table public.usuarios enable row level security;
alter table public.produtos enable row level security;
alter table public.produtores enable row level security;
alter table public.clientes enable row level security;
alter table public.terminais enable row level security;
alter table public.locais enable row level security;
alter table public.transportadoras enable row level security;
alter table public.motoristas enable row level security;
alter table public.motorista_transportadoras enable row level security;
alter table public.veiculos enable row level security;
alter table public.veiculo_transportadoras enable row level security;
alter table public.contratos enable row level security;
alter table public.contrato_anexos enable row level security;
alter table public.cargas enable row level security;
alter table public.carga_transps_permitidas enable row level security;
alter table public.reservas enable row level security;
alter table public.autorizacoes_carregamento enable row level security;
alter table public.ordens_carregamento enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.ctes enable row level security;
alter table public.romaneios enable row level security;
alter table public.solicitacoes_troca_nota enable row level security;
alter table public.dados_descarga enable row level security;
alter table public.faturamentos enable row level security;
alter table public.faturamento_ctes enable row level security;
alter table public.pagamentos enable row level security;
alter table public.pendencias enable row level security;
alter table public.documentos_operacao enable row level security;
alter table public.tickets_carregamento enable row level security;
alter table public.laudos_classificacao enable row level security;
alter table public.anexos_agendamento enable row level security;
alter table public.avisos_refugo enable row level security;
alter table public.ctes_retorno enable row level security;
alter table public.estadias enable row level security;
alter table public.quebras enable row level security;
alter table public.ia_analises_fatura enable row level security;
alter table public.ia_itens_analise enable row level security;
alter table public.historico_eventos enable row level security;
alter table public.notificacoes enable row level security;

-- ════════════════════════════════════════════════════════════════════
-- COMMENTS — documentação inline pro Studio
-- ════════════════════════════════════════════════════════════════════

comment on table public.usuarios is 'Usuários do sistema. Linkado a auth.users via auth_user_id.';
comment on table public.motorista_transportadoras is 'N:N — motoristas globais (CPF único) podem rodar para várias transportadoras.';
comment on table public.veiculo_transportadoras is 'N:N — veículos globais (placa única) podem ser fretados por várias transportadoras.';
comment on table public.contratos is 'Contratos de compra/venda. Nascem disponivel=false; cargas só podem ser publicadas com disponivel=true.';
comment on table public.cargas is 'Cargas publicadas a partir de contratos. transps_permitidas faz allowlist via carga_transps_permitidas.';
comment on column public.cargas.destino_local_id is 'Opcional — pode ser definido depois pela logística.';
comment on table public.pendencias is 'Sistema de pendências com SLA por categoria. Encadeadas via ganchos no app.';
comment on column public.pendencias.transp_id is 'Quando o setor é transportadora, identifica qual transp — filtro de "minhas pendências".';
comment on table public.ordens_carregamento is 'OC — 3 trilhas paralelas de status: operacional / fiscal / financeiro.';
comment on column public.ordens_carregamento.refugada is 'Bloco J — true quando a transp avisou refugo e cerealista confirmou.';
comment on table public.quebras is 'Bloco J — diferença carregado vs descarregado. alerta=true quando > 0,5%.';
comment on table public.ia_analises_fatura is 'Bloco J — resultado da IA conferindo fatura × CT-es. 4 campos: valor, transp, prestador, número CTE.';
