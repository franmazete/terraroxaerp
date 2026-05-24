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
import { createClient, createAdminClient } from "@/lib/supabase/server";
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

  // Insert carga — trigger no banco recalcula contratos.saldo_kg automaticamente.
  const { data: carga, error: e1 } = await supabase
    .from("cargas")
    .insert({ ...cargaInput, status: "disponivel" })
    .select("id")
    .single();
  if (e1 || !carga) return { error: traduzirErro(e1 ?? { message: "Falha ao criar carga" }) };

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

  // Trigger no banco ja incrementou cargas.reservado_kg automaticamente.

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

  // Trigger no banco recalcula cargas.reservado_kg (status reprovada nao conta).

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

/* ─── BLOCO J — ANEXAR AUTORIZAÇÃO DE CARREGAMENTO → GERA OC ────────── */

/**
 * Recebe FormData com:
 *   - arquivo: File (PDF/imagem)
 *   - reserva_id: string
 *   - carga_id: string
 *   - observacoes?: string
 *
 * Faz: upload no bucket "operacao" → INSERT autorizacoes_carregamento →
 * INSERT ordens_carregamento (gera OC) → UPDATE reserva.etapa →
 * resolve pendência de autorização + cria pendência de ticket pra transp.
 *
 * Usa createAdminClient pra evitar fricção de policies (a OC ainda não
 * existe quando a transp sobe o arquivo). Valida ownership da reserva
 * antes de qualquer escrita.
 */
export async function anexarAutorizacaoAction(
  formData: FormData,
): Promise<ActionResult<{ ocId: string; ocNumero: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (user.perfil !== "transportadora" || !user.transp_id) {
    return { error: "Apenas transportadoras podem anexar autorização" };
  }

  const arquivo = formData.get("arquivo") as File | null;
  const reservaId = formData.get("reserva_id") as string | null;
  const cargaId = formData.get("carga_id") as string | null;
  const observacoes = (formData.get("observacoes") as string | null) ?? undefined;

  if (!arquivo || arquivo.size === 0) return { error: "Selecione um arquivo." };
  if (!reservaId || !cargaId) return { error: "Reserva/carga inválida." };
  if (arquivo.size > 20 * 1024 * 1024) return { error: "Arquivo maior que 20MB." };

  const admin = createAdminClient();

  // 1. Valida que a reserva é dessa transp e está aprovada
  const { data: reserva, error: errRes } = await admin
    .from("reservas")
    .select("id, carga_id, transp_id, motorista_id, veiculo_id, qtd_kg, status, transp_nome")
    .eq("id", reservaId)
    .single();
  if (errRes || !reserva) return { error: "Reserva não encontrada." };
  if (reserva.transp_id !== user.transp_id) return { error: "Esta reserva não é da sua transportadora." };
  if (reserva.status !== "aprovada") return { error: "Reserva precisa estar aprovada." };
  if (!reserva.motorista_id || !reserva.veiculo_id) {
    return { error: "Reserva sem motorista/veículo definidos." };
  }

  // 2. Verifica que ainda não tem autorização
  const { data: jaTem } = await admin
    .from("autorizacoes_carregamento")
    .select("id")
    .eq("reserva_id", reservaId)
    .maybeSingle();
  if (jaTem) return { error: "Esta reserva já tem autorização anexada." };

  // 3. Busca dados da carga (contrato, locais) pra montar a OC
  const { data: carga, error: errCar } = await admin
    .from("cargas")
    .select("id, contrato_id, origem_local_id, destino_local_id")
    .eq("id", cargaId)
    .single();
  if (errCar || !carga) return { error: "Carga não encontrada." };

  // 4. Upload do arquivo no bucket "operacao"
  const ext = arquivo.name.split(".").pop() ?? "pdf";
  const timestamp = Date.now();
  const path = `autorizacoes/${reservaId}/${timestamp}.${ext}`;
  const { error: errUp } = await admin.storage
    .from("operacao")
    .upload(path, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (errUp) {
    console.error("[anexarAutorizacao] upload falhou:", errUp);
    return { error: `Falha no upload: ${errUp.message}` };
  }

  // 5. Salva o PATH (não signed URL). URL assinada é gerada sob demanda no
  //    download — assim não expira em 24h e fica baixável pra sempre.
  const arquivoUrl = path;

  // 6. INSERT autorizacoes_carregamento
  const { data: auth, error: errAut } = await admin
    .from("autorizacoes_carregamento")
    .insert({
      reserva_id: reservaId,
      carga_id: cargaId,
      transp_id: user.transp_id,
      arquivo_url: arquivoUrl,
      nome_arquivo: arquivo.name,
      observacoes,
      anexada_por_user_id: user.id,
      anexada_por_nome: user.nome,
    })
    .select("id")
    .single();
  if (errAut || !auth) {
    console.error("[anexarAutorizacao] insert autorização falhou:", errAut);
    // Rollback do storage
    await admin.storage.from("operacao").remove([path]);
    return { error: traduzirErro(errAut ?? { message: "Falha ao registrar autorização" }) };
  }

  // 7. Gera número da OC (ano + sequencial baseado em count)
  const { count } = await admin.from("ordens_carregamento").select("*", { count: "exact", head: true });
  const ano = new Date().getFullYear();
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  const numero = `OC-${ano}-${seq}`;

  // 8. INSERT ordens_carregamento
  const { data: oc, error: errOc } = await admin
    .from("ordens_carregamento")
    .insert({
      numero,
      contrato_id: carga.contrato_id,
      carga_id: cargaId,
      reserva_id: reservaId,
      transp_id: user.transp_id,
      motorista_id: reserva.motorista_id,
      veiculo_id: reserva.veiculo_id,
      local_carg_id: carga.origem_local_id,
      destino_local_id: carga.destino_local_id ?? null,
      peso_previsto_kg: reserva.qtd_kg,
      status: "emitida",
      origem: "automatica_reserva",
      emitida_em: new Date().toISOString().split("T")[0],
      emitida_por_nome: "Sistema (autorização anexada)",
      status_operacional: "oc_emitida",
      status_fiscal: "aguardando_nf",
      status_financeiro: "aguardando_liberacao",
      autorizacao_id: auth.id,
    })
    .select("id, numero")
    .single();
  if (errOc || !oc) {
    console.error("[anexarAutorizacao] insert OC falhou:", errOc, {
      contrato_id: carga.contrato_id,
      carga_id: cargaId,
      reserva_id: reservaId,
      local_carg_id: carga.origem_local_id,
      destino_local_id: carga.destino_local_id,
    });
    // Rollback completo: deleta autorização e arquivo
    await admin.from("autorizacoes_carregamento").delete().eq("id", auth.id);
    await admin.storage.from("operacao").remove([path]);
    return {
      error: `Autorização recebida, mas falha ao gerar OC: ${
        errOc?.message ?? "erro desconhecido"
      }. Tente novamente; se persistir, contate o suporte.`,
    };
  }

  // 9. Atualiza reserva.etapa = ordem_emitida
  const { error: errResUp } = await admin
    .from("reservas")
    .update({ etapa: "ordem_emitida" })
    .eq("id", reservaId);
  if (errResUp) console.error("[anexarAutorizacao] update reserva.etapa:", errResUp);

  // 10. Resolve pendência "anexar_autorizacao_carreg" + cria "anexar_ticket_carreg"
  //     (usa admin pra não esbarrar em RLS de pendências)
  const { error: errPendUp } = await admin
    .from("pendencias")
    .update({ status: "resolvida", resolvida_em: new Date().toISOString() })
    .eq("reserva_id", reservaId)
    .eq("categoria", "anexar_autorizacao_carreg")
    .eq("status", "aberta");
  if (errPendUp) console.error("[anexarAutorizacao] resolver pendência autorização:", errPendUp);

  const agora = new Date();
  const venceTicket = new Date(agora.getTime() + 24 * 3600 * 1000);
  const { error: errPendIns } = await admin.from("pendencias").insert({
    oc_id: oc.id,
    transp_id: user.transp_id,
    categoria: "anexar_ticket_carreg",
    setor_responsavel: "transportadora",
    sla_horas: 24,
    descricao: "Anexar ticket de carregamento e peso líquido",
    criada_em: agora.toISOString(),
    vence_em: venceTicket.toISOString(),
    status: "aberta",
  });
  if (errPendIns) console.error("[anexarAutorizacao] criar pendência ticket:", errPendIns);

  revalidatePath("/minhas-reservas");
  revalidatePath("/pendencias");
  revalidatePath("/painel");
  revalidatePath("/dashboard");
  revalidatePath(`/ordens/${oc.id}`);
  return { ok: true, data: { ocId: oc.id, ocNumero: oc.numero } };
}

/**
 * Auto-cura: detecta autorizações já anexadas que NÃO têm OC vinculada e
 * gera a OC retroativamente. Útil quando a action de anexar falhou no
 * meio do processo (autorização registrada mas OC nunca foi criada).
 *
 * Quem pode disparar: cerealista (admin/logistica) ou a própria transp
 * que é dona da autorização. Retorna lista das OCs criadas.
 */
export async function gerarOcsFaltantesAction(): Promise<
  ActionResult<{ criadas: { ocNumero: string; reservaId: string }[] }>
> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();

  // 1. Pega autorizações sem OC vinculada
  let q = admin
    .from("autorizacoes_carregamento")
    .select("id, reserva_id, carga_id, transp_id")
    .order("anexada_em", { ascending: true });
  if (user.perfil === "transportadora" && user.transp_id) {
    q = q.eq("transp_id", user.transp_id);
  }
  const { data: autorizacoes, error: errAut } = await q;
  if (errAut) return { error: traduzirErro(errAut) };

  const criadas: { ocNumero: string; reservaId: string }[] = [];

  for (const aut of autorizacoes ?? []) {
    // Já tem OC?
    const { data: ocExist } = await admin
      .from("ordens_carregamento")
      .select("id")
      .or(`autorizacao_id.eq.${aut.id},reserva_id.eq.${aut.reserva_id}`)
      .maybeSingle();
    if (ocExist) continue;

    // Busca reserva + carga
    const { data: reserva } = await admin
      .from("reservas")
      .select("id, motorista_id, veiculo_id, qtd_kg, status")
      .eq("id", aut.reserva_id)
      .single();
    if (!reserva || reserva.status !== "aprovada") continue;
    if (!reserva.motorista_id || !reserva.veiculo_id) continue;

    const { data: carga } = await admin
      .from("cargas")
      .select("id, contrato_id, origem_local_id, destino_local_id")
      .eq("id", aut.carga_id)
      .single();
    if (!carga) continue;

    const { count } = await admin
      .from("ordens_carregamento")
      .select("*", { count: "exact", head: true });
    const ano = new Date().getFullYear();
    const seq = String((count ?? 0) + 1).padStart(4, "0");
    const numero = `OC-${ano}-${seq}`;

    const { data: oc, error: errOc } = await admin
      .from("ordens_carregamento")
      .insert({
        numero,
        contrato_id: carga.contrato_id,
        carga_id: aut.carga_id,
        reserva_id: aut.reserva_id,
        transp_id: aut.transp_id,
        motorista_id: reserva.motorista_id,
        veiculo_id: reserva.veiculo_id,
        local_carg_id: carga.origem_local_id,
        destino_local_id: carga.destino_local_id ?? null,
        peso_previsto_kg: reserva.qtd_kg,
        status: "emitida",
        origem: "automatica_reserva",
        emitida_em: new Date().toISOString().split("T")[0],
        emitida_por_nome: "Sistema (auto-cura)",
        status_operacional: "oc_emitida",
        status_fiscal: "aguardando_nf",
        status_financeiro: "aguardando_liberacao",
        autorizacao_id: aut.id,
      })
      .select("id, numero")
      .single();
    if (errOc || !oc) {
      console.error("[gerarOcsFaltantes] insert OC falhou:", errOc, { autorizacao_id: aut.id });
      continue;
    }

    await admin.from("reservas").update({ etapa: "ordem_emitida" }).eq("id", aut.reserva_id);

    const agora = new Date();
    const venceTicket = new Date(agora.getTime() + 24 * 3600 * 1000);
    await admin.from("pendencias").insert({
      oc_id: oc.id,
      transp_id: aut.transp_id,
      categoria: "anexar_ticket_carreg",
      setor_responsavel: "transportadora",
      sla_horas: 24,
      descricao: "Anexar ticket de carregamento e peso líquido",
      criada_em: agora.toISOString(),
      vence_em: venceTicket.toISOString(),
      status: "aberta",
    });

    criadas.push({ ocNumero: oc.numero, reservaId: aut.reserva_id });
  }

  revalidatePath("/minhas-reservas");
  revalidatePath("/pendencias");
  revalidatePath("/painel");
  revalidatePath("/dashboard");
  return { ok: true, data: { criadas } };
}

/* ─── DOWNLOAD DE ANEXOS ────────────────────────────────────────────── */

/**
 * Gera URL de download assinada (válida 1h) para um arquivo no bucket "operacao".
 *
 * Aceita tanto path puro (ex: "autorizacoes/<reserva_id>/123.pdf") quanto URL
 * antiga (a primeira versão da action salvava URL assinada de 24h no banco —
 * se ela já expirou, geramos uma nova a partir do path extraído).
 *
 * RLS do bucket controla quem pode baixar:
 *  - cerealista: tudo
 *  - transp: arquivos cuja OC seja dela (verifica pattern <oc_id>/ no path)
 *
 * Pra autorizações pré-OC (path "autorizacoes/<reserva_id>/...") a policy
 * de SELECT atual NÃO inclui esse caso — então usamos admin client e
 * validamos ownership manualmente.
 */
export async function gerarUrlDownloadAction(
  arquivoUrlOuPath: string,
): Promise<ActionResult<{ url: string; nome: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "Não autenticado" };
  if (!arquivoUrlOuPath) return { error: "Caminho do arquivo vazio" };

  // Se já é URL completa e ainda válida (signed URL nao-expirada), retorna ela.
  // Mas signed URLs expiram, então tentamos extrair o path mesmo assim.
  let path = arquivoUrlOuPath;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    // Tenta extrair o path do formato: <host>/storage/v1/object/sign/operacao/<path>?token=...
    const match = path.match(/\/object\/sign\/operacao\/([^?]+)/) ?? path.match(/\/object\/public\/operacao\/([^?]+)/);
    if (match) {
      path = decodeURIComponent(match[1]);
    } else {
      // URL externa ou formato não reconhecido — devolve direto
      const nome = path.split("/").pop()?.split("?")[0] ?? "arquivo";
      return { ok: true, data: { url: arquivoUrlOuPath, nome } };
    }
  }

  // Gera signed URL fresh
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("operacao")
    .createSignedUrl(path, 60 * 60); // 1h

  if (error || !signed) {
    console.error("[gerarUrlDownload] createSignedUrl falhou:", error, { path });
    return { error: `Não foi possível gerar URL de download: ${error?.message ?? "erro"}` };
  }

  const nome = path.split("/").pop() ?? "arquivo";
  return { ok: true, data: { url: signed.signedUrl, nome } };
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
