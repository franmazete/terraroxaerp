"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Badge } from "@/components/ui/Badge";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReservarCargaModal } from "@/components/reservas/ReservarCargaModal";
import { AnexarAutorizacaoModal } from "@/components/reservas/AnexarAutorizacaoModal";
import { ChecklistOC } from "@/components/checklist/ChecklistOC";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { disponivelKg } from "@/lib/domain/saldo";
import { fmtKg } from "@/lib/domain/format";
import { calcSeveridade } from "@/lib/domain/sla";
import { calcChecklist, progressoChecklist } from "@/lib/domain/checklist";
import { buildOCSnapshot } from "@/lib/domain/oc-snapshot";
import type { AutorizacaoCarregamento, Carga, OrdemCarregamento, Pendencia, Reserva } from "@/lib/types";

interface Props {
  /** Dados vindos do Server Component (Supabase). null = modo mock. */
  dadosSSR?: {
    cargas: Carga[];
    ordens: OrdemCarregamento[];
    pendencias: Pendencia[];
    autorizacoes: AutorizacaoCarregamento[];
  } | null;
}

export function PainelTranspClientView({ dadosSSR = null }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const store = useDataStore();
  const usandoSSR = supabaseConfigured && dadosSSR !== null;
  const cargas = usandoSSR ? dadosSSR!.cargas : (store.cargas ?? []);
  const ordens = usandoSSR ? dadosSSR!.ordens : (store.ordens ?? []);
  const pendencias = usandoSSR ? dadosSSR!.pendencias : (store.pendencias ?? []);
  const autorizacoesSSR = usandoSSR ? dadosSSR!.autorizacoes : (store.autorizacoesCarregamento ?? []);
  const [reservar, setReservar] = useState<Carga | null>(null);
  const [anexar, setAnexar] = useState<{ carga: Carga; reserva: Reserva } | null>(null);
  const [ocAberta, setOcAberta] = useState<string | null>(null);

  const tid = user?.transp_id;

  const stats = useMemo(() => {
    const minhas = cargas.flatMap((c) =>
      (c.reservas ?? []).filter((r) => r.transp_id === tid).map((r) => ({ ...r, carga: c })),
    );
    const aprovadas = minhas.filter((r) => r.status === "aprovada");
    const pendentes = minhas.filter((r) => r.status === "pendente");
    const disponiveis = cargas.filter((c) => c.status !== "fechada" && disponivelKg(c) > 0);
    const minhasOcs = ordens.filter((o) => o.transp_id === tid && !["finalizada", "cancelada"].includes(o.status));
    const minhasPend = pendencias.filter(
      (p) =>
        p.status === "aberta" &&
        p.setor_responsavel === "transportadora" &&
        (!p.transp_id || p.transp_id === tid),
    );
    const agora = new Date();
    const pendAtrasadas = minhasPend.filter((p) => {
      const s = calcSeveridade(p, agora);
      return s === "atrasada" || s === "critica";
    }).length;
    return { minhas, aprovadas, pendentes, disponiveis, minhasOcs, minhasPend, pendAtrasadas };
  }, [cargas, ordens, pendencias, tid]);

  // Reservas aprovadas SEM autorização anexada → ação destacada
  const aguardandoAutorizacao = useMemo(
    () =>
      stats.aprovadas.filter(
        (r) => !autorizacoesSSR.some((a) => a.reserva_id === r.id),
      ),
    [stats.aprovadas, autorizacoesSSR],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🚛 Painel da Transportadora</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {user?.nome} · {stats.minhasOcs.length} OC(s) em andamento
          </div>
        </div>
        <Link href="/disponiveis">
          <Button variant="primary">🔍 Ver Cargas Disponíveis</Button>
        </Link>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="b" label="Cargas Disponíveis" value={stats.disponiveis.length} sub="abertas para reserva" />
        <StatBox tone="g" label="OCs em Andamento" value={stats.minhasOcs.length} sub={`${stats.aprovadas.length} reservas aprovadas`} />
        <StatBox tone="a" label="Aguard. Aprovação" value={stats.pendentes.length} sub="reservas pendentes" />
        <StatBox tone="r" label="Pendências Atrasadas" value={stats.pendAtrasadas} sub={`de ${stats.minhasPend.length} abertas`} />
      </div>

      {stats.pendAtrasadas > 0 && (
        <div className="section-gap">
          <AlertBox
            tone="red"
            icon="🔴"
            title={`${stats.pendAtrasadas} pendência(s) atrasada(s)`}
            actions={<Link href="/pendencias"><Button size="sm" variant="danger">Ver pendências →</Button></Link>}
          >
            Você tem ações pendentes que passaram do SLA. Resolva o quanto antes para não atrasar a operação.
          </AlertBox>
        </div>
      )}

      {aguardandoAutorizacao.length > 0 && (
        <div className="section-gap">
          <Card>
            <CardHeader>
              <CardTitle>📋 Reservas aprovadas — anexe a autorização para gerar a OC</CardTitle>
            </CardHeader>
            {aguardandoAutorizacao.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--g100)",
                  border: "1px solid var(--g400)",
                  borderRadius: "var(--radius)",
                  marginBottom: 8,
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {r.carga.produto} · {fmtKg(r.qtd_kg)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {r.carga.origem.split("/")[0]} → {r.carga.destino ? r.carga.destino.split("/")[0] : "A definir"} · {r.motorista} · {r.placa}
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => setAnexar({ carga: r.carga, reserva: r })}>
                  📋 Anexar Autorização
                </Button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Lista de OCs em andamento — cada uma com checklist expansível */}
      {stats.minhasOcs.length > 0 ? (
        <Card className="section-gap">
          <CardHeader>
            <CardTitle>🚚 Minhas OCs em Andamento — Checklist Sequencial</CardTitle>
          </CardHeader>
          {stats.minhasOcs.map((oc) => {
            // Snapshot precisa de várias arrays — em modo SSR usamos ordens/autorizacoes
            // do banco e completamos as demais com o store (mock vazio em prod).
            // O checklist fica "parcial" mas a UI renderiza sem crashar.
            const snapshotInputs = usandoSSR
              ? { ...store, ordens, autorizacoesCarregamento: autorizacoesSSR }
              : store;
            const snap = buildOCSnapshot(oc.id, snapshotInputs);
            if (!snap) return null;
            const passos = calcChecklist(snap);
            const prog = progressoChecklist(passos);
            const proxPasso = passos.find((p) => p.status === "pendente" && p.setor === "transportadora");
            const aberta = ocAberta === oc.id;

            return (
              <div
                key={oc.id}
                style={{
                  padding: 14,
                  marginBottom: 10,
                  background: "var(--surf2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <Link href={`/ordens/${oc.id}`} style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--g700)", fontWeight: 700 }}>
                        {oc.numero}
                      </Link>
                      {oc.refugada && <Badge tone="red">⚠️ Refugada</Badge>}
                      <Badge tone="blue">{prog.concluidos}/{prog.total} passos</Badge>
                    </div>
                    {proxPasso ? (
                      <div style={{ fontSize: 12, color: "var(--a600)", fontWeight: 600, marginTop: 4 }}>
                        ⏳ Próximo: {proxPasso.label}
                        {proxPasso.hint && <span style={{ color: "var(--muted)", fontWeight: 400 }}> — {proxPasso.hint}</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--g600)", fontWeight: 600, marginTop: 4 }}>
                        ✓ Sem ações pendentes de sua parte no momento
                      </div>
                    )}
                    <div style={{ marginTop: 8, maxWidth: 360 }}>
                      <ProgressBar percent={prog.pct} color={prog.pct >= 100 ? "green" : prog.pct >= 50 ? "amber" : "red"} />
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setOcAberta(aberta ? null : oc.id)}>
                    {aberta ? "▲ Recolher checklist" : "▼ Ver checklist"}
                  </Button>
                </div>

                {aberta && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                    <ChecklistOC passos={passos} compact />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="section-gap">
          <EmptyState icon="📦">
            Nenhuma OC em andamento. Reserve uma carga para começar.
            <div style={{ marginTop: 12 }}>
              <Link href="/disponiveis"><Button variant="primary">Ver cargas disponíveis</Button></Link>
            </div>
          </EmptyState>
        </Card>
      )}

      {/* Cargas disponíveis (compacto) */}
      {stats.disponiveis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📦 Cargas Disponíveis (próximas)</CardTitle>
          </CardHeader>
          {stats.disponiveis.slice(0, 3).map((c) => {
            const disp = disponivelKg(c);
            return (
              <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.produto}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {c.origem.split("/")[0]} → {c.destino ? c.destino.split("/")[0] : "A definir"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--g600)", fontWeight: 600, marginTop: 2 }}>
                      {fmtKg(disp)} disponíveis
                    </div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => setReservar(c)}>
                    Reservar
                  </Button>
                </div>
              </div>
            );
          })}
          {stats.disponiveis.length > 3 && (
            <div style={{ textAlign: "center", paddingTop: 10 }}>
              <Link href="/disponiveis">
                <Button size="sm">Ver todas ({stats.disponiveis.length}) →</Button>
              </Link>
            </div>
          )}
        </Card>
      )}

      <ReservarCargaModal carga={reservar} onClose={() => setReservar(null)} />
      <AnexarAutorizacaoModal data={anexar} onClose={() => setAnexar(null)} />
    </>
  );
}
