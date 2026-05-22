"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Timeline } from "@/components/ui/Timeline";
import { useDataStore } from "@/lib/data-store";

export default function HistoricoPage() {
  const { historico } = useDataStore();
  return (
    <>
      <div className="page-header">
        <div className="page-title">Histórico de Movimentações</div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>📋 Registro completo de ações</CardTitle>
        </CardHeader>
        <Timeline events={historico} />
      </Card>
    </>
  );
}
