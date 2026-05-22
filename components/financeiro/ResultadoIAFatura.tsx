"use client";

import { Badge } from "@/components/ui/Badge";
import { AlertBox } from "@/components/ui/AlertBox";
import { CAMPO_LABEL } from "@/lib/domain/ia-fatura";
import type { IAAnaliseFatura } from "@/lib/types";

interface Props {
  analise: IAAnaliseFatura;
  compact?: boolean;
}

/**
 * Exibe o resultado da análise da IA na fatura × CT-es.
 * Mostra cabeçalho com status + tabela campo×campo + resumo.
 */
export function ResultadoIAFatura({ analise, compact }: Props) {
  const tone =
    analise.status === "aprovada" ? "green" : analise.status === "divergencia" ? "red" : "amber";
  const icon = analise.status === "aprovada" ? "✓" : analise.status === "divergencia" ? "⚠️" : "🤖";

  return (
    <div
      style={{
        background: tone === "green" ? "var(--g100)" : tone === "red" ? "var(--r100)" : "var(--a100)",
        border: `1px solid ${tone === "green" ? "var(--g500)" : tone === "red" ? "var(--r600)" : "var(--a600)"}`,
        borderRadius: "var(--radius)",
        padding: compact ? 10 : 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <strong style={{ fontSize: 13 }}>🤖 IA conferiu a fatura × CT-e</strong>
        <Badge tone={tone}>{analise.status.toUpperCase()}</Badge>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--hint)" }}>
          {new Date(analise.analisada_em).toLocaleString("pt-BR")}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{analise.resumo}</div>

      <div
        style={{
          background: "rgba(255,255,255,0.7)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surf2)" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Campo</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Esperado</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Encontrado</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Match</th>
            </tr>
          </thead>
          <tbody>
            {analise.itens.map((it) => (
              <tr key={it.campo} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{CAMPO_LABEL[it.campo]}</td>
                <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{it.esperado}</td>
                <td style={{ padding: "6px 8px" }}>{it.encontrado}</td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: it.match ? "var(--g600)" : "var(--r600)",
                      color: "white",
                      fontWeight: 700,
                      lineHeight: "20px",
                      fontSize: 11,
                    }}
                    title={it.observacao}
                  >
                    {it.match ? "✓" : "✗"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analise.itens.some((it) => !it.match) && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          {analise.itens
            .filter((it) => !it.match)
            .map((it) => (
              <div key={it.campo}>
                <strong>{CAMPO_LABEL[it.campo]}:</strong> {it.observacao}
              </div>
            ))}
        </div>
      )}

      <AlertBox
        tone="amber"
        icon="🤖"
        title="IA mock (Etapa 3+: chamada real a LLM/regra customizada)"
      >
        Esta análise usa regras locais para validar 4 campos chave. Integração real virá com modelo treinado nos contratos da empresa.
      </AlertBox>
    </div>
  );
}
