import s from "./ProgressBar.module.css";

export function ProgressBar({ percent, color = "green", className = "" }: { percent: number; color?: "green" | "amber" | "red"; className?: string }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className={`${s.bar} ${className}`}>
      <div className={`${s.fill} ${s[color]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
