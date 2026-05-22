"use client";

import type { Carga } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { disponivelKg, percentualReservado, saldoColor } from "@/lib/domain/saldo";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import s from "./CargaCard.module.css";

interface Props {
  carga: Carga;
  meuTranspId?: string;
  onReservar: (carga: Carga) => void;
}

export function CargaCard({ carga, meuTranspId, onReservar }: Props) {
  const disp = disponivelKg(carga);
  const pct = percentualReservado(carga);
  const color = saldoColor(pct);
  const minhaReserva = meuTranspId ? carga.reservas.find((r) => r.transp_id === meuTranspId) : undefined;

  const variantClass = carga.status === "fechada" ? s.cheia : carga.status === "parcial" ? s.parcial : "";

  return (
    <div className={`${s.card} ${variantClass}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
        <div className={s.produto}>{carga.produto}</div>
        <Badge tone={carga.status === "parcial" ? "amber" : "green"}>
          {carga.status === "parcial" ? "⚡ Parcial" : "✅ Disponível"}
        </Badge>
      </div>
      <div className={s.cargaId}>
        {carga.id} · publicada em {fmtDate(carga.publicada_em)}
      </div>

      <div className={s.rota}>
        <div className={s.origem}>📍 {carga.origem}</div>
        <div className={s.seta}>→</div>
        <div className={s.destino} style={carga.destino ? undefined : { color: "var(--a600)" }}>🏁 {carga.destino || "Destino a definir"}</div>
      </div>

      <div className={s.info}>
        <div className={s.infoItem}>
          <div className={s.lbl}>Tipo de Carga</div>
          <div className={s.val} style={{ fontSize: 11 }}>{carga.tipo_carga}</div>
        </div>
        <div className={s.infoItem}>
          <div className={s.lbl}>Carg. Previsto</div>
          <div className={s.val}>{fmtDate(carga.data_carg)}</div>
        </div>
        <div className={s.infoItem}>
          <div className={s.lbl}>Disponível Agora</div>
          <div className={s.val} style={{ color: "var(--g600)" }}>{fmtKg(disp)}</div>
        </div>
      </div>

      <div className={s.saldo}>
        <div className={s.saldoHead}>
          <div className={s.saldoTotal}>Total da carga: {fmtKg(carga.total_kg)}</div>
          <div className={s.saldoDisp}>
            {disp.toLocaleString("pt-BR")}<span> kg disponíveis</span>
          </div>
        </div>
        <ProgressBar percent={pct} color={color} />
        <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 4 }}>
          {fmtKg(carga.reservado_kg)} já reservado por {carga.reservas.length} transportadora(s)
        </div>
        {carga.reservas.length > 0 && (
          <div className={s.reservasList}>
            {carga.reservas.map((r) => (
              <div key={r.id} className={s.reservaRow}>
                <span className={s.reservaNome}>
                  {r.transp_id === meuTranspId ? (
                    <strong>Você</strong>
                  ) : (
                    `${r.transp_nome.split(" ")[0]} (outra)`
                  )}
                </span>
                <span className={s.reservaQtd}>{fmtKg(r.qtd_kg)}</span>
                <Badge tone={r.status === "aprovada" ? "green" : "amber"}>
                  {r.status === "aprovada" ? "✓" : "⏳"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {carga.obs && <div className={s.obs}>📋 {carga.obs}</div>}

      {minhaReserva ? (
        <div className={s.jaReservou}>
          ✓ Você já reservou {fmtKg(minhaReserva.qtd_kg)} nesta carga — status: {minhaReserva.status}
        </div>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onClick={() => onReservar(carga)}
          style={{ width: "100%", justifyContent: "center" }}
        >
          🚚 Quero Carregar — Reservar Agora
        </Button>
      )}
    </div>
  );
}
