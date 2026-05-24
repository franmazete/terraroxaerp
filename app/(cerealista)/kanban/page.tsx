import { KanbanBoard } from "@/components/reservas/KanbanBoard";
import { getCargas } from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function KanbanPage() {
  const cargas = SUPABASE_CONFIGURED ? await getCargas() : [];
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
