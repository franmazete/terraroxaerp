"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import s from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${s.modal} ${wide ? s.wide : ""}`}>
        <div className={s.head}>
          <div>
            <h2>{title}</h2>
            {subtitle && <div className={s.sub}>{subtitle}</div>}
          </div>
          <button className={s.close} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>
  );
}
