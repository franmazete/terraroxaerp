"use client";

import type { ReactNode } from "react";
import s from "./Tabs.module.css";

interface TabItem<K extends string> {
  id: K;
  label: ReactNode;
}

interface Props<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (id: K) => void;
}

export function Tabs<K extends string>({ tabs, active, onChange }: Props<K>) {
  return (
    <div className={s.tabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`${s.tab} ${active === t.id ? s.active : ""}`}
          onClick={() => onChange(t.id)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
