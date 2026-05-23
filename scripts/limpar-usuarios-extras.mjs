#!/usr/bin/env node
/**
 * Limpa todos os usuários do sistema EXCETO os admins.
 *
 * Remove:
 *  - Row em public.usuarios
 *  - User correspondente no Auth (via service_role)
 *
 * SEMPRE preserva quem tem perfil='admin' em public.usuarios.
 *
 * Uso:
 *   node scripts/limpar-usuarios-extras.mjs         # dry-run
 *   node scripts/limpar-usuarios-extras.mjs --apply # remove de verdade
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

const APPLY = process.argv.includes("--apply");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

console.log("");
console.log("═".repeat(64));
console.log("🧹 Limpeza de usuários (preserva apenas admins)");
console.log(`   Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log("═".repeat(64));

// 1. Lista admins (a preservar)
const { data: admins } = await supabase
  .from("usuarios")
  .select("auth_user_id, email")
  .eq("perfil", "admin");
const adminIds = new Set((admins ?? []).map((a) => a.auth_user_id).filter(Boolean));

console.log("");
console.log(`🛡️  Admins preservados (${admins?.length ?? 0}):`);
for (const a of admins ?? []) console.log(`     • ${a.email}`);

// 2. Lista todos os usuários do Auth
const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
const todosAuth = authData?.users ?? [];

const aRemover = todosAuth.filter((u) => !adminIds.has(u.id));

console.log("");
console.log(`🗑️  Usuários a remover (${aRemover.length}):`);
for (const u of aRemover) console.log(`     • ${u.email}`);

if (aRemover.length === 0) {
  console.log("");
  console.log("✅ Nada a fazer — só admins existem.");
  process.exit(0);
}

if (!APPLY) {
  console.log("");
  console.log("ℹ️  DRY-RUN — rode com --apply pra remover.");
  process.exit(0);
}

// 3. Remove row em public.usuarios primeiro (FK constraint)
let removidosUsuarios = 0;
let removidosAuth = 0;
for (const u of aRemover) {
  // Delete public.usuarios
  const { error: errU } = await supabase
    .from("usuarios")
    .delete()
    .eq("auth_user_id", u.id);
  if (!errU) removidosUsuarios++;

  // Delete Auth user
  const { error: errA } = await supabase.auth.admin.deleteUser(u.id);
  if (!errA) {
    removidosAuth++;
    console.log(`   ✓ Removido: ${u.email}`);
  } else {
    console.log(`   ❌ ${u.email}: ${errA.message}`);
  }
}

console.log("");
console.log("─".repeat(64));
console.log(`📊 Resultado:`);
console.log(`  Rows em public.usuarios removidas: ${removidosUsuarios}`);
console.log(`  Auth users removidos:              ${removidosAuth}`);
console.log("");
