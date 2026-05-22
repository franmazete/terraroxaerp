import type { ReactNode } from "react";
import s from "./EmptyState.module.css";

export function EmptyState({ icon, children, className = "" }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`${s.empty} ${className}`}>
      {icon && <div className={s.icon}>{icon}</div>}
      <div className={s.text}>{children}</div>
    </div>
  );
}
