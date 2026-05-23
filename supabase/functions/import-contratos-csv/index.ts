/* ════════════════════════════════════════════════════════════════════
 * Edge Function: import-contratos-csv
 *
 * Lê CSVs de Supabase Storage bucket "importacoes/contratos/pendentes/",
 * processa cada arquivo importando contratos pro banco, e move o arquivo
 * pra "processados/<timestamp>/". Linhas com erro vão pra um CSV em
 * "erros/<timestamp>_<arquivo>.csv".
 *
 * Invocação:
 *   - Manual: curl -X POST <function-url> -H "Authorization: Bearer <token>"
 *   - Cron: configurar pg_cron pra invocar periodicamente
 * ════════════════════════════════════════════════════════════════════ */

// @ts-expect-error Deno globals
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error - import via URL é padrão Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  decodeLatin1,
  extrairNome,
  normalizarNome,
  parseCSV,
  parseDataPtBR,
  parseNumberPtBR,
  parseOrigem,
  type LinhaCSV,
} from "./parser.ts";

const BUCKET = "importacoes";
const PASTA_PENDENTES = "contratos/pendentes";
const PASTA_PROCESSADOS = "contratos/processados";
const PASTA_ERROS = "contratos/erros";

interface RelatorioLinha {
  linha: number;
  contrato: string;
  status: "importada" | "rejeitada";
  motivo?: string;
}

interface RelatorioArquivo {
  arquivo: string;
  total: number;
  importadas: number;
  rejeitadas: number;
  produtores_criados: number;
  linhas: RelatorioLinha[];
}

// @ts-expect-error Deno globals
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // @ts-expect-error Deno globals
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error Deno globals
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // 1. Lista arquivos pendentes
    const { data: arquivos, error: errList } = await supabase.storage
      .from(BUCKET)
      .list(PASTA_PENDENTES, { limit: 100 });

    if (errList) {
      return json({ error: `Falha ao listar arquivos: ${errList.message}` }, 500);
    }

    if (!arquivos || arquivos.length === 0) {
      return json({ ok: true, processados: 0, mensagem: "Nenhum arquivo pendente" });
    }

    const csvs = arquivos.filter((a: { name: string }) => a.name.toLowerCase().endsWith(".csv"));
    const relatorios: RelatorioArquivo[] = [];

    for (const arquivo of csvs) {
      try {
        const rel = await processarArquivo(supabase, arquivo.name);
        relatorios.push(rel);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Erro processando ${arquivo.name}:`, msg);
        relatorios.push({
          arquivo: arquivo.name,
          total: 0,
          importadas: 0,
          rejeitadas: 0,
          produtores_criados: 0,
          linhas: [{ linha: 0, contrato: "", status: "rejeitada", motivo: `Erro geral: ${msg}` }],
        });
      }
    }

    return json({ ok: true, processados: relatorios.length, relatorios });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

/**
 * Processa um arquivo CSV: parse → de-para → insert → move/loga.
 */
async function processarArquivo(supabase: ReturnType<typeof createClient>, nome: string): Promise<RelatorioArquivo> {
  const caminhoOrigem = `${PASTA_PENDENTES}/${nome}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Cria entrada no audit log
  const { data: logRow } = await supabase
    .from("importacao_log")
    .insert({
      tipo: "contratos",
      arquivo: nome,
      status: "processando",
    })
    .select("id")
    .single();
  const logId = logRow?.id as string | undefined;

  // 1. Download
  const { data: blob, error: errDown } = await supabase.storage.from(BUCKET).download(caminhoOrigem);
  if (errDown || !blob) throw new Error(`Download falhou: ${errDown?.message ?? "blob vazio"}`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const texto = decodeLatin1(bytes);
  const linhas = parseCSV(texto);

  // 2. Carrega lookups em memória (produtos + produtores existentes)
  const { data: produtos } = await supabase.from("produtos").select("id, nome");
  const { data: produtores } = await supabase.from("produtores").select("id, nome");

  const produtosMap = new Map<string, string>(); // nome normalizado → id
  for (const p of produtos ?? []) produtosMap.set(normalizarNome(p.nome), p.id);
  const produtoresMap = new Map<string, string>();
  for (const p of produtores ?? []) produtoresMap.set(normalizarNome(p.nome), p.id);

  // 3. Processa cada linha
  const relatorioLinhas: RelatorioLinha[] = [];
  let importadas = 0;
  let rejeitadas = 0;
  let produtoresCriados = 0;

  for (const linha of linhas) {
    const resultado = await processarLinha(supabase, linha, produtosMap, produtoresMap);
    relatorioLinhas.push(resultado.relatorio);
    if (resultado.relatorio.status === "importada") importadas++;
    else rejeitadas++;
    if (resultado.produtorCriado) produtoresCriados++;
  }

  // 4. Salva CSV de erros (se houver)
  let arquivoErros: string | null = null;
  const errosCsv = gerarCSVErros(relatorioLinhas);
  if (errosCsv) {
    arquivoErros = `${PASTA_ERROS}/${timestamp}_${nome}`;
    await supabase.storage.from(BUCKET).upload(arquivoErros, new Blob([errosCsv], { type: "text/csv" }), {
      contentType: "text/csv",
      upsert: true,
    });
  }

  // 5. Move o arquivo original pra processados
  const caminhoDestino = `${PASTA_PROCESSADOS}/${timestamp}/${nome}`;
  await supabase.storage.from(BUCKET).move(caminhoOrigem, caminhoDestino);

  // 6. Atualiza log
  const status = rejeitadas === 0 ? "sucesso" : importadas > 0 ? "sucesso_parcial" : "erro";
  if (logId) {
    await supabase
      .from("importacao_log")
      .update({
        concluida_em: new Date().toISOString(),
        total_linhas: linhas.length,
        importadas,
        rejeitadas,
        produtores_criados: produtoresCriados,
        arquivo_erros: arquivoErros,
        status,
      })
      .eq("id", logId);
  }

  return {
    arquivo: nome,
    total: linhas.length,
    importadas,
    rejeitadas,
    produtores_criados: produtoresCriados,
    linhas: relatorioLinhas,
  };
}

/**
 * Processa UMA linha do CSV: valida, faz de-para, insere o contrato.
 */
async function processarLinha(
  supabase: ReturnType<typeof createClient>,
  linha: LinhaCSV,
  produtosMap: Map<string, string>,
  produtoresMap: Map<string, string>,
): Promise<{ relatorio: RelatorioLinha; produtorCriado: boolean }> {
  // 1. TIPO (COMPRA/VENDA → compra/venda)
  const tipo = linha.tipo.toLowerCase().trim();
  if (tipo !== "compra" && tipo !== "venda") {
    return {
      relatorio: {
        linha: linha.linha,
        contrato: linha.contrato,
        status: "rejeitada",
        motivo: `TIPO inválido: "${linha.tipo}" (esperado COMPRA ou VENDA)`,
      },
      produtorCriado: false,
    };
  }

  // 2. Produto (de-para por nome)
  const produtoNome = extrairNome(linha.produto).nome;
  if (!produtoNome) {
    return {
      relatorio: { linha: linha.linha, contrato: linha.contrato, status: "rejeitada", motivo: "PRODUTO vazio" },
      produtorCriado: false,
    };
  }
  const produtoId = produtosMap.get(normalizarNome(produtoNome));
  if (!produtoId) {
    return {
      relatorio: {
        linha: linha.linha,
        contrato: linha.contrato,
        status: "rejeitada",
        motivo: `PRODUTO "${produtoNome}" não cadastrado no sistema (cadastre antes de re-importar)`,
      },
      produtorCriado: false,
    };
  }

  // 3. Produtor (de-para por nome; se não existe, CRIA com cidade/UF do ORIGEM)
  const produtorNome = extrairNome(linha.produtor).nome;
  if (!produtorNome) {
    return {
      relatorio: { linha: linha.linha, contrato: linha.contrato, status: "rejeitada", motivo: "PRODUTOR vazio" },
      produtorCriado: false,
    };
  }
  let produtorId = produtoresMap.get(normalizarNome(produtorNome));
  let produtorCriado = false;
  if (!produtorId) {
    const origem = parseOrigem(linha.origem);
    const codigo = extrairNome(linha.produtor).codigo;
    const { data: novo, error: errProd } = await supabase
      .from("produtores")
      .insert({
        nome: produtorNome,
        razao_social: origem.razao ?? produtorNome,
        cpf_cnpj: codigo ? `ERP-${codigo}` : "PENDENTE",
        cidade: origem.cidade ?? "—",
        uf: origem.uf ?? "—",
        contato: "—",
        tipo: "vendedor",
        ativo: true,
      })
      .select("id")
      .single();
    if (errProd || !novo) {
      return {
        relatorio: {
          linha: linha.linha,
          contrato: linha.contrato,
          status: "rejeitada",
          motivo: `Falha ao criar produtor "${produtorNome}": ${errProd?.message ?? "sem id"}`,
        },
        produtorCriado: false,
      };
    }
    produtorId = novo.id as string;
    produtoresMap.set(normalizarNome(produtorNome), produtorId);
    produtorCriado = true;
  }

  // 4. Conversões numéricas e datas
  const qtdKg = parseNumberPtBR(linha.quantidade);
  if (qtdKg === null || qtdKg <= 0) {
    return {
      relatorio: {
        linha: linha.linha,
        contrato: linha.contrato,
        status: "rejeitada",
        motivo: `QUANTIDADE inválida: "${linha.quantidade}"`,
      },
      produtorCriado,
    };
  }

  const saldoKg = parseNumberPtBR(linha.nqtdsaldo) ?? qtdKg;
  const valorTotal = parseNumberPtBR(linha.valortotal);
  const valorSaldo = parseNumberPtBR(linha.nvlrsaldo);
  const valorSaca = parseNumberPtBR(linha.valorunit);
  // Calcula valor_unitario (R$/kg) a partir de valor_unitario_saca
  const valorUnitario = valorSaca !== null ? +(valorSaca / 60).toFixed(6) : undefined;

  // 5. Insert do contrato
  // Como não temos local_origem cadastrado (CSV traz texto livre),
  // gravamos origem_descricao e local_origem_id = null por enquanto.
  // O usuário pode linkar depois manualmente.
  const numero = `ERP-${linha.estab}-${linha.contrato}`; // identificador único do ERP
  const insertPayload = {
    numero,
    numero_origem: linha.contrato,
    numero_manual: linha.contrato,
    tipo_contrato: tipo,
    produtor_id: produtorId,
    produto_id: produtoId,
    local_origem_id: null,
    qtd_kg_total: Math.round(qtdKg),
    saldo_kg: Math.round(saldoKg),
    safra: linha.descsafra || null,
    empresa_origem_codigo: linha.estab || null,
    origem_descricao: linha.origem || null,
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

  // Upsert por numero_origem + empresa_origem_codigo (idempotente)
  const { error: errIns } = await supabase
    .from("contratos")
    .upsert(insertPayload, { onConflict: "numero" });

  if (errIns) {
    return {
      relatorio: {
        linha: linha.linha,
        contrato: linha.contrato,
        status: "rejeitada",
        motivo: `Insert falhou: ${errIns.message}`,
      },
      produtorCriado,
    };
  }

  return {
    relatorio: { linha: linha.linha, contrato: linha.contrato, status: "importada" },
    produtorCriado,
  };
}

/** Gera CSV de erros (só linhas rejeitadas). Retorna null se não há erros. */
function gerarCSVErros(linhas: RelatorioLinha[]): string | null {
  const erros = linhas.filter((l) => l.status === "rejeitada");
  if (erros.length === 0) return null;
  const rows = ["linha;contrato;motivo"];
  for (const e of erros) {
    const motivo = (e.motivo ?? "").replace(/[;\n]/g, " ");
    rows.push(`${e.linha};${e.contrato};${motivo}`);
  }
  // BOM UTF-8 + CSV
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
