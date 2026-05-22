import type { ReactNode } from "react";
import s from "./Chip.module.css";

export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`${s.chip} ${className}`}>{children}</span>;
}
