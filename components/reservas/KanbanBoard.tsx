"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/Badge";
import { useDataStore } from "@/lib/data-store";
import { kanbanCols } from "@/lib/mock-data";
import { fmtKg } from "@/lib/domain/format";
import type { Carga, ReservaComCarga, ReservaEtapa } from "@/lib/types";
import s from "./KanbanBoard.module.css";

function KbCard({ item, dragging }: { item: ReservaComCarga; dragging?: boolean }) {
  return (
    <div className={`${s.card} ${dragging ? s.dragging : ""}`}>
      <div className={s.num}>
        {item.id} · {item.carga.contrato_interno}
      </div>
      <div className={s.title}>{item.carga.produto}</div>
      <div className={s.meta}>
        🚚 {item.transp_nome.split(" ")[0]}
        <br />
        ⚖️ {fmtKg(item.qtd_kg)}
        <br />
        👤 {item.motorista || "—"}
        <br />
        🚗 {item.placa || "—"}
        <br />
        💰 R$ {((item.qtd_kg / 1000) * item.frete_ton).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </div>
      <div style={{ marginTop: 8 }}>
        <Badge tone={item.status === "aprovada" ? "green" : "amber"}>
          {item.status === "aprovada" ? "✓ Aprovada" : "⏳ Pendente"}
        </Badge>
      </div>
    </div>
  );
}

function DraggableCard({ item }: { item: ReservaComCarga }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${item.carga.id}::${item.id}`,
    data: { reservaId: item.id, cargaId: item.carga.id },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KbCard item={item} dragging={isDragging} />
    </div>
  );
}

function DroppableCol({
  etapa,
  label,
  items,
}: {
  etapa: ReservaEtapa;
  label: string;
  items: ReservaComCarga[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: etapa });
  return (
    <div ref={setNodeRef} className={`${s.col} ${isOver ? s.colOver : ""}`}>
      <div className={s.colHd}>
        {label}
        <span className={s.count}>{items.length}</span>
      </div>
      {items.map((item) => (
        <DraggableCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function KanbanBoard({ cargas }: { cargas: Carga[] }) {
  const { moverEtapa } = useDataStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const todasReservas = useMemo<ReservaComCarga[]>(
    () => cargas.flatMap((c) => c.reservas.map((r): ReservaComCarga => ({ ...r, carga: c }))),
    [cargas],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const dataAct = e.active.data.current as { cargaId: string; reservaId: string } | undefined;
    if (!dataAct) return;
    moverEtapa(dataAct.cargaId, dataAct.reservaId, overId as ReservaEtapa);
  }

  const activeItem = activeId
    ? todasReservas.find((r) => `${r.carga.id}::${r.id}` === activeId)
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={s.scroll}>
        <div className={s.board}>
          {kanbanCols.map((col) => {
            const items = todasReservas.filter((r) => (r.etapa ?? "reserva_pendente") === col.id);
            return <DroppableCol key={col.id} etapa={col.id} label={col.label} items={items} />;
          })}
        </div>
      </div>
      <DragOverlay>{activeItem ? <KbCard item={activeItem} /> : null}</DragOverlay>
    </DndContext>
  );
}
