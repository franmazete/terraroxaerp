#!/usr/bin/env node
/**
 * Importa locais de carregamento (origem) no Supabase.
 *
 * Todos cadastrados como tipo "armazem_origem" — aparecem no dropdown
 * de Local de Origem do PublicarCargaModal.
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

/* Mapeamento de prefixos de cidade abreviados → nome real (todos SP). */
const PREFIXOS_CIDADE = {
  "A. STA. B.": "Águas de Santa Bárbara",
  "ANGATUBA": "Angatuba",
  "ARARAQUARA": "Araraquara",
  "AVARÉ": "Avaré",
  "B. CAMPOS": "Bernardino de Campos",
  "BARIRI": "Bariri",
  "BORACÉIA": "Boracéia",
  "C. CESAR": "Cerqueira César",
  "C.M.A.": "Campina do Monte Alegre",
  "CANDIDO MOTA": "Cândido Mota",
  "CERQUILHO": "Cerquilho",
  "CORONEL MACEDO": "Coronel Macedo",
  "CRUZÁLIA": "Cruzália",
  "FLORÍNEA": "Florínea",
  "HOLAMBRA II": "Holambra",
  "IARAS": "Iaras",
  "IBIRAREMA": "Ibirarema",
  "ITABERÁ": "Itaberá",
  "ITAÍ": "Itaí",
  "ITAPETININGA": "Itapetininga",
  "ITAPEVA": "Itapeva",
  "ITAPORANGA": "Itaporanga",
  "MARACAÍ": "Maracaí",
  "NOVO HORIZONTE": "Novo Horizonte",
  "OLÉO": "Óleo",
  "PARANAPANEMA": "Paranapanema",
  "PIRACICABA": "Piracicaba",
  "PIRAJU": "Piraju",
  "R. SUL": "Ribeirão do Sul",
  "SANTELMO": "Pederneiras",
  "STA. C. R. PARDO": "Santa Cruz do Rio Pardo",
  "TAQUARIVAÍ": "Taquarivaí",
  "TQB": "Taquarituba",
};

/** Cidades sem prefixo (linhas que são só o nome da cidade). */
const SOMENTE_CIDADE = {
  "HERCULÂNDIA": "Herculândia",
  "TAGUAÍ": "Taguaí",
};

const LOCAIS = [
  "A. STA. B. - SILO AGRO",
  "A. STA. B. - ZORZATO",
  "ANGATUBA - FAZ. BOA ESPERENÇA",
  "ANGATUBA - FAZ. SANTA FÉ",
  "ANGATUBA - KOCHI",
  "ANGATUBA - OURO SAFRA",
  "ANGATUBA - RODOGRÃOS",
  "ARARAQUARA - CEAGESP",
  "AVARÉ - CAPAL",
  "AVARÉ - CEAGESP",
  "AVARÉ - COOP. H2",
  "AVARÉ - DEFANT",
  "B. CAMPOS - FERTILE",
  "B. CAMPOS - MANTOAN",
  "B. CAMPOS - SIRIEMA DO LAGO",
  "B. CAMPOS - STA. M. PARAGUAI",
  "BARIRI - BARIGRÃOS",
  "BARIRI - SILO PALLAMIN",
  "BORACÉIA - BARIGRÃOS",
  "C. CESAR - DEFANT",
  "C. CESAR - OLINTO",
  "C.M.A. - 4A",
  "C.M.A. - FAZ. SANTA MONICA",
  "C.M.A. - RFA",
  "CANDIDO MOTA - VASQUES",
  "CERQUILHO - SEBASTIANI",
  "CORONEL MACEDO - GAMELÃO",
  "CORONEL MACEDO - TONON",
  "CRUZÁLIA - COCAMAR",
  "CRUZÁLIA - DI RAIMO",
  "CRUZÁLIA - NEUMMAN",
  "FLORÍNEA - CIAVOLELLA",
  "FLORÍNEA - CODA",
  "HERCULÂNDIA",
  "HOLAMBRA II - COOP. H2",
  "IARAS - OLINTO",
  "IBIRAREMA - CIAVELELLA",
  "ITABERÁ - AGRO MAIA",
  "ITABERÁ - BOA SAFRA",
  "ITABERÁ - BUTININHA",
  "ITABERÁ - CASTROLANDA",
  "ITABERÁ - FAZ. SELEÇÕES",
  "ITABERÁ - LAGOA BONITA",
  "ITABERÁ - OURO SAFRA",
  "ITABERÁ - SILO LEI",
  "ITAÍ - MAEDA",
  "ITAÍ - SILO COSTA",
  "ITAÍ - TERRA ROXA",
  "ITAPETININGA - INOCENCIO",
  "ITAPETININGA - OURO SAFRA",
  "ITAPETININGA - TAGUI",
  "ITAPETININGA - TRADIÇÃO",
  "ITAPEVA - FAZ. TERRA BELA",
  "ITAPEVA - FAZ. JOSÉ ZAMBOM",
  "ITAPEVA - SILO BALEIA",
  "ITAPEVA - SILO COSTA",
  "ITAPORANGA - IOSHIDA",
  "ITAPORANGA - S. J. PINHAL",
  "ITAPORANGA - SILO GAMELÃO",
  "MARACAÍ - AMSTALDEN",
  "NOVO HORIZONTE - SEMENSATO",
  "OLÉO - SILO SOARES",
  "PARANAPANEMA - BARBARA",
  "PIRACICABA - COOPLACANA",
  "PIRAJU - FAZ. MAGRISA",
  "PIRAJU - FAZ. N.SRA.APDA.",
  "PIRAJU - FAZ. SHANGRI-LÁ",
  "PIRAJU - FAZ. YGUAPORÃ",
  "R. SUL - SILO CONTE",
  "SANTELMO - BARIGRÃOS",
  "STA. C. R. PARDO - ROMALURE",
  "TAGUAÍ",
  "TAQUARIVAÍ - CAPAL",
  "TAQUARIVAÍ - JORGE MAEDA",
  "TQB - CAPAL",
  "TQB - COOP. H2",
  "TQB - COPLACANA",
  "TQB - ELIANO ANTUNES",
  "TQB - EST. TRIGO",
  "TQB - FAZ. BARREIRO",
  "TQB - FAZ. CATETO",
  "TQB - IOSHIDA",
  "TROCA - NOTA",
];

function parsearCidade(nomeCompleto) {
  // Sem prefixo
  if (SOMENTE_CIDADE[nomeCompleto]) {
    return { cidade: SOMENTE_CIDADE[nomeCompleto], uf: "SP" };
  }
  // Caso especial — TROCA - NOTA
  if (nomeCompleto === "TROCA - NOTA") {
    return { cidade: "—", uf: "—" };
  }
  // Tenta achar o prefixo mais longo que bate
  for (const prefixo of Object.keys(PREFIXOS_CIDADE).sort((a, b) => b.length - a.length)) {
    if (nomeCompleto.startsWith(prefixo + " -") || nomeCompleto.startsWith(prefixo + "  -")) {
      return { cidade: PREFIXOS_CIDADE[prefixo], uf: "SP" };
    }
  }
  return { cidade: "—", uf: "—" };
}

console.log("");
console.log("═".repeat(72));
console.log(`📍 Importando ${LOCAIS.length} locais de carregamento`);
console.log("═".repeat(72));

// 1. Pega locais existentes (pra skip)
const { data: existentes, error: errLs } = await supabase
  .from("locais")
  .select("id, nome");
if (errLs) {
  console.error("❌ Erro lendo locais:", errLs.message);
  process.exit(1);
}
const nomesExistentes = new Set((existentes ?? []).map((l) => l.nome.toUpperCase().trim()));
console.log(`  Já cadastrados: ${nomesExistentes.size}`);

let criados = 0, pulados = 0, erros = 0;
const cidadesNaoMapeadas = new Set();

for (const nome of LOCAIS) {
  if (nomesExistentes.has(nome.toUpperCase().trim())) {
    pulados++;
    continue;
  }
  const { cidade, uf } = parsearCidade(nome);
  if (cidade === "—") cidadesNaoMapeadas.add(nome);

  const { error } = await supabase.from("locais").insert({
    nome,
    tipo: "armazem_origem",
    cidade,
    uf,
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
  console.log(`⚠️  Cidades não mapeadas (gravadas com "—"):`);
  cidadesNaoMapeadas.forEach((n) => console.log(`     ${n}`));
}

// Confere estado final
const { count } = await supabase
  .from("locais")
  .select("*", { count: "exact", head: true })
  .eq("tipo", "armazem_origem");
console.log("");
console.log(`✅ Total de locais armazem_origem no banco: ${count}`);
console.log("");
