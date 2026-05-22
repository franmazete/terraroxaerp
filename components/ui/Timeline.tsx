import type { HistoricoEvento } from "@/lib/types";
import s from "./Timeline.module.css";

export function Timeline({ events }: { events: HistoricoEvento[] }) {
  return (
    <div className={s.timeline}>
      {events.map((h, i) => (
        <div key={i} className={s.item}>
          <div className={`${s.dot} ${s[h.tipo]}`} />
          <div className={s.when}>
            {h.quando} · {h.quem}
          </div>
          <div className={s.what}>{h.o_que}</div>
        </div>
      ))}
    </div>
  );
}
