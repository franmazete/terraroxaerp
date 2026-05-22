"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Badge } from "@/components/ui/Badge";
import { AlertBox } from "@/components/ui/AlertBox";
import { useDataStore } from "@/lib/data-store";

export function DashFiscal() {
  const { ordens, notasFiscais, ctes, solicitacoesTrocaNota, dadosDescarga, faturamentos, pendencias } = useDataStore();

  const stats = useMemo(() => {
    const nfsAtivas = notasFiscais.filter((n) => n.status === "ativa" || !n.status).length;
    const trocasPendentes = solicitacoesTrocaNota.filter((s) => s.status === "pendente").length;
    const trocasAprovadasSemNova = solicitacoesTrocaNota.filter((s) => s.status === "aprovada" && !s.nova_nf_id).length;
    const ctesAnexados = ctes.length;
    const descargasPendentes = dadosDescarga.filter((d) => !d.validado_em && !d.rejeitado_em).length;
    const faturamentosACalc = ordens.filter(
      (o) =>
        dadosDescarga.find((d) => d.oc_id === o.id && d.validado_em) &&
        !faturamentos.find((f) => f.oc_id === o.id),
    ).length;

    return { nfsAtivas, trocasPendentes, trocasAprovadasSemNova, ctesAnexados, descargasPendentes, faturamentosACalc };
  }, [ordens, notasFiscais, ctes, solicitacoesTrocaNota, dadosDescarga, faturamentos]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Dashboard Fiscal</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>NFs, trocas, CT-es e liberação de faturamento</div>
        </div>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="g" label="NFs Ativas" value={stats.nfsAtivas} sub="válidas no momento" />
        <StatBox tone="r" label="Trocas Pendentes" value={stats.trocasPendentes} sub="aguardando sua decisão" />
        <StatBox tone="a" label="Aguardando nova NF" value={stats.trocasAprovadasSemNova} sub="trocas aprovadas" />
        <StatBox tone="b" label="CT-es Recebidos" value={stats.ctesAnexados} sub="anexados pelas transps" />
      </div>

      <div className="grid-2 section-gap">
        <Card>
          <CardHeader><CardTitle>⚖️ Descargas pendentes de validação</CardTitle></CardHeader>
          <StatBox tone="a" label="Aguardando validação" value={stats.descargasPendentes} sub="cada uma requer ação sua" />
          {stats.descargasPendentes > 0 && (
            <AlertBox tone="amber" icon="⏳" title="Validar descargas para liberar faturamento">
              Acesse cada OC e valide a descarga registrada pela logística.
            </AlertBox>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>💰 Faturamentos a liberar</CardTitle></CardHeader>
          <StatBox tone="g" label="OCs prontas para liberar" value={stats.faturamentosACalc} sub="descarga validada, sem faturamento" />
          {stats.faturamentosACalc > 0 && (
            <div style={{ marginTop: 12 }}>
              <Link href="/ordens"><Button size="sm" variant="primary">Ver OCs →</Button></Link>
            </div>
          )}
        </Card>
      </div>

      {stats.trocasPendentes > 0 && (
        <div className="section-gap">
          <AlertBox
            tone="red"
            icon="🔄"
            title={`${stats.trocasPendentes} solicitação(ões) de troca de NF aguardando análise`}
            actions={<Link href="/pendencias"><Button size="sm" variant="danger">Ver Pendências</Button></Link>}
          >
            Acesse a OC para aprovar/rejeitar e, se aprovar, anexar a nova NF.
          </AlertBox>
        </div>
      )}
    </>
  );
}
