"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";

export default function EsqueciSenhaPage() {
  const toast = useToast();
  const { supabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.warn("Informe um e-mail válido.");
      return;
    }
    if (!supabaseConfigured) {
      toast.warn(
        "A redefinição por e-mail exige o Supabase configurado. Em modo mock, peça a um admin para criar a conta novamente.",
        "Supabase não configurado",
      );
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/definir-senha`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnviado(true);
    toast.success("Verifique seu e-mail para redefinir a senha.", "Link enviado");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, var(--g100), var(--surf))",
        padding: 20,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          background: "var(--surf)",
          padding: 32,
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Esqueci minha senha</h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Informe seu e-mail. Enviaremos um link para criar uma nova senha.
          </div>
        </div>

        {enviado ? (
          <>
            <div
              style={{
                background: "var(--g100)",
                border: "1px solid var(--g500)",
                borderRadius: "var(--radius)",
                padding: 14,
                color: "var(--g700)",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              ✓ Link enviado para <strong>{email}</strong>. <br />
              <span style={{ fontSize: 11 }}>Cheque sua caixa de entrada (e o spam).</span>
            </div>
            <Link
              href="/login"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 14px",
                background: "var(--g600)",
                color: "white",
                borderRadius: "var(--radius)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid var(--border2)",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--g600)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
                marginBottom: 12,
              }}
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>

            <Link
              href="/login"
              style={{
                display: "block",
                textAlign: "center",
                fontSize: 12,
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              ← Voltar para o login
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
