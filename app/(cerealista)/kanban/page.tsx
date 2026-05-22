"use client";

import { KanbanBoard } from "@/components/reservas/KanbanBoard";
import { useDataStore } from "@/lib/data-store";

export default function KanbanPage() {
  const { cargas } = useDataStore();
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Kanban Logístico</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Acompanhamento detalhado por reserva — arraste os cards para mover de etapa
          </div>
        </div>
      </div>
      <KanbanBoard cargas={cargas} />
    </>
  );
}
