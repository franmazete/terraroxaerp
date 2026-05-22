"use client";

import { useEffect, useId, useState, type InputHTMLAttributes } from "react";

type Variant = "integer" | "currency";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | "";
  onChange: (n: number | "") => void;
  /** integer: 500000 → "500.000"   currency: 1234.5 → "1.234,50" */
  variant?: Variant;
  /** Sufixo opcional renderizado dentro do input (ex: "kg"). */
  suffix?: string;
}

function formatInteger(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseInteger(raw: string): number | "" {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  return parseInt(digits, 10);
}

function parseCurrency(raw: string): number | "" {
  // Remove tudo que não for dígito. Os últimos 2 dígitos são centavos.
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return num / 100;
}

export function NumberInput({ value, onChange, variant = "integer", suffix, ...rest }: Props) {
  const id = useId();
  const [text, setText] = useState<string>("");

  // Sincroniza com `value` externo
  useEffect(() => {
    if (value === "" || value === undefined || value === null || (typeof value === "number" && Number.isNaN(value))) {
      setText("");
    } else if (typeof value === "number") {
      setText(variant === "currency" ? formatCurrency(value) : formatInteger(value));
    }
  }, [value, variant]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const parsed = variant === "currency" ? parseCurrency(raw) : parseInteger(raw);
    onChange(parsed);
    if (parsed === "") {
      setText("");
    } else {
      setText(variant === "currency" ? formatCurrency(parsed) : formatInteger(parsed));
    }
  }

  // Container relativo apenas se houver sufixo
  if (suffix) {
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
        <input
          id={id}
          type="text"
          inputMode={variant === "currency" ? "decimal" : "numeric"}
          value={text}
          onChange={handleChange}
          style={{ paddingRight: 38 }}
          {...rest}
        />
        <span
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: "var(--muted)",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      </div>
    );
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={variant === "currency" ? "decimal" : "numeric"}
      value={text}
      onChange={handleChange}
      {...rest}
    />
  );
}
