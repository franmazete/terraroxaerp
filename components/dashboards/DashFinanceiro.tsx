"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { AlertBox } from "@/components/ui/AlertBox";
import { useDataStore } from "@/lib/data-store";
import { fmtBRL } from "@/lib/domain/format";

export function DashFinanceiro() {
  const { faturamentos, pagamentos } = useDataStore();

  const stats = useMemo(() => {
    const aPagar = faturamentos.filter((f) => f.status === "fatura_anexada" || f.status === "em_conferencia" || f.status === "aprovado");
    const totalAPagar = aPagar.reduce((s, f) => s + (f.valor_informado ?? f.valor_calculado), 0);
    const comDivergencia = faturamentos.filter((f) => f.divergencia && f.status !== "aprovado").length;
    const pagos = pagamentos.length;
    const totalPago = pagamentos.reduce((s, p) => s + p.valor_pago, 0);
    return { aPagar: aPagar.length, totalAPagar, comDivergencia, pagos, totalPago };
  }, [faturamentos, pagamentos]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">💰 Dashboard Financeiro</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Pagamentos, divergências e fluxo de caixa</div>
        </div>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="r" label="Faturas a Pagar" value={stats.aPagar} sub="aguardando processamento" />
        <StatBox tone="b" label="Total a Pagar" value={fmtBRL(stats.totalAPagar)} sub="valor agregado" />
        <StatBox tone="a" label="Com Divergência" value={stats.comDivergencia} sub="conferência manual" />
        <StatBox tone="g" label="Pagos" value={stats.pagos} sub={`${fmtBRL(stats.totalPago)} total`} />
      </div>

      {stats.comDivergencia > 0 && (
        <div className="section-gap">
          <AlertBox
            tone="red"
            icon="⚠️"
            title={`${stats.comDivergencia} faturamento(s) com divergência`}
            actions={<Link href="/ordens"><Button size="sm" variant="danger">Ver OCs →</Button></Link>}
          >
            Valores informados pela transportadora divergem do cálculo do sistema. Conferir antes de pagar.
          </AlertBox>
        </div>
      )}

      {stats.aPagar > 0 && stats.comDivergencia === 0 && (
        <AlertBox tone="green" icon="✅" title={`${stats.aPagar} faturamento(s) prontos para pagar`}>
          Todos sem divergência. Acesse cada OC para registrar o pagamento.
        </AlertBox>
      )}
    </>
  );
}
