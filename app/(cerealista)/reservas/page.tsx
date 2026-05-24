import { getCargas } from "@/lib/api/queries.server";
import { ReservasClientView } from "./ReservasClientView";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function ReservasPage() {
  if (!SUPABASE_CONFIGURED) {
    return <ReservasClientView cargasSSR={null} />;
  }
  const cargas = await getCargas();
  return <ReservasClientView cargasSSR={cargas} />;
}
