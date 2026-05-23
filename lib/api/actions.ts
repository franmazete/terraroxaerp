/* ════════════════════════════════════════════════════════════════════
 * Server Actions — Etapa 2 B1
 *
 * Mutations server-side que gravam no Supabase. Cada action:
 *  1. Verifica auth.uid() — se anônimo, retorna { error }
 *  2. Faz insert/update no Supabase
 *  3. revalidatePath para invalidar cache do RSC
 *  4. Retorna { ok: true, data } ou { error: string }
 *
 * USO no client:
 *   const r = await publicarCargaAction({...});
 *   if ("error" in r) toast.error(r.error); else toast.success(...)
 *
 * STATUS: stubs prontos. Quando aplicar Supabase, descomenta o corpo.
 * ════════════════════════════════════════════════════════════════════ */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "./erros-pt";
import type { Perfil, Pendencia } from "@/lib/types";

type ActionResult<T = unknown> = { ok: true; data?: T } | { error: string };

const NAO_CONFIGURADO_MSG = "Supabase não configurado — veja docs/SETUP_ETAPA_2_SUPABASE.md";

/** Helper: pega usuário logado + perfil. Retorna null se anônimo. */
async function getAuthUser(): Promise<{ id: string; nome: string; perfil: Perfil; transp_id?: string } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx")) {
    return null;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, perfil, transp_id")
    .eq("auth_user_id", user.id)
    .single();
  return usuario as { id: string; nome: string; perfil: Perfil; transp_id?: string } | null;
}

/* ─── CONTRATOS ─────────────────────────────────────────────────────── */

export async function publicarContratoAction(input: {
  produtor_id: string;
  produto_id: string;
  local_origem_id: string;
  qtd_kg_total: number;
  numero_manual?: string;
  cliente_id?: string;
  destino_local_id?: string;
  data_emissao?: string;
  data_vencto_financeiro?: string;
  valor_unitario?: number;
  valor_total?: number;
  observacoes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "comercial", "logistica"].includes(user.perfil)) {
    return { error: "Sem permissão para criar contratos" };
  }

  const supabase = await createClient();
  // Número auto via RPC (Bloco B2 — sequence dedicada no banco)
  const { data: numeroData, error: errNumero } = await supabase.rpc("proximo_numero_contrato");
  if (errNumero || !numeroData) {
    return { error: traduzirErro(errNumero ?? { message: "Falha ao gerar número do contrato" }) };
  }
  const numero = numeroData as string;

  const { data, error } = await supabase
    .from("contratos")
    .insert({
      ...input,
      numero,
      saldo_kg: input.qtd_kg_total,
      status: "ativo",
      disponivel: false,
      criado_por_user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: traduzirErro(error) };
  revalidatePath("/contratos");
  return { ok: true, data };
}

export async function disponibilizarContratoAction(id: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "comercial", "logistica"].includes(user.perfil)) {
    return { error: "Sem permissão para disponibilizar contratos" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").update({ disponivel: true }).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
  return { ok: true };
}

export async function atualizarContratoAction(
  id: string,
  patch: {
    numero_manual?: string;
    qtd_kg_total?: number;
    saldo_kg?: number;
    cliente_id?: string;
    destino_local_id?: string;
    terminal_id?: string;
    data_emissao?: string;
    data_vencto_financeiro?: string;
    valor_unitario?: number;
    valor_total?: number;
    observacoes?: string;
    status?: string;
  },
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "comercial", "logistica"].includes(user.perfil)) {
    return { error: "Sem permissão para editar contratos" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
  return { ok: true };
}

export async function excluirContratoAction(id: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "comercial"].includes(user.perfil)) {
    return { error: "Sem permissão para excluir contratos (apenas admin/comercial)" };
  }
  const supabase = await createClient();

  // Bloqueia se tem cargas vinculadas
  const { count: cargasCount } = await supabase
    .from("cargas")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", id);
  if ((cargasCount ?? 0) > 0) {
    return {
      error: `Contrato tem ${cargasCount} carga(s) vinculada(s). Cancele as cargas antes de excluir.`,
    };
  }

  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/contratos");
  return { ok: true };
}

/* ─── CARGAS ────────────────────────────────────────────────────────── */

export async function publicarCargaAction(input: {
  contrato_id: string;
  produto_id: string;
  produto: string;
  tipo_carga: string;
  origem_local_id: string;
  destino_local_id?: string;
  origem: string;
  destino?: string;
  total_kg: number;
  data_carg: string;
  obs?: string;
  contrato_interno: string;
  transps_permitidas?: string[];
}): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "comercial", "logistica"].includes(user.perfil)) {
    return { error: "Sem permissão para publicar cargas" };
  }

  const supabase = await createClient();
  const { transps_permitidas, ...cargaInput } = input;

  // Insert carga + desconta saldo do contrato + insert allowlist
  const { data: carga, error: e1 } = await supabase
    .from("cargas")
    .insert({ ...cargaInput, status: "disponivel" })
    .select("id")
    .single();
  if (e1 || !carga) return { error: traduzirErro(e1 ?? { message: "Falha ao criar carga" }) };

  // Desconta do saldo
  const { data: ct } = await supabase
    .from("contratos")
    .select("saldo_kg")
    .eq("id", input.contrato_id)
    .single();
  if (ct) {
    await supabase
      .from("contratos")
      .update({ saldo_kg: Math.max(0, ct.saldo_kg - input.total_kg) })
      .eq("id", input.contrato_id);
  }

  // Allowlist
  if (transps_permitidas && transps_permitidas.length > 0) {
    await supabase.from("carga_transps_permitidas").insert(
      transps_permitidas.map((t) => ({ carga_id: carga.id, transp_id: t })),
    );
  }

  revalidatePath("/cargas");
  revalidatePath("/disponiveis");
  return { ok: true, data: carga };
}

/* ─── RESERVAS ──────────────────────────────────────────────────────── */

export async function criarReservaAction(input: {
  carga_id: string;
  motorista_id: string;
  veiculo_id: string;
  motorista: string;
  placa: string;
  qtd_kg: number;
  frete_ton: number;
  obs?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user || user.perfil !== "transportadora" || !user.transp_id) {
    return { error: "Apenas transportadoras logadas podem reservar" };
  }

  const supabase = await createClient();
  // Pega nome da transp
  const { data: transp } = await supabase
    .from("transportadoras")
    .select("nome_fantasia")
    .eq("id", user.transp_id)
    .single();

  const { data, error } = await supabase
    .from("reservas")
    .insert({
      carga_id: input.carga_id,
      transp_id: user.transp_id,
      transp_nome: transp?.nome_fantasia ?? "",
      motorista_id: input.motorista_id,
      veiculo_id: input.veiculo_id,
      motorista: input.motorista,
      placa: input.placa,
      qtd_kg: input.qtd_kg,
      frete_ton: input.frete_ton,
      obs: input.obs,
      status: "pendente",
      etapa: "reserva_pendente",
    })
    .select("id")
    .single();

  if (error || !data) return { error: traduzirErro(error ?? { message: "Falha ao reservar" }) };

  // Cria pendência "aprovar_reserva" pra logística
  await criarPendenciaServer({
    reserva_id: data.id,
    categoria: "aprovar_reserva",
    setor_responsavel: "logistica",
    sla_horas: 24,
    descricao: "Aprovar/reprovar reserva da transportadora",
  });

  revalidatePath("/disponiveis");
  revalidatePath("/cargas");
  revalidatePath("/minhas-reservas");
  return { ok: true, data };
}

export async function reprovarReservaAction(reservaId: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "logistica"].includes(user.perfil)) {
    return { error: "Apenas logística pode reprovar reservas" };
  }

  const supabase = await createClient();
  // Pega a reserva pra devolver kg ao saldo da carga
  const { data: reserva, error: e1 } = await supabase
    .from("reservas")
    .select("id, carga_id, qtd_kg")
    .eq("id", reservaId)
    .single();
  if (e1 || !reserva) return { error: traduzirErro(e1 ?? { message: "Reserva não encontrada" }) };

  const { error: eUp } = await supabase
    .from("reservas")
    .update({ status: "reprovada" })
    .eq("id", reservaId);
  if (eUp) return { error: traduzirErro(eUp) };

  // Devolve kg ao saldo da carga (reservado_kg -= qtd)
  const { data: carga } = await supabase
    .from("cargas")
    .select("reservado_kg")
    .eq("id", reserva.carga_id)
    .single();
  if (carga) {
    await supabase
      .from("cargas")
      .update({ reservado_kg: Math.max(0, carga.reservado_kg - reserva.qtd_kg) })
      .eq("id", reserva.carga_id);
  }

  // Resolve pendência "aprovar_reserva" se houver
  await supabase
    .from("pendencias")
    .update({ status: "resolvida", resolvida_em: new Date().toISOString() })
    .eq("reserva_id", reservaId)
    .eq("categoria", "aprovar_reserva")
    .eq("status", "aberta");

  revalidatePath("/cargas");
  revalidatePath("/reservas");
  revalidatePath("/minhas-reservas");
  return { ok: true };
}

export async function aprovarReservaAction(reservaId: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "logistica"].includes(user.perfil)) {
    return { error: "Apenas logística aprova reservas" };
  }

  const supabase = await createClient();
  const { data: reserva, error: e1 } = await supabase
    .from("reservas")
    .update({ status: "aprovada", etapa: "aguard_docs" })
    .eq("id", reservaId)
    .select("transp_id")
    .single();
  if (e1 || !reserva) return { error: traduzirErro(e1 ?? { message: "Reserva não encontrada" }) };

  // Resolve pendência anterior + cria nova
  await supabase
    .from("pendencias")
    .update({ status: "resolvida", resolvida_em: new Date().toISOString() })
    .eq("reserva_id", reservaId)
    .eq("categoria", "aprovar_reserva")
    .eq("status", "aberta");

  await criarPendenciaServer({
    reserva_id: reservaId,
    transp_id: reserva.transp_id,
    categoria: "anexar_autorizacao_carreg",
    setor_responsavel: "transportadora",
    sla_horas: 48,
    descricao: "Anexar autorização de carregamento",
  });

  revalidatePath("/cargas");
  revalidatePath("/reservas");
  revalidatePath("/minhas-reservas");
  revalidatePath("/pendencias");
  return { ok: true };
}

/* ─── PENDÊNCIAS (server-only helper) ───────────────────────────────── */

async function criarPendenciaServer(input: {
  oc_id?: string;
  reserva_id?: string;
  transp_id?: string;
  categoria: Pendencia["categoria"];
  setor_responsavel: Pendencia["setor_responsavel"];
  sla_horas: number;
  descricao: string;
}): Promise<void> {
  const supabase = await createClient();
  const agora = new Date();
  const vence = new Date(agora.getTime() + input.sla_horas * 3600 * 1000);
  await supabase.from("pendencias").insert({
    ...input,
    criada_em: agora.toISOString(),
    vence_em: vence.toISOString(),
    status: "aberta",
  });
}

export async function resolverPendenciaAction(id: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pendencias")
    .update({
      status: "resolvida",
      resolvida_em: new Date().toISOString(),
      resolvida_por_user_id: user.id,
    })
    .eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/pendencias");
  return { ok: true };
}

/* ─── CANCELAR OC ───────────────────────────────────────────────────── */

export async function cancelarOrdemAction(input: {
  oc_id: string;
  motivo: string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!["admin", "logistica", "fiscal"].includes(user.perfil)) {
    return { error: "Sem permissão para cancelar OC" };
  }
  if (input.motivo.trim().length < 10) {
    return { error: "Motivo precisa ter ao menos 10 caracteres" };
  }

  const supabase = await createClient();
  const { error: e1 } = await supabase
    .from("ordens_carregamento")
    .update({ status: "cancelada" })
    .eq("id", input.oc_id);
  if (e1) return { error: traduzirErro(e1) };

  // Cancela pendências da OC
  await supabase
    .from("pendencias")
    .update({ status: "cancelada", resolvida_em: new Date().toISOString() })
    .eq("oc_id", input.oc_id)
    .eq("status", "aberta");

  // Histórico
  await supabase.from("historico_eventos").insert({
    quem: user.nome,
    o_que: `OC cancelada — motivo: ${input.motivo}`,
    tipo: "r",
    entity_type: "ordens_carregamento",
    entity_id: input.oc_id,
    perfil_no_momento: user.perfil,
    acao: "cancelou",
    motivo: input.motivo,
  });

  revalidatePath("/ordens");
  revalidatePath(`/ordens/${input.oc_id}`);
  return { ok: true };
}

/* ─── PLACEHOLDER de outras actions ─────────────────────────────────── *
 *
 * Faltam: anexarAutorizacao, anexarTicketCarregamento, anexarLaudo,
 * anexarNF, validarNF, anexarAgendamento, anexarCTE, registrarDescarga,
 * validarDescarga, criarAvisoRefugo, decidirAvisoRefugo, anexarCteRetorno,
 * anexarEstadia, calcularQuebra, liberarFaturamento, anexarFatura,
 * conferirFaturaFiscal, confirmarPagamento, solicitarTroca,
 * anexarNovaNFSubstituta, anexarDocumento, substituirDocumento.
 *
 * Padrão é o mesmo: getAuthUser → checar perfil → supabase.insert/update
 * → revalidatePath → return ok/error.
 *
 * Quando a usuária aplicar as migrations e quiser, peça pra completar
 * essa lista em batches. Cada action segue o template das já implementadas.
 * ═══════════════════════════════════════════════════════════════════════ */
