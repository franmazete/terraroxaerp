/** Formatação de quantidade — unidade canônica do projeto é KG. */
export function fmtKg(n: number): string {
  return `${n.toLocaleString("pt-BR")} kg`;
}

/** Variante sem unidade (para usar em contexto com label "kg" separado). */
export function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtBRLNumber(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function fmtCNPJ(s: string): string {
  return s; // placeholder — mock data já vem formatado
}

export function fmtCPF(s: string): string {
  return s;
}
