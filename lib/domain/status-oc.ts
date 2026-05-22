import type { OCStatusFinanceiro, OCStatusFiscal, OCStatusOperacional } from "../types";

/* ════════════════════════════════════════════════════════════════════
 * Bloco I — Helpers das 3 trilhas paralelas de status da OC
 * ════════════════════════════════════════════════════════════════════ */

export const STATUS_OPERACIONAL_LABEL: Record<OCStatusOperacional, string> = {
  aguardando_autorizacao: "Aguardando Autorização",
  oc_emitida: "OC Emitida",
  carregando: "Carregando",
  em_transito: "Em Trânsito",
  aguardando_descarga: "Aguardando Descarga",
  descarregado: "Descarregado",
  operacional_concluido: "Operação Concluída",
};

export const STATUS_FISCAL_LABEL: Record<OCStatusFiscal, string> = {
  aguardando_nf: "Aguardando NF",
  nf_recebida: "NF Recebida",
  nf_em_analise: "NF em Análise",
  troca_solicitada: "Troca Solicitada",
  troca_aprovada: "Troca Aprovada",
  nf_substituida: "NF Substituída",
  nf_validada: "NF Validada",
  aguardando_cte: "Aguardando CT-e",
  cte_recebido: "CT-e Recebido",
  liberado_faturamento: "Liberado p/ Faturamento",
};

export const STATUS_FINANCEIRO_LABEL: Record<OCStatusFinanceiro, string> = {
  aguardando_liberacao: "Aguardando Liberação",
  calculado: "Calculado",
  fatura_anexada: "Fatura Anexada",
  em_conferencia: "Em Conferência",
  divergencia: "Divergência",
  pago: "Pago",
  finalizado: "Finalizado",
};

/* Cores (tones) para badges nas 3 trilhas. */

export function toneOperacional(s?: OCStatusOperacional): "gray" | "amber" | "blue" | "green" | "teal" {
  if (!s) return "gray";
  if (s === "aguardando_autorizacao" || s === "aguardando_descarga") return "amber";
  if (s === "oc_emitida") return "blue";
  if (s === "carregando" || s === "em_transito") return "teal";
  return "green"; // descarregado, operacional_concluido
}

export function toneFiscal(s?: OCStatusFiscal): "gray" | "amber" | "blue" | "green" | "red" {
  if (!s) return "gray";
  if (s === "aguardando_nf" || s === "aguardando_cte") return "amber";
  if (s === "troca_solicitada" || s === "troca_aprovada") return "red";
  if (s === "nf_recebida" || s === "nf_em_analise" || s === "nf_substituida" || s === "cte_recebido") return "blue";
  return "green"; // nf_validada, liberado_faturamento
}

export function toneFinanceiro(s?: OCStatusFinanceiro): "gray" | "amber" | "blue" | "green" | "red" {
  if (!s) return "gray";
  if (s === "aguardando_liberacao" || s === "calculado") return "amber";
  if (s === "fatura_anexada" || s === "em_conferencia") return "blue";
  if (s === "divergencia") return "red";
  return "green"; // pago, finalizado
}

/* Transições válidas — usados como guarda nas mutations. */

const OPERACIONAL_NEXT: Record<OCStatusOperacional, OCStatusOperacional[]> = {
  aguardando_autorizacao: ["oc_emitida"],
  oc_emitida: ["carregando"],
  carregando: ["em_transito"],
  em_transito: ["aguardando_descarga"],
  aguardando_descarga: ["descarregado"],
  descarregado: ["operacional_concluido"],
  operacional_concluido: [],
};

const FISCAL_NEXT: Record<OCStatusFiscal, OCStatusFiscal[]> = {
  aguardando_nf: ["nf_recebida"],
  nf_recebida: ["nf_em_analise", "nf_validada"],
  nf_em_analise: ["nf_validada", "troca_solicitada"],
  troca_solicitada: ["troca_aprovada"],
  troca_aprovada: ["nf_substituida"],
  nf_substituida: ["nf_em_analise", "nf_validada"],
  nf_validada: ["aguardando_cte"],
  aguardando_cte: ["cte_recebido"],
  cte_recebido: ["liberado_faturamento"],
  liberado_faturamento: [],
};

const FINANCEIRO_NEXT: Record<OCStatusFinanceiro, OCStatusFinanceiro[]> = {
  aguardando_liberacao: ["calculado"],
  calculado: ["fatura_anexada"],
  fatura_anexada: ["em_conferencia"],
  em_conferencia: ["pago", "divergencia"],
  divergencia: ["em_conferencia"],
  pago: ["finalizado"],
  finalizado: [],
};

export function podeTransicaoOperacional(de: OCStatusOperacional, para: OCStatusOperacional): boolean {
  return OPERACIONAL_NEXT[de].includes(para);
}

export function podeTransicaoFiscal(de: OCStatusFiscal, para: OCStatusFiscal): boolean {
  return FISCAL_NEXT[de].includes(para);
}

export function podeTransicaoFinanceiro(de: OCStatusFinanceiro, para: OCStatusFinanceiro): boolean {
  return FINANCEIRO_NEXT[de].includes(para);
}
