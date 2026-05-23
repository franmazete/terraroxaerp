"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Acao, Modulo, Perfil, User } from "@/lib/types";
import { usuariosMock, transportadorasDb } from "@/lib/mock-data";
import { perfilFromRole, podeExecutar, roleFromPerfil } from "@/lib/domain/permissions";
import { createClient } from "@/lib/supabase/client";

/** True quando .env.local está completo — usa Supabase. False = fallback mock. */
const SUPABASE_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx")
);

interface AuthContextValue {
  user: User | null;
  /** Verifica permissão da sessão atual. */
  can: (modulo: Modulo, acao: Acao) => boolean;
  /** Login com email + senha. Em modo Supabase usa signInWithPassword; em mock usa SENHAS_MOCK. */
  login: (input: { email: string; senha: string; transpId?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  ready: boolean;
  /** True quando rodando contra Supabase real; false quando em mock local. */
  supabaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "terraroxa-user";

/** Mock de credenciais (fallback quando Supabase não está configurado). */
const SENHAS_MOCK: Record<string, string> = {
  "carlos@terraroxa.com.br": "admin",
  "ana@terraroxa.com.br": "logistica",
  "marina@terraroxa.com.br": "fiscal",
  "rodrigo@terraroxa.com.br": "financeiro",
  "joao@cerrado.com.br": "carregar",
  "paulo@ranchofundo.com.br": "carregar",
  cerealista: "logistica",
  transportadora: "carregar",
};

function makeInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Carrega user do Supabase (ou localStorage no modo mock)
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (SUPABASE_CONFIGURED) {
        // ─── Modo Supabase real ────────────────────────────────────────
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = await fetchUsuarioFromDb(session.user.id, session.user.email ?? "");
          if (mounted) setUser(u);
        }

        // Listener pra mudanças de session
        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          if (session?.user) {
            const u = await fetchUsuarioFromDb(session.user.id, session.user.email ?? "");
            setUser(u);
          } else {
            setUser(null);
          }
        });

        if (mounted) setReady(true);
        return () => sub.subscription.unsubscribe();
      } else {
        // ─── Modo mock ─────────────────────────────────────────────────
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw && mounted) setUser(JSON.parse(raw));
        } catch {}
        if (mounted) setReady(true);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  async function login({ email, senha, transpId }: { email: string; senha: string; transpId?: string }) {
    if (SUPABASE_CONFIGURED) {
      // ─── Login Supabase real ─────────────────────────────────────────
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error || !data.user) return false;
      const u = await fetchUsuarioFromDb(data.user.id, data.user.email ?? "");
      if (!u) return false;
      setUser(u);
      // Se o user foi criado com senha temporária e ainda não trocou,
      // força ir pra tela de definir senha antes de qualquer outra coisa.
      const mustChange = data.user.user_metadata?.must_change_password === true;
      if (mustChange) {
        router.push("/definir-senha?force=1");
      } else {
        router.push(u.role === "cerealista" ? "/dashboard" : "/painel");
      }
      return true;
    } else {
      // ─── Login mock (legacy) ─────────────────────────────────────────
      const senhaEsperada = SENHAS_MOCK[email.toLowerCase()];
      if (!senhaEsperada || senhaEsperada !== senha) return false;

      let usuario = usuariosMock.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!usuario && email.toLowerCase() === "cerealista") {
        usuario = usuariosMock.find((u) => u.perfil === "logistica");
      }
      if (!usuario && email.toLowerCase() === "transportadora") {
        usuario = usuariosMock.find((u) => u.perfil === "transportadora" && u.transp_id === (transpId ?? "TR-001"));
      }
      if (!usuario) return false;

      const finalTranspId = usuario.perfil === "transportadora" ? transpId ?? usuario.transp_id : usuario.transp_id;
      let nomeFinal = usuario.nome;
      if (usuario.perfil === "transportadora" && finalTranspId) {
        const td = transportadorasDb[finalTranspId];
        if (td) nomeFinal = td.nome;
      }
      const role = roleFromPerfil(usuario.perfil);

      const newUser: User = {
        usuario_id: usuario.id,
        email: usuario.email,
        nome: nomeFinal,
        initials: makeInitials(nomeFinal),
        perfil: usuario.perfil,
        role,
        transp_id: finalTranspId,
      };

      setUser(newUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      router.push(role === "cerealista" ? "/dashboard" : "/painel");
      return true;
    }
  }

  async function logout() {
    if (SUPABASE_CONFIGURED) {
      const supabase = createClient();
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
    router.push("/login");
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      can: (modulo, acao) => (user ? podeExecutar(user.perfil, modulo, acao) : false),
      supabaseConfigured: SUPABASE_CONFIGURED,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Busca o registro de public.usuarios para um auth_user_id.
 * Retorna User montado com nome/perfil/transp_id.
 */
async function fetchUsuarioFromDb(authUserId: string, email: string): Promise<User | null> {
  const supabase = createClient();
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id, nome, perfil, transp_id, ativo")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !usuario || !usuario.ativo) return null;

  let nomeFinal: string = usuario.nome;
  let transpIdFinal: string | undefined = usuario.transp_id ?? undefined;

  // Se transportadora, busca nome_fantasia
  if (usuario.perfil === "transportadora" && transpIdFinal) {
    const { data: transp } = await supabase
      .from("transportadoras")
      .select("nome_fantasia")
      .eq("id", transpIdFinal)
      .single();
    if (transp?.nome_fantasia) nomeFinal = transp.nome_fantasia;
  }

  return {
    usuario_id: usuario.id,
    email,
    nome: nomeFinal,
    initials: makeInitials(nomeFinal),
    perfil: usuario.perfil as Perfil,
    role: roleFromPerfil(usuario.perfil as Perfil),
    transp_id: transpIdFinal,
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve estar dentro de <AuthProvider>");
  return ctx;
}

/** Atalho legacy para componentes da Etapa 1. */
export { perfilFromRole };
