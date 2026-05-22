import type { ReactNode } from "react";
import s from "./Card.module.css";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`${s.card} ${className}`} style={style}>{children}</div>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className={s.header}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className={s.title}>{children}</div>;
}
