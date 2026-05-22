import type { Pendencia, PendenciaCategoria, PendenciaSeveridade, PendenciaSetor } from "../types";

/* ════════════════════════════════════════════════════════════════════
 * Bloco I — SLA padrão por categoria de pendência
 * Valores em HORAS (não dias) para granularidade.
 * 1 dia útil ≈ 24h corridas (simplificação no mock; calendário real virá com lib).
 * ════════════════════════════════════════════════════════════════════ */

export const SLA_PADRAO: Record<PendenciaCategoria, { horas: number; setor: PendenciaSetor; descricao: string }> = {
  aprovar_reserva: { horas: 24, setor: "logistica", descricao: "Aprovar/reprovar reserva da transportadora" },
  anexar_autorizacao_carreg: { horas: 48, setor: "transportadora", descricao: "Anexar autorização de carregamento" },
  anexar_ticket_carreg: { horas: 24, setor: "transportadora", descricao: "Anexar ticket de carregamento + peso líquido" },
  registrar_descarga: { horas: 48, setor: "logistica", descricao: "Registrar dados de descarga (peso, ticket, canhoto)" },
  validar_descarga: { horas: 24, setor: "fiscal", descricao: "Validar a descarga registrada pela logística" },
  anexar_ticket_descarga: { horas: 48, setor: "transportadora", descricao: "Anexar comprovante de descarga (porto/destino)" },
  anexar_laudo: { horas: 72, setor: "transportadora", descricao: "Anexar laudo de classificação (opcional)" },
  anexar_nf: { horas: 72, setor: "logistica", descricao: "Anexar NF da operação" },
  validar_nf: { horas: 48, setor: "fiscal", descricao: "Validar NF anexada" },
  aprovar_troca_nf: { horas: 48, setor: "fiscal", descricao: "Aprovar/rejeitar solicitação de troca de NF" },
  anexar_nova_nf: { horas: 96, setor: "fiscal", descricao: "Anexar nova NF substituta" },
  anexar_cte: { horas: 120, setor: "transportadora", descricao: "Anexar CT-e da operação" },
  liberar_faturamento: { horas: 24, setor: "fiscal", descricao: "Liberar faturamento (todos os docs ok)" },
  anexar_fatura: { horas: 120, setor: "transportadora", descricao: "Anexar fatura dos CT-es" },
  processar_pagamento: { horas: 720, setor: "financeiro", descricao: "Processar pagamento (até 30 dias)" },
  /* ──── Bloco J — gating sequencial + refugo + IA ──── */
  anexar_agendamento: { horas: 48, setor: "logistica", descricao: "Anexar comprovante de agendamento no destino" },
  confirmar_refugo: { horas: 24, setor: "logistica", descricao: "Confirmar refugo informado pela transportadora" },
  anexar_cte_retorno: { horas: 72, setor: "transportadora", descricao: "Anexar CT-e do retorno (carga refugada)" },
  calc_quebra: { horas: 24, setor: "fiscal", descricao: "Calcular quebra (carregado vs descarregado)" },
  conferir_fatura_ia: { horas: 4, setor: "fiscal", descricao: "IA conferindo fatura × CT-es" },
  conferir_fatura_fiscal: { horas: 24, setor: "fiscal", descricao: "Conferir resultado da IA antes de mandar pro financeiro" },
};

/** Calcula severidade da pendência baseada em tempo decorrido vs. SLA. */
export function calcSeveridade(pendencia: Pendencia, agora: Date = new Date()): PendenciaSeveridade {
  if (pendencia.status !== "aberta") return "no_prazo";

  const criada = new Date(pendencia.criada_em);
  const vence = new Date(pendencia.vence_em);
  const decorrido = agora.getTime() - criada.getTime();
  const total = vence.getTime() - criada.getTime();
  const pct = total > 0 ? decorrido / total : 1;

  if (pct >= 2) return "critica";   // passou de 2× o SLA
  if (pct >= 1) return "atrasada";  // estourou
  if (pct >= 0.8) return "vencendo"; // 80% do SLA
  if (pct >= 0.5) return "proximo";  // 50% do SLA
  return "no_prazo";
}

export const SEVERIDADE_TONE: Record<PendenciaSeveridade, "green" | "amber" | "red"> = {
  no_prazo: "green",
  proximo: "amber",
  vencendo: "amber",
  atrasada: "red",
  critica: "red",
};

export const SEVERIDADE_LABEL: Record<PendenciaSeveridade, string> = {
  no_prazo: "🟢 No prazo",
  proximo: "🟡 Próximo do vencimento",
  vencendo: "🟠 Vencendo",
  atrasada: "🔴 Atrasada",
  critica: "⚫ Crítica",
};

/** Cria uma pendência com SLA derivado da categoria. */
export function criarPendencia(input: {
  oc_id?: string;
  reserva_id?: string;
  /** Quando setor é "transportadora", identifica a transp específica para filtrar "minhas pendências". */
  transp_id?: string;
  categoria: PendenciaCategoria;
  setor_override?: PendenciaSetor;
}): Omit<Pendencia, "id"> {
  const padrao = SLA_PADRAO[input.categoria];
  const agora = new Date();
  const vence = new Date(agora.getTime() + padrao.horas * 3600 * 1000);
  return {
    oc_id: input.oc_id,
    reserva_id: input.reserva_id,
    transp_id: input.transp_id,
    categoria: input.categoria,
    descricao: padrao.descricao,
    setor_responsavel: input.setor_override ?? padrao.setor,
    sla_horas: padrao.horas,
    criada_em: agora.toISOString(),
    vence_em: vence.toISOString(),
    status: "aberta",
  };
}
