import type { ButtonHTMLAttributes } from "react";
import s from "./Button.module.css";

type Variant = "default" | "primary" | "success" | "danger" | "warning";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "default", size = "md", className = "", children, ...rest }: Props) {
  const cls = [
    s.btn,
    variant !== "default" ? s[variant] : "",
    size === "sm" ? s.sm : size === "lg" ? s.lg : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
