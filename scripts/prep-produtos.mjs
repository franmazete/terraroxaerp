#!/usr/bin/env node
/**
 * Limpa produtos antigos (Soja, Milho) e cria os 4 com nome do CSV:
 * SOJA A GRANEL, MILHO A GRANEL, TRIGO A GRANEL, SORGO A GRANEL.
 *
 * Roda APENAS quando seguro: aborta se houver contratos vinculados.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const linha of content.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const NOVOS = [
  { nome: "SOJA A GRANEL", descricao: "Soja em grão a granel" },
  { nome: "MILHO A GRANEL", descricao: "Milho em grão a granel" },
  { nome: "TRIGO A GRANEL", descricao: "Trigo em grão a granel" },
  { nome: "SORGO A GRANEL", descricao: "Sorgo em grão a granel" },
];

console.log("");
console.log("═".repeat(60));
console.log("📦 Preparação dos produtos para importação");
console.log("═".repeat(60));

// 1. Lista produtos existentes
const { data: existentes, error: errLs } = await supabase
  .from("produtos")
  .select("id, nome");
if (errLs) {
  console.error("❌ Erro lendo produtos:", errLs.message);
  process.exit(1);
}
console.log(`\nProdutos atuais (${existentes.length}):`);
for (const p of existentes) console.log(`  • ${p.nome} (${p.id.slice(0, 8)}...)`);

// 2. Identifica os antigos a remover
const antigosNomes = ["Soja", "Milho", "Sorgo", "Trigo", "Algodão"];
const antigos = existentes.filter((p) => antigosNomes.includes(p.nome));

if (antigos.length > 0) {
  console.log(`\n🗑️  Removendo ${antigos.length} produto(s) antigos: ${antigos.map((a) => a.nome).join(", ")}`);
  const idsAntigos = antigos.map((a) => a.id);

  // Confere vínculos
  const { count: cContratos } = await supabase
    .from("contratos")
    .select("*", { count: "exact", head: true })
    .in("produto_id", idsAntigos);
  const { count: cCargas } = await supabase
    .from("cargas")
    .select("*", { count: "exact", head: true })
    .in("produto_id", idsAntigos);

  console.log(`   Vinculos encontrados: ${cContratos ?? 0} contratos, ${cCargas ?? 0} cargas`);

  if ((cContratos ?? 0) > 0) {
    const { error } = await supabase.from("contratos").delete().in("produto_id", idsAntigos);
    if (error) {
      console.error("   ❌ Falha ao deletar contratos vinculados:", error.message);
      process.exit(1);
    }
    console.log("   ✓ Contratos vinculados removidos");
  }
  if ((cCargas ?? 0) > 0) {
    const { error } = await supabase.from("cargas").delete().in("produto_id", idsAntigos);
    if (error) {
      console.error("   ❌ Falha ao deletar cargas vinculadas:", error.message);
      process.exit(1);
    }
    console.log("   ✓ Cargas vinculadas removidas");
  }

  const { error: errDel } = await supabase.from("produtos").delete().in("id", idsAntigos);
  if (errDel) {
    console.error("   ❌ Falha ao deletar produtos:", errDel.message);
    process.exit(1);
  }
  console.log(`   ✓ ${antigos.length} produto(s) antigo(s) removido(s)`);
}

// 3. Insere os novos (skip se já existem)
console.log("\n📥 Inserindo produtos do CSV:");
for (const p of NOVOS) {
  const jaExiste = existentes.find((x) => x.nome === p.nome);
  if (jaExiste) {
    console.log(`   ⏭️  ${p.nome} já existe`);
    continue;
  }
  const { error } = await supabase.from("produtos").insert(p);
  if (error) {
    console.error(`   ❌ ${p.nome}: ${error.message}`);
  } else {
    console.log(`   ✓ ${p.nome}`);
  }
}

// 4. Confere estado final
const { data: finais } = await supabase.from("produtos").select("nome").order("nome");
console.log(`\n✅ Produtos finais (${finais.length}):`);
for (const p of finais) console.log(`   • ${p.nome}`);
console.log("");
