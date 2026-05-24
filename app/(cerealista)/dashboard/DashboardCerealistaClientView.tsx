"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { DashComercial } from "@/components/dashboards/DashComercial";
import { DashLogistica } from "@/components/dashboards/DashLogistica";
import { DashFiscal } from "@/components/dashboards/DashFiscal";
import { DashFinanceiro } from "@/components/dashboards/DashFinanceiro";
import type { AutorizacaoCarregamento, Carga, OrdemCarregamento, Pendencia, Transportadora } from "@/lib/types";

export interface DashSSRData {
  cargas: Carga[];
  ordens: OrdemCarregamento[];
  pendencias: Pendencia[];
  autorizacoes: AutorizacaoCarregamento[];
  transportadoras: Transportadora[];
}

interface Props {
  dadosSSR?: DashSSRData | null;
}

export function DashboardCerealistaClientView({ dadosSSR = null }: Props) {
  const { user } = useAuth();
  // Roteamento por perfil — cada setor vê seu dashboard específico (Bloco I.8)
  switch (user?.perfil) {
    case "comercial":
      return <DashComercial dadosSSR={dadosSSR} />;
    case "fiscal":
      return <DashFiscal dadosSSR={dadosSSR} />;
    case "financeiro":
      return <DashFinanceiro dadosSSR={dadosSSR} />;
    case "admin":
    case "logistica":
    default:
      return <DashLogistica dadosSSR={dadosSSR} />;
  }
}
