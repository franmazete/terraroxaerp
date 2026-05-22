"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDataStore } from "@/lib/data-store";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import type { Carga, Reserva } from "@/lib/types";

interface Props {
  reserva: Reserva;
  carga: Carga;
  onVer: (carga: Carga, reserva: Reserva) => void;
}

export function ReservaCard({ reserva, carga, onVer }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const { aprovarReserva, reprovarReserva } = useDataStore();
  const showActions = user?.role === "cerealista" && reserva.status === "pendente";

  return (
    <Card className="section-gap">
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "var(--muted)" }}>{reserva.id}</span>
            <Badge tone={reserva.status === "aprovada" ? "green" : "amber"}>
              {reserva.status === "aprovada" ? "✓ Aprovada" : "⏳ Pendente"}
            </Badge>
            <Badge tone="blue">{carga.produto}</Badge>
            <Badge tone="gray">{carga.id}</Badge>
            {user?.role === "cerealista" && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{carga.contrato_interno}</span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{reserva.transp_nome}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            {carga.origem} → {carga.destino || <span style={{ color: "var(--a600)" }}>A definir</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
            <Info label="Quantidade" value={fmtKg(reserva.qtd_kg)} highlight />
            <Info label="Frete/Ton" value={`R$ ${reserva.frete_ton}`} highlight />
            <Info label="Total Frete" value={`R$ ${((reserva.qtd_kg / 1000) * reserva.frete_ton).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} highlight />
            <Info label="Motorista" value={reserva.motorista || "—"} />
            <Info label="Placa" value={reserva.placa || "—"} mono />
            <Info label="Data Reserva" value={fmtDate(reserva.data)} />
          </div>
        </div>
        {showActions ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
            <Button
              variant="success"
              onClick={() => {
                aprovarReserva(carga.id, reserva.id, user!.nome);
                toast.success(`Reserva ${reserva.id} aprovada.`);
              }}
            >
              ✓ Aprovar Reserva
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirmar({
                  titulo: "Reprovar reserva?",
                  mensagem: (
                    <>
                      Reprovar a reserva <strong>{reserva.id}</strong> de{" "}
                      <strong>{reserva.transp_nome}</strong>?
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                        Os {fmtKg(reserva.qtd_kg)} voltam ao saldo da carga.
                      </div>
                    </>
                  ),
                  variante: "danger",
                  confirmarLabel: "Reprovar",
                });
                if (!ok) return;
                reprovarReserva(carga.id, reserva.id, user!.nome);
                toast.info(`Reserva ${reserva.id} reprovada — saldo devolvido.`);
              }}
            >
              ✗ Reprovar
            </Button>
            <Button size="sm" onClick={() => onVer(carga, reserva)}>
              📋 Ver Documentos
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => onVer(carga, reserva)}>
            📋 Ver Detalhes
          </Button>
        )}
      </div>
    </Card>
  );
}

function Info({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div
        style={{
          fontSize: highlight ? 15 : 12,
          fontWeight: highlight ? 700 : 600,
          color: highlight ? "var(--g700)" : "var(--text)",
          fontFamily: mono ? "DM Mono, monospace" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}
