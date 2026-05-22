"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ════════════════════════════════════════════════════════════════════
 * Toast global — substitui window.alert()
 * Uso:
 *   const toast = useToast();
 *   toast.success("Salvo!");
 *   toast.error("Falhou: ...");
 *   toast.warn("Verifique X");
 *   toast.info("Carregando...");
 *
 *   // versão completa:
 *   toast.show({ tipo: "success", titulo: "OC criada", mensagem: "OC-2026-001", duracao: 4000 });
 * ════════════════════════════════════════════════════════════════════ */

export type ToastTipo = "success" | "error" | "warn" | "info";

export interface ToastConfig {
  tipo: ToastTipo;
  titulo?: string;
  mensagem: string;
  /** Duração em ms. Default: 4000. 0 = não auto-fecha. */
  duracao?: number;
}

interface ToastEntry extends ToastConfig {
  id: string;
}

interface ToastContextValue {
  show: (config: ToastConfig) => string;
  dismiss: (id: string) => void;
  success: (mensagem: string, titulo?: string) => string;
  error: (mensagem: string, titulo?: string) => string;
  warn: (mensagem: string, titulo?: string) => string;
  info: (mensagem: string, titulo?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastTipo, string> = {
  success: "✓",
  error: "✗",
  warn: "⚠️",
  info: "ℹ️",
};

const COLOR: Record<ToastTipo, { bg: string; border: string; text: string }> = {
  success: { bg: "#e8f5e9", border: "#2e7d32", text: "#1b5e20" },
  error: { bg: "#ffebee", border: "#c62828", text: "#b71c1c" },
  warn: { bg: "#fff8e1", border: "#f57f17", text: "#e65100" },
  info: { bg: "#e3f2fd", border: "#1565c0", text: "#0d47a1" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (config: ToastConfig): string => {
      idRef.current += 1;
      const id = `tst-${idRef.current}`;
      const entry: ToastEntry = { id, duracao: 4000, ...config };
      setToasts((arr) => [...arr, entry]);
      if (entry.duracao && entry.duracao > 0) {
        setTimeout(() => dismiss(id), entry.duracao);
      }
      return id;
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    show,
    dismiss,
    success: (mensagem, titulo) => show({ tipo: "success", mensagem, titulo }),
    error: (mensagem, titulo) => show({ tipo: "error", mensagem, titulo, duracao: 6000 }),
    warn: (mensagem, titulo) => show({ tipo: "warn", mensagem, titulo, duracao: 5000 }),
    info: (mensagem, titulo) => show({ tipo: "info", mensagem, titulo }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="region"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 380,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const c = COLOR[t.tipo];
          return (
            <div
              key={t.id}
              role={t.tipo === "error" ? "alert" : "status"}
              style={{
                background: c.bg,
                color: c.text,
                border: `1px solid ${c.border}`,
                borderLeft: `5px solid ${c.border}`,
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
                display: "flex",
                gap: 10,
                alignItems: "start",
                pointerEvents: "auto",
                animation: "tr-toast-slide-in 0.22s ease-out",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{ICON[t.tipo]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.titulo && (
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t.titulo}</div>
                )}
                <div style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                  {t.mensagem}
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
                style={{
                  background: "transparent",
                  border: "none",
                  color: c.text,
                  fontSize: 16,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes tr-toast-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve estar dentro de <ToastProvider>");
  return ctx;
}
