/* ════════════════════════════════════════════════════════════════════
 * Parser do CSV de Contratos exportado pelo ERP de origem.
 *
 * Formato do CSV (separador ;):
 *   ESTAB;TIPO;CONTRATO;DESCSAFRA;DTEMISSAO;DTVENCTO;DTINICIO;DTFINAL;
 *   PRODUTOR;PRODUTO;QUANTIDADE;VALORUNIT;VALORTOTAL;ORIGEM;NQTDSALDO;NVLRSALDO
 *
 * Encoding: vem em Latin-1 (CP1252). Convertemos pra UTF-8 antes de processar.
 * Números pt-BR: "1.234,56" vira 1234.56.
 * Datas: "dd.mm.yyyy" vira "yyyy-mm-dd".
 * ════════════════════════════════════════════════════════════════════ */

export interface LinhaCSV {
  linha: number; // número da linha original (pra log de erro)
  estab: string;
  tipo: string;
  contrato: string;
  descsafra: string;
  dtemissao: string;
  dtvencto: string;
  dtinicio: string;
  dtfinal: string;
  produtor: string; // "270, OTAVIO JOVELLI FILHO"
  produto: string;  // "3, SOJA A GRANEL"
  quantidade: string;
  valorunit: string;
  valortotal: string;
  origem: string;   // "Taquarituba-SP, ELIANO ANTUNES DE OLIVEIRA" ou ""
  nqtdsaldo: string;
  nvlrsaldo: string;
}

/** Converte Uint8Array em Latin-1 (CP1252) pra string UTF-8 corretamente. */
export function decodeLatin1(bytes: Uint8Array): string {
  // Mapeamento CP1252 → Unicode (cobre os caracteres comuns em pt-BR)
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Parse genérico de CSV com separador ; e suporte a aspas. */
export function parseCSV(content: string): LinhaCSV[] {
  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  // Header esperado (ignoramos posição, mas confirmamos campos obrigatórios)
  const cabecalho = linhas[0].split(";").map((c) => c.trim().toUpperCase());
  const idx = (nome: string) => cabecalho.indexOf(nome);

  const ix = {
    estab: idx("ESTAB"),
    tipo: idx("TIPO"),
    contrato: idx("CONTRATO"),
    descsafra: idx("DESCSAFRA"),
    dtemissao: idx("DTEMISSAO"),
    dtvencto: idx("DTVENCTO"),
    dtinicio: idx("DTINICIO"),
    dtfinal: idx("DTFINAL"),
    produtor: idx("PRODUTOR"),
    produto: idx("PRODUTO"),
    quantidade: idx("QUANTIDADE"),
    valorunit: idx("VALORUNIT"),
    valortotal: idx("VALORTOTAL"),
    origem: idx("ORIGEM"),
    nqtdsaldo: idx("NQTDSALDO"),
    nvlrsaldo: idx("NVLRSALDO"),
  };

  const resultado: LinhaCSV[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(";");
    if (campos.length < 10) continue; // linha inválida/em branco

    resultado.push({
      linha: i + 1, // linha real do arquivo (1-indexed, header é linha 1)
      estab: campos[ix.estab]?.trim() ?? "",
      tipo: campos[ix.tipo]?.trim() ?? "",
      contrato: campos[ix.contrato]?.trim() ?? "",
      descsafra: campos[ix.descsafra]?.trim() ?? "",
      dtemissao: campos[ix.dtemissao]?.trim() ?? "",
      dtvencto: campos[ix.dtvencto]?.trim() ?? "",
      dtinicio: campos[ix.dtinicio]?.trim() ?? "",
      dtfinal: campos[ix.dtfinal]?.trim() ?? "",
      produtor: campos[ix.produtor]?.trim() ?? "",
      produto: campos[ix.produto]?.trim() ?? "",
      quantidade: campos[ix.quantidade]?.trim() ?? "",
      valorunit: campos[ix.valorunit]?.trim() ?? "",
      valortotal: campos[ix.valortotal]?.trim() ?? "",
      origem: campos[ix.origem]?.trim() ?? "",
      nqtdsaldo: campos[ix.nqtdsaldo]?.trim() ?? "",
      nvlrsaldo: campos[ix.nvlrsaldo]?.trim() ?? "",
    });
  }
  return resultado;
}

/** Converte "1.234,56" pt-BR pra 1234.56 JS. Aceita também "1.234" (sem decimal). */
export function parseNumberPtBR(s: string): number | null {
  if (!s || s.trim() === "") return null;
  // Remove pontos de milhar e converte vírgula em ponto decimal
  const limpo = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Converte "dd.mm.yyyy" → "yyyy-mm-dd". Retorna null se inválida ou vazia. */
export function parseDataPtBR(s: string): string | null {
  if (!s || s.trim() === "") return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Extrai nome de campo "código, NOME" do CSV.
 * Ex: "3, SOJA A GRANEL" → "SOJA A GRANEL"
 * Ex: "270, OTAVIO JOVELLI FILHO" → "OTAVIO JOVELLI FILHO"
 */
export function extrairNome(campo: string): { codigo: string; nome: string } {
  if (!campo) return { codigo: "", nome: "" };
  const partes = campo.split(",");
  if (partes.length < 2) return { codigo: "", nome: campo.trim() };
  return {
    codigo: partes[0].trim(),
    nome: partes.slice(1).join(",").trim(),
  };
}

/**
 * Extrai cidade/UF e razão social do campo ORIGEM.
 * Ex: "Taquarituba-SP, ELIANO ANTUNES DE OLIVEIRA" → { cidade: "Taquarituba", uf: "SP", razao: "ELIANO ANTUNES DE OLIVEIRA" }
 * Ex: "" → { cidade: null, uf: null, razao: null }
 */
export function parseOrigem(s: string): { cidade: string | null; uf: string | null; razao: string | null } {
  if (!s || s.trim() === "") return { cidade: null, uf: null, razao: null };
  const partes = s.split(",");
  const local = partes[0]?.trim() ?? "";
  const razao = partes.slice(1).join(",").trim() || null;
  const m = local.match(/^(.+)-([A-Z]{2})$/);
  if (!m) return { cidade: local || null, uf: null, razao };
  return { cidade: m[1].trim(), uf: m[2], razao };
}

/** Normaliza nome pra de-para: trim + uppercase + remove acentos. */
export function normalizarNome(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}
