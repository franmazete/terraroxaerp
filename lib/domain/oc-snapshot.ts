/* ════════════════════════════════════════════════════════════════════
 * BLOCO J — Helper para montar o snapshot completo de uma OC
 * a partir dos arrays do data-store. Usado pelo calcChecklist().
 * ════════════════════════════════════════════════════════════════════ */

import type { OCSnapshot } from "./checklist";
import type {
  AnexoAgendamento,
  AutorizacaoCarregamento,
  AvisoRefugo,
  CTE,
  CteRetorno,
  DadosDescarga,
  Estadia,
  Faturamento,
  LaudoClassificacao,
  NotaFiscal,
  OrdemCarregamento,
  Pagamento,
  Quebra,
  TicketCarregamento,
} from "../types";

export interface SnapshotInputs {
  ordens: OrdemCarregamento[];
  autorizacoesCarregamento: AutorizacaoCarregamento[];
  ticketsCarregamento: TicketCarregamento[];
  laudosClassificacao: LaudoClassificacao[];
  anexosAgendamento: AnexoAgendamento[];
  ctes: CTE[];
  ctesRetorno: CteRetorno[];
  estadias: Estadia[];
  notasFiscais: NotaFiscal[];
  dadosDescarga: DadosDescarga[];
  avisosRefugo: AvisoRefugo[];
  quebras: Quebra[];
  faturamentos: Faturamento[];
  pagamentos: Pagamento[];
}

/** Monta o snapshot de uma OC específica (resolve todos os FKs). */
export function buildOCSnapshot(ocId: string, inputs: SnapshotInputs): OCSnapshot | null {
  const oc = inputs.ordens.find((o) => o.id === ocId);
  if (!oc) return null;

  return {
    oc,
    autorizacao: oc.autorizacao_id
      ? inputs.autorizacoesCarregamento.find((a) => a.id === oc.autorizacao_id)
      : inputs.autorizacoesCarregamento.find((a) => a.reserva_id === oc.reserva_id),
    ticketCarreg: oc.ticket_carregamento_id
      ? inputs.ticketsCarregamento.find((t) => t.id === oc.ticket_carregamento_id)
      : inputs.ticketsCarregamento.find((t) => t.oc_id === ocId),
    laudo: oc.laudo_classificacao_id
      ? inputs.laudosClassificacao.find((l) => l.id === oc.laudo_classificacao_id)
      : inputs.laudosClassificacao.find((l) => l.oc_id === ocId),
    notaFiscal: oc.nota_fiscal_id
      ? inputs.notasFiscais.find((n) => n.id === oc.nota_fiscal_id)
      : inputs.notasFiscais.find((n) => n.oc_id === ocId && n.status !== "substituida" && n.status !== "cancelada"),
    anexoAgendamento: oc.anexo_agendamento_id
      ? inputs.anexosAgendamento.find((a) => a.id === oc.anexo_agendamento_id)
      : inputs.anexosAgendamento.find((a) => a.oc_id === ocId),
    cte: oc.cte_id
      ? inputs.ctes.find((c) => c.id === oc.cte_id)
      : inputs.ctes.find((c) => c.oc_id === ocId),
    descarga: oc.descarga_id
      ? inputs.dadosDescarga.find((d) => d.id === oc.descarga_id)
      : inputs.dadosDescarga.find((d) => d.oc_id === ocId),
    avisoRefugo: oc.aviso_refugo_id
      ? inputs.avisosRefugo.find((a) => a.id === oc.aviso_refugo_id)
      : inputs.avisosRefugo.find((a) => a.oc_id === ocId),
    cteRetorno: oc.cte_retorno_id
      ? inputs.ctesRetorno.find((c) => c.id === oc.cte_retorno_id)
      : inputs.ctesRetorno.find((c) => c.oc_id === ocId),
    estadia: oc.estadia_id
      ? inputs.estadias.find((e) => e.id === oc.estadia_id)
      : inputs.estadias.find((e) => e.oc_id === ocId),
    quebra: oc.quebra_id
      ? inputs.quebras.find((q) => q.id === oc.quebra_id)
      : inputs.quebras.find((q) => q.oc_id === ocId),
    faturamento: oc.faturamento_id
      ? inputs.faturamentos.find((f) => f.id === oc.faturamento_id)
      : inputs.faturamentos.find((f) => f.oc_id === ocId),
    pagamento: inputs.pagamentos.find((p) => p.oc_id === ocId),
  };
}
