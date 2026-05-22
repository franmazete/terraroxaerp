import type { ReactNode } from "react";
import s from "./StatBox.module.css";

export type StatTone = "g" | "a" | "b" | "r" | "t" | "none";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  compact?: boolean;
  className?: string;
}

export function StatBox({ label, value, sub, tone = "none", compact = false, className = "" }: Props) {
  const cls = [s.box, tone !== "none" ? s[tone] : "", compact ? s.compact : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className={s.lbl}>{label}</div>
      <div className={s.val}>{value}</div>
      {sub != null && <div className={s.sub}>{sub}</div>}
    </div>
  );
}
