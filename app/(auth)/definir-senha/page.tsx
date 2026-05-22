"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailLogado, setEmailLogado] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
      } else {
        setEmailLogado(data.user.email ?? null);
      }
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa ter ao menos 8 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não coincidem.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/dashboard"), 1500);
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
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Definir senha</h1>
          {emailLogado && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Conta: <strong>{emailLogado}</strong>
            </div>
          )}
        </div>

        {ok ? (
          <div
            style={{
              background: "var(--g100)",
              border: "1px solid var(--g500)",
              borderRadius: "var(--radius)",
              padding: 14,
              color: "var(--g700)",
              textAlign: "center",
            }}
          >
            ✅ Senha definida! Redirecionando...
          </div>
        ) : (
          <>
            {erro && (
              <div
                style={{
                  background: "var(--r100)",
                  color: "var(--r600)",
                  padding: 10,
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {erro}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Nova senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 8 caracteres"
                autoComplete="new-password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid var(--border2)",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
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
              }}
            >
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
