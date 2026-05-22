import { PendenciasClientView } from "./PendenciasClientView";
import { getPendenciasAbertas } from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function PendenciasPage() {
  if (!SUPABASE_CONFIGURED) {
    return <PendenciasClientView pendenciasSSR={null} />;
  }
  // RLS já filtra automaticamente:
  // — cerealista vê tudo; transp vê só do setor "transportadora" + seu transp_id
  const pendencias = await getPendenciasAbertas();
  return <PendenciasClientView pendenciasSSR={pendencias} />;
}
