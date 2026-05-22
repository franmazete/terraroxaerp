"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatBox } from "@/components/ui/StatBox";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { PublicarCargaModal } from "@/components/cargas/PublicarCargaModal";
import { DetalheReservaModal } from "@/components/reservas/DetalheReservaModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { aprovarReservaAction, reprovarReservaAction } from "@/lib/api/actions";
import { disponivelKg, percentualReservado, saldoColor } from "@/lib/domain/saldo";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import type { Carga, Reserva } from "@/lib/types";

interface Props {
  cargasSSR: Carga[] | null;
}

export function CargasClientView({ cargasSSR }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const router = useRouter();
  const store = useDataStore();
  const cargas = cargasSSR ?? store.cargas;

  const [publicarOpen, setPublicarOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<{ carga: Carga; reserva: Reserva } | null>(null);

  async function aprovar(carga: Carga, r: Reserva) {
    if (supabaseConfigured) {
      const res = await aprovarReservaAction(r.id);
      if ("error" in res) return toast.error(res.error);
      toast.success(`Reserva ${r.id} aprovada.`);
      router.refresh();
    } else {
      store.aprovarReserva(carga.id, r.id, user?.nome ?? "Admin");
      toast.success(`Reserva ${r.id} aprovada.`);
    }
  }

  async function reprovar(carga: Carga, r: Reserva) {
    const ok = await confirmar({
      titulo: "Reprovar reserva?",
      mensagem: (
        <>
          Reprovar a reserva <strong>{r.id}</strong> de <strong>{r.transp_nome}</strong>?
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Os {fmtKg(r.qtd_kg)} voltam ao saldo da carga.
          </div>
        </>
      ),
      variante: "danger",
      confirmarLabel: "Reprovar",
    });
    if (!ok) return;
    if (supabaseConfigured) {
      const res = await reprovarReservaAction(r.id);
      if ("error" in res) return toast.error(res.error);
      toast.info(`Reserva ${r.id} reprovada — saldo devolvido.`);
      router.refresh();
    } else {
      store.reprovarReserva(carga.id, r.id, user?.nome ?? "Admin");
      toast.info(`Reserva ${r.id} reprovada — saldo devolvido.`);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Gerenciar Cargas Publicadas</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Controle de saldo e reservas por contrato interno
          </div>
        </div>
        <Button variant="primary" onClick={() => setPublicarOpen(true)}>
          📦 Publicar Nova Carga
        </Button>
      </div>

      {cargas.length === 0 ? (
        <Card>
          <EmptyState icon="📦">
            Nenhuma carga publicada ainda.
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={() => setPublicarOpen(true)}>
                Publicar Primeira Carga
              </Button>
            </div>
          </EmptyState>
        </Card>
      ) : cargas.map((c) => {
        const disp = disponivelKg(c);
        const pct = percentualReservado(c);
        return (
          <Card key={c.id} className="section-gap">
            <div style={{ display: "flex", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontFamily: "DM Mono, monospace", background: "var(--surf3)", padding: "2px 7px", borderRadius: 4, color: "var(--muted)" }}>
                    {c.contrato_interno} · {c.id}
                  </span>
                  <Badge tone={c.status === "fechada" ? "red" : c.status === "parcial" ? "amber" : "green"}>
                    {c.status === "fechada" ? "🔒 Fechada" : c.status === "parcial" ? "⚡ Parcialmente Reservada" : "✅ Disponível"}
                  </Badge>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--g700)", marginBottom: 2 }}>{c.produto}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                  {c.origem} → {c.destino || <span style={{ color: "var(--a600)" }}>A definir</span>}
                </div>
                <ProgressBar percent={pct} color={saldoColor(pct)} className="" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
                  <span>{fmtKg(c.reservado_kg)} reservado</span>
                  <span style={{ fontWeight: 600, color: disp > 0 ? "var(--g600)" : "var(--r600)" }}>
                    {fmtKg(disp)} disponível de {fmtKg(c.total_kg)}
                  </span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 280 }}>
                <StatBox compact label="Carg. Previsto" value={fmtDate(c.data_carg)} />
                <StatBox tone="g" compact label="Reservas" value={c.reservas.length} />
                <StatBox tone="a" compact label="Pend. Aprov." value={c.reservas.filter((r) => r.status === "pendente").length} />
                <StatBox tone="b" compact label="Status" value={c.status} />
              </div>
            </div>

            {c.reservas.length > 0 ? (
              <>
                <hr className="divider" />
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
                  Reservas Vinculadas
                </div>
                <Table>
                  <thead>
                    <tr>
                      <th>ID Reserva</th>
                      <th>Transportadora</th>
                      <th>Qtd (kg)</th>
                      <th>Frete/t</th>
                      <th>Motorista</th>
                      <th>Placa</th>
                      <th>Data Reserva</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.reservas.map((r) => (
                      <tr key={r.id}>
                        <td><span className={tableStyles.mono}>{r.id}</span></td>
                        <td><strong>{r.transp_nome}</strong></td>
                        <td><strong>{fmtKg(r.qtd_kg)}</strong></td>
                        <td>R$ {r.frete_ton}/t</td>
                        <td>{r.motorista || "—"}</td>
                        <td>{r.placa || "—"}</td>
                        <td>{fmtDate(r.data)}</td>
                        <td>
                          <Badge tone={r.status === "aprovada" ? "green" : "amber"}>
                            {r.status === "aprovada" ? "✓ Aprovada" : "⏳ Pendente"}
                          </Badge>
                        </td>
                        <td>
                          {r.status === "pendente" && (
                            <>
                              <Button size="sm" variant="success" onClick={() => aprovar(c, r)}>
                                ✓ Aprovar
                              </Button>{" "}
                              <Button size="sm" variant="danger" onClick={() => reprovar(c, r)}>
                                ✗ Reprovar
                              </Button>{" "}
                            </>
                          )}
                          <Button size="sm" onClick={() => setDetalhe({ carga: c, reserva: r })}>
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            ) : (
              <div style={{ padding: "12px 0", color: "var(--hint)", fontSize: 12 }}>
                Nenhuma reserva ainda para esta carga.
              </div>
            )}
          </Card>
        );
      })}

      <PublicarCargaModal open={publicarOpen} onClose={() => setPublicarOpen(false)} />
      <DetalheReservaModal data={detalhe} onClose={() => setDetalhe(null)} />
    </>
  );
}
