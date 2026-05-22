import type { ReactNode } from "react";
import s from "./Table.module.css";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className={s.wrap}>
      <table className={s.table}>{children}</table>
    </div>
  );
}

export const tableStyles = s;
