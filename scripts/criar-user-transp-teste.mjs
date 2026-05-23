#!/usr/bin/env node
/**
 * Cria usuário Auth + row em public.usuarios pro perfil transportadora.
 * Usa SERVICE_ROLE pra criar o user no Auth.
 *
 * Credenciais default:
 *   email: transp@teste.com
 *   senha: terraroxa2026
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

const EMAIL = "transp@teste.com";
const SENHA = "terraroxa2026";

console.log("");
console.log("═".repeat(60));
console.log("👤 Criando usuário Auth pra teste de transportadora");
console.log("═".repeat(60));

// 1. Pega transp de teste
const { data: transp, error: errT } = await supabase
  .from("transportadoras")
  .select("id, nome_fantasia")
  .eq("cnpj_cpf", "00.000.000/0001-00")
  .single();
if (errT || !transp) {
  console.error("❌ Transp de teste não encontrada. Rode seed-dados-teste.mjs primeiro.");
  process.exit(1);
}
console.log(`📍 Transp alvo: ${transp.nome_fantasia} (${transp.id.slice(0, 8)}...)`);

// 2. Checa se user já existe
const { data: existingUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = existingUsers?.users?.find((u) => u.email === EMAIL);

let authUserId;
if (existing) {
  console.log(`⏭️  Auth user já existe (${EMAIL}). Atualizando senha...`);
  await supabase.auth.admin.updateUserById(existing.id, { password: SENHA });
  authUserId = existing.id;
} else {
  // 3. Cria user Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
  });
  if (error || !data?.user) {
    console.error("❌ Falha ao criar Auth user:", error?.message);
    process.exit(1);
  }
  authUserId = data.user.id;
  console.log(`✅ Auth user criado: ${EMAIL}`);
}

// 4. Cria/atualiza row em public.usuarios
const { data: userRow } = await supabase
  .from("usuarios")
  .select("id")
  .eq("auth_user_id", authUserId)
  .maybeSingle();

if (userRow) {
  await supabase
    .from("usuarios")
    .update({ transp_id: transp.id, perfil: "transportadora", ativo: true })
    .eq("id", userRow.id);
  console.log("✅ Row em public.usuarios atualizada");
} else {
  const { error } = await supabase.from("usuarios").insert({
    auth_user_id: authUserId,
    nome: "TranspTeste",
    email: EMAIL,
    perfil: "transportadora",
    transp_id: transp.id,
    ativo: true,
  });
  if (error) {
    console.error("❌ Falha ao inserir em public.usuarios:", error.message);
    process.exit(1);
  }
  console.log("✅ Row em public.usuarios criada");
}

console.log("");
console.log("─".repeat(60));
console.log("✅ TUDO PRONTO PRA TESTE!");
console.log("─".repeat(60));
console.log(`  URL Vercel:  https://terraroxaerp-xxxx.vercel.app/login`);
console.log(`  URL Local:   http://localhost:3000/login`);
console.log("");
console.log("  👤 USUÁRIO TRANSPORTADORA:");
console.log(`     Email: ${EMAIL}`);
console.log(`     Senha: ${SENHA}`);
console.log("");
console.log("  💡 Pra fazer o fluxo completo, você precisa também ter um");
console.log("     usuário CEREALISTA (admin/logistica) logado em outra aba.");
console.log("");
