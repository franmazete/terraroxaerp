import type { ReactNode } from "react";
import s from "./AlertBox.module.css";

interface Props {
  tone: "red" | "amber" | "green" | "blue";
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

export function AlertBox({ tone, icon, title, children, actions }: Props) {
  return (
    <div className={`${s.box} ${s[tone]}`}>
      {icon && <div className={s.icon}>{icon}</div>}
      <div className={s.text}>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {actions}
    </div>
  );
}
