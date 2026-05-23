#!/usr/bin/env node
/**
 * Cria dados mínimos pra testar o fluxo Publicar Carga → Reservar → OC:
 *  - 1 Transportadora "TranspTeste"
 *  - 1 Motorista vinculado
 *  - 1 Veículo (Bitrem) vinculado
 *
 * NOTA: o usuário transp pra logar precisa ser criado manualmente no
 * Supabase Auth (Authentication → Users) + uma row em public.usuarios
 * com perfil='transportadora' e transp_id apontando para esta transp.
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

console.log("");
console.log("═".repeat(60));
console.log("🌱 Seed de dados de teste");
console.log("═".repeat(60));

// 1. Transportadora
const cnpjTeste = "00.000.000/0001-00";
let { data: transp } = await supabase
  .from("transportadoras")
  .select("id, nome_fantasia")
  .eq("cnpj_cpf", cnpjTeste)
  .maybeSingle();

if (transp) {
  console.log(`⏭️  Transp já existe: ${transp.nome_fantasia} (id=${transp.id.slice(0, 8)}...)`);
} else {
  const { data, error } = await supabase
    .from("transportadoras")
    .insert({
      razao_social: "Transportadora Teste LTDA",
      nome_fantasia: "TranspTeste",
      cnpj_cpf: cnpjTeste,
      telefone: "(00) 0000-0000",
      email: "teste@transpteste.com.br",
      responsavel: "João Tester",
      rntrc: "12345678",
      status: "ativa",
    })
    .select("id, nome_fantasia")
    .single();
  if (error) { console.error("❌ Transp:", error.message); process.exit(1); }
  transp = data;
  console.log(`✅ Transp criada: ${transp.nome_fantasia}`);
}

// 2. Motorista
let { data: motorista } = await supabase
  .from("motoristas")
  .select("id, nome")
  .eq("cpf", "000.000.000-00")
  .maybeSingle();
if (motorista) {
  console.log(`⏭️  Motorista já existe: ${motorista.nome}`);
} else {
  const { data, error } = await supabase
    .from("motoristas")
    .insert({
      nome: "José Tester",
      cpf: "000.000.000-00",
      cnh: "12345678900",
      celular: "(11) 99999-0000",
      email: "jose@teste.com",
      ativo: true,
    })
    .select("id, nome")
    .single();
  if (error) { console.error("❌ Motorista:", error.message); process.exit(1); }
  motorista = data;
  console.log(`✅ Motorista criado: ${motorista.nome}`);
}

// 2.1 Vínculo motorista <-> transp (N:N)
const { data: vincMot } = await supabase
  .from("motorista_transportadoras")
  .select("motorista_id")
  .eq("motorista_id", motorista.id)
  .eq("transp_id", transp.id)
  .maybeSingle();
if (vincMot) {
  console.log("⏭️  Vínculo motorista↔transp já existe");
} else {
  const { error } = await supabase
    .from("motorista_transportadoras")
    .insert({ motorista_id: motorista.id, transp_id: transp.id });
  if (error) { console.error("❌ Vínculo motorista:", error.message); }
  else console.log("✅ Vínculo motorista↔transp criado");
}

// 3. Veículo
let { data: veiculo } = await supabase
  .from("veiculos")
  .select("id, placa_cavalo")
  .eq("placa_cavalo", "AAA0A00")
  .maybeSingle();
if (veiculo) {
  console.log(`⏭️  Veículo já existe: ${veiculo.placa_cavalo}`);
} else {
  const { data, error } = await supabase
    .from("veiculos")
    .insert({
      placa_cavalo: "AAA0A00",
      placa_carreta: "BBB0B00",
      tipo: "Bitrem",
      capacidade_kg: 45000,
      ativo: true,
    })
    .select("id, placa_cavalo")
    .single();
  if (error) { console.error("❌ Veículo:", error.message); process.exit(1); }
  veiculo = data;
  console.log(`✅ Veículo criado: ${veiculo.placa_cavalo} (Bitrem 45t)`);
}

// 3.1 Vínculo veículo <-> transp
const { data: vincVei } = await supabase
  .from("veiculo_transportadoras")
  .select("veiculo_id")
  .eq("veiculo_id", veiculo.id)
  .eq("transp_id", transp.id)
  .maybeSingle();
if (vincVei) {
  console.log("⏭️  Vínculo veículo↔transp já existe");
} else {
  const { error } = await supabase
    .from("veiculo_transportadoras")
    .insert({ veiculo_id: veiculo.id, transp_id: transp.id });
  if (error) { console.error("❌ Vínculo veículo:", error.message); }
  else console.log("✅ Vínculo veículo↔transp criado");
}

console.log("");
console.log("─".repeat(60));
console.log("📊 IDs criados:");
console.log(`  transp_id    = ${transp.id}`);
console.log(`  motorista_id = ${motorista.id}`);
console.log(`  veiculo_id   = ${veiculo.id}`);

// 4. Disponibilizar todos os contratos ativos
const { count } = await supabase
  .from("contratos")
  .update({ disponivel: true })
  .eq("status", "ativo")
  .eq("disponivel", false)
  .select("*", { count: "exact", head: true });
console.log("");
console.log(`✅ ${count ?? 0} contratos marcados como disponivel=true`);

console.log("");
console.log("─".repeat(60));
console.log("ℹ️  PRÓXIMO PASSO MANUAL:");
console.log("    Pra logar como transp, crie no Supabase Studio:");
console.log("      1. Authentication → Users → Add user");
console.log("         email: transp@teste.com  | senha: teste123");
console.log("      2. Table Editor → usuarios → INSERT:");
console.log(`         auth_user_id = <id do user criado em 1>`);
console.log(`         nome = "TranspTeste"`);
console.log(`         email = "transp@teste.com"`);
console.log(`         perfil = "transportadora"`);
console.log(`         transp_id = "${transp.id}"`);
console.log(`         ativo = true`);
console.log("");
