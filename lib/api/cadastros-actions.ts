/* ════════════════════════════════════════════════════════════════════
 * Server Actions — Cadastros (Bloco B4.a)
 *
 * 8 entidades base × 2 ações (criar/atualizar) = 16 actions. Cada uma:
 *   1. Valida que o user é cerealista (admin/comercial/logistica)
 *   2. Faz insert/update no Supabase
 *   3. revalidatePath('/cadastros/<entity>')
 *   4. Retorna { ok, data } ou { error }
 *
 * IDs são gerados pelo Postgres (gen_random_uuid()) — nunca passados pelo app.
 * ════════════════════════════════════════════════════════════════════ */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "./erros-pt";
import type {
  Cliente,
  Local,
  Motorista,
  Perfil,
  Produto,
  Produtor,
  Terminal,
  TipoLocal,
  TipoProdutor,
  TipoTerminal,
  TipoVeiculo,
  Transportadora,
  TransportadoraStatus,
  Veiculo,
} from "@/lib/types";

type ActionResult<T = unknown> = { ok: true; data?: T } | { error: string };

async function requireCerealista(): Promise<
  { ok: true; user: { id: string; nome: string; perfil: Perfil; transp_id?: string } } | { error: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx")) {
    return { error: "Supabase não configurado" };
  }
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: "Não autenticado" };
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, perfil, transp_id")
    .eq("auth_user_id", authUser.id)
    .single();
  if (!usuario) return { error: "Usuário não encontrado em public.usuarios" };
  if (!["admin", "comercial", "logistica", "fiscal", "financeiro"].includes(usuario.perfil)) {
    return { error: "Sem permissão (perfil não cerealista)" };
  }
  return { ok: true, user: usuario as { id: string; nome: string; perfil: Perfil; transp_id?: string } };
}

/* ═════════════════════════════════════════════════════════════════════
 * PRODUTOS
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarProduto(input: { nome: string; descricao?: string }): Promise<ActionResult<Produto>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome do produto" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .insert({ nome: input.nome, descricao: input.descricao })
    .select("*")
    .single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/produtos");
  return { ok: true, data: data as Produto };
}

export async function atualizarProduto(id: string, patch: { nome?: string; descricao?: string }): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("produtos").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/produtos");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * PRODUTORES
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarProdutor(input: {
  nome: string;
  cpf_cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
  razao_social?: string;
  tipo?: TipoProdutor;
  email?: string;
}): Promise<ActionResult<Produtor>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome" };
  if (!input.cpf_cnpj.trim()) return { error: "Informe CPF/CNPJ" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtores")
    .insert({ ...input, tipo: input.tipo ?? "vendedor", ativo: true })
    .select("*")
    .single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/produtores");
  return { ok: true, data: data as Produtor };
}

export async function atualizarProdutor(id: string, patch: Partial<Produtor>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("produtores").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/produtores");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * CLIENTES
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarCliente(input: {
  nome: string;
  cpf_cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
}): Promise<ActionResult<Cliente>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome" };
  if (!input.cpf_cnpj.trim()) return { error: "Informe CPF/CNPJ" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...input, ativo: true })
    .select("*")
    .single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/clientes");
  return { ok: true, data: data as Cliente };
}

export async function atualizarCliente(id: string, patch: Partial<Cliente>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/clientes");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * LOCAIS (com vínculo opcional, contato, lat/lng)
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarLocal(input: {
  nome: string;
  tipo: TipoLocal;
  cidade: string;
  uf: string;
  contato_nome?: string;
  contato_whatsapp?: string;
  contato_email?: string;
  latitude?: number;
  longitude?: number;
}): Promise<ActionResult<Local>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome" };
  if (!input.cidade.trim()) return { error: "Informe a cidade" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("locais").insert(input).select("*").single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/locais");
  return { ok: true, data: data as Local };
}

export async function atualizarLocal(id: string, patch: Partial<Local>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("locais").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/locais");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * TERMINAIS
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarTerminal(input: {
  nome: string;
  cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
  tipo: TipoTerminal;
  observacoes?: string;
}): Promise<ActionResult<Terminal>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome" };
  if (!input.cnpj.trim()) return { error: "Informe o CNPJ" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("terminais")
    .insert({ ...input, ativo: true })
    .select("*")
    .single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/terminais");
  return { ok: true, data: data as Terminal };
}

export async function atualizarTerminal(id: string, patch: Partial<Terminal>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("terminais").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/terminais");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * TRANSPORTADORAS
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarTransportadora(input: {
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  telefone: string;
  email: string;
  responsavel: string;
  inscricao_estadual?: string;
  rntrc?: string;
  status?: TransportadoraStatus;
}): Promise<ActionResult<Transportadora>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.razao_social.trim()) return { error: "Informe a razão social" };
  if (!input.cnpj_cpf.trim()) return { error: "Informe CNPJ/CPF" };
  if (!input.email.trim()) return { error: "Informe o e-mail" };

  const supabase = await createClient();
  const payload = {
    razao_social: input.razao_social,
    nome_fantasia: input.nome_fantasia || input.razao_social,
    cnpj_cpf: input.cnpj_cpf,
    telefone: input.telefone,
    email: input.email,
    responsavel: input.responsavel,
    inscricao_estadual: input.inscricao_estadual,
    rntrc: input.rntrc,
    status: input.status ?? "pendente",
  };
  const { data, error } = await supabase
    .from("transportadoras")
    .insert(payload)
    .select("*")
    .single();
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/transportadoras");
  return { ok: true, data: data as Transportadora };
}

export async function atualizarTransportadora(id: string, patch: Partial<Transportadora>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  // Remove campos legacy do tipo TS que NÃO existem no schema do Supabase
  const { nome: _nome, contato: _contato, cnpj: _cnpj, criada_em: _ce, ...patchLimpo } = patch as Record<string, unknown>;
  void _nome; void _contato; void _cnpj; void _ce;
  const { error } = await supabase.from("transportadoras").update(patchLimpo).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  revalidatePath("/cadastros/transportadoras");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * MOTORISTAS (com vínculo N:N → motorista_transportadoras)
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarMotorista(input: {
  nome: string;
  cpf: string;
  cnh: string;
  celular: string;
  email?: string;
  foto_url?: string;
  transp_ids: string[];
}): Promise<ActionResult<Motorista>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.nome.trim()) return { error: "Informe o nome" };
  if (!input.cpf.trim()) return { error: "Informe o CPF" };
  if (!input.cnh.trim()) return { error: "Informe a CNH" };

  const supabase = await createClient();
  const { transp_ids, ...motoristaInput } = input;
  const { data: motorista, error } = await supabase
    .from("motoristas")
    .insert({ ...motoristaInput, ativo: true })
    .select("*")
    .single();
  if (error || !motorista) return { error: error?.message ?? "Falha ao criar motorista" };

  // Inserir vínculos N:N
  if (transp_ids.length > 0) {
    await supabase.from("motorista_transportadoras").insert(
      transp_ids.map((tid) => ({ motorista_id: motorista.id, transp_id: tid })),
    );
  }

  revalidatePath("/cadastros/motoristas");
  return { ok: true, data: { ...motorista, transp_ids } as Motorista };
}

export async function atualizarMotorista(id: string, patch: Partial<Motorista>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { transp_ids, ...motoristaPatch } = patch;
  const { error } = await supabase.from("motoristas").update(motoristaPatch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  // Atualiza vínculos N:N (delete + insert simples; idempotente)
  if (transp_ids) {
    await supabase.from("motorista_transportadoras").delete().eq("motorista_id", id);
    if (transp_ids.length > 0) {
      await supabase.from("motorista_transportadoras").insert(
        transp_ids.map((tid) => ({ motorista_id: id, transp_id: tid })),
      );
    }
  }
  revalidatePath("/cadastros/motoristas");
  return { ok: true };
}

export async function vincularMotoristaTransp(motoristaId: string, transpId: string): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("motorista_transportadoras")
    .insert({ motorista_id: motoristaId, transp_id: transpId });
  if (error && !error.message.includes("duplicate")) return { error: error.message };
  revalidatePath("/cadastros/motoristas");
  return { ok: true };
}

/* ═════════════════════════════════════════════════════════════════════
 * VEÍCULOS (com vínculo N:N → veiculo_transportadoras)
 * ═════════════════════════════════════════════════════════════════════ */

export async function criarVeiculo(input: {
  placa_cavalo: string;
  tipo: TipoVeiculo;
  capacidade_kg: number;
  placa_carreta?: string;
  crlv_url?: string;
  transp_ids: string[];
}): Promise<ActionResult<Veiculo>> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  if (!input.placa_cavalo.trim()) return { error: "Informe a placa do cavalo" };
  if (input.capacidade_kg <= 0) return { error: "Capacidade inválida" };

  const supabase = await createClient();
  const { transp_ids, ...veiculoInput } = input;
  const { data: veiculo, error } = await supabase
    .from("veiculos")
    .insert({ ...veiculoInput, ativo: true })
    .select("*")
    .single();
  if (error || !veiculo) return { error: error?.message ?? "Falha ao criar veículo" };

  if (transp_ids.length > 0) {
    await supabase.from("veiculo_transportadoras").insert(
      transp_ids.map((tid) => ({ veiculo_id: veiculo.id, transp_id: tid })),
    );
  }
  revalidatePath("/cadastros/veiculos");
  return { ok: true, data: { ...veiculo, transp_ids } as Veiculo };
}

export async function atualizarVeiculo(id: string, patch: Partial<Veiculo>): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { transp_ids, ...veiculoPatch } = patch;
  const { error } = await supabase.from("veiculos").update(veiculoPatch).eq("id", id);
  if (error) return { error: traduzirErro(error) };
  if (transp_ids) {
    await supabase.from("veiculo_transportadoras").delete().eq("veiculo_id", id);
    if (transp_ids.length > 0) {
      await supabase.from("veiculo_transportadoras").insert(
        transp_ids.map((tid) => ({ veiculo_id: id, transp_id: tid })),
      );
    }
  }
  revalidatePath("/cadastros/veiculos");
  return { ok: true };
}

export async function vincularVeiculoTransp(veiculoId: string, transpId: string): Promise<ActionResult> {
  const auth = await requireCerealista();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("veiculo_transportadoras")
    .insert({ veiculo_id: veiculoId, transp_id: transpId });
  if (error && !error.message.includes("duplicate")) return { error: error.message };
  revalidatePath("/cadastros/veiculos");
  return { ok: true };
}
