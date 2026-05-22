-- ════════════════════════════════════════════════════════════════════
-- terraroxa — Row Level Security
-- Data: 2026-05-20
--
-- Estratégia:
--  - Cerealista (admin/comercial/logistica/fiscal/financeiro): vê tudo.
--  - Transportadora: vê apenas o que é dela (transp_id == seu_transp_id).
--  - Motorista: vê apenas suas próprias operações (futuramente).
--  - Cliente: vê apenas seus pedidos (futuramente — Bloco I).
--
-- Helpers em SECURITY DEFINER pra não recursar nas policies.
-- Pendência transp filtra também por transp_id (do J.1).
-- ════════════════════════════════════════════════════════════════════

-- ─── Helpers (SECURITY DEFINER pra evitar recursão de policy) ────────

create or replace function public.perfil_atual()
returns perfil_t language sql stable security definer set search_path = public as $$
  select perfil from public.usuarios where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.transp_id_atual()
returns uuid language sql stable security definer set search_path = public as $$
  select transp_id from public.usuarios where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_cerealista()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select perfil in ('admin', 'comercial', 'logistica', 'fiscal', 'financeiro')
     from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

create or replace function public.is_transp()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select perfil = 'transportadora'
     from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select perfil = 'admin' from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Cadastros base
-- ════════════════════════════════════════════════════════════════════

-- USUARIOS: cada um vê o próprio + admin vê todos
create policy "usuarios_select_self_ou_admin" on public.usuarios
  for select using (auth_user_id = auth.uid() or public.is_admin());
create policy "usuarios_update_admin" on public.usuarios
  for update using (public.is_admin());
create policy "usuarios_insert_admin" on public.usuarios
  for insert with check (public.is_admin());
create policy "usuarios_delete_admin" on public.usuarios
  for delete using (public.is_admin());

-- PRODUTOS / PRODUTORES / CLIENTES / TERMINAIS: leitura livre (todos cadastrados);
-- escrita apenas cerealista
create policy "produtos_select_logado" on public.produtos
  for select using (auth.uid() is not null);
create policy "produtos_cud_cerealista" on public.produtos
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "produtores_select_logado" on public.produtores
  for select using (auth.uid() is not null);
create policy "produtores_cud_cerealista" on public.produtores
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "clientes_select_cerealista" on public.clientes
  for select using (public.is_cerealista());
create policy "clientes_cud_cerealista" on public.clientes
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "terminais_select_logado" on public.terminais
  for select using (auth.uid() is not null);
create policy "terminais_cud_cerealista" on public.terminais
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "locais_select_logado" on public.locais
  for select using (auth.uid() is not null);
create policy "locais_cud_cerealista" on public.locais
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- TRANSPORTADORAS: cerealista vê todas; transp vê só a própria
create policy "transp_select_cerealista_ou_propria" on public.transportadoras
  for select using (
    public.is_cerealista() or
    id = public.transp_id_atual()
  );
create policy "transp_cud_cerealista" on public.transportadoras
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- MOTORISTAS / VEÍCULOS: globais — quem está logado vê;
-- transp pode criar/editar (vincular à própria via N:N)
create policy "motoristas_select_logado" on public.motoristas
  for select using (auth.uid() is not null);
create policy "motoristas_insert" on public.motoristas
  for insert with check (auth.uid() is not null);
create policy "motoristas_update_cerealista_ou_vinculado" on public.motoristas
  for update using (
    public.is_cerealista() or
    exists (
      select 1 from public.motorista_transportadoras
      where motorista_id = motoristas.id
        and transp_id = public.transp_id_atual()
    )
  );

create policy "veiculos_select_logado" on public.veiculos
  for select using (auth.uid() is not null);
create policy "veiculos_insert" on public.veiculos
  for insert with check (auth.uid() is not null);
create policy "veiculos_update_cerealista_ou_vinculado" on public.veiculos
  for update using (
    public.is_cerealista() or
    exists (
      select 1 from public.veiculo_transportadoras
      where veiculo_id = veiculos.id
        and transp_id = public.transp_id_atual()
    )
  );

-- N:N vínculos: cerealista vê tudo; transp vê só os seus vínculos
create policy "mot_transp_select" on public.motorista_transportadoras
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "mot_transp_insert" on public.motorista_transportadoras
  for insert with check (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "mot_transp_delete" on public.motorista_transportadoras
  for delete using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );

create policy "vei_transp_select" on public.veiculo_transportadoras
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "vei_transp_insert" on public.veiculo_transportadoras
  for insert with check (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "vei_transp_delete" on public.veiculo_transportadoras
  for delete using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Operação (Contratos, Cargas, Reservas, OCs)
-- ════════════════════════════════════════════════════════════════════

-- CONTRATOS: dados internos da cerealista — transp NÃO vê
create policy "contratos_select_cerealista" on public.contratos
  for select using (public.is_cerealista());
create policy "contratos_cud_cerealista" on public.contratos
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "contrato_anexos_select_cerealista" on public.contrato_anexos
  for select using (public.is_cerealista());
create policy "contrato_anexos_cud_cerealista" on public.contrato_anexos
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- CARGAS: cerealista vê tudo; transp vê apenas as cargas em que está na allowlist
-- OU cargas sem allowlist (disponíveis para todas)
create policy "cargas_select" on public.cargas
  for select using (
    public.is_cerealista() or
    not exists (
      select 1 from public.carga_transps_permitidas
      where carga_id = cargas.id
    ) or
    exists (
      select 1 from public.carga_transps_permitidas
      where carga_id = cargas.id
        and transp_id = public.transp_id_atual()
    )
  );
create policy "cargas_cud_cerealista" on public.cargas
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "carga_transps_select" on public.carga_transps_permitidas
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "carga_transps_cud_cerealista" on public.carga_transps_permitidas
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- RESERVAS: cerealista vê tudo; transp vê só as suas próprias
create policy "reservas_select" on public.reservas
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "reservas_insert_transp" on public.reservas
  for insert with check (
    -- transp só pode criar reserva pra ela mesma
    transp_id = public.transp_id_atual() or public.is_cerealista()
  );
create policy "reservas_update" on public.reservas
  for update using (
    -- cerealista aprova/reprova; transp atualiza só própria pré-aprovação
    public.is_cerealista() or (transp_id = public.transp_id_atual() and status = 'pendente')
  );

-- AUTORIZAÇÕES: cerealista vê todas; transp vê as suas
create policy "autoriz_select" on public.autorizacoes_carregamento
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "autoriz_insert_transp" on public.autorizacoes_carregamento
  for insert with check (
    transp_id = public.transp_id_atual() or public.is_cerealista()
  );

-- ORDENS: cerealista vê tudo; transp vê só as próprias
create policy "oc_select" on public.ordens_carregamento
  for select using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );
create policy "oc_insert_cerealista" on public.ordens_carregamento
  for insert with check (public.is_cerealista());
create policy "oc_update" on public.ordens_carregamento
  for update using (
    public.is_cerealista() or transp_id = public.transp_id_atual()
  );

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Fiscal (NFs, CTEs, Romaneios, Troca NF)
-- ════════════════════════════════════════════════════════════════════

-- Helper inline: a OC desta entidade é visível pra mim?
-- (encapsulado em policy via subquery — sem function helper)

create policy "nf_select" on public.notas_fiscais
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = notas_fiscais.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "nf_cud_cerealista" on public.notas_fiscais
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "cte_select" on public.ctes
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ctes.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "cte_insert_transp_ou_cerealista" on public.ctes
  for insert with check (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ctes.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "romaneios_select" on public.romaneios
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = romaneios.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "romaneios_cud_cerealista" on public.romaneios
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "troca_nota_select_cerealista" on public.solicitacoes_troca_nota
  for select using (public.is_cerealista());
create policy "troca_nota_cud_cerealista" on public.solicitacoes_troca_nota
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Bloco I (Descarga, Faturamento, Pagamento, Pendências, Docs)
-- ════════════════════════════════════════════════════════════════════

create policy "descarga_select" on public.dados_descarga
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = dados_descarga.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "descarga_cud_cerealista" on public.dados_descarga
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "faturamento_select" on public.faturamentos
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = faturamentos.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "faturamento_insert_cerealista" on public.faturamentos
  for insert with check (public.is_cerealista());
create policy "faturamento_update" on public.faturamentos
  for update using (
    -- cerealista pode tudo; transp atualiza apenas pra anexar fatura na OC dela
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = faturamentos.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "fat_ctes_select" on public.faturamento_ctes
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.faturamentos f
      join public.ordens_carregamento o on o.id = f.oc_id
      where f.id = faturamento_ctes.faturamento_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "fat_ctes_cud_cerealista_ou_transp" on public.faturamento_ctes
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.faturamentos f
      join public.ordens_carregamento o on o.id = f.oc_id
      where f.id = faturamento_ctes.faturamento_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "pagamentos_select_cerealista" on public.pagamentos
  for select using (public.is_cerealista());
create policy "pagamentos_cud_cerealista" on public.pagamentos
  for all using (public.is_cerealista()) with check (public.is_cerealista());

-- PENDÊNCIAS: cerealista vê tudo; transp vê do setor 'transportadora' + sua transp_id
create policy "pendencias_select" on public.pendencias
  for select using (
    public.is_cerealista() or
    (
      setor_responsavel = 'transportadora' and
      (transp_id is null or transp_id = public.transp_id_atual())
    )
  );
create policy "pendencias_cud_cerealista" on public.pendencias
  for all using (public.is_cerealista()) with check (public.is_cerealista());
-- transp pode resolver (update status) suas pendências
create policy "pendencias_update_transp" on public.pendencias
  for update using (
    setor_responsavel = 'transportadora' and
    (transp_id is null or transp_id = public.transp_id_atual())
  );

create policy "doc_op_select" on public.documentos_operacao
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = documentos_operacao.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "doc_op_cud" on public.documentos_operacao
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = documentos_operacao.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Bloco J (Tickets, Laudos, Agendamentos, Refugo, Quebra, IA)
-- ════════════════════════════════════════════════════════════════════

-- Helper inline pra OC: visible se é cerealista OU transp dona da OC
-- Aplicado em todas as tabelas Bloco J

create policy "tickets_carg_select" on public.tickets_carregamento
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = tickets_carregamento.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "tickets_carg_cud" on public.tickets_carregamento
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = tickets_carregamento.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "laudos_select" on public.laudos_classificacao
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = laudos_classificacao.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "laudos_cud" on public.laudos_classificacao
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = laudos_classificacao.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "agendamento_select" on public.anexos_agendamento
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = anexos_agendamento.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "agendamento_cud_cerealista" on public.anexos_agendamento
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "refugo_select" on public.avisos_refugo
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = avisos_refugo.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "refugo_insert_transp" on public.avisos_refugo
  for insert with check (
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = avisos_refugo.oc_id and o.transp_id = public.transp_id_atual()
    ) or public.is_cerealista()
  );
create policy "refugo_update_cerealista" on public.avisos_refugo
  for update using (public.is_cerealista());

create policy "cte_retorno_select" on public.ctes_retorno
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ctes_retorno.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "cte_retorno_insert_transp" on public.ctes_retorno
  for insert with check (
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ctes_retorno.oc_id and o.transp_id = public.transp_id_atual()
    ) or public.is_cerealista()
  );

create policy "estadias_select" on public.estadias
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = estadias.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "estadias_cud_transp" on public.estadias
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = estadias.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "quebras_select" on public.quebras
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = quebras.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "quebras_cud_cerealista" on public.quebras
  for all using (public.is_cerealista()) with check (public.is_cerealista());

create policy "ia_analise_select" on public.ia_analises_fatura
  for select using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ia_analises_fatura.oc_id and o.transp_id = public.transp_id_atual()
    )
  );
create policy "ia_analise_cud" on public.ia_analises_fatura
  for all using (
    public.is_cerealista() or
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = ia_analises_fatura.oc_id and o.transp_id = public.transp_id_atual()
    )
  );

create policy "ia_itens_select" on public.ia_itens_analise
  for select using (
    exists (
      select 1 from public.ia_analises_fatura a
      where a.id = ia_itens_analise.ia_analise_id
      and (public.is_cerealista() or exists (
        select 1 from public.ordens_carregamento o
        where o.id = a.oc_id and o.transp_id = public.transp_id_atual()
      ))
    )
  );
create policy "ia_itens_cud" on public.ia_itens_analise
  for all using (
    exists (
      select 1 from public.ia_analises_fatura a
      where a.id = ia_itens_analise.ia_analise_id
      and (public.is_cerealista() or exists (
        select 1 from public.ordens_carregamento o
        where o.id = a.oc_id and o.transp_id = public.transp_id_atual()
      ))
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- POLICIES — Histórico / Notificações
-- ════════════════════════════════════════════════════════════════════

-- HISTÓRICO: cerealista vê tudo. Transp vê eventos cujas entidades são suas.
-- Simplificação: transp só lê eventos das próprias OCs.
create policy "historico_select_cerealista" on public.historico_eventos
  for select using (public.is_cerealista());
create policy "historico_select_transp" on public.historico_eventos
  for select using (
    public.is_transp() and
    entity_type = 'ordens_carregamento' and
    exists (
      select 1 from public.ordens_carregamento o
      where o.id = historico_eventos.entity_id and o.transp_id = public.transp_id_atual()
    )
  );
-- Insert: tudo via app (service-side); aqui permite logado
create policy "historico_insert_logado" on public.historico_eventos
  for insert with check (auth.uid() is not null);

create policy "notif_select_self" on public.notificacoes
  for select using (
    user_id in (select id from public.usuarios where auth_user_id = auth.uid())
  );
create policy "notif_update_self" on public.notificacoes
  for update using (
    user_id in (select id from public.usuarios where auth_user_id = auth.uid())
  );
create policy "notif_insert_logado" on public.notificacoes
  for insert with check (auth.uid() is not null);
