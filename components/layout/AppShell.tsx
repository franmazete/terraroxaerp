"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Role } from "@/lib/types";
import { NavDropdown } from "./NavDropdown";
import { NotificacoesBell } from "./NotificacoesBell";
import { Logo } from "@/components/ui/Logo";
import { NAV_CEREALISTA, NAV_TRANSPORTADORA, type NavItem, type NavSection } from "./nav-config";
import s from "./Topbar.module.css";

interface Props {
  role: Role;
  children: ReactNode;
}

export function AppShell({ role, children }: Props) {
  const { user, ready, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === "cerealista" ? "/dashboard" : "/painel");
    }
  }, [ready, user, role, router]);

  if (!ready || !user || user.role !== role) return null;

  const sections = role === "cerealista" ? NAV_CEREALISTA : NAV_TRANSPORTADORA;

  function itemAllowed(item: NavItem): boolean {
    if (item.perfis && !item.perfis.includes(user!.perfil)) return false;
    if (item.requires && !can(item.requires.modulo, item.requires.acao)) return false;
    return true;
  }

  function sectionItems(section: NavSection): NavItem[] {
    return section.items.filter(itemAllowed);
  }

  const badgeLabel = role === "cerealista" ? "🏢 Cerealista / Logística" : "🚚 Transportadora";

  return (
    <div className={s.shell}>
      <div className={s.topbar}>
        <div className={s.brand} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo empresa="terra-roxa" height={36} />
          <span style={{ fontSize: 11, color: "var(--muted)", borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
            Portal de Cargas
          </span>
        </div>
        <span className={`${s.roleBadge} ${role === "cerealista" ? s.roleCerealista : s.roleTransp}`}>
          {badgeLabel}
        </span>

        <nav className={s.nav}>
          {sections.map((section) => {
            const items = sectionItems(section);
            if (items.length === 0) return null;
            if (section.variant === "inline") {
              return items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${s.navItem} ${pathname === item.href ? s.active : ""}`}
                >
                  {item.label}
                </Link>
              ));
            }
            return <NavDropdown key={section.id} label={section.label} items={items} />;
          })}
        </nav>

        <div className={s.right}>
          <NotificacoesBell />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
            <span className={s.userLabel}>{user.nome}</span>
            <span style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {user.perfil}
            </span>
          </div>
          <div className={s.avatar}>{user.initials}</div>
          <button className={s.logout} onClick={logout}>
            Sair
          </button>
        </div>
      </div>
      <main id="conteudo-principal" className={s.content}>{children}</main>
    </div>
  );
}
