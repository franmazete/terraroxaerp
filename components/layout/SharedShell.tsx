"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppShell } from "./AppShell";

/**
 * Shell para rotas compartilhadas (fora dos route groups).
 * Escolhe automaticamente o AppShell cerealista ou transportadora
 * baseado no perfil do usuário logado.
 */
export function SharedShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;
  return <AppShell role={user.role}>{children}</AppShell>;
}
