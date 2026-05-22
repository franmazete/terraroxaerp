"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { DashComercial } from "@/components/dashboards/DashComercial";
import { DashLogistica } from "@/components/dashboards/DashLogistica";
import { DashFiscal } from "@/components/dashboards/DashFiscal";
import { DashFinanceiro } from "@/components/dashboards/DashFinanceiro";

export default function DashboardCerealistaPage() {
  const { user } = useAuth();
  // Roteamento por perfil — cada setor vê seu dashboard específico (Bloco I.8)
  switch (user?.perfil) {
    case "comercial":
      return <DashComercial />;
    case "fiscal":
      return <DashFiscal />;
    case "financeiro":
      return <DashFinanceiro />;
    case "admin":
    case "logistica":
    default:
      return <DashLogistica />;
  }
}
