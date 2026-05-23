import { DisponiveisClientView } from "./DisponiveisClientView";
import { getCargas } from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function DisponiveisPage() {
  if (!SUPABASE_CONFIGURED) {
    return <DisponiveisClientView cargasSSR={null} />;
  }
  // Em modo Supabase, getCargas() já respeita a RLS:
  // transp vê só cargas com status disponivel/parcial (filtro adicional no client por allowlist)
  const cargas = await getCargas();
  return <DisponiveisClientView cargasSSR={cargas} />;
}
