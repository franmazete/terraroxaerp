"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReservaCard } from "@/components/reservas/ReservaCard";
import { DetalheReservaModal } from "@/components/reservas/DetalheReservaModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import type { Carga, Reserva, ReservaComCarga } from "@/lib/types";

type Tab = "pend" | "aprov" | "todas";

interface Props {
  /** Cargas vindas do Server Component (Supabase, com reservas via join). null = modo mock. */
  cargasSSR?: Carga[] | null;
}

export function ReservasClientView({ cargasSSR = null }: Props) {
  const { supabaseConfigured } = useAuth();
  const store = useDataStore();
  const usandoSSR = supabaseConfigured && cargasSSR !== null;
  const cargas = usandoSSR ? cargasSSR! : (store.cargas ?? []);
  const [tab, setTab] = useState<Tab>("pend");
  const [detalhe, setDetalhe] = useState<{ carga: Carga; reserva: Reserva } | null>(null);

  const todas = useMemo<ReservaComCarga[]>(
    () => cargas.flatMap((c) => (c.reservas ?? []).map((r): ReservaComCarga => ({ ...r, carga: c }))),
    [cargas],
  );
  const pendentes = todas.filter((r) => r.status === "pendente");
  const aprovadas = todas.filter((r) => r.status === "aprovada");
  const lista = tab === "pend" ? pendentes : tab === "aprov" ? aprovadas : todas;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Reservas das Transportadoras</div>
      </div>

      {pendentes.length > 0 && (
        <div className="section-gap">
          <AlertBox tone="amber" icon="⏳" title={`${pendentes.length} reserva(s) aguardando aprovação`}>
            Transportadoras estão aguardando sua decisão para iniciar a operação.
          </AlertBox>
        </div>
      )}

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "pend", label: <>Pendentes <Badge tone="amber">{pendentes.length}</Badge></> },
          { id: "aprov", label: <>Aprovadas <Badge tone="green">{aprovadas.length}</Badge></> },
          { id: "todas", label: <>Todas <Badge tone="gray">{todas.length}</Badge></> },
        ]}
      />

      {lista.length === 0 ? (
        <EmptyState icon="✅">Nenhuma reserva nesta lista.</EmptyState>
      ) : (
        lista.map((r) => (
          <ReservaCard
            key={r.id}
            reserva={r}
            carga={r.carga}
            onVer={(carga, reserva) => setDetalhe({ carga, reserva })}
          />
        ))
      )}

      <DetalheReservaModal data={detalhe} onClose={() => setDetalhe(null)} />
    </>
  );
}
