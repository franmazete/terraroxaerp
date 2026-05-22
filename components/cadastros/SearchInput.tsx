"use client";

import s from "./SearchInput.module.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "Buscar..." }: Props) {
  return (
    <div className={s.wrap}>
      <span className={s.icon}>🔍</span>
      <input
        className={s.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
