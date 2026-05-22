/* ════════════════════════════════════════════════════════════════════
 * Helper genérico de export CSV
 * Gera blob UTF-8 com BOM (compatível com Excel) e dispara download.
 * ════════════════════════════════════════════════════════════════════ */

export interface CSVColumn<T> {
  /** Cabeçalho exibido. */
  header: string;
  /** Como extrair o valor da linha. */
  value: (row: T) => string | number | null | undefined;
}

/** Escapa um campo CSV (vírgula, aspas, quebra de linha). */
function escapeCSV(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Gera o CSV e dispara o download no browser.
 * Separador: `;` (padrão Excel-BR — vírgula é decimal).
 * @returns nome do arquivo gerado.
 */
export function downloadCSV<T>(
  rows: T[],
  columns: CSVColumn<T>[],
  filename: string,
): string {
  const sep = ";";
  const linhas = [
    columns.map((c) => escapeCSV(c.header)).join(sep),
    ...rows.map((row) => columns.map((c) => escapeCSV(c.value(row))).join(sep)),
  ];
  const conteudo = linhas.join("\r\n");
  // BOM UTF-8 para Excel reconhecer acentos
  const bom = "﻿";
  const blob = new Blob([bom + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return a.download;
}

/** Formata data ISO para "DD/MM/AAAA". */
export function fmtDataCSV(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}
