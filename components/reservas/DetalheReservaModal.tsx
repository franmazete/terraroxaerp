"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatBox } from "@/components/ui/StatBox";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import type { Carga, Reserva } from "@/lib/types";

interface Props {
  data: { carga: Carga; reserva: Reserva } | null;
  onClose: () => void;
}

export function DetalheReservaModal({ data, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const { aprovarReserva, reprovarReserva } = useDataStore();
  if (!data) return null;

  const { carga, reserva } = data;
  const podeAprovar = user?.role === "cerealista" && reserva.status === "pendente";

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title={<>{reserva.id} — Detalhes da Reserva</>}
      subtitle={
        <>
          {user?.role === "cerealista" && <>{carga.contrato_interno} · </>}
          {carga.id} · {carga.produto}
        </>
      }
      wide
      footer={
        <>
          {podeAprovar && (
            <>
              <Button
                variant="success"
                onClick={() => {
                  aprovarReserva(carga.id, reserva.id, user!.nome);
                  toast.success(`Reserva ${reserva.id} aprovada.`);
                  onClose();
                }}
              >
                ✓ Aprovar
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
                  onClose();
                }}
              >
                ✗ Reprovar
              </Button>
            </>
          )}
          <Button onClick={onClose}>Fechar</Button>
          {user?.role === "cerealista" && reserva.status === "aprovada" && (
            <Button variant="primary" onClick={() => toast.info("A emissão manual de OC virá na Etapa 5. No fluxo atual, a OC é gerada automaticamente quando a transp anexa a autorização.")}>
              📄 Gerar Ordem de Carg.
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatBox tone="g" compact label="Transportadora" value={<span style={{ fontSize: 14, fontWeight: 700 }}>{reserva.transp_nome}</span>} />
        <StatBox tone="b" compact label="Quantidade" value={fmtKg(reserva.qtd_kg)} />
        <StatBox compact label="Frete / Ton" value={`R$ ${reserva.frete_ton}`} />
        <StatBox tone="a" compact label="Total do Frete" value={`R$ ${((reserva.qtd_kg / 1000) * reserva.frete_ton).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
      </div>

      <table style={{ width: "100%", fontSize: 12 }}>
        <tbody>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0", width: "40%" }}>Motorista</td><td style={{ fontWeight: 600 }}>{reserva.motorista || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>CPF</td><td style={{ fontWeight: 600 }}>{reserva.cpf || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>CNH</td><td style={{ fontWeight: 600 }}>{reserva.cnh || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>Placa</td><td style={{ fontWeight: 600, fontFamily: "DM Mono, monospace" }}>{reserva.placa || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>Carreta</td><td style={{ fontWeight: 600, fontFamily: "DM Mono, monospace" }}>{reserva.carreta || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>Tipo de Veículo</td><td style={{ fontWeight: 600 }}>{reserva.tipo_veiculo || "—"}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>Data da Reserva</td><td>{fmtDate(reserva.data)}</td></tr>
          <tr><td style={{ color: "var(--muted)", padding: "6px 0" }}>Carg. Previsto</td><td>{fmtDate(carga.data_carg)}</td></tr>
          <tr>
            <td style={{ color: "var(--muted)", padding: "6px 0" }}>Status</td>
            <td>
              <Badge tone={reserva.status === "aprovada" ? "green" : "amber"}>
                {reserva.status === "aprovada" ? "✓ Aprovada" : "⏳ Pendente"}
              </Badge>
            </td>
          </tr>
        </tbody>
      </table>

      <hr className="divider" />

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
        Documentos Anexados
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {["CNH do Motorista", "CRLV do Caminhão", "Ordem de Carregamento", "Outros Documentos"].map((d) => (
          <div key={d} style={{ border: "1px dashed var(--border2)", borderRadius: "var(--radius)", padding: 10, textAlign: "center", fontSize: 11, color: "var(--hint)" }}>
            📄 {d}
            <br />
            <span style={{ fontSize: 10 }}>(upload disponível na Etapa 4)</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
