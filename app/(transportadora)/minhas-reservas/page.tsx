"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnexarAutorizacaoModal } from "@/components/reservas/AnexarAutorizacaoModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import type { Carga, Reserva, ReservaComCarga } from "@/lib/types";

export default function MinhasReservasPage() {
  const { user } = useAuth();
  const { cargas, autorizacoesCarregamento, ordens } = useDataStore();
  const tid = user?.transp_id;
  const [anexar, setAnexar] = useState<{ carga: Carga; reserva: Reserva } | null>(null);

  const minhas: ReservaComCarga[] = cargas.flatMap((c) =>
    c.reservas.filter((r) => r.transp_id === tid).map((r): ReservaComCarga => ({ ...r, carga: c })),
  );

  if (minhas.length === 0) {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Minhas Reservas</div>
        </div>
        <Card>
          <EmptyState icon="📦">
            Você ainda não fez nenhuma reserva.
            <div style={{ marginTop: 12 }}>
              <Link href="/disponiveis">
                <Button variant="primary">Ver Cargas Disponíveis</Button>
              </Link>
            </div>
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Minhas Reservas</div>
      </div>

      {minhas.map((r) => {
        const autorizExiste = autorizacoesCarregamento.some((a) => a.reserva_id === r.id);
        const ocExiste = ordens.find((o) => o.reserva_id === r.id);

        return (
          <Card key={r.id} className="section-gap">
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "var(--muted)" }}>{r.id}</span>
                  <Badge tone={r.status === "aprovada" ? "green" : "amber"}>
                    {r.status === "aprovada" ? "✓ Aprovada" : "⏳ Aguardando aprovação"}
                  </Badge>
                  {ocExiste && <Badge tone="teal">📋 {ocExiste.numero}</Badge>}
                  {autorizExiste && <Badge tone="green">✓ Autorização anexada</Badge>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--g700)", marginBottom: 4 }}>{r.carga.produto}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--surf2)", borderRadius: "var(--radius)", fontSize: 12, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>📍 {r.carga.origem}</span>
                  <span style={{ color: "var(--g400)", fontSize: 16 }}>→</span>
                  <span style={{ fontWeight: 600, color: r.carga.destino ? undefined : "var(--a600)" }}>🏁 {r.carga.destino || "A definir"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                  <StatBox tone="g" compact label="Qtd Reservada" value={fmtKg(r.qtd_kg)} />
                  <StatBox tone="b" compact label="Frete / Ton" value={`R$ ${r.frete_ton}`} />
                  <StatBox compact label="Total Frete" value={`R$ ${((r.qtd_kg / 1000) * r.frete_ton).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <StatBox compact label="Motorista" value={r.motorista || "—"} />
                  <StatBox compact label="Placa" value={r.placa || "—"} />
                  <StatBox compact label="Carg. Previsto" value={fmtDate(r.carga.data_carg)} />
                </div>
              </div>
            </div>
            <hr className="divider" />

            {r.status === "pendente" && (
              <AlertBox tone="amber" icon="⏳" title="Aguardando aprovação da logística">
                Sua reserva está em análise. Você será notificada assim que houver decisão.
              </AlertBox>
            )}

            {r.status === "aprovada" && !autorizExiste && (
              <AlertBox
                tone="green"
                icon="✅"
                title="Reserva aprovada! Anexe a autorização de carregamento para gerar a OC"
                actions={
                  <Button variant="primary" onClick={() => setAnexar({ carga: r.carga, reserva: r })}>
                    📋 Anexar Autorização
                  </Button>
                }
              >
                A logística aprovou. Para liberar o carregamento na fazenda, anexe a autorização de carregamento da sua transportadora.
                A Ordem de Carregamento (OC) será <strong>gerada automaticamente</strong> ao anexar.
              </AlertBox>
            )}

            {r.status === "aprovada" && autorizExiste && ocExiste && (
              <AlertBox tone="blue" icon="📋" title={`OC ${ocExiste.numero} gerada — operação em andamento`}>
                Autorização anexada e Ordem de Carregamento criada. Acompanhe o status operacional no painel da OC.
              </AlertBox>
            )}
          </Card>
        );
      })}

      <AnexarAutorizacaoModal data={anexar} onClose={() => setAnexar(null)} />
    </>
  );
}
