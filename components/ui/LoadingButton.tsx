"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button } from "./Button";

type Variant = "default" | "primary" | "success" | "danger" | "warning";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: Variant;
  size?: Size;
  /** Handler async. Enquanto a Promise estiver pendente, mostra spinner e desabilita. */
  onClick: () => Promise<unknown> | void;
  /** Label opcional durante loading. Default: "Carregando..." */
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * Botão que aceita handler async — mostra spinner enquanto pendente.
 * Não precisa gerenciar `loading` em cada componente.
 */
export function LoadingButton({
  variant,
  size,
  onClick,
  loadingLabel = "Carregando...",
  children,
  disabled,
  ...rest
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (loading) return;
    try {
      setLoading(true);
      await onClick();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handle}
      disabled={loading || disabled}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              animation: "tr-loading-spin 0.7s linear infinite",
            }}
            aria-hidden
          />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
      <style>{`
        @keyframes tr-loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Button>
  );
}
