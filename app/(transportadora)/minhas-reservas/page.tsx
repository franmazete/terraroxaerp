import { createClient } from "@/lib/supabase/server";
import { getAutorizacoes, getCargas } from "@/lib/api/queries.server";
import { MinhasReservasClientView } from "./MinhasReservasClientView";
import type { Carga, OrdemCarregamento } from "@/lib/types";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function MinhasReservasPage() {
  if (!SUPABASE_CONFIGURED) {
    return <MinhasReservasClientView dadosSSR={null} />;
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return <MinhasReservasClientView dadosSSR={null} />;

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("transp_id")
    .eq("auth_user_id", authUser.id)
    .single();
  const tid = usuario?.transp_id as string | undefined;
  if (!tid) return <MinhasReservasClientView dadosSSR={null} />;

  const [cargasTodas, ordens, autorizacoes] = await Promise.all([
    getCargas(),
    (async () => {
      const { data, error } = await supabase
        .from("ordens_carregamento")
        .select("*")
        .eq("transp_id", tid)
        .order("criada_em", { ascending: false });
      if (error) {
        console.error("[minhas-reservas] ordens:", error.message);
        return [] as OrdemCarregamento[];
      }
      return (data ?? []) as OrdemCarregamento[];
    })(),
    getAutorizacoes(),
  ]);

  // Filtra para mostrar só cargas que tenham ao menos uma reserva da minha transp
  // (mantemos o objeto Carga inteiro porque a UI usa carga.produto, carga.origem etc)
  const cargas: Carga[] = cargasTodas
    .map((c) => ({ ...c, reservas: (c.reservas ?? []).filter((r) => r.transp_id === tid) }))
    .filter((c) => c.reservas.length > 0);

  return (
    <MinhasReservasClientView dadosSSR={{ cargas, ordens, autorizacoes }} />
  );
}
