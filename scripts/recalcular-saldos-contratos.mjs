#!/usr/bin/env node
/**
 * Recalcula saldo_kg de cada contrato com base nas cargas reais.
 *
 * saldo_kg = qtd_kg_total − soma(cargas.total_kg do contrato)
 *
 * Útil quando o saldo ficou zerado/inconsistente por causa do bug
 * do auto-preenchimento (que sugeria saldo todo ao publicar carga).
 *
 * Uso:
 *   node scripts/recalcular-saldos-contratos.mjs         # DRY-RUN
 *   node scripts/recalcular-saldos-contratos.mjs --apply # grava
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

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

console.log("");
console.log("═".repeat(70));
console.log("🔄 Recalcular saldos dos contratos baseado em cargas reais");
console.log(`   Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log("═".repeat(70));

// Pega APENAS contratos que tem cargas vinculadas no terraroxa.
// Contratos sem cargas — saldo_kg veio do ERP de origem (NQTDSALDO) e não devemos mexer.
const { rows } = await c.query(`
  select c.id, c.numero, c.qtd_kg_total, c.saldo_kg as saldo_atual,
         coalesce((select sum(total_kg) from cargas where contrato_id = c.id), 0) as cargas_total,
         (select count(*) from cargas where contrato_id = c.id) as qtd_cargas
  from contratos c
  where exists (select 1 from cargas where cargas.contrato_id = c.id)
  order by c.numero
`);

console.log(`📦 Contratos com cargas vinculadas: ${rows.length}`);
console.log("");

let inconsistentes = 0;
let consertados = 0;

for (const row of rows) {
  const saldoCalculado = Number(row.qtd_kg_total) - Number(row.cargas_total);
  const saldoAtual = Number(row.saldo_atual);
  if (saldoCalculado === saldoAtual) {
    console.log(`  ✓ ${row.numero}: ok (saldo=${saldoAtual.toLocaleString("pt-BR")}, ${row.qtd_cargas} cargas)`);
    continue;
  }

  inconsistentes++;
  console.log(`  ⚠️  ${row.numero}: saldo_atual=${saldoAtual.toLocaleString("pt-BR")} | esperado=${saldoCalculado.toLocaleString("pt-BR")} kg (${row.qtd_cargas} cargas totalizando ${Number(row.cargas_total).toLocaleString("pt-BR")})`);

  if (APPLY) {
    await c.query(`update contratos set saldo_kg = $1 where id = $2`, [saldoCalculado, row.id]);
    consertados++;
  }
}

console.log("");
console.log("─".repeat(70));
console.log(`📊 Resultado:`);
console.log(`  Contratos verificados:    ${rows.length}`);
console.log(`  Inconsistentes encontrados: ${inconsistentes}`);
if (APPLY) {
  console.log(`  Saldos corrigidos:         ${consertados}`);
} else {
  console.log(`  Rode com --apply pra corrigir.`);
}
console.log("");

await c.end();
