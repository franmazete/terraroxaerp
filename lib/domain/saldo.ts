import type { Carga, Contrato } from "../types";

export function disponivelKg(carga: Carga): number {
  return carga.total_kg - carga.reservado_kg;
}

export function percentualReservado(carga: Carga): number {
  if (carga.total_kg === 0) return 0;
  return Math.round((carga.reservado_kg / carga.total_kg) * 100);
}

export function saldoContratoKg(contrato: Contrato): number {
  return contrato.saldo_kg;
}

export function percentualContratoUsado(contrato: Contrato): number {
  if (contrato.qtd_kg_total === 0) return 0;
  const usado = contrato.qtd_kg_total - contrato.saldo_kg;
  return Math.round((usado / contrato.qtd_kg_total) * 100);
}

export type SaldoColor = "green" | "amber" | "red";

export function saldoColor(pct: number): SaldoColor {
  if (pct >= 100) return "red";
  if (pct >= 50) return "amber";
  return "green";
}

/** Alias compat com Etapa 1 — alguns componentes ainda usam `disponivel(c)`. */
export const disponivel = disponivelKg;
