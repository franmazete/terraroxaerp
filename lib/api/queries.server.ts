/* ════════════════════════════════════════════════════════════════════
 * Server Queries — Etapa 2 B1
 *
 * Funções server-side puras que leem direto do Supabase via createClient()
 * de lib/supabase/server.ts. Usadas em Server Components.
 *
 * IMPORTANTE: cada função retorna [] quando o Supabase não está configurado
 * (modo dev local sem .env.local) — assim páginas que usarem essas queries
 * não quebram, apenas mostram lista vazia.
 *
 * Quando uma página vira Server Component, troca:
 *   const { ordens } = useDataStore();   →   const ordens = await getOrdens();
 * ════════════════════════════════════════════════════════════════════ */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AnexoAgendamento,
  AutorizacaoCarregamento,
  AvisoRefugo,
  Carga,
  Cliente,
  Contrato,
  CTE,
  CteRetorno,
  DadosDescarga,
  DocumentoOperacao,
  Estadia,
  Faturamento,
  IAAnaliseFatura,
  LaudoClassificacao,
  Local,
  Motorista,
  NotaFiscal,
  OrdemCarregamento,
  Pagamento,
  Pendencia,
  Produto,
  Produtor,
  Quebra,
  Reserva,
  SolicitacaoTrocaNota,
  Terminal,
  TicketCarregamento,
  Transportadora,
  Usuario,
  Veiculo,
} from "@/lib/types";

const NAO_CONFIGURADO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

/** Helper para queries simples — devolve [] em modo mock e loga erro. */
async function selectAll<T>(table: string, orderBy?: string): Promise<T[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const query = supabase.from(table).select("*");
  const { data, error } = orderBy ? await query.order(orderBy, { ascending: false }) : await query;
  if (error) {
    console.error(`[queries.server] ${table}: ${error.message}`);
    return [];
  }
  return (data ?? []) as T[];
}

async function selectByOC<T>(table: string, ocId: string): Promise<T[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").eq("oc_id", ocId);
  if (error) {
    console.error(`[queries.server] ${table} (oc=${ocId}): ${error.message}`);
    return [];
  }
  return (data ?? []) as T[];
}

/* ─── CADASTROS ─────────────────────────────────────────────────────── */

export async function getUsuarios(): Promise<Usuario[]> {
  return selectAll<Usuario>("usuarios", "criado_em");
}

export async function getTransportadoras(): Promise<Transportadora[]> {
  return selectAll<Transportadora>("transportadoras", "nome_fantasia");
}

export async function getMotoristas(): Promise<Motorista[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("motoristas")
    .select("*, motorista_transportadoras(transp_id)")
    .order("nome", { ascending: true });
  if (error) {
    console.error(`[queries.server] motoristas: ${error.message}`);
    return [];
  }
  type Row = Motorista & { motorista_transportadoras?: { transp_id: string }[] | null };
  return (data ?? []).map((m: Row) => ({
    ...m,
    transp_ids: (m.motorista_transportadoras ?? []).map((mt) => mt.transp_id),
  })) as Motorista[];
}

export async function getVeiculos(): Promise<Veiculo[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("veiculos")
    .select("*, veiculo_transportadoras(transp_id)")
    .order("placa_cavalo", { ascending: true });
  if (error) {
    console.error(`[queries.server] veiculos: ${error.message}`);
    return [];
  }
  type Row = Veiculo & { veiculo_transportadoras?: { transp_id: string }[] | null };
  return (data ?? []).map((v: Row) => ({
    ...v,
    transp_ids: (v.veiculo_transportadoras ?? []).map((vt) => vt.transp_id),
  })) as Veiculo[];
}

export async function getProdutores(): Promise<Produtor[]> {
  return selectAll<Produtor>("produtores", "nome");
}

export async function getClientes(): Promise<Cliente[]> {
  return selectAll<Cliente>("clientes", "nome");
}

export async function getTerminais(): Promise<Terminal[]> {
  return selectAll<Terminal>("terminais", "nome");
}

export async function getLocais(): Promise<Local[]> {
  return selectAll<Local>("locais", "nome");
}

export async function getProdutos(): Promise<Produto[]> {
  return selectAll<Produto>("produtos", "nome");
}

/* ─── CONTRATOS / CARGAS / RESERVAS / OCs ───────────────────────────── */

export async function getContratos(): Promise<Contrato[]> {
  return selectAll<Contrato>("contratos", "criado_em");
}

export async function getContrato(id: string): Promise<Contrato | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("contratos").select("*").eq("id", id).single();
  if (error) {
    console.error(`[queries.server] contrato (${id}): ${error.message}`);
    return null;
  }
  return data as Contrato;
}

export async function getCargas(): Promise<Carga[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cargas")
    .select("*, reservas(*)")
    .order("publicada_em", { ascending: false });
  if (error) {
    console.error("[queries.server] cargas:", error.message);
    return [];
  }
  // Garante que cada carga tenha sempre o array `reservas` (Postgres pode omitir relação vazia)
  const cargas = (data ?? []).map((c) => ({ ...c, reservas: c.reservas ?? [] })) as Carga[];
  return cargas;
}

export async function getReservasDaTransp(transpId: string): Promise<Reserva[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("reservas").select("*").eq("transp_id", transpId);
  if (error) {
    console.error("[queries.server] reservas:", error.message);
    return [];
  }
  return (data ?? []) as Reserva[];
}

export async function getOrdens(): Promise<OrdemCarregamento[]> {
  return selectAll<OrdemCarregamento>("ordens_carregamento", "emitida_em");
}

export async function getOrdem(id: string): Promise<OrdemCarregamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_carregamento")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error(`[queries.server] ordem (${id}): ${error.message}`);
    return null;
  }
  return data as OrdemCarregamento;
}

export async function getOrdensDaTransp(transpId: string): Promise<OrdemCarregamento[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_carregamento")
    .select("*")
    .eq("transp_id", transpId)
    .order("emitida_em", { ascending: false });
  if (error) {
    console.error("[queries.server] ordens transp:", error.message);
    return [];
  }
  return (data ?? []) as OrdemCarregamento[];
}

/* ─── PENDÊNCIAS ────────────────────────────────────────────────────── */

export async function getPendenciasAbertas(): Promise<Pendencia[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pendencias")
    .select("*")
    .eq("status", "aberta")
    .order("vence_em", { ascending: true });
  if (error) {
    console.error("[queries.server] pendencias:", error.message);
    return [];
  }
  return (data ?? []) as Pendencia[];
}

export async function getPendenciasDoSetor(
  setor: "comercial" | "logistica" | "fiscal" | "financeiro" | "transportadora",
  transpId?: string,
): Promise<Pendencia[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  let q = supabase.from("pendencias").select("*").eq("status", "aberta").eq("setor_responsavel", setor);
  if (setor === "transportadora" && transpId) {
    q = q.eq("transp_id", transpId);
  }
  const { data, error } = await q.order("vence_em", { ascending: true });
  if (error) {
    console.error("[queries.server] pendencias setor:", error.message);
    return [];
  }
  return (data ?? []) as Pendencia[];
}

/* ─── FISCAL / FINANCEIRO ───────────────────────────────────────────── */

export async function getNotasFiscaisDaOC(ocId: string): Promise<NotaFiscal[]> {
  return selectByOC<NotaFiscal>("notas_fiscais", ocId);
}

export async function getCtesDaOC(ocId: string): Promise<CTE[]> {
  return selectByOC<CTE>("ctes", ocId);
}

export async function getDescargaDaOC(ocId: string): Promise<DadosDescarga | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("dados_descarga").select("*").eq("oc_id", ocId).maybeSingle();
  if (error) {
    console.error("[queries.server] descarga:", error.message);
    return null;
  }
  return data as DadosDescarga | null;
}

export async function getFaturamentoDaOC(ocId: string): Promise<Faturamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("faturamentos").select("*").eq("oc_id", ocId).maybeSingle();
  if (error) {
    console.error("[queries.server] faturamento:", error.message);
    return null;
  }
  return data as Faturamento | null;
}

export async function getPagamentoDaOC(ocId: string): Promise<Pagamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("pagamentos").select("*").eq("oc_id", ocId).maybeSingle();
  if (error) {
    console.error("[queries.server] pagamento:", error.message);
    return null;
  }
  return data as Pagamento | null;
}

export async function getSolicitacoesTroca(ocId: string): Promise<SolicitacaoTrocaNota[]> {
  return selectByOC<SolicitacaoTrocaNota>("solicitacoes_troca_nota", ocId);
}

export async function getDocumentosDaOC(ocId: string): Promise<DocumentoOperacao[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documentos_operacao")
    .select("*")
    .eq("oc_id", ocId)
    .order("versao", { ascending: false });
  if (error) {
    console.error("[queries.server] documentos:", error.message);
    return [];
  }
  return (data ?? []) as DocumentoOperacao[];
}

/* ─── BLOCO J — Gating ──────────────────────────────────────────────── */

export async function getAutorizacoes(): Promise<AutorizacaoCarregamento[]> {
  if (NAO_CONFIGURADO) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("autorizacoes_carregamento")
    .select("*")
    .order("anexada_em", { ascending: false });
  if (error) {
    console.error("[queries.server] autorizacoes:", error.message);
    return [];
  }
  return (data ?? []) as AutorizacaoCarregamento[];
}

export async function getAutorizacaoDaOC(ocId: string): Promise<AutorizacaoCarregamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  // FK pela reserva da OC — pega autorização que aponta pra mesma reserva_id
  const { data: oc } = await supabase
    .from("ordens_carregamento")
    .select("reserva_id")
    .eq("id", ocId)
    .single();
  if (!oc?.reserva_id) return null;
  const { data, error } = await supabase
    .from("autorizacoes_carregamento")
    .select("*")
    .eq("reserva_id", oc.reserva_id)
    .maybeSingle();
  if (error) {
    console.error("[queries.server] autorizacao:", error.message);
    return null;
  }
  return data as AutorizacaoCarregamento | null;
}

export async function getTicketCarregamento(ocId: string): Promise<TicketCarregamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets_carregamento")
    .select("*")
    .eq("oc_id", ocId)
    .maybeSingle();
  if (error) return null;
  return data as TicketCarregamento | null;
}

export async function getLaudo(ocId: string): Promise<LaudoClassificacao | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("laudos_classificacao").select("*").eq("oc_id", ocId).maybeSingle();
  return data as LaudoClassificacao | null;
}

export async function getAgendamento(ocId: string): Promise<AnexoAgendamento | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("anexos_agendamento").select("*").eq("oc_id", ocId).maybeSingle();
  return data as AnexoAgendamento | null;
}

export async function getAvisoRefugo(ocId: string): Promise<AvisoRefugo | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("avisos_refugo").select("*").eq("oc_id", ocId).maybeSingle();
  return data as AvisoRefugo | null;
}

export async function getCteRetorno(ocId: string): Promise<CteRetorno | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ctes_retorno").select("*").eq("oc_id", ocId).maybeSingle();
  return data as CteRetorno | null;
}

export async function getEstadia(ocId: string): Promise<Estadia | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("estadias").select("*").eq("oc_id", ocId).maybeSingle();
  return data as Estadia | null;
}

export async function getQuebra(ocId: string): Promise<Quebra | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("quebras").select("*").eq("oc_id", ocId).maybeSingle();
  return data as Quebra | null;
}

export async function getIAAnalise(faturaId: string): Promise<IAAnaliseFatura | null> {
  if (NAO_CONFIGURADO) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ia_analises_fatura").select("*").eq("fatura_id", faturaId).maybeSingle();
  return data as IAAnaliseFatura | null;
}

/* ─── SNAPSHOT da OC (Bloco J) — junta tudo numa chamada ────────────── */

import type { OCSnapshot } from "@/lib/domain/checklist";

/**
 * Monta o snapshot completo de uma OC com 1 chamada agregada (10 queries paralelas).
 * Substituirá buildOCSnapshot() do mock quando a página virar Server Component.
 */
export async function getOCSnapshot(ocId: string): Promise<OCSnapshot | null> {
  const oc = await getOrdem(ocId);
  if (!oc) return null;

  const [
    autorizacao,
    ticketCarreg,
    laudo,
    notasFiscais,
    anexoAgendamento,
    ctes,
    descarga,
    avisoRefugo,
    cteRetorno,
    estadia,
    quebra,
    faturamento,
    pagamento,
  ] = await Promise.all([
    getAutorizacaoDaOC(ocId),
    getTicketCarregamento(ocId),
    getLaudo(ocId),
    getNotasFiscaisDaOC(ocId),
    getAgendamento(ocId),
    getCtesDaOC(ocId),
    getDescargaDaOC(ocId),
    getAvisoRefugo(ocId),
    getCteRetorno(ocId),
    getEstadia(ocId),
    getQuebra(ocId),
    getFaturamentoDaOC(ocId),
    getPagamentoDaOC(ocId),
  ]);

  // NF ativa: a que não foi substituida nem cancelada
  const notaFiscal =
    notasFiscais.find((n) => (n.status ?? "ativa") === "ativa") ?? notasFiscais[0];
  // CT-e mais recente (não substituído)
  const cte = ctes.find((c) => !c.substitui_cte_id) ?? ctes[0];

  return {
    oc,
    autorizacao: autorizacao ?? undefined,
    ticketCarreg: ticketCarreg ?? undefined,
    laudo: laudo ?? undefined,
    notaFiscal: notaFiscal ?? undefined,
    anexoAgendamento: anexoAgendamento ?? undefined,
    cte: cte ?? undefined,
    descarga: descarga ?? undefined,
    avisoRefugo: avisoRefugo ?? undefined,
    cteRetorno: cteRetorno ?? undefined,
    estadia: estadia ?? undefined,
    quebra: quebra ?? undefined,
    faturamento: faturamento ?? undefined,
    pagamento: pagamento ?? undefined,
  };
}
