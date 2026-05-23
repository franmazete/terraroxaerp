#!/usr/bin/env node
/**
 * Importa terminais (pontos de descarga / clientes finais) no Supabase.
 *
 * Todos cadastrados como tipo="terminal" — aparecem no select de
 * Terminal nas telas de Contrato e Carga.
 *
 * Idempotente: skip se nome já existe (case-insensitive).
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

const TERMINAIS = [
  "ABATEDOURO - SP",
  "AGTL - PR",
  "ALTP - PR",
  "BTG 01 - PR",
  "BTG 02 - PR",
  "BUNGUE - PR",
  "CEAGESP - AVARÉ",
  "CEAGESP - SÃO PAULO",
  "CEAGESP - TATUI",
  "CIMBESSUL - PR",
  "CLI - SP",
  "COPERSUCAR - SP",
  "COTRIGAÇU - PR",
  "CUTRALE - SP",
  "DEVOLUÇÃO PRODUTOR",
  "GRANO - PR",
  "GRANSOL - PR",
  "IMBITUBA - SC",
  "INTERALLI - PR",
  "ITABERÁ - BUTININHA",
  "LAURENTINO - SC",
  "LDC - PR",
  "M. ANACONDA - PR",
  "M. ANACONDA - SP",
  "M. BUNGE - SP",
  "M. BUNGUE - TATUI",
  "M. CORRECTA - SP",
  "M. FRISIA - PR",
  "M. HORTOLÂNDIA",
  "M. NACIONAL - SP",
  "M. TONDO - SP",
  "MOINHO PACÍFICO - SP",
  "OLINTO - CERQUEIRA C.",
  "OLINTO - IARAS",
  "P. ALCANTARA - FARTURA",
  "PASA - PR",
  "ROCHA - PR",
  "SANTA CLARA - ITAÍ",
  "T39 - SP",
  "TAGUI",
  "TEAG - SP",
  "TEC - SP",
  "TEG - SP",
  "TERLOG",
  "TERRA ROXA - ITAÍ",
  "TES - SP",
  "TESC - SC",
  "TGG - SP",
  "T-GRÄO - SP",
  "TIBAGI - PR",
  "TRANSGULF - PR",
  "YOKOTOBI",
  "ZANCHETTA - SP",
];

/* Mapeamento de cidades quando aparecem após o hífen. */
const CIDADES_CONHECIDAS = {
  "AVARÉ": { cidade: "Avaré", uf: "SP" },
  "SÃO PAULO": { cidade: "São Paulo", uf: "SP" },
  "TATUI": { cidade: "Tatuí", uf: "SP" },
  "CERQUEIRA C.": { cidade: "Cerqueira César", uf: "SP" },
  "IARAS": { cidade: "Iaras", uf: "SP" },
  "FARTURA": { cidade: "Fartura", uf: "SP" },
  "ITAÍ": { cidade: "Itaí", uf: "SP" },
  "BUTININHA": { cidade: "Itaberá", uf: "SP" },
};

/* Padrão "M. HORTOLÂNDIA" — cidade colada ao prefixo Moinho. */
const PREFIXO_M = {
  "M. HORTOLÂNDIA": { cidade: "Hortolândia", uf: "SP" },
};

/* Padrão "ITABERÁ - BUTININHA" — cidade no início. */
const PREFIXO_CIDADE = {
  "ITABERÁ -": { cidade: "Itaberá", uf: "SP" },
};

function parsearLocal(nome) {
  // 1. Caso especial — Moinho + cidade
  if (PREFIXO_M[nome]) return PREFIXO_M[nome];

  // 2. Prefixo de cidade (raro)
  for (const prefixo of Object.keys(PREFIXO_CIDADE)) {
    if (nome.startsWith(prefixo)) return PREFIXO_CIDADE[prefixo];
  }

  // 3. Sufixo " - UF" (SP, PR, SC, etc — 2 letras maiúsculas no fim)
  const ufMatch = nome.match(/ - ([A-Z]{2})$/);
  if (ufMatch) {
    return { cidade: "—", uf: ufMatch[1] };
  }

  // 4. Sufixo " - <cidade conhecida>"
  for (const cidade of Object.keys(CIDADES_CONHECIDAS)) {
    if (nome.endsWith(" - " + cidade)) return CIDADES_CONHECIDAS[cidade];
  }

  // 5. Sem padrão (TAGUI, TERLOG, YOKOTOBI, DEVOLUÇÃO PRODUTOR, M. HORTOLÂNDIA já tratado)
  return { cidade: "—", uf: "—" };
}

console.log("");
console.log("═".repeat(72));
console.log(`🏗️  Importando ${TERMINAIS.length} terminais`);
console.log("═".repeat(72));

const { data: existentes, error: errLs } = await supabase
  .from("terminais")
  .select("id, nome");
if (errLs) {
  console.error("❌ Erro lendo terminais:", errLs.message);
  process.exit(1);
}
const nomesExistentes = new Set((existentes ?? []).map((l) => l.nome.toUpperCase().trim()));
console.log(`  Já cadastrados: ${nomesExistentes.size}`);

let criados = 0, pulados = 0, erros = 0;
const cidadesNaoMapeadas = new Set();

for (const nome of TERMINAIS) {
  if (nomesExistentes.has(nome.toUpperCase().trim())) {
    pulados++;
    continue;
  }
  const { cidade, uf } = parsearLocal(nome);
  if (cidade === "—" && uf === "—") cidadesNaoMapeadas.add(nome);

  const { error } = await supabase.from("terminais").insert({
    nome,
    cnpj: "PENDENTE",
    contato: "—",
    cidade,
    uf,
    tipo: "terminal",
    ativo: true,
  });

  if (error) {
    console.error(`  ❌ ${nome}: ${error.message}`);
    erros++;
  } else {
    criados++;
  }
}

console.log("");
console.log("─".repeat(72));
console.log(`📊 Resultado:`);
console.log(`  ✓ Criados:  ${criados}`);
console.log(`  ⏭️  Pulados:  ${pulados} (já existiam)`);
console.log(`  ❌ Erros:    ${erros}`);
if (cidadesNaoMapeadas.size > 0) {
  console.log("");
  console.log(`⚠️  Cidades não detectadas (gravadas com "—"):`);
  cidadesNaoMapeadas.forEach((n) => console.log(`     ${n}`));
}

const { count } = await supabase
  .from("terminais")
  .select("*", { count: "exact", head: true })
  .eq("tipo", "terminal");
console.log("");
console.log(`✅ Total de terminais no banco: ${count}`);
console.log("");
