"use client";

import { useState } from "react";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { CargaCard } from "@/components/cargas/CargaCard";
import { ReservarCargaModal } from "@/components/reservas/ReservarCargaModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { disponivel } from "@/lib/domain/saldo";
import type { Carga } from "@/lib/types";

export default function DisponiveisPage() {
  const { user } = useAuth();
  const { cargas } = useDataStore();
  const [reservar, setReservar] = useState<Carga | null>(null);

  // Bloco I — só vê cargas onde a transp está na allowlist (ou allowlist vazia = todas podem)
  const minhaId = user?.transp_id;
  const disponiveis = cargas.filter((c) => {
    if (c.status === "fechada") return false;
    if (disponivel(c) <= 0) return false;
    const allowlist = c.transps_permitidas;
    if (allowlist && allowlist.length > 0 && minhaId) {
      return allowlist.includes(minhaId);
    }
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Cargas Disponíveis</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Reserve cargas para transporte — apenas dados operacionais
          </div>
        </div>
      </div>

      <div className="section-gap">
        <AlertBox tone="green" icon="ℹ️" title="Como funciona a reserva?">
          Clique em "Quero Carregar", informe seus dados, quantidade desejada e valor do frete. A cerealista irá analisar e aprovar sua reserva. O saldo é atualizado automaticamente.
        </AlertBox>
      </div>

      {disponiveis.length === 0 ? (
        <EmptyState icon="🌾">
          Nenhuma carga disponível no momento.
          <br />
          Aguarde novas publicações da cerealista.
        </EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {disponiveis.map((c) => (
            <CargaCard key={c.id} carga={c} meuTranspId={user?.transp_id} onReservar={setReservar} />
          ))}
        </div>
      )}

      <ReservarCargaModal carga={reservar} onClose={() => setReservar(null)} />
    </>
  );
}
