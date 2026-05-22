/* ════════════════════════════════════════════════════════════════════
 * BLOCO J — Checklist sequencial do fluxo TMS
 * Calcula o status de cada passo a partir do estado da OC.
 * Regra: cada passo só fica "pendente" quando o anterior está "concluido".
 * Passos opcionais (laudo, estadia) podem ser "pulados".
 * ════════════════════════════════════════════════════════════════════ */

import type {
  AnexoAgendamento,
  AutorizacaoCarregamento,
  AvisoRefugo,
  CteRetorno,
  CTE,
  DadosDescarga,
  Estadia,
  Faturamento,
  LaudoClassificacao,
  NotaFiscal,
  OrdemCarregamento,
  Pagamento,
  PassoChecklist,
  Quebra,
  StatusPasso,
  TicketCarregamento,
} from "../types";

/** Snapshot dos anexos de uma OC — facilita o cálculo do checklist. */
export interface OCSnapshot {
  oc: OrdemCarregamento;
  autorizacao?: AutorizacaoCarregamento;
  ticketCarreg?: TicketCarregamento;
  laudo?: LaudoClassificacao;
  notaFiscal?: NotaFiscal;
  anexoAgendamento?: AnexoAgendamento;
  cte?: CTE;
  descarga?: DadosDescarga;
  avisoRefugo?: AvisoRefugo;
  cteRetorno?: CteRetorno;
  estadia?: Estadia;
  quebra?: Quebra;
  faturamento?: Faturamento;
  pagamento?: Pagamento;
}

export interface PassoStatus {
  passo: PassoChecklist;
  /** Label de exibição (PT-BR). */
  label: string;
  /** Setor responsável por esse passo. */
  setor: "transportadora" | "logistica" | "fiscal" | "financeiro" | "sistema";
  /** Status calculado. */
  status: StatusPasso;
  /** Quando foi concluído (ISO string) — quando aplicável. */
  concluido_em?: string;
  /** Quem concluiu (nome). */
  concluido_por?: string;
  /** Texto descritivo do que falta/já está feito. */
  hint?: string;
  /** True se o passo é opcional (pode ser pulado). */
  opcional?: boolean;
  /** True se o passo só aparece em fluxo refugado. */
  refugo_only?: boolean;
}

/** Labels PT-BR de cada passo. */
export const PASSO_LABEL: Record<PassoChecklist, string> = {
  autorizacao_carregamento: "Autorização de carregamento",
  ticket_carregamento: "Ticket de carregamento + peso líquido",
  laudo_classificacao: "Laudo de classificação",
  nf_venda: "Nota fiscal",
  anexo_agendamento: "Comprovante de agendamento (destino)",
  cte_emissao: "CT-e da operação",
  comprovante_descarga: "Comprovante de descarga",
  aviso_refugo: "Aviso de refugo",
  confirmacao_refugo: "Confirmação do refugo",
  cte_retorno: "CT-e de retorno",
  estadia: "Estadia",
  calc_quebra: "Cálculo da quebra",
  validacao_fiscal: "Validação fiscal",
  fatura_ctes: "Fatura dos CT-es",
  conferencia_fiscal: "Conferência fiscal da fatura",
  envio_financeiro: "Envio ao financeiro",
  pagamento: "Pagamento",
};

/** Setor responsável por cada passo. */
export const PASSO_SETOR: Record<PassoChecklist, PassoStatus["setor"]> = {
  autorizacao_carregamento: "transportadora",
  ticket_carregamento: "transportadora",
  laudo_classificacao: "transportadora",
  nf_venda: "logistica",
  anexo_agendamento: "logistica",
  cte_emissao: "transportadora",
  comprovante_descarga: "transportadora",
  aviso_refugo: "transportadora",
  confirmacao_refugo: "logistica",
  cte_retorno: "transportadora",
  estadia: "transportadora",
  calc_quebra: "fiscal",
  validacao_fiscal: "fiscal",
  fatura_ctes: "transportadora",
  conferencia_fiscal: "fiscal",
  envio_financeiro: "fiscal",
  pagamento: "financeiro",
};

/**
 * Calcula o estado de TODOS os passos do checklist a partir do snapshot.
 * Sequência rígida: passo N só fica "pendente" se passo N-1 está "concluido".
 * Passos refugo_only só aparecem se oc.refugada === true.
 */
export function calcChecklist(snap: OCSnapshot): PassoStatus[] {
  const { oc, autorizacao, ticketCarreg, laudo, notaFiscal, anexoAgendamento, cte, descarga, avisoRefugo, cteRetorno, estadia, quebra, faturamento, pagamento } = snap;

  // Passo 1 — Autorização (sempre obrigatório)
  const p1: PassoStatus = autorizacao
    ? {
        passo: "autorizacao_carregamento",
        label: PASSO_LABEL.autorizacao_carregamento,
        setor: "transportadora",
        status: "concluido",
        concluido_em: autorizacao.anexada_em,
        concluido_por: autorizacao.anexada_por_nome,
      }
    : {
        passo: "autorizacao_carregamento",
        label: PASSO_LABEL.autorizacao_carregamento,
        setor: "transportadora",
        status: "pendente",
        hint: "Aguardando anexo da autorização (gera OC).",
      };

  // Passo 2 — Ticket de carregamento
  const p2: PassoStatus = ticketCarreg
    ? {
        passo: "ticket_carregamento",
        label: PASSO_LABEL.ticket_carregamento,
        setor: "transportadora",
        status: "concluido",
        concluido_em: ticketCarreg.carregado_em,
        concluido_por: ticketCarreg.carregado_por_nome,
        hint: `Peso líquido: ${ticketCarreg.peso_liquido_kg.toLocaleString("pt-BR")} kg`,
      }
    : {
        passo: "ticket_carregamento",
        label: PASSO_LABEL.ticket_carregamento,
        setor: "transportadora",
        status: p1.status === "concluido" ? "pendente" : "bloqueado",
        hint: p1.status === "concluido" ? "Anexar ticket da fazenda com bruto/tara/líquido." : "Aguardando autorização.",
      };

  // Passo 3 — Laudo de classificação (OPCIONAL)
  const p3: PassoStatus = laudo
    ? {
        passo: "laudo_classificacao",
        label: PASSO_LABEL.laudo_classificacao,
        setor: "transportadora",
        status: "concluido",
        concluido_em: laudo.anexado_em,
        concluido_por: laudo.anexado_por_nome,
        opcional: true,
      }
    : {
        passo: "laudo_classificacao",
        label: PASSO_LABEL.laudo_classificacao,
        setor: "transportadora",
        status: p2.status === "concluido" ? "pendente" : "bloqueado",
        opcional: true,
        hint: "Opcional — pode ser pulado.",
      };

  // Passo 4 — NF (cerealista anexa)
  const p4: PassoStatus = notaFiscal
    ? {
        passo: "nf_venda",
        label: PASSO_LABEL.nf_venda,
        setor: "logistica",
        status: "concluido",
        concluido_em: notaFiscal.emitida_em,
        hint: `NF ${notaFiscal.numero}`,
      }
    : {
        passo: "nf_venda",
        label: PASSO_LABEL.nf_venda,
        setor: "logistica",
        status: p2.status === "concluido" ? "pendente" : "bloqueado",
        hint: "Cerealista anexa NF da operação.",
      };

  // Passo 5 — Anexo de agendamento (cerealista)
  const p5: PassoStatus = anexoAgendamento
    ? {
        passo: "anexo_agendamento",
        label: PASSO_LABEL.anexo_agendamento,
        setor: "logistica",
        status: "concluido",
        concluido_em: anexoAgendamento.anexado_em,
        concluido_por: anexoAgendamento.anexado_por_nome,
      }
    : {
        passo: "anexo_agendamento",
        label: PASSO_LABEL.anexo_agendamento,
        setor: "logistica",
        status: p4.status === "concluido" ? "pendente" : "bloqueado",
        hint: "Cerealista anexa comprovante do agendamento no destino.",
      };

  // Passo 6 — CT-e (transp)
  const p6: PassoStatus = cte
    ? {
        passo: "cte_emissao",
        label: PASSO_LABEL.cte_emissao,
        setor: "transportadora",
        status: "concluido",
        concluido_em: cte.emitido_em,
        hint: `CT-e ${cte.numero} — status "em trânsito" liberado`,
      }
    : {
        passo: "cte_emissao",
        label: PASSO_LABEL.cte_emissao,
        setor: "transportadora",
        status: p5.status === "concluido" ? "pendente" : "bloqueado",
        hint: "Ao anexar, status muda para 'em trânsito' automaticamente.",
      };

  // Passo 7 — Comprovante de descarga (transp)
  const p7: PassoStatus = descarga
    ? {
        passo: "comprovante_descarga",
        label: PASSO_LABEL.comprovante_descarga,
        setor: "transportadora",
        status: "concluido",
        concluido_em: descarga.descarregado_em,
        hint: `Peso descarregado: ${descarga.peso_descarregado_kg.toLocaleString("pt-BR")} kg`,
      }
    : {
        passo: "comprovante_descarga",
        label: PASSO_LABEL.comprovante_descarga,
        setor: "transportadora",
        status: p6.status === "concluido" ? "pendente" : "bloqueado",
      };

  // Passos 7a/7b/8/9 — Refugo (só aparecem se oc.refugada)
  const refugado = !!oc.refugada || !!avisoRefugo;
  const p7a: PassoStatus = {
    passo: "aviso_refugo",
    label: PASSO_LABEL.aviso_refugo,
    setor: "transportadora",
    refugo_only: true,
    status: avisoRefugo
      ? "concluido"
      : refugado && p7.status === "concluido"
      ? "pendente"
      : "bloqueado",
    concluido_em: avisoRefugo?.avisado_em,
    concluido_por: avisoRefugo?.avisado_por_nome,
    hint: avisoRefugo ? `Motivo: ${avisoRefugo.motivo}` : undefined,
  };
  const p7b: PassoStatus = {
    passo: "confirmacao_refugo",
    label: PASSO_LABEL.confirmacao_refugo,
    setor: "logistica",
    refugo_only: true,
    status:
      avisoRefugo?.status === "confirmado"
        ? "concluido"
        : avisoRefugo?.status === "rejeitado"
        ? "rejeitado"
        : avisoRefugo
        ? "pendente"
        : "bloqueado",
    concluido_em: avisoRefugo?.decidido_em,
    concluido_por: avisoRefugo?.decidido_por_nome,
  };
  const p8: PassoStatus = {
    passo: "cte_retorno",
    label: PASSO_LABEL.cte_retorno,
    setor: "transportadora",
    refugo_only: true,
    status: cteRetorno
      ? "concluido"
      : p7b.status === "concluido"
      ? "pendente"
      : "bloqueado",
    concluido_em: cteRetorno?.anexado_em,
    concluido_por: cteRetorno?.anexado_por_nome,
    hint: cteRetorno ? `CT-e retorno ${cteRetorno.numero}` : undefined,
  };
  const p9: PassoStatus = {
    passo: "estadia",
    label: PASSO_LABEL.estadia,
    setor: "transportadora",
    refugo_only: true,
    opcional: true,
    status: estadia
      ? "concluido"
      : p8.status === "concluido"
      ? "pendente"
      : "bloqueado",
    concluido_em: estadia?.anexada_em,
    concluido_por: estadia?.anexada_por_nome,
    hint: estadia ? `${estadia.horas_estadia}h — R$ ${estadia.valor.toFixed(2)}` : "Opcional",
  };

  // Passo 10 — Quebra (fiscal) — destravado quando descarga ok
  // Em fluxo refugado, a quebra é calculada após CT-e retorno (passo 8)
  const desbloqueiaQuebra = refugado ? p8.status === "concluido" : p7.status === "concluido";
  const p10: PassoStatus = quebra
    ? {
        passo: "calc_quebra",
        label: PASSO_LABEL.calc_quebra,
        setor: "fiscal",
        status: "concluido",
        concluido_em: quebra.calculado_em,
        hint: `Quebra: ${quebra.quebra_kg.toLocaleString("pt-BR")} kg (${quebra.quebra_pct.toFixed(2)}%)${quebra.alerta ? " ⚠️" : ""}`,
      }
    : {
        passo: "calc_quebra",
        label: PASSO_LABEL.calc_quebra,
        setor: "fiscal",
        status: desbloqueiaQuebra ? "pendente" : "bloqueado",
      };

  // Passo 11 — Validação fiscal (descarga validada + quebra ok)
  const fiscalOk = !!descarga?.validado_em && p10.status === "concluido";
  const p11: PassoStatus = {
    passo: "validacao_fiscal",
    label: PASSO_LABEL.validacao_fiscal,
    setor: "fiscal",
    status: fiscalOk ? "concluido" : p10.status === "concluido" ? "pendente" : "bloqueado",
    concluido_em: descarga?.validado_em,
  };

  // Passo 12 — Fatura dos CT-es (transp)
  const p12: PassoStatus = faturamento?.fatura_url
    ? {
        passo: "fatura_ctes",
        label: PASSO_LABEL.fatura_ctes,
        setor: "transportadora",
        status: "concluido",
        hint: faturamento.valor_informado
          ? `Valor: R$ ${faturamento.valor_informado.toFixed(2)}`
          : undefined,
      }
    : {
        passo: "fatura_ctes",
        label: PASSO_LABEL.fatura_ctes,
        setor: "transportadora",
        status: p11.status === "concluido" ? "pendente" : "bloqueado",
        hint: "IA confere automaticamente após anexo.",
      };

  // Passo 13 — Conferência fiscal da fatura (após IA)
  const p13: PassoStatus = faturamento?.fiscal_conferida_em
    ? {
        passo: "conferencia_fiscal",
        label: PASSO_LABEL.conferencia_fiscal,
        setor: "fiscal",
        status: "concluido",
        concluido_em: faturamento.fiscal_conferida_em,
      }
    : {
        passo: "conferencia_fiscal",
        label: PASSO_LABEL.conferencia_fiscal,
        setor: "fiscal",
        status: p12.status === "concluido" ? "pendente" : "bloqueado",
      };

  // Passo 14 — Envio ao financeiro (faturamento liberado)
  const p14: PassoStatus = {
    passo: "envio_financeiro",
    label: PASSO_LABEL.envio_financeiro,
    setor: "fiscal",
    status:
      oc.status_financeiro === "fatura_anexada" || oc.status_financeiro === "pago"
        ? "concluido"
        : p13.status === "concluido"
        ? "pendente"
        : "bloqueado",
  };

  // Passo 15 — Pagamento (financeiro)
  const p15: PassoStatus = pagamento
    ? {
        passo: "pagamento",
        label: PASSO_LABEL.pagamento,
        setor: "financeiro",
        status: "concluido",
        concluido_em: pagamento.data_pagamento,
        hint: `R$ ${pagamento.valor_pago.toFixed(2)}`,
      }
    : {
        passo: "pagamento",
        label: PASSO_LABEL.pagamento,
        setor: "financeiro",
        status: p14.status === "concluido" ? "pendente" : "bloqueado",
      };

  const passos: PassoStatus[] = [p1, p2, p3, p4, p5, p6, p7, p7a, p7b, p8, p9, p10, p11, p12, p13, p14, p15];
  // Filtra refugo_only quando não é refugo
  return passos.filter((p) => !p.refugo_only || refugado);
}

/**
 * Calcula a percentagem de progresso (passos concluídos vs total visível).
 * Ignora passos "pulados" e refugo_only quando não aplicável.
 */
export function progressoChecklist(passos: PassoStatus[]): { concluidos: number; total: number; pct: number } {
  const total = passos.length;
  const concluidos = passos.filter((p) => p.status === "concluido").length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { concluidos, total, pct };
}

/**
 * Calcula a quebra (origem vs destino).
 * Retorna kg de diferença e percentual sobre o carregado.
 */
export function calcularQuebra(
  pesoCarregadoKg: number,
  pesoDescarregadoKg: number,
  limitePct: number = 0.5,
): { quebra_kg: number; quebra_pct: number; alerta: boolean } {
  const quebra_kg = pesoCarregadoKg - pesoDescarregadoKg;
  const quebra_pct = pesoCarregadoKg > 0 ? (quebra_kg / pesoCarregadoKg) * 100 : 0;
  const alerta = quebra_pct > limitePct;
  return { quebra_kg, quebra_pct, alerta };
}
