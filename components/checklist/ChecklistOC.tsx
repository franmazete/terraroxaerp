"use client";

import type { PassoStatus } from "@/lib/domain/checklist";

interface Props {
  passos: PassoStatus[];
  /** Quando true, mostra também passos bloqueados (timeline completa). Default true. */
  mostrarBloqueados?: boolean;
  /** Compacto: ícones menores, padding reduzido. */
  compact?: boolean;
}

const STATUS_ICON: Record<PassoStatus["status"], string> = {
  concluido: "✓",
  pendente: "⏳",
  bloqueado: "🔒",
  pulado: "⊘",
  rejeitado: "✗",
};

const STATUS_COLOR: Record<PassoStatus["status"], { bg: string; border: string; text: string }> = {
  concluido: { bg: "var(--g100)", border: "var(--g500)", text: "var(--g700)" },
  pendente: { bg: "var(--a100)", border: "var(--a600)", text: "var(--a600)" },
  bloqueado: { bg: "var(--surf2)", border: "var(--border)", text: "var(--hint)" },
  pulado: { bg: "var(--surf2)", border: "var(--border2)", text: "var(--muted)" },
  rejeitado: { bg: "var(--r100)", border: "var(--r600)", text: "var(--r600)" },
};

const SETOR_LABEL: Record<PassoStatus["setor"], string> = {
  transportadora: "Transp",
  logistica: "Cerealista",
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  sistema: "Sistema",
};

export function ChecklistOC({ passos, mostrarBloqueados = true, compact = false }: Props) {
  const visiveis = mostrarBloqueados ? passos : passos.filter((p) => p.status !== "bloqueado");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 4 : 6 }}>
      {visiveis.map((p, idx) => {
        const cores = STATUS_COLOR[p.status];
        return (
          <div
            key={p.passo}
            style={{
              display: "flex",
              alignItems: "start",
              gap: 10,
              padding: compact ? "6px 10px" : "10px 12px",
              background: cores.bg,
              border: `1px solid ${cores.border}`,
              borderLeft: `4px solid ${cores.border}`,
              borderRadius: "var(--radius)",
            }}
          >
            <div
              style={{
                width: compact ? 22 : 28,
                height: compact ? 22 : 28,
                borderRadius: "50%",
                background: cores.border,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: compact ? 11 : 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
              title={p.status}
            >
              {STATUS_ICON[p.status]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: compact ? 11 : 12, color: "var(--hint)", fontFamily: "DM Mono, monospace" }}>
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <strong style={{ fontSize: compact ? 12 : 13, color: cores.text }}>
                  {p.label}
                </strong>
                {p.opcional && (
                  <span style={{ fontSize: 9, background: "var(--surf3)", color: "var(--muted)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Opcional
                  </span>
                )}
                {p.refugo_only && (
                  <span style={{ fontSize: 9, background: "var(--r100)", color: "var(--r600)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Refugo
                  </span>
                )}
                <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>
                  {SETOR_LABEL[p.setor]}
                </span>
              </div>
              {p.hint && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.hint}</div>
              )}
              {p.concluido_em && (
                <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2, fontFamily: "DM Mono, monospace" }}>
                  ✓ {new Date(p.concluido_em).toLocaleString("pt-BR")}
                  {p.concluido_por ? ` · ${p.concluido_por}` : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
