"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

/* ════════════════════════════════════════════════════════════════════
 * ConfirmDialog — substitui window.confirm()
 * Uso:
 *   const confirmar = useConfirm();
 *
 *   if (await confirmar({
 *     titulo: "Reprovar reserva?",
 *     mensagem: "Os 50.000 kg voltam ao saldo. Continuar?",
 *     variante: "danger",
 *     confirmarLabel: "Reprovar",
 *   })) {
 *     // user confirmou
 *   }
 * ════════════════════════════════════════════════════════════════════ */

type Variante = "info" | "danger" | "warn";

export interface ConfirmConfig {
  titulo: string;
  mensagem: ReactNode;
  variante?: Variante;
  confirmarLabel?: string;
  cancelarLabel?: string;
}

type Resolver = (v: boolean) => void;

interface ConfirmContextValue {
  /** Abre o dialog e devolve uma Promise<boolean>. true = confirmou, false = cancelou. */
  (config: ConfirmConfig): Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const confirmar = useCallback((cfg: ConfirmConfig) => {
    return new Promise<boolean>((resolve) => {
      setConfig(cfg);
      setResolver(() => resolve);
      setOpen(true);
    });
  }, []);

  function decidir(valor: boolean) {
    setOpen(false);
    if (resolver) resolver(valor);
    setResolver(null);
    // Limpa config depois da animação de fechar
    setTimeout(() => setConfig(null), 150);
  }

  const variante = config?.variante ?? "info";
  const corBotao: "primary" | "danger" | "warning" =
    variante === "danger" ? "danger" : variante === "warn" ? "warning" : "primary";
  const icon =
    variante === "danger" ? "⚠️" : variante === "warn" ? "⚠️" : "ℹ️";

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal
        open={open}
        onClose={() => decidir(false)}
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{icon}</span>
            {config?.titulo ?? ""}
          </span>
        }
        footer={
          <>
            <Button onClick={() => decidir(false)}>
              {config?.cancelarLabel ?? "Cancelar"}
            </Button>
            <Button variant={corBotao} onClick={() => decidir(true)}>
              {config?.confirmarLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
          {config?.mensagem}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm deve estar dentro de <ConfirmDialogProvider>");
  return ctx;
}
