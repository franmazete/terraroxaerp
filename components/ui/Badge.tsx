import type { ReactNode } from "react";
import s from "./Badge.module.css";

export type BadgeTone = "green" | "amber" | "blue" | "red" | "teal" | "gray";

export function Badge({ tone = "gray", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`${s.badge} ${s[tone]} ${className}`}>{children}</span>;
}

/** Map dos códigos curtos do HTML original: bg/ba/bb/br/bt/bx. */
const ALIAS: Record<string, BadgeTone> = {
  bg: "green",
  ba: "amber",
  bb: "blue",
  br: "red",
  bt: "teal",
  bx: "gray",
};
export function toneFromAlias(alias: string): BadgeTone {
  return ALIAS[alias] ?? "gray";
}
