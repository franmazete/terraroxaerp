/* ════════════════════════════════════════════════════════════════════
 * Parser do CSV de Contratos (layout v2 — com dados do produtor).
 *
 * Formato esperado (separador ;):
 *   ESTAB;TIPO;CONTRATO;DESCSAFRA;DTEMISSAO;DTVENCTO;DTINICIO;DTFINAL;
 *   P_PRODUTOR;P_DOCCPF;P_NOMEFAZENDA;P_CIDADE_PRODUTOR;
 *   PRODUTO;QUANTIDADE;VALORUNIT;VALORTOTAL;ORIGEM;NQTDSALDO;NVLRSALDO
 *
 * Encoding: Latin-1 (CP1252) → UTF-8.
 * Números pt-BR: "1.234,56" vira 1234.56.
 * Datas: "dd.mm.yyyy" vira "yyyy-mm-dd".
 * Códigos: "270-OTAVIO JOVELLI" vira { codigo: "270", nome: "OTAVIO JOVELLI" }.
 * ════════════════════════════════════════════════════════════════════ */

export interface LinhaCSV {
  linha: number;
  estab: string;
  tipo: string;
  operacao: string;
  contrato: string;
  descsafra: string;
  dtemissao: string;
  dtvencto: string;
  dtinicio: string;
  dtfinal: string;
  p_produtor: string;       // "270-OTAVIO JOVELLI FILHO"
  p_doccpf: string;         // "08740825000316"
  p_nomefazenda: string;    // "FAZ SANTO ANTONIO, ZONA RURAL"
  p_cidade_produtor: string;// "Arandu-SP"
  produto: string;          // "3-SOJA A GRANEL"
  quantidade: string;
  valorunit: string;
  valortotal: string;
  origem: string;
  nqtdsaldo: string;
  nvlrsaldo: string;
}

/** Decoder Latin-1 (CP1252) → UTF-8. */
export function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Parse CSV com separador ; */
export function parseCSV(content: string): LinhaCSV[] {
  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const cabecalho = linhas[0].split(";").map((c) => c.trim().toUpperCase());
  const idx = (nome: string) => cabecalho.indexOf(nome);

  const ix = {
    estab: idx("ESTAB"),
    tipo: idx("TIPO"),
    operacao: idx("OPERACAO"),
    contrato: idx("CONTRATO"),
    descsafra: idx("DESCSAFRA"),
    dtemissao: idx("DTEMISSAO"),
    dtvencto: idx("DTVENCTO"),
    dtinicio: idx("DTINICIO"),
    dtfinal: idx("DTFINAL"),
    p_produtor: idx("P_PRODUTOR"),
    p_doccpf: idx("P_DOCCPF"),
    p_nomefazenda: idx("P_NOMEFAZENDA"),
    p_cidade_produtor: idx("P_CIDADE_PRODUTOR"),
    produto: idx("PRODUTO"),
    quantidade: idx("QUANTIDADE"),
    valorunit: idx("VALORUNIT"),
    valortotal: idx("VALORTOTAL"),
    origem: idx("ORIGEM"),
    nqtdsaldo: idx("NQTDSALDO"),
    nvlrsaldo: idx("NVLRSALDO"),
  };

  const get = (campos: string[], i: number): string =>
    i >= 0 && i < campos.length ? campos[i].trim() : "";

  const resultado: LinhaCSV[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = linhas[i].split(";");
    if (campos.length < 10) continue;

    resultado.push({
      linha: i + 1,
      estab: get(campos, ix.estab),
      tipo: get(campos, ix.tipo),
      operacao: get(campos, ix.operacao),
      contrato: get(campos, ix.contrato),
      descsafra: get(campos, ix.descsafra),
      dtemissao: get(campos, ix.dtemissao),
      dtvencto: get(campos, ix.dtvencto),
      dtinicio: get(campos, ix.dtinicio),
      dtfinal: get(campos, ix.dtfinal),
      p_produtor: get(campos, ix.p_produtor),
      p_doccpf: get(campos, ix.p_doccpf),
      p_nomefazenda: get(campos, ix.p_nomefazenda),
      p_cidade_produtor: get(campos, ix.p_cidade_produtor),
      produto: get(campos, ix.produto),
      quantidade: get(campos, ix.quantidade),
      valorunit: get(campos, ix.valorunit),
      valortotal: get(campos, ix.valortotal),
      origem: get(campos, ix.origem),
      nqtdsaldo: get(campos, ix.nqtdsaldo),
      nvlrsaldo: get(campos, ix.nvlrsaldo),
    });
  }
  return resultado;
}

/** "1.234,56" → 1234.56. Aceita "1.234" (sem decimal). */
export function parseNumberPtBR(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const limpo = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** "dd.mm.yyyy" → "yyyy-mm-dd". */
export function parseDataPtBR(s: string): string | null {
  if (!s || s.trim() === "") return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Extrai código-nome de campos como "270-OTAVIO JOVELLI" ou "3-SOJA A GRANEL".
 * Aceita também o separador ", " do layout antigo pra compat.
 */
export function extrairCodigoNome(campo: string): { codigo: string; nome: string } {
  if (!campo) return { codigo: "", nome: "" };
  // Tenta primeiro com hífen (novo layout), depois com vírgula (antigo)
  let sep = "-";
  let i = campo.indexOf(sep);
  if (i < 0) {
    sep = ",";
    i = campo.indexOf(sep);
  }
  if (i < 0) return { codigo: "", nome: campo.trim() };
  return {
    codigo: campo.slice(0, i).trim(),
    nome: campo.slice(i + sep.length).trim(),
  };
}

/** "Pedrinhas Paulista-SP" → { cidade: "Pedrinhas Paulista", uf: "SP" }. */
export function parseCidadeUF(s: string): { cidade: string | null; uf: string | null } {
  if (!s || s.trim() === "") return { cidade: null, uf: null };
  const m = s.trim().match(/^(.+)-([A-Z]{2})$/);
  if (!m) return { cidade: s.trim() || null, uf: null };
  return { cidade: m[1].trim(), uf: m[2] };
}

/**
 * Origem livre — formato similar ao P_CIDADE_PRODUTOR mas com razão social opcional:
 * "Taquarituba-SP, ELIANO ANTUNES" → { cidade, uf, razao }
 */
export function parseOrigem(s: string): { cidade: string | null; uf: string | null; razao: string | null } {
  if (!s || s.trim() === "") return { cidade: null, uf: null, razao: null };
  const partes = s.split(",");
  const local = partes[0]?.trim() ?? "";
  const razao = partes.slice(1).join(",").trim() || null;
  const cu = parseCidadeUF(local);
  return { ...cu, razao };
}

/** Normaliza CPF/CNPJ: só dígitos. */
export function normalizarDoc(s: string): string {
  return (s ?? "").replace(/\D+/g, "");
}

/** Normaliza nome pra de-para: trim + uppercase + remove acentos. */
export function normalizarNome(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
