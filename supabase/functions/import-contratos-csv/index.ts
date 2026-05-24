/* ════════════════════════════════════════════════════════════════════
 * Edge Function: import-contratos-csv (v2)
 *
 * Layout v2 traz dados completos do produtor:
 *   P_PRODUTOR, P_DOCCPF, P_NOMEFAZENDA, P_CIDADE_PRODUTOR
 *
 * Comportamento:
 *   - De-para de PRODUTO por nome (rejeita se não cadastrado)
 *   - De-para de PRODUTOR por CPF/CNPJ (cria se não existe;
 *     atualiza dados faltantes se já existe)
 *   - Classifica produtor: tipo='vendedor' quando contrato=COMPRA
 *   - Upsert do contrato pelo numero (idempotente)
 *   - Move CSV pra processados/, gera CSV de erros se houver
 *   - Loga em importacao_log
 * ════════════════════════════════════════════════════════════════════ */

// @ts-expect-error Deno
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decodeLatin1,
  extrairCodigoNome,
  normalizarDoc,
  normalizarNome,
  parseCidadeUF,
  parseCSV,
  parseDataPtBR,
  parseNumberPtBR,
  type LinhaCSV,
} from "./parser.ts";

const BUCKET = "importacoes";
const PASTA_PENDENTES = "contratos/pendentes";
const PASTA_PROCESSADOS = "contratos/processados";
const PASTA_ERROS = "contratos/erros";

interface RelatorioLinha {
  linha: number;
  contrato: string;
  status: "importada" | "rejeitada" | "atualizada";
  produtor_acao?: "criado" | "atualizado" | "ja_existia";
  motivo?: string;
}

interface RelatorioArquivo {
  arquivo: string;
  total: number;
  importadas: number;
  rejeitadas: number;
  produtores_criados: number;
  produtores_atualizados: number;
  linhas: RelatorioLinha[];
}

// @ts-expect-error Deno
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    // @ts-expect-error Deno
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error Deno
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: arquivos, error: errList } = await supabase.storage
      .from(BUCKET)
      .list(PASTA_PENDENTES, { limit: 100 });
    if (errList) return json({ error: `Falha ao listar: ${errList.message}` }, 500);
    if (!arquivos || arquivos.length === 0) {
      return json({ ok: true, processados: 0, mensagem: "Nenhum arquivo pendente" });
    }

    const csvs = arquivos.filter((a: { name: string }) => a.name.toLowerCase().endsWith(".csv"));
    const relatorios: RelatorioArquivo[] = [];

    for (const arquivo of csvs) {
      try {
        relatorios.push(await processarArquivo(supabase, arquivo.name));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        relatorios.push({
          arquivo: arquivo.name, total: 0, importadas: 0, rejeitadas: 0,
          produtores_criados: 0, produtores_atualizados: 0,
          linhas: [{ linha: 0, contrato: "", status: "rejeitada", motivo: `Erro geral: ${msg}` }],
        });
      }
    }

    return json({ ok: true, processados: relatorios.length, relatorios });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function processarArquivo(
  supabase: ReturnType<typeof createClient>,
  nome: string,
): Promise<RelatorioArquivo> {
  const caminhoOrigem = `${PASTA_PENDENTES}/${nome}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const { data: logRow } = await supabase
    .from("importacao_log")
    .insert({ tipo: "contratos", arquivo: nome, status: "processando" })
    .select("id")
    .single();
  const logId = logRow?.id as string | undefined;

  const { data: blob, error: errDown } = await supabase.storage.from(BUCKET).download(caminhoOrigem);
  if (errDown || !blob) throw new Error(`Download: ${errDown?.message ?? "blob vazio"}`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const texto = decodeLatin1(bytes);
  const linhas = parseCSV(texto);

  // Lookups
  const { data: produtos } = await supabase.from("produtos").select("id, nome");
  const { data: produtores } = await supabase.from("produtores").select("id, nome, cpf_cnpj");

  const produtosMap = new Map<string, string>();
  for (const p of produtos ?? []) produtosMap.set(normalizarNome(p.nome), p.id);

  const produtoresPorDoc = new Map<string, { id: string; nome: string }>();
  for (const p of produtores ?? []) {
    const doc = normalizarDoc(p.cpf_cnpj);
    if (doc) produtoresPorDoc.set(doc, { id: p.id, nome: p.nome });
  }

  let importadas = 0, rejeitadas = 0;
  let produtoresCriados = 0, produtoresAtualizados = 0;
  const relatorioLinhas: RelatorioLinha[] = [];

  for (const linha of linhas) {
    const r = await processarLinha(supabase, linha, produtosMap, produtoresPorDoc);
    relatorioLinhas.push(r.relatorio);
    if (r.relatorio.status === "rejeitada") rejeitadas++;
    else importadas++;
    if (r.produtor_acao === "criado") produtoresCriados++;
    else if (r.produtor_acao === "atualizado") produtoresAtualizados++;
  }

  // CSV de erros
  let arquivoErros: string | null = null;
  const errosCsv = gerarCSVErros(relatorioLinhas);
  if (errosCsv) {
    arquivoErros = `${PASTA_ERROS}/${timestamp}_${nome}`;
    await supabase.storage.from(BUCKET).upload(arquivoErros, new Blob([errosCsv], { type: "text/csv" }), {
      contentType: "text/csv", upsert: true,
    });
  }

  // Move arquivo
  await supabase.storage.from(BUCKET).move(caminhoOrigem, `${PASTA_PROCESSADOS}/${timestamp}/${nome}`);

  // Atualiza log
  const status = rejeitadas === 0 ? "sucesso" : importadas > 0 ? "sucesso_parcial" : "erro";
  if (logId) {
    await supabase.from("importacao_log").update({
      concluida_em: new Date().toISOString(),
      total_linhas: linhas.length, importadas, rejeitadas,
      produtores_criados: produtoresCriados, arquivo_erros: arquivoErros, status,
    }).eq("id", logId);
  }

  return {
    arquivo: nome, total: linhas.length, importadas, rejeitadas,
    produtores_criados: produtoresCriados, produtores_atualizados: produtoresAtualizados,
    linhas: relatorioLinhas,
  };
}

async function processarLinha(
  supabase: ReturnType<typeof createClient>,
  linha: LinhaCSV,
  produtosMap: Map<string, string>,
  produtoresPorDoc: Map<string, { id: string; nome: string }>,
): Promise<{ relatorio: RelatorioLinha; produtor_acao?: "criado" | "atualizado" | "ja_existia" }> {
  // 1. TIPO
  const tipo = linha.tipo.toLowerCase().trim();
  if (tipo !== "compra" && tipo !== "venda") {
    return rej(linha, `TIPO inválido: "${linha.tipo}" (esperado COMPRA ou VENDA)`);
  }

  // 2. PRODUTO (de-para por nome, rejeita se não existe)
  const produtoNome = extrairCodigoNome(linha.produto).nome;
  if (!produtoNome) return rej(linha, "PRODUTO vazio");
  const produtoId = produtosMap.get(normalizarNome(produtoNome));
  if (!produtoId) return rej(linha, `PRODUTO "${produtoNome}" não cadastrado (cadastre antes de re-importar)`);

  // 3. PRODUTOR (de-para por CPF/CNPJ; cria/atualiza)
  const produtorNome = extrairCodigoNome(linha.p_produtor).nome;
  if (!produtorNome) return rej(linha, "P_PRODUTOR vazio");
  const docCpf = normalizarDoc(linha.p_doccpf);
  if (!docCpf) return rej(linha, "P_DOCCPF vazio (CPF/CNPJ obrigatório pra de-para)");

  const cidade_uf = parseCidadeUF(linha.p_cidade_produtor);
  const tipoProdutor = tipo === "compra" ? "vendedor" : "comprador";

  let produtorAcao: "criado" | "atualizado" | "ja_existia" = "ja_existia";
  let produtorId: string;

  const existente = produtoresPorDoc.get(docCpf);
  if (existente) {
    produtorId = existente.id;
    // Atualiza dados faltantes (sem sobrescrever campos já preenchidos pelo user)
    // Por simplicidade: sempre garante o tipo correto e razao_social se vier
    const { error: errUp } = await supabase
      .from("produtores")
      .update({
        razao_social: linha.p_nomefazenda || existente.nome,
        tipo: tipoProdutor,
        ativo: true,
      })
      .eq("id", produtorId);
    if (!errUp) produtorAcao = "atualizado";
  } else {
    // Cria novo
    const { data: novo, error: errProd } = await supabase
      .from("produtores")
      .insert({
        nome: produtorNome,
        razao_social: linha.p_nomefazenda || produtorNome,
        cpf_cnpj: linha.p_doccpf,
        cidade: cidade_uf.cidade ?? "—",
        uf: cidade_uf.uf ?? "—",
        contato: "—",
        tipo: tipoProdutor,
        ativo: true,
      })
      .select("id")
      .single();
    if (errProd || !novo) {
      return rej(linha, `Falha ao criar produtor "${produtorNome}": ${errProd?.message ?? "sem id"}`);
    }
    produtorId = novo.id as string;
    produtoresPorDoc.set(docCpf, { id: produtorId, nome: produtorNome });
    produtorAcao = "criado";
  }

  // 4. Conversões
  const qtdKg = parseNumberPtBR(linha.quantidade);
  if (qtdKg === null || qtdKg <= 0) return rej(linha, `QUANTIDADE inválida: "${linha.quantidade}"`, produtorAcao);

  // NQTDSALDO é o saldo do ERP de origem — informativo, NÃO sobrescreve nosso saldo_kg.
  // O saldo_kg real é recalculado pelo trigger no banco (qtd_kg_total - cargas publicadas).
  const qtdOrigemErp = parseNumberPtBR(linha.nqtdsaldo);
  const valorTotal = parseNumberPtBR(linha.valortotal);
  const valorSaldo = parseNumberPtBR(linha.nvlrsaldo);
  const valorSaca = parseNumberPtBR(linha.valorunit);
  const valorUnitario = valorSaca !== null ? +(valorSaca / 60).toFixed(6) : undefined;

  // 5. Upsert contrato
  // Remove pontos do número (CSV vem "9.985", banco fica "9985")
  const contratoLimpo = linha.contrato.replace(/\./g, "");
  const numero = `ERP-${linha.estab}-${contratoLimpo}`;
  const insertPayload = {
    numero,
    numero_origem: contratoLimpo,
    numero_manual: contratoLimpo,
    tipo_contrato: tipo,
    produtor_id: produtorId,
    produto_id: produtoId,
    local_origem_id: null,
    qtd_kg_total: Math.round(qtdKg),
    saldo_kg: Math.round(qtdKg), // trigger recalcula em seguida com base nas cargas
    qtd_kg_origem_erp: qtdOrigemErp !== null ? Math.round(qtdOrigemErp) : null,
    safra: linha.descsafra || null,
    empresa_origem_codigo: linha.estab || null,
    origem_descricao: linha.origem || null,
    operacao: linha.operacao || null,
    data_emissao: parseDataPtBR(linha.dtemissao),
    data_vencto_financeiro: parseDataPtBR(linha.dtvencto),
    data_inicio: parseDataPtBR(linha.dtinicio),
    data_fim: parseDataPtBR(linha.dtfinal),
    valor_unitario: valorUnitario,
    valor_unitario_saca: valorSaca,
    valor_total: valorTotal,
    valor_saldo: valorSaldo,
    status: "ativo",
    disponivel: false,
  };

  const { error: errIns } = await supabase
    .from("contratos")
    .upsert(insertPayload, { onConflict: "numero" });

  if (errIns) return rej(linha, `Insert contrato: ${errIns.message}`, produtorAcao);

  return {
    relatorio: { linha: linha.linha, contrato: linha.contrato, status: "importada", produtor_acao: produtorAcao },
    produtor_acao: produtorAcao,
  };
}

function rej(linha: LinhaCSV, motivo: string, produtor_acao?: "criado" | "atualizado" | "ja_existia") {
  return {
    relatorio: { linha: linha.linha, contrato: linha.contrato, status: "rejeitada" as const, produtor_acao, motivo },
    produtor_acao,
  };
}

function gerarCSVErros(linhas: RelatorioLinha[]): string | null {
  const erros = linhas.filter((l) => l.status === "rejeitada");
  if (erros.length === 0) return null;
  const rows = ["linha;contrato;motivo"];
  for (const e of erros) {
    const motivo = (e.motivo ?? "").replace(/[;\n]/g, " ");
    rows.push(`${e.linha};${e.contrato};${motivo}`);
  }
  return "﻿" + rows.join("\n");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
