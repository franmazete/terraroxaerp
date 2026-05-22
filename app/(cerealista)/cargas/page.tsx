import { CargasClientView } from "./CargasClientView";
import { getCargas } from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function GerenciarCargasPage() {
  if (!SUPABASE_CONFIGURED) {
    return <CargasClientView cargasSSR={null} />;
  }
  const cargas = await getCargas();
  return <CargasClientView cargasSSR={cargas} />;
}
