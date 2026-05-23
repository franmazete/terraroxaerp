#!/usr/bin/env node
/**
 * Script de teste local da importação de Contratos CSV.
 *
 * Replica a lógica da Edge Function `import-contratos-csv` em Node puro,
 * pra você testar contra o Supabase real ANTES de subir o arquivo no bucket.
 *
 * Uso:
 *   node scripts/test-import-csv.mjs <caminho-do-csv>           # DRY-RUN (não insere)
 *   node scripts/test-import-csv.mjs <caminho-do-csv> --apply   # Insere de verdade
 *
 * Exemplo:
 *   node scripts/test-import-csv.mjs "C:/Users/FranMaz/Downloads/CONTRATOATUAL 2.csv"
 *
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import iconv from "iconv-lite";

// ── Load .env.local manualmente ─────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local não encontrado");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const linha of content.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const csvPath = args.find((a) => !a.startsWith("--"));
if (!csvPath) {
  console.error("❌ Uso: node scripts/test-import-csv.mjs <caminho.csv> [--apply]");
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error(`❌ Arquivo não encontrado: ${csvPath}`);
  process.exit(1);
}

// ── Parser (cópia do supabase/functions/import-contratos-csv/parser.ts) ─
function parseCSV(content) {
  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];
  const cabecalho = linhas[0].split(";").map((c) => c.trim().toUpperCase());
  const idx = (n) => cabecalho.indexOf(n);
  const ix = {
    estab: idx("ESTAB"), tipo: idx("TIPO"), operacao: idx("OPERACAO"), contrato: idx("CONTRATO"),
    descsafra: idx("DESCSAFRA"), dtemissao: idx("DTEMISSAO"), dtvencto: idx("DTVENCTO"),
    dtinicio: idx("DTINICIO"), dtfinal: idx("DTFINAL"),
    p_produtor: idx("P_PRODUTOR"), p_doccpf: idx("P_DOCCPF"),
    p_nomefazenda: idx("P_NOMEFAZENDA"), p_cidade_produtor: idx("P_CIDADE_PRODUTOR"),
    produto: idx("PRODUTO"), quantidade: idx("QUANTIDADE"), valorunit: idx("VALORUNIT"),
    valortotal: idx("VALORTOTAL"), origem: idx("ORIGEM"),
    nqtdsaldo: idx("NQTDSALDO"), nvlrsaldo: idx("NVLRSALDO"),
  };
  const get = (campos, i) => (i >= 0 && i < campos.length ? campos[i].trim() : "");
  const resultado = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(";");
    if (c.length < 10) continue;
    resultado.push({
      linha: i + 1,
      estab: get(c, ix.estab), tipo: get(c, ix.tipo), operacao: get(c, ix.operacao), contrato: get(c, ix.contrato),
      descsafra: get(c, ix.descsafra), dtemissao: get(c, ix.dtemissao), dtvencto: get(c, ix.dtvencto),
      dtinicio: get(c, ix.dtinicio), dtfinal: get(c, ix.dtfinal),
      p_produtor: get(c, ix.p_produtor), p_doccpf: get(c, ix.p_doccpf),
      p_nomefazenda: get(c, ix.p_nomefazenda), p_cidade_produtor: get(c, ix.p_cidade_produtor),
      produto: get(c, ix.produto), quantidade: get(c, ix.quantidade), valorunit: get(c, ix.valorunit),
      valortotal: get(c, ix.valortotal), origem: get(c, ix.origem),
      nqtdsaldo: get(c, ix.nqtdsaldo), nvlrsaldo: get(c, ix.nvlrsaldo),
    });
  }
  return resultado;
}

function parseNumberPtBR(s) {
  if (!s || s.trim() === "") return null;
  const n = Number(s.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function parseDataPtBR(s) {
  if (!s || s.trim() === "") return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}
function extrairCodigoNome(campo) {
  if (!campo) return { codigo: "", nome: "" };
  let sep = "-";
  let i = campo.indexOf(sep);
  if (i < 0) { sep = ","; i = campo.indexOf(sep); }
  if (i < 0) return { codigo: "", nome: campo.trim() };
  return { codigo: campo.slice(0, i).trim(), nome: campo.slice(i + sep.length).trim() };
}
function parseCidadeUF(s) {
  if (!s || s.trim() === "") return { cidade: null, uf: null };
  const m = s.trim().match(/^(.+)-([A-Z]{2})$/);
  if (!m) return { cidade: s.trim() || null, uf: null };
  return { cidade: m[1].trim(), uf: m[2] };
}
function normalizarDoc(s) { return (s ?? "").replace(/\D+/g, ""); }
function normalizarNome(s) {
  return s.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── Main ────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bytes = fs.readFileSync(csvPath);
const texto = iconv.decode(bytes, "win1252");
const linhas = parseCSV(texto);

console.log("");
console.log("═".repeat(72));
console.log(`📄 Arquivo: ${path.basename(csvPath)}`);
console.log(`📊 Total de linhas: ${linhas.length}`);
console.log(`🔧 Modo: ${APPLY ? "APPLY (inserir no banco)" : "DRY-RUN (somente simulação)"}`);
console.log("═".repeat(72));

// Lookups
const { data: produtos, error: errP } = await supabase.from("produtos").select("id, nome");
if (errP) {
  console.error("❌ Erro lendo produtos:", errP.message);
  console.error("   👉 Provavelmente a migration não foi aplicada. Veja docs/IMPORT_CONTRATOS.md");
  process.exit(1);
}

const { data: produtores } = await supabase.from("produtores").select("id, nome, cpf_cnpj");

const produtosMap = new Map();
for (const p of produtos ?? []) produtosMap.set(normalizarNome(p.nome), p.id);

const produtoresPorDoc = new Map();
for (const p of produtores ?? []) {
  const doc = normalizarDoc(p.cpf_cnpj);
  if (doc) produtoresPorDoc.set(doc, { id: p.id, nome: p.nome });
}

console.log("");
console.log(`📦 Produtos cadastrados no Supabase: ${produtos?.length ?? 0}`);
if ((produtos?.length ?? 0) > 0) {
  console.log(`   ${produtos.map((p) => p.nome).join(", ")}`);
}
console.log(`👥 Produtores cadastrados: ${produtores?.length ?? 0}`);
console.log("");

let importadas = 0, atualizadas = 0, rejeitadas = 0;
let produtoresCriados = 0, produtoresAtualizados = 0, produtoresJaExistiam = 0;
const erros = [];

for (const linha of linhas) {
  const tipo = linha.tipo.toLowerCase().trim();
  if (tipo !== "compra" && tipo !== "venda") {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: `TIPO inválido: "${linha.tipo}"` });
    continue;
  }

  const produtoNome = extrairCodigoNome(linha.produto).nome;
  if (!produtoNome) {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: "PRODUTO vazio" });
    continue;
  }
  const produtoId = produtosMap.get(normalizarNome(produtoNome));
  if (!produtoId) {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: `PRODUTO "${produtoNome}" NÃO CADASTRADO` });
    continue;
  }

  const produtorNome = extrairCodigoNome(linha.p_produtor).nome;
  const docCpf = normalizarDoc(linha.p_doccpf);
  if (!produtorNome) {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: "P_PRODUTOR vazio" });
    continue;
  }
  if (!docCpf) {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: "P_DOCCPF vazio" });
    continue;
  }

  const cidade_uf = parseCidadeUF(linha.p_cidade_produtor);
  const tipoProdutor = tipo === "compra" ? "vendedor" : "comprador";

  let produtorId;
  let produtorAcao;
  const existente = produtoresPorDoc.get(docCpf);
  if (existente) {
    produtorId = existente.id;
    produtorAcao = "ja_existia";
    if (APPLY) {
      const { error } = await supabase.from("produtores").update({
        razao_social: linha.p_nomefazenda || existente.nome,
        tipo: tipoProdutor, ativo: true,
      }).eq("id", produtorId);
      if (!error) produtorAcao = "atualizado";
    }
  } else {
    if (APPLY) {
      const { data: novo, error } = await supabase.from("produtores").insert({
        nome: produtorNome,
        razao_social: linha.p_nomefazenda || produtorNome,
        cpf_cnpj: linha.p_doccpf,
        cidade: cidade_uf.cidade ?? "—",
        uf: cidade_uf.uf ?? "—",
        contato: "—",
        tipo: tipoProdutor,
        ativo: true,
      }).select("id").single();
      if (error || !novo) {
        rejeitadas++;
        erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: `Falha criar produtor: ${error?.message}` });
        continue;
      }
      produtorId = novo.id;
      produtoresPorDoc.set(docCpf, { id: produtorId, nome: produtorNome });
    } else {
      produtorId = "<seria-criado>";
    }
    produtorAcao = "criado";
  }

  if (produtorAcao === "criado") produtoresCriados++;
  else if (produtorAcao === "atualizado") produtoresAtualizados++;
  else produtoresJaExistiam++;

  const qtdKg = parseNumberPtBR(linha.quantidade);
  if (qtdKg === null || qtdKg <= 0) {
    rejeitadas++;
    erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: `QUANTIDADE inválida: "${linha.quantidade}"` });
    continue;
  }

  const saldoKg = parseNumberPtBR(linha.nqtdsaldo) ?? qtdKg;
  const valorTotal = parseNumberPtBR(linha.valortotal);
  const valorSaldo = parseNumberPtBR(linha.nvlrsaldo);
  const valorSaca = parseNumberPtBR(linha.valorunit);

  if (APPLY) {
    // Remove pontos do número do contrato (CSV vem "9.985", banco fica "9985")
    const contratoLimpo = linha.contrato.replace(/\./g, "");
    const numero = `ERP-${linha.estab}-${contratoLimpo}`;
    const payload = {
      numero, numero_origem: contratoLimpo, numero_manual: contratoLimpo,
      tipo_contrato: tipo, produtor_id: produtorId, produto_id: produtoId,
      local_origem_id: null,
      qtd_kg_total: Math.round(qtdKg), saldo_kg: Math.round(saldoKg),
      safra: linha.descsafra || null,
      empresa_origem_codigo: linha.estab || null,
      origem_descricao: linha.origem || null,
      operacao: linha.operacao || null,
      data_emissao: parseDataPtBR(linha.dtemissao),
      data_vencto_financeiro: parseDataPtBR(linha.dtvencto),
      data_inicio: parseDataPtBR(linha.dtinicio),
      data_fim: parseDataPtBR(linha.dtfinal),
      valor_unitario: valorSaca !== null ? +(valorSaca / 60).toFixed(6) : null,
      valor_unitario_saca: valorSaca,
      valor_total: valorTotal,
      valor_saldo: valorSaldo,
      status: "ativo", disponivel: false,
    };
    const { error: errIns } = await supabase.from("contratos").upsert(payload, { onConflict: "numero" });
    if (errIns) {
      rejeitadas++;
      erros.push({ linha: linha.linha, contrato: linha.contrato, motivo: `Insert contrato: ${errIns.message}` });
      continue;
    }
  }

  importadas++;
}

// ── Resumo ──────────────────────────────────────────────────────────
console.log("─".repeat(72));
console.log(`📊 RESUMO`);
console.log("─".repeat(72));
console.log(`  ✓ Importadas:           ${importadas}`);
console.log(`  ✗ Rejeitadas:           ${rejeitadas}`);
console.log("");
console.log(`  👥 Produtores criados:    ${produtoresCriados}`);
console.log(`  ✏️  Produtores atualizados:${produtoresAtualizados}`);
console.log(`  ✓ Produtores já existiam: ${produtoresJaExistiam}`);
console.log("");
if (erros.length > 0) {
  console.log("─".repeat(72));
  console.log(`❌ ERROS (${erros.length}):`);
  console.log("─".repeat(72));
  for (const e of erros.slice(0, 20)) {
    console.log(`  linha ${e.linha} (contrato ${e.contrato}): ${e.motivo}`);
  }
  if (erros.length > 20) console.log(`  ... e mais ${erros.length - 20} erros`);
}
console.log("");
if (!APPLY) {
  console.log("ℹ️  Modo DRY-RUN — nada foi gravado no banco.");
  console.log("   Pra realmente importar, rode com --apply no final.");
}
console.log("");
