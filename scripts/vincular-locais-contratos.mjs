#!/usr/bin/env node
/**
 * Tenta vincular local_origem_id nos contratos importados (que estão null).
 *
 * Heurística:
 *  1. Se contrato.origem_descricao tem "Cidade-UF, ...": match por cidade
 *     - Se múltiplos locais batem, tenta refinar pelo nome (substring da razão)
 *  2. Se origem_descricao vazia: match pela cidade do produtor
 *  3. Se múltiplos, pega o primeiro
 *  4. Sem match: deixa null (user vincula manual)
 *
 * Modo --apply grava. Sem flag = dry-run.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const linha of content.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

const APPLY = process.argv.includes("--apply");

function normalizar(s) {
  return (s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .trim();
}

function parseOrigem(s) {
  if (!s) return { cidade: null, razao: null };
  const partes = s.split(",");
  const local = (partes[0] ?? "").trim();
  const razao = partes.slice(1).join(",").trim() || null;
  const m = local.match(/^(.+)-([A-Z]{2})$/);
  if (!m) return { cidade: local || null, razao };
  return { cidade: m[1].trim(), uf: m[2], razao };
}

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await c.connect();

// 1. Pega contratos sem local
const contratos = (
  await c.query(`
    select c.id, c.numero, c.origem_descricao, p.cidade as cidade_produtor
    from contratos c
    join produtores p on p.id = c.produtor_id
    where c.local_origem_id is null
  `)
).rows;

// 2. Pega todos os locais
const locais = (await c.query(`select id, nome, cidade from locais`)).rows;
const locaisPorCidade = new Map(); // cidadeNorm → array de locais
for (const l of locais) {
  const k = normalizar(l.cidade);
  if (!locaisPorCidade.has(k)) locaisPorCidade.set(k, []);
  locaisPorCidade.get(k).push(l);
}

console.log("");
console.log("═".repeat(70));
console.log(`🔗 Vinculação de Local de Origem`);
console.log(`   ${contratos.length} contratos sem local_origem`);
console.log(`   ${locais.length} locais cadastrados`);
console.log(`   Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log("═".repeat(70));

let vinculados = 0;
let ambiguos = 0;
let semMatch = 0;

for (const ctr of contratos) {
  // Cidade alvo: do origem_descricao OU do produtor
  const o = parseOrigem(ctr.origem_descricao);
  const cidade = o.cidade || ctr.cidade_produtor;
  if (!cidade) {
    semMatch++;
    continue;
  }

  const candidatos = locaisPorCidade.get(normalizar(cidade)) ?? [];
  if (candidatos.length === 0) {
    semMatch++;
    continue;
  }

  let escolhido = candidatos[0];

  // Se múltiplos, tenta refinar pela razão social (substring no nome do local)
  if (candidatos.length > 1 && o.razao) {
    const razaoNorm = normalizar(o.razao);
    const palavrasRazao = razaoNorm.split(/\s+/).filter((p) => p.length > 3);
    const comMatch = candidatos.find((l) => {
      const nomeNorm = normalizar(l.nome);
      return palavrasRazao.some((p) => nomeNorm.includes(p));
    });
    if (comMatch) escolhido = comMatch;
    else ambiguos++;
  }

  if (APPLY) {
    await c.query(`update contratos set local_origem_id = $1 where id = $2`, [
      escolhido.id,
      ctr.id,
    ]);
  }
  vinculados++;
}

console.log("");
console.log("─".repeat(70));
console.log(`📊 Resultado:`);
console.log(`  ✓ Vinculados:     ${vinculados}`);
console.log(`  ⚠️  Ambíguos:       ${ambiguos} (múltiplos locais bateram na cidade)`);
console.log(`  ❌ Sem match:      ${semMatch}`);
console.log("");
if (!APPLY) console.log(`ℹ️  DRY-RUN — rode com --apply pra gravar.`);
console.log("");

await c.end();
