#!/usr/bin/env node
/**
 * Aplica uma migration SQL no Supabase via conexão direta Postgres.
 *
 * Uso:
 *   node scripts/apply-migration.mjs <caminho-do-sql>
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

const sqlPath = process.argv[2];
if (!sqlPath || !fs.existsSync(sqlPath)) {
  console.error("❌ Uso: node scripts/apply-migration.mjs <caminho.sql>");
  process.exit(1);
}

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL não está em .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf-8");

console.log("");
console.log("═".repeat(60));
console.log(`📜 Aplicando migration: ${path.basename(sqlPath)}`);
console.log(`📊 Tamanho: ${sql.length} chars`);
console.log("═".repeat(60));

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("✓ Conectado ao Postgres\n");

  await client.query(sql);
  console.log("✅ Migration aplicada com sucesso!");
} catch (err) {
  console.error("❌ Erro ao executar SQL:");
  console.error(`   ${err.message}`);
  if (err.position) console.error(`   posição: ${err.position}`);
  if (err.detail) console.error(`   detalhe: ${err.detail}`);
  process.exit(1);
} finally {
  await client.end();
}
console.log("");
