"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { calcSeveridade } from "@/lib/domain/sla";
import type { PendenciaSetor } from "@/lib/types";

/**
 * Sino de notificações no topbar — mostra contagem de pendências do meu setor +
 * dropdown listando as 5 mais recentes/urgentes. Anima quando chega algo novo.
 */
export function NotificacoesBell() {
  const { user } = useAuth();
  const { pendencias } = useDataStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const totalAnteriorRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);

  const meuSetor: PendenciaSetor | null =
    user?.perfil === "comercial"
      ? "comercial"
      : user?.perfil === "logistica" || user?.perfil === "admin"
      ? "logistica"
      : user?.perfil === "fiscal"
      ? "fiscal"
      : user?.perfil === "financeiro"
      ? "financeiro"
      : user?.perfil === "transportadora"
      ? "transportadora"
      : null;

  const minhas = useMemo(() => {
    if (!meuSetor) return [];
    return pendencias
      .filter((p) => p.status === "aberta" && p.setor_responsavel === meuSetor)
      .filter((p) => meuSetor !== "transportadora" || !p.transp_id || p.transp_id === user?.transp_id);
  }, [pendencias, meuSetor, user?.transp_id]);

  const agora = new Date();
  const enriched = useMemo(
    () =>
      minhas
        .map((p) => ({ ...p, severidade: calcSeveridade(p, agora) }))
        .sort((a, b) => {
          const order = { critica: 0, atrasada: 1, vencendo: 2, proximo: 3, no_prazo: 4 } as const;
          return order[a.severidade] - order[b.severidade];
        }),
    // agora é recalculado a cada render — não é dep para evitar loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minhas],
  );

  const total = enriched.length;
  const atrasadas = enriched.filter((p) => p.severidade === "atrasada" || p.severidade === "critica").length;

  // Pulse quando o total aumenta
  useEffect(() => {
    if (totalAnteriorRef.current === null) {
      totalAnteriorRef.current = total;
      return;
    }
    if (total > totalAnteriorRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1800);
      totalAnteriorRef.current = total;
      return () => clearTimeout(t);
    }
    totalAnteriorRef.current = total;
  }, [total]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!meuSetor) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${total} pendência(s) aberta(s) no seu setor`}
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          padding: "4px 8px",
          borderRadius: "var(--radius)",
          color: "white",
          lineHeight: 1,
          animation: pulse ? "tr-bell-pulse 0.9s ease-in-out 2" : undefined,
        }}
      >
        🔔
        {total > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              background: atrasadas > 0 ? "#dc3545" : "#ffb020",
              color: "white",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--g700, #2a5a3a)",
            }}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            overflowY: "auto",
            background: "var(--surf)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            zIndex: 1000,
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
              🔔 Notificações
            </div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              <strong>{total}</strong> pendência(s) ·{" "}
              <span style={{ color: atrasadas > 0 ? "var(--r600)" : "var(--g700)" }}>
                {atrasadas} atrasada(s)
              </span>
            </div>
          </div>

          {enriched.length === 0 ? (
            <div style={{ padding: "20px 14px", fontSize: 12, color: "var(--hint)", textAlign: "center" }}>
              🎉 Sem pendências abertas. Tudo em dia!
            </div>
          ) : (
            enriched.slice(0, 6).map((p) => {
              const cor =
                p.severidade === "critica" || p.severidade === "atrasada"
                  ? "var(--r600)"
                  : p.severidade === "vencendo" || p.severidade === "proximo"
                  ? "var(--a600)"
                  : "var(--g700)";
              const icon =
                p.severidade === "critica"
                  ? "⚫"
                  : p.severidade === "atrasada"
                  ? "🔴"
                  : p.severidade === "vencendo"
                  ? "🟠"
                  : p.severidade === "proximo"
                  ? "🟡"
                  : "🟢";
              return (
                <Link
                  key={p.id}
                  href={p.oc_id ? `/ordens/${p.oc_id}` : "/pendencias"}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: cor }}>{p.descricao}</div>
                      <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2, fontFamily: "DM Mono, monospace" }}>
                        {p.oc_id ?? p.reserva_id ?? "—"} · SLA {p.sla_horas}h · vence em{" "}
                        {new Date(p.vence_em).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}

          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surf2)" }}>
            <Link
              href="/pendencias"
              onClick={() => setOpen(false)}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--g700)", textDecoration: "none" }}
            >
              Ver todas as pendências →
            </Link>
          </div>
        </div>
      )}

      {/* Keyframes do pulse */}
      <style>{`
        @keyframes tr-bell-pulse {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.25) rotate(-12deg); }
          50% { transform: scale(1.15) rotate(12deg); }
          75% { transform: scale(1.25) rotate(-8deg); }
        }
      `}</style>
    </div>
  );
}
