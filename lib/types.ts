/* ════════════════════════════════════════════════════════════════════
 * DOMÍNIO terraroxa — tipos centrais
 * Unidade canônica: KG (integer). UI também exibe em kg.
 * ════════════════════════════════════════════════════════════════════ */

/* ─────────── Identidade ─────────── */

export type Role = "cerealista" | "transportadora";

/** Perfil de acesso — define escopo + permissões padrão. */
export type Perfil =
  | "admin"
  | "comercial"
  | "logistica"
  | "fiscal"
  | "financeiro"
  | "transportadora"
  | "motorista"
  | "cliente";

/** Ações que podem ser permitidas/negadas por (perfil × módulo). */
export type Acao =
  | "visualizar"
  | "criar"
  | "editar"
  | "excluir"
  | "aprovar"
  | "cancelar"
  | "anexar_doc"
  | "baixar_doc";

/** Módulos do sistema — usado pela matriz de permissões. */
export type Modulo =
  | "dashboard"
  | "usuarios"
  | "transportadoras"
  | "motoristas"
  | "veiculos"
  | "terminais"
  | "locais"
  | "produtores"
  | "clientes"
  | "produtos"
  | "contratos"
  | "cargas"
  | "reservas"
  | "ordens_carregamento"
  | "notas_fiscais"
  | "ctes"
  | "romaneios"
  | "historico";

/** Uma entrada da matriz perfil × módulo × ação. */
export interface Permissao {
  perfil: Perfil;
  modulo: Modulo;
  acao: Acao;
  permitido: boolean;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil;
  /** Preenchido quando perfil="transportadora" ou "motorista". */
  transp_id?: string;
  ativo: boolean;
  criado_em: string;
}

/** Sessão ativa — guardada no AuthContext. */
export interface User {
  usuario_id: string;
  email: string;
  nome: string;
  initials: string;
  perfil: Perfil;
  /** Mantido por compat com Etapa 1 — derivado de perfil. */
  role: Role;
  transp_id?: string;
}

/* ─────────── Endereço (composto) ─────────── */

export interface Endereco {
  logradouro: string;
  numero: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep?: string;
}

/* ─────────── Transportadoras ─────────── */

export type TransportadoraStatus = "ativa" | "inativa" | "pendente";

export interface Transportadora {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  /** CNPJ ou CPF (autônomo). */
  cnpj_cpf: string;
  inscricao_estadual?: string;
  /** Registro Nacional dos Transportadores Rodoviários de Cargas (obrigatório p/ frete). */
  rntrc?: string;
  telefone: string;
  email: string;
  responsavel: string;
  endereco?: Endereco;
  status: TransportadoraStatus;
  criada_em: string;
  /** Campo legacy de Etapa 1 — mantido para não quebrar UI. */
  nome: string;
  contato: string;
  cnpj: string;
}

/* ─────────── Motoristas e Veículos ─────────── */

/**
 * Motorista é uma entidade GLOBAL identificada pelo CPF.
 * Pode estar vinculado a múltiplas transportadoras (ex: autônomos
 * que rodam para várias empresas). A relação N:N é representada
 * pelo array `transp_ids`.
 */
export interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  cnh: string;
  celular: string;
  email?: string;
  foto_url?: string;
  /** Transportadoras às quais o motorista está vinculado. */
  transp_ids: string[];
  ativo: boolean;
  criado_em: string;
}

export type TipoVeiculo = "Bitrem" | "Rodotrem" | "Treminhão" | "Carreta Simples" | "Truck";

/**
 * Veículo é uma entidade GLOBAL identificada pela placa do cavalo.
 * Pode estar vinculado a múltiplas transportadoras (mesma placa pode
 * ser fretada por mais de uma empresa).
 */
export interface Veiculo {
  id: string;
  placa_cavalo: string;
  placa_carreta?: string;
  tipo: TipoVeiculo;
  capacidade_kg: number;
  crlv_url?: string;
  /** Transportadoras às quais o veículo está vinculado. */
  transp_ids: string[];
  ativo: boolean;
  criado_em: string;
}

/* ─────────── Produtores e Clientes ─────────── */

/** Bloco I.4½ — tipo de atuação do produtor no agronegócio. */
export type TipoProdutor = "vendedor" | "comprador" | "ambos";

export interface Produtor {
  id: string;
  /** Nome da fazenda — apresentação principal. */
  nome: string;
  /** Razão social ou nome completo (pessoa física/jurídica). */
  razao_social?: string;
  cpf_cnpj: string;
  /** Tipo de atuação (default: vendedor). */
  tipo?: TipoProdutor;
  cidade: string;
  uf: string;
  contato: string;
  /** Bloco J — Email opcional do produtor para envio de OC. */
  email?: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
  ativo: boolean;
}

/* ─────────── Terminais ─────────── */

export type TipoTerminal = "terminal" | "armazem" | "porto" | "cliente";

export interface Terminal {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  uf: string;
  endereco?: Endereco;
  contato: string;
  tipo: TipoTerminal;
  observacoes?: string;
  ativo: boolean;
}

/* ─────────── Locais (origem/destino reutilizáveis) ─────────── */

export type TipoLocal = "fazenda" | "armazem_origem" | "destino" | "porto" | "terminal";

export interface Local {
  id: string;
  nome: string;
  tipo: TipoLocal;
  cidade: string;
  uf: string;
  endereco?: Endereco;
  /** Vinculação opcional a outro cadastro (ex: porto pode estar vinculado a um Terminal). */
  vinculado_a?: { entidade: "terminal" | "produtor" | "cliente"; id: string };
  /* ──── Bloco J — Contato do local (para envio de OC) ──── */
  contato_nome?: string;
  contato_whatsapp?: string;
  contato_email?: string;
  /* ──── Bloco J — Geolocalização (placeholder Google Maps) ──── */
  latitude?: number;
  longitude?: number;
}

/* ─────────── Produtos ─────────── */

export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
}

/* ─────────── Contratos ─────────── */

export type ContratoStatus = "ativo" | "concluido" | "cancelado" | "rascunho";

export interface AnexoContrato {
  id: string;
  nome_arquivo: string;
  url: string;
  anexado_em: string;
}

/** Tipo de contrato: compra do produtor (cerealista compra) ou venda para cliente (cerealista vende). */
export type TipoContrato = "compra" | "venda";

export interface Contrato {
  id: string;
  /** Número humano gerado pelo sistema: CT-001, CT-2026-001 etc. */
  numero: string;
  /** Número manual digitado pelo usuário (opcional). Se preenchido, é exibido no lugar de `numero`. */
  numero_manual?: string;
  /** Tipo do contrato (Bloco I). */
  tipo_contrato?: TipoContrato;
  produtor_id: string;
  local_origem_id: string;
  produto_id: string;
  qtd_kg_total: number;
  saldo_kg: number;
  /** Quantidade de cotas (Bloco I) — usado pra fatiar em cargas múltiplas. */
  quantidade_cotas?: number;
  /** Cliente comprador — pode ser definido depois (contratos têm essa flexibilidade). */
  cliente_id?: string;
  /** Local de destino — também opcional na criação. */
  destino_local_id?: string;
  terminal_id?: string;
  /** Porto associado ao contrato (Bloco I) — pode ser igual ao destino ou um terminal específico. */
  porto_id?: string;
  /** Data de emissão do contrato (opcional). */
  data_emissao?: string;
  /** Data de vencimento financeiro (antes era data_vencimento). */
  data_vencto_financeiro?: string;
  /** Data inicial de validade do contrato (vem do CSV DTINICIO). */
  data_inicio?: string;
  /** Data final de validade do contrato (vem do CSV DTFINAL). */
  data_fim?: string;
  /** Safra (ex: "26-2026") — vem do CSV DESCSAFRA. */
  safra?: string;
  /** Código do estabelecimento no ERP de origem (ex: "5", "6") — INFORMATIVO. */
  empresa_origem_codigo?: string;
  /** Número do contrato no ERP de origem (ex: "5.328"). */
  numero_origem?: string;
  /** Texto livre da origem (cidade/UF/razão social) — não relaciona com locais. */
  origem_descricao?: string;
  /** Valor por kg em R$ (opcional). */
  valor_unitario?: number;
  /** R$/saca de 60kg (convenção do mercado de grãos). */
  valor_unitario_saca?: number;
  /** Valor total em R$ (opcional, normalmente unitário × qtd_kg_total). */
  valor_total?: number;
  /** Saldo financeiro restante em R$ (do CSV NVLRSALDO). */
  valor_saldo?: number;
  observacoes?: string;
  anexos: AnexoContrato[];
  status: ContratoStatus;
  /**
   * Contrato salvo nasce com `disponivel: false`.
   * Para publicar uma carga a partir dele, o usuário precisa disponibilizá-lo.
   * O filtro do PublicarCargaModal só mostra contratos com `disponivel === true`.
   */
  disponivel: boolean;
  criado_em: string;
  criado_por: string;
}

/* ─────────── Cargas ─────────── */

export type CargaStatus = "disponivel" | "parcial" | "fechada" | "cancelada";

export interface Carga {
  id: string;
  /** Toda carga DEVE pertencer a um contrato (fluxo Contrato→Carga→Reserva→OC). */
  contrato_id: string;
  /** Mantido para exibição rápida; espelha contratos[id].numero. */
  contrato_interno: string;
  produto_id: string;
  /** String redundante para UI rápida — sincronizar quando produto mudar. */
  produto: string;
  tipo_carga: string;
  origem_local_id: string;
  /** Destino pode ficar "a definir" — preenchido depois pela logística. */
  destino_local_id?: string;
  /** Strings redundantes — exibidas até resolver via FK. */
  origem: string;
  /** Vazio quando destino ainda não foi definido. */
  destino?: string;
  total_kg: number;
  reservado_kg: number;
  data_carg: string;
  obs: string;
  status: CargaStatus;
  publicada_em: string;
  /**
   * Bloco I — Allowlist de transportadoras que podem reservar essa carga.
   * Se vazio/undefined, qualquer transp pode reservar (comportamento legacy).
   */
  transps_permitidas?: string[];
  reservas: Reserva[];
}

/* ─────────── Reservas ─────────── */

export type ReservaStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";

export type ReservaEtapa =
  | "reserva_pendente"
  | "reserva_aprovada"
  | "aguard_docs"
  | "docs_ok"
  | "aguard_ordem"
  | "ordem_emitida"
  | "carregando"
  | "em_transito"
  | "descarregado"
  | "finalizado";

export interface Reserva {
  id: string;
  transp_id: string;
  transp_nome: string;
  /** FKs para motorista/veículo cadastrados (preenchidos a partir do Bloco D). */
  motorista_id?: string;
  veiculo_id?: string;
  /** Campos denormalizados para exibição rápida — espelham os cadastros. */
  motorista?: string;
  placa?: string;
  carreta?: string;
  cpf?: string;
  cnh?: string;
  tipo_veiculo?: string;
  /** RNTRC do motorista no momento da reserva (Bloco I — auditoria fiscal). */
  rntrc_motorista?: string;
  qtd_kg: number;
  /** Frete por tonelada (convenção do mercado mantida em R$/t). */
  frete_ton: number;
  status: ReservaStatus;
  data: string;
  etapa?: ReservaEtapa;
  obs?: string;
}

/* ─────────── Ordens de Carregamento ─────────── */

export type OCOrigem = "automatica_reserva" | "manual_logistica";

export type OCStatus =
  | "emitida"
  | "aguardando_docs"
  | "em_carregamento"
  | "em_transito"
  | "descarregada"
  | "finalizada"
  | "cancelada";

export interface OrdemCarregamento {
  id: string;
  numero: string;
  contrato_id: string;
  carga_id: string;
  /** Reserva pode ser null se a OC foi lançada manualmente. */
  reserva_id?: string;
  transp_id: string;
  motorista_id: string;
  veiculo_id: string;
  local_carg_id: string;
  /** Destino pode ficar "a definir" — preenchido depois pela logística. */
  destino_local_id?: string;
  terminal_id?: string;
  peso_previsto_kg: number;
  status: OCStatus;
  origem: OCOrigem;
  emitida_em: string;
  emitida_por: string;
  observacoes?: string;
  /** Vínculos opcionais (preenchidos depois). */
  nota_fiscal_id?: string;
  cte_id?: string;
  romaneio_id?: string;

  /* ──── Bloco I: 3 trilhas paralelas de status ──── */
  /** Status da trilha operacional (carregamento/trânsito/descarga). */
  status_operacional?: OCStatusOperacional;
  /** Status da trilha fiscal (NF/troca/validação). */
  status_fiscal?: OCStatusFiscal;
  /** Status da trilha financeira (faturamento/pagamento). */
  status_financeiro?: OCStatusFinanceiro;
  /** Vínculo com a autorização de carregamento que gerou a OC. */
  autorizacao_id?: string;
  /** Vínculo com os dados de descarga. */
  descarga_id?: string;
  /** Vínculo com o faturamento gerado. */
  faturamento_id?: string;
  /* ──── Bloco J — FKs do gating sequencial ──── */
  /** Ticket de carregamento da fazenda (passo 2). */
  ticket_carregamento_id?: string;
  /** Laudo de classificação (passo 3 — opcional). */
  laudo_classificacao_id?: string;
  /** Comprovante de agendamento no destino (passo 5). */
  anexo_agendamento_id?: string;
  /** Aviso de refugo (fluxo alternativo 7a). */
  aviso_refugo_id?: string;
  /** CT-e de retorno (refugo — passo 8). */
  cte_retorno_id?: string;
  /** Estadia (refugo — passo 9 opcional). */
  estadia_id?: string;
  /** Quebra calculada pelo fiscal (passo 10). */
  quebra_id?: string;
  /** Resultado da IA na conferência da fatura × CT-es. */
  ia_analise_id?: string;
  /** True se esta OC foi sinalizada como refugada. */
  refugada?: boolean;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — Trilhas paralelas de status da OC
 * Operacional, Fiscal e Financeiro evoluem INDEPENDENTEMENTE:
 * descarga pode estar OK enquanto fiscal ainda processa troca de NF.
 * ════════════════════════════════════════════════════════════════════ */

export type OCStatusOperacional =
  | "aguardando_autorizacao"   // reserva aprovada, transp ainda não anexou autorização
  | "oc_emitida"                // OC gerada automaticamente após autorização
  | "carregando"                // fazenda está carregando
  | "em_transito"               // saiu da fazenda
  | "aguardando_descarga"       // chegou ao porto/destino
  | "descarregado"              // ticket descarga + canhoto anexados
  | "operacional_concluido";    // descarga validada pelo fiscal

export type OCStatusFiscal =
  | "aguardando_nf"             // OC operando, fiscal aguarda NF do cliente
  | "nf_recebida"               // fiscal anexou NF original
  | "nf_em_analise"             // fiscal analisando
  | "troca_solicitada"          // fiscal pediu troca
  | "troca_aprovada"            // fiscal aprovou a troca, aguarda nova NF
  | "nf_substituida"            // nova NF chegou e foi anexada
  | "nf_validada"               // fiscal validou a NF ativa
  | "aguardando_cte"            // NF ok, aguardando CTE da transp
  | "cte_recebido"              // transp anexou CTE
  | "liberado_faturamento";     // fiscal liberou faturamento

export type OCStatusFinanceiro =
  | "aguardando_liberacao"      // sem ação ainda
  | "calculado"                 // sistema calculou o valor
  | "fatura_anexada"            // transp anexou fatura/CTE
  | "em_conferencia"            // financeiro conferindo
  | "divergencia"               // valor calculado ≠ informado, em revisão
  | "pago"                      // financeiro processou pagamento
  | "finalizado";

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — AUTORIZAÇÃO DE CARREGAMENTO
 * Anexada pela transportadora após aprovação da reserva.
 * Sua existência DISPARA a geração automática da OC.
 * ════════════════════════════════════════════════════════════════════ */

export interface AutorizacaoCarregamento {
  id: string;
  reserva_id: string;
  carga_id: string;
  transp_id: string;
  arquivo_url: string;
  nome_arquivo: string;
  observacoes?: string;
  anexada_em: string;
  anexada_por_user_id: string;
  anexada_por_nome: string;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — DADOS DE DESCARGA
 * Registrados pela logística ao final do trajeto. Validados pelo fiscal.
 * ════════════════════════════════════════════════════════════════════ */

export interface DadosDescarga {
  id: string;
  oc_id: string;
  /** Peso oficial registrado na descarga (kg). Base para o cálculo do faturamento. */
  peso_descarregado_kg: number;
  ticket_descarga_url?: string;
  laudo_classificacao_url?: string;
  comprovante_porto_url?: string;
  canhoto_url?: string;
  descarregado_em: string;
  descarregado_por_user_id: string;
  observacoes?: string;
  /** Fiscal valida a descarga (libera próximos passos). */
  validado_em?: string;
  validado_por_user_id?: string;
  /** Quando o fiscal rejeita: motivo para correção. */
  rejeitado_em?: string;
  rejeitado_por_user_id?: string;
  motivo_rejeicao?: string;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — SOLICITAÇÃO DE TROCA DE NF
 * Workflow: fiscal solicita → cliente envia nova NF → fiscal aprova
 * NF antiga NUNCA é apagada — apenas marcada como substituida.
 * ════════════════════════════════════════════════════════════════════ */

export type SolicitacaoTrocaStatus = "pendente" | "aprovada" | "rejeitada" | "cancelada";

export interface SolicitacaoTrocaNota {
  id: string;
  oc_id: string;
  nf_original_id: string;
  motivo: string;
  solicitada_em: string;
  solicitada_por_user_id: string;
  solicitada_por_nome: string;
  status: SolicitacaoTrocaStatus;
  decidida_em?: string;
  decidida_por_user_id?: string;
  observacao_fiscal?: string;
  /** Preenchido quando a nova NF chega e é vinculada à substituição. */
  nova_nf_id?: string;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — FATURAMENTO
 * Cálculo automático = (peso_descarregado_kg / 1000) × frete_ton.
 * Transp confere; se discordar, registra justificativa.
 * ════════════════════════════════════════════════════════════════════ */

export type FaturamentoStatus =
  | "aguardando_liberacao_fiscal"
  | "calculado"
  | "fatura_anexada"
  | "em_conferencia"
  | "divergencia"
  | "aprovado"
  | "pago";

export interface Faturamento {
  id: string;
  oc_id: string;
  /** Peso base do cálculo — normalmente o descarregado. */
  peso_base_kg: number;
  /** Frete por tonelada (R$/t) — vem da reserva. */
  frete_ton: number;
  /** Valor calculado pelo sistema. */
  valor_calculado: number;
  /** Valor informado pela transportadora (pode divergir do calculado). */
  valor_informado?: number;
  /** Diferença |informado - calculado| absoluto (preenchido quando há divergência). */
  divergencia?: number;
  justificativa_divergencia?: string;
  fatura_url?: string;
  /** Bloco I — vínculo a UM CTE (legado). */
  cte_id?: string;
  /** Bloco J — múltiplos CT-es agrupados numa única fatura. */
  ctes_ids?: string[];
  /** Bloco J — número da fatura informado pela transportadora. */
  numero_fatura?: string;
  /** Bloco J — FK ao resultado da IA (IAAnaliseFatura.id). */
  ia_analise_id?: string;
  status: FaturamentoStatus;
  liberado_em?: string;
  liberado_por_user_id?: string;
  criado_em: string;
  /** Bloco J — fiscal conferiu o resultado da IA e validou antes do financeiro. */
  fiscal_conferida_em?: string;
  fiscal_conferida_por_user_id?: string;
  fiscal_observacao?: string;
}

export interface Pagamento {
  id: string;
  faturamento_id: string;
  oc_id: string;
  valor_pago: number;
  data_pagamento: string;
  comprovante_url?: string;
  pago_por_user_id: string;
  observacoes?: string;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — PENDÊNCIAS (com SLA)
 * Cada transição operacional gera pendências para o setor responsável.
 * ════════════════════════════════════════════════════════════════════ */

export type PendenciaSetor = "comercial" | "logistica" | "fiscal" | "financeiro" | "transportadora";
export type PendenciaCategoria =
  | "aprovar_reserva"
  | "anexar_autorizacao_carreg"
  | "anexar_ticket_carreg"
  | "registrar_descarga"
  | "validar_descarga"
  | "anexar_ticket_descarga"
  | "anexar_laudo"
  | "anexar_nf"
  | "validar_nf"
  | "aprovar_troca_nf"
  | "anexar_nova_nf"
  | "anexar_cte"
  | "liberar_faturamento"
  | "anexar_fatura"
  | "processar_pagamento"
  /* ──── Bloco J — gating sequencial + refugo + IA ──── */
  | "anexar_agendamento"      // cerealista logística — anexar comprovante agendamento destino
  | "confirmar_refugo"         // cerealista — confirmar que carga foi refugada (destrava CT-e retorno)
  | "anexar_cte_retorno"       // transp — anexar CT-e do retorno (carga refugada)
  | "calc_quebra"              // fiscal — calcular quebra (carregado vs descarregado)
  | "conferir_fatura_ia"       // sistema — IA confere fatura × CT-es (resolvida automaticamente)
  | "conferir_fatura_fiscal";  // fiscal — conferir resultado da IA antes de mandar pro financeiro

export type PendenciaSeveridade = "no_prazo" | "proximo" | "vencendo" | "atrasada" | "critica";
export type PendenciaStatus = "aberta" | "resolvida" | "cancelada";

export interface Pendencia {
  id: string;
  oc_id?: string;
  reserva_id?: string;
  /** Quando a pendência é de uma transp específica, identifica qual (filtra "minhas pendências"). */
  transp_id?: string;
  categoria: PendenciaCategoria;
  descricao: string;
  setor_responsavel: PendenciaSetor;
  /** SLA em horas — quando vence. */
  sla_horas: number;
  criada_em: string;
  /** Calculado: deadline = criada_em + sla_horas. */
  vence_em: string;
  resolvida_em?: string;
  resolvida_por_user_id?: string;
  status: PendenciaStatus;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — DOCUMENTO DA OPERAÇÃO (central documental unificada)
 * Substitui o tipo `Documento` legacy quando o anexo pertence à OC.
 * ════════════════════════════════════════════════════════════════════ */

export type CategoriaDocumento =
  | "autorizacao_carregamento"
  | "ticket_carregamento"
  | "comprovante_fazenda"
  | "peso_origem"
  | "ticket_descarga"
  | "laudo_classificacao"
  | "comprovante_porto"
  | "canhoto"
  | "peso_descarga"
  | "nota_fiscal"
  | "cte"
  | "fatura_transp"
  | "comprovante_pagamento"
  | "outros"
  /* ──── Bloco J — gating sequencial + refugo + estadia ──── */
  | "anexo_agendamento"        // comprovante agendamento no destino (cerealista logística)
  | "aviso_refugo"             // documento que comprova refugo da carga (transp)
  | "cte_retorno"              // CT-e do retorno quando carga é refugada (transp)
  | "estadia";                 // comprovante de estadia (transp — opcional pós-refugo)

export type DocumentoOperacaoStatus = "enviado" | "em_analise" | "aprovado" | "rejeitado" | "substituido";

export interface DocumentoOperacao {
  id: string;
  oc_id: string;
  categoria: CategoriaDocumento;
  arquivo_url: string;
  nome_original: string;
  mime_type?: string;
  tamanho_bytes?: number;
  /** Versão incremental (1, 2, 3 — útil quando o doc é substituído). */
  versao: number;
  /** Aponta para a versão anterior (cadeia de versões do mesmo doc). */
  versao_anterior_id?: string;
  status: DocumentoOperacaoStatus;
  observacao?: string;
  enviado_em: string;
  enviado_por_user_id: string;
  enviado_por_nome: string;
  decidido_em?: string;
  decidido_por_user_id?: string;
  /** false quando substituído ou cancelado (não aparece na vista padrão). */
  ativo: boolean;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO I — NOTIFICAÇÕES IN-APP
 * ════════════════════════════════════════════════════════════════════ */

export type NotificacaoTipo = "info" | "alerta" | "sucesso" | "erro";

export interface Notificacao {
  id: string;
  user_id: string;
  oc_id?: string;
  pendencia_id?: string;
  tipo: NotificacaoTipo;
  titulo: string;
  body: string;
  link?: string;
  lida: boolean;
  criada_em: string;
  lida_em?: string;
}

/* ════════════════════════════════════════════════════════════════════
 * BLOCO J — GATING SEQUENCIAL + REFUGO + QUEBRA + IA
 * Cada passo destrava o próximo. Sequência rígida do fluxo TMS:
 *  1. autorizacao_carregamento → 2. ticket_carregamento + peso →
 *  3. laudo_classificacao (opcional) → 4. nf_venda → 5. anexo_agendamento →
 *  6. cte_emissao (status "em_transito" auto) → 7. comprovante_descarga →
 *  [REFUGO?] 7a. aviso_refugo → 7b. confirmacao_refugo →
 *             8. cte_retorno → 9. estadia (opcional) →
 *  10. calc_quebra (fiscal) → 11. validar_tudo →
 *  12. fatura_ctes (IA confere) → 13. conferencia_fiscal → 14. financeiro
 * ════════════════════════════════════════════════════════════════════ */

/** Bloco J — passo do checklist sequencial (usado nos dashboards transp/cerealista). */
export type PassoChecklist =
  | "autorizacao_carregamento"   // 1 — transp anexa autorização (gera OC)
  | "ticket_carregamento"         // 2 — transp anexa ticket + peso líquido
  | "laudo_classificacao"         // 3 — transp anexa laudo (opcional)
  | "nf_venda"                    // 4 — cerealista anexa NF
  | "anexo_agendamento"           // 5 — cerealista anexa agendamento destino
  | "cte_emissao"                 // 6 — transp anexa CT-e (status → "em_transito")
  | "comprovante_descarga"        // 7 — transp anexa comprovante descarga
  | "aviso_refugo"                // 7a (refugo) — transp avisa
  | "confirmacao_refugo"          // 7b (refugo) — cerealista confirma
  | "cte_retorno"                 // 8 (refugo) — transp anexa CT-e retorno
  | "estadia"                     // 9 (refugo) — transp anexa estadia (opcional)
  | "calc_quebra"                 // 10 — fiscal calcula quebra
  | "validacao_fiscal"            // 11 — fiscal valida tudo
  | "fatura_ctes"                 // 12 — transp anexa fatura (IA confere)
  | "conferencia_fiscal"          // 13 — fiscal confere fatura
  | "envio_financeiro"            // 14 — fiscal manda pro financeiro pagar
  | "pagamento";                  // 15 — financeiro paga

/** Status de cada passo no checklist (derivado dos anexos da OC). */
export type StatusPasso = "pendente" | "bloqueado" | "concluido" | "pulado" | "rejeitado";

/* ─────────── BLOCO J — Ticket de Carregamento (origem/fazenda) ─────────── */

export interface TicketCarregamento {
  id: string;
  oc_id: string;
  /** Peso bruto (caminhão + carga) em kg. */
  peso_bruto_kg: number;
  /** Peso da tara (caminhão vazio) em kg. */
  peso_tara_kg: number;
  /** Peso líquido (bruto − tara) em kg — base para o cálculo de quebra. */
  peso_liquido_kg: number;
  arquivo_url: string;
  nome_arquivo: string;
  carregado_em: string;
  carregado_por_user_id: string;
  carregado_por_nome: string;
  observacoes?: string;
}

/* ─────────── BLOCO J — Laudo de Classificação (opcional) ─────────── */

export interface LaudoClassificacao {
  id: string;
  oc_id: string;
  arquivo_url: string;
  nome_arquivo: string;
  /** Indicadores típicos do laudo de grãos (campos opcionais). */
  umidade_pct?: number;
  impurezas_pct?: number;
  avariados_pct?: number;
  observacoes?: string;
  emitido_em?: string;
  anexado_em: string;
  anexado_por_user_id: string;
  anexado_por_nome: string;
}

/* ─────────── BLOCO J — Anexo de Agendamento no Destino ─────────── */

export interface AnexoAgendamento {
  id: string;
  oc_id: string;
  /** Data prevista do agendamento no destino. */
  data_agendamento: string;
  /** Janela de descarga (opcional). */
  horario_inicio?: string;
  horario_fim?: string;
  arquivo_url: string;
  nome_arquivo: string;
  observacoes?: string;
  anexado_em: string;
  anexado_por_user_id: string;
  anexado_por_nome: string;
}

/* ─────────── BLOCO J — Aviso de Refugo (fluxo alternativo) ─────────── */

export type AvisoRefugoStatus = "aguardando_confirmacao" | "confirmado" | "rejeitado";

export interface AvisoRefugo {
  id: string;
  oc_id: string;
  /** Motivo informado pela transp ao avisar. */
  motivo: string;
  /** Evidência (foto/laudo) — opcional. */
  arquivo_url?: string;
  nome_arquivo?: string;
  avisado_em: string;
  avisado_por_user_id: string;
  avisado_por_nome: string;
  status: AvisoRefugoStatus;
  /** Preenchido quando a cerealista decide. */
  decidido_em?: string;
  decidido_por_user_id?: string;
  decidido_por_nome?: string;
  observacao_cerealista?: string;
}

/* ─────────── BLOCO J — CT-e de Retorno (pós-refugo) ─────────── */

export interface CteRetorno {
  id: string;
  oc_id: string;
  /** FK para o aviso confirmado que destravou este CT-e. */
  aviso_refugo_id: string;
  numero: string;
  chave_cte?: string;
  emitido_em: string;
  arquivo_url: string;
  nome_arquivo: string;
  anexado_em: string;
  anexado_por_user_id: string;
  anexado_por_nome: string;
  observacoes?: string;
}

/* ─────────── BLOCO J — Estadia (pós-refugo, opcional) ─────────── */

export interface Estadia {
  id: string;
  oc_id: string;
  /** Horas de estadia cobradas. */
  horas_estadia: number;
  /** Valor em R$. */
  valor: number;
  justificativa: string;
  arquivo_url?: string;
  nome_arquivo?: string;
  anexada_em: string;
  anexada_por_user_id: string;
  anexada_por_nome: string;
}

/* ─────────── BLOCO J — Quebra (cálculo fiscal) ─────────── */

export interface Quebra {
  id: string;
  oc_id: string;
  /** Peso na origem (vem do TicketCarregamento). */
  peso_carregado_kg: number;
  /** Peso no destino (vem do DadosDescarga). */
  peso_descarregado_kg: number;
  /** Diferença = carregado − descarregado (kg). */
  quebra_kg: number;
  /** Percentual = (quebra_kg / peso_carregado_kg) × 100. */
  quebra_pct: number;
  /** True quando quebra_pct > 0,5% (limite operacional). */
  alerta: boolean;
  /** Justificativa da transp (obrigatória se alerta=true). */
  justificativa_transp?: string;
  /** Observação do fiscal ao validar. */
  observacao_fiscal?: string;
  /** Estado da validação. */
  validado_em?: string;
  validado_por_user_id?: string;
  validado_por_nome?: string;
  calculado_em: string;
  calculado_por_user_id: string;
}

/* ─────────── BLOCO J — IA: análise de Fatura × CT-es ─────────── */

export type IAStatus = "pendente" | "aprovada" | "divergencia" | "erro";

/** Item analisado pela IA com seu veredito (campo×campo). */
export interface IAItemAnalise {
  campo: "valor_frete" | "transportadora" | "prestador" | "numero_cte";
  esperado: string;
  encontrado: string;
  match: boolean;
  observacao?: string;
}

export interface IAAnaliseFatura {
  id: string;
  fatura_id: string;        // FK ao Faturamento
  oc_id: string;
  status: IAStatus;
  itens: IAItemAnalise[];
  divergencias_count: number;
  resumo: string;
  analisada_em: string;
}

/* ─────────── Documentos fiscais ─────────── */

/** Status da NF: 'ativa' = válida agora; 'substituida' = trocada por outra; 'cancelada' = invalidada sem substituta. */
export type NotaFiscalStatus = "ativa" | "substituida" | "cancelada";

export interface NotaFiscal {
  id: string;
  oc_id: string;
  numero: string;
  chave_nfe?: string;
  valor: number;
  emitida_em: string;
  xml_url?: string;
  /** Bloco I — status da NF na operação. Default 'ativa' quando criada. */
  status?: NotaFiscalStatus;
  /** Bloco I — quando esta NF substitui outra, aponta para a NF substituída. */
  substitui_nf_id?: string;
  /** Bloco I — quando esta NF foi substituída, aponta para a NF que a substituiu. */
  substituida_por_nf_id?: string;
  /** Bloco I — motivo informado pelo fiscal ao solicitar a troca. */
  motivo_substituicao?: string;
  /** Bloco I — quando a substituição foi efetivada. */
  trocada_em?: string;
  /** Bloco I — usuário que aprovou a substituição (perfil fiscal). */
  trocada_por_user_id?: string;
}

export type CTEStatusSefaz = "rascunho" | "transmitido" | "autorizado" | "rejeitado" | "cancelado";

/** Bloco I — origem do CTE. 'emissao' = primeiro CTE; 'substituicao_manual' = troca decidida pelo fiscal. */
export type CTEOrigem = "emissao" | "substituicao_manual";

export interface CTE {
  id: string;
  oc_id: string;
  numero: string;
  chave_cte?: string;
  status_sefaz: CTEStatusSefaz;
  emitido_em: string;
  xml_url?: string;
  /** Bloco I — origem do CTE; CT-e nunca é substituído automaticamente. */
  origem?: CTEOrigem;
  /** Bloco I — quando este CTE substitui outro (manualmente), aponta para o anterior. */
  substitui_cte_id?: string;
}

export interface Romaneio {
  id: string;
  oc_id: string;
  numero: string;
  peso_bruto_kg: number;
  peso_tara_kg: number;
  peso_liquido_kg: number;
  emitido_em: string;
  anexo_url?: string;
}

/* ─────────── Documentos transversais (uploads) ─────────── */

export type TipoDocumento = "cnh" | "crlv" | "foto_motorista" | "contrato" | "nfe" | "cte" | "romaneio" | "outros";

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  url: string;
  /** Polimorfismo: aponta para qual entidade pertence. */
  entity_type: "motorista" | "veiculo" | "contrato" | "ordem" | "reserva";
  entity_id: string;
  anexado_por: string;
  anexado_em: string;
}

/* ─────────── Histórico de eventos (auditoria) ─────────── */

export type HistoricoTipo = "g" | "a" | "b" | "r" | "t";

export interface HistoricoEvento {
  quando: string;
  quem: string;
  o_que: string;
  tipo: HistoricoTipo;
  entity_type?: Modulo;
  entity_id?: string;
  /** Bloco I — perfil do usuário NO MOMENTO do evento (audit trail). */
  perfil_no_momento?: Perfil;
  /** Bloco I — ação semântica (criou, editou, aprovou, anexou, substituiu, ...). */
  acao?: HistoricoAcao;
  /** Bloco I — snapshot do estado ANTES da mudança (versionamento). */
  valor_antes?: unknown;
  /** Bloco I — snapshot do estado DEPOIS da mudança. */
  valor_depois?: unknown;
  /** Bloco I — motivo informado pelo usuário (em trocas, reprovações, ajustes). */
  motivo?: string;
}

/** Bloco I — ações semânticas registradas no histórico. */
export type HistoricoAcao =
  | "criou"
  | "editou"
  | "aprovou"
  | "reprovou"
  | "cancelou"
  | "publicou"
  | "anexou"
  | "substituiu"
  | "validou"
  | "rejeitou"
  | "solicitou_troca"
  | "aprovou_troca"
  | "rejeitou_troca"
  | "liberou_faturamento"
  | "anexou_fatura"
  | "pagou"
  | "finalizou";

/* ─────────── Tipos derivados ─────────── */

export type ReservaComCarga = Reserva & { carga: Carga };
