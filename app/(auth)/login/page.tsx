"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { transportadorasMock } from "@/lib/mock-data";
import s from "./page.module.css";

type LoginMode = "cerealista" | "transportadora";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login, supabaseConfigured } = useAuth();
  const [mode, setMode] = useState<LoginMode>("cerealista");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [transpId, setTranspId] = useState("TR-001");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(user.role === "cerealista" ? "/dashboard" : "/painel");
    }
  }, [ready, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const ok = await login({ email, senha, transpId: mode === "transportadora" ? transpId : undefined });
      if (!ok) {
        setErro(supabaseConfigured
          ? "E-mail ou senha incorretos. Se você foi convidado(a), defina a senha pelo link no e-mail."
          : "Credenciais inválidas. Use os exemplos abaixo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.screen}>
      <form className={s.card} onSubmit={onSubmit}>
        <div className={s.logo}>
          <div className={s.emoji}>🌾</div>
          <h1>Portal de Cargas</h1>
          <span>Marketplace Logístico — Cerealista</span>
        </div>

        <div className={s.tabs}>
          <button
            type="button"
            className={`${s.tab} ${mode === "cerealista" ? s.active : ""}`}
            onClick={() => setMode("cerealista")}
          >
            🏢 Cerealista / Logística
          </button>
          <button
            type="button"
            className={`${s.tab} ${mode === "transportadora" ? s.active : ""}`}
            onClick={() => setMode("transportadora")}
          >
            🚚 Transportadora
          </button>
        </div>

        {erro && <div className={s.error}>{erro}</div>}

        <div className={s.field}>
          <label>Usuário / E-mail</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com.br"
            autoComplete="username"
          />
        </div>

        <div className={s.field}>
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {mode === "transportadora" && (
          <div className={s.field}>
            <label>Transportadora</label>
            <select value={transpId} onChange={(e) => setTranspId(e.target.value)}>
              {transportadorasMock.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome_fantasia}
                </option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" className={s.submit} disabled={loading}>
          {loading ? "Entrando..." : "Entrar no Portal"}
        </button>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <Link href="/esqueci-senha" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
            Esqueci minha senha
          </Link>
        </div>

        {supabaseConfigured ? (
          <div className={s.hint}>
            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              Acesso por convite. Sem conta? Peça ao administrador para convidá-lo.
            </p>
          </div>
        ) : (
          <div className={s.hint}>
            <p>Modo demonstração (sem Supabase):</p>
            <span className={s.cred}>cerealista / logistica</span>
            <span className={s.cred}>transportadora / carregar</span>
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--hint)" }}>
              Ou e-mail completo: ana@terraroxa.com.br, marina@terraroxa.com.br, rodrigo@terraroxa.com.br
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
