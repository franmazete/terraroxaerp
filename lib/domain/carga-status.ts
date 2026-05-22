import type { Carga, CargaStatus } from "../types";

export function recalcCargaStatus(carga: Carga): CargaStatus {
  if (carga.reservado_kg >= carga.total_kg) return "fechada";
  if (carga.reservado_kg > 0) return "parcial";
  return "disponivel";
}

export function statusLabel(s: CargaStatus): string {
  if (s === "fechada") return "Fechada";
  if (s === "parcial") return "Parcialmente Reservada";
  if (s === "cancelada") return "Cancelada";
  return "Disponível";
}

export function statusBadgeClass(s: CargaStatus): "bg" | "ba" | "br" | "bx" {
  if (s === "fechada") return "br";
  if (s === "parcial") return "ba";
  if (s === "cancelada") return "bx";
  return "bg";
}
