import {
  getAutorizacoes,
  getCargas,
  getOrdens,
  getPendenciasAbertas,
  getTransportadoras,
} from "@/lib/api/queries.server";
import { DashboardCerealistaClientView } from "./DashboardCerealistaClientView";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function DashboardCerealistaPage() {
  if (!SUPABASE_CONFIGURED) {
    return <DashboardCerealistaClientView dadosSSR={null} />;
  }

  const [cargas, ordens, pendencias, autorizacoes, transportadoras] = await Promise.all([
    getCargas(),
    getOrdens(),
    getPendenciasAbertas(),
    getAutorizacoes(),
    getTransportadoras(),
  ]);

  return (
    <DashboardCerealistaClientView
      dadosSSR={{ cargas, ordens, pendencias, autorizacoes, transportadoras }}
    />
  );
}
