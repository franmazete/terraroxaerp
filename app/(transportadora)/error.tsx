"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Error Boundary do grupo /(transportadora).
 * Captura qualquer exception client-side e mostra mensagem clara
 * em vez do "Application error" genérico do Next.
 */
export default function TranspError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga no console pra inspeção; em produção também vai pra Vercel logs
    console.error("[transportadora] Erro renderizando:", error);
  }, [error]);

  return (
    <div style={{ padding: "40px 20px", maxWidth: 720, margin: "0 auto" }}>
      <Card>
        <div style={{ textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, color: "var(--r600)", marginBottom: 12 }}>
            Algo deu errado nesta tela
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.5 }}>
            Ocorreu um erro inesperado ao carregar a área da transportadora.
            Isso pode acontecer se seu usuário não tem uma transportadora vinculada
            corretamente ou se algum dado esperado está faltando.
          </p>

          {error.message && (
            <div
              style={{
                background: "var(--r100)",
                border: "1px solid var(--r400)",
                borderLeft: "3px solid var(--r600)",
                padding: "10px 14px",
                borderRadius: "var(--radius)",
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                textAlign: "left",
                color: "var(--r600)",
                marginBottom: 16,
                maxWidth: 480,
                marginLeft: "auto",
                marginRight: "auto",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => reset()}>
              🔄 Tentar novamente
            </Button>
            <Link href="/login">
              <Button>Voltar ao login</Button>
            </Link>
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: "var(--hint)" }}>
            <p style={{ marginBottom: 6 }}>
              <strong>Possíveis causas:</strong>
            </p>
            <ul style={{ textAlign: "left", display: "inline-block", lineHeight: 1.6 }}>
              <li>Seu usuário não tem transportadora vinculada</li>
              <li>A transportadora vinculada foi removida</li>
              <li>Você é admin tentando acessar área de transportadora</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              Avise o administrador se o erro persistir.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
