import { createClient } from "@/lib/supabase/server";
import { getCargas, getAutorizacoes } from "@/lib/api/queries.server";
import { PainelTranspClientView } from "./PainelTranspClientView";
import type { OrdemCarregamento, Pendencia } from "@/lib/types";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function PainelTranspPage() {
  if (!SUPABASE_CONFIGURED) {
    return <PainelTranspClientView dadosSSR={null} />;
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return <PainelTranspClientView dadosSSR={null} />;

  // Descobre transp_id do usuário
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("transp_id")
    .eq("auth_user_id", authUser.id)
    .single();
  const tid = usuario?.transp_id as string | undefined;
  if (!tid) return <PainelTranspClientView dadosSSR={null} />;

  // Carrega em paralelo só o que o painel precisa
  const [cargas, ordens, pendencias, autorizacoes] = await Promise.all([
    getCargas(),
    // OCs da transp
    (async () => {
      const { data, error } = await supabase
        .from("ordens_carregamento")
        .select("*")
        .eq("transp_id", tid)
        .order("criada_em", { ascending: false });
      if (error) {
        console.error("[painel] ordens:", error.message);
        return [] as OrdemCarregamento[];
      }
      return (data ?? []) as OrdemCarregamento[];
    })(),
    // Pendências da transp (setor=transportadora e da própria transp)
    (async () => {
      const { data, error } = await supabase
        .from("pendencias")
        .select("*")
        .eq("status", "aberta")
        .eq("setor_responsavel", "transportadora")
        .or(`transp_id.is.null,transp_id.eq.${tid}`)
        .order("vence_em", { ascending: true });
      if (error) {
        console.error("[painel] pendencias:", error.message);
        return [] as Pendencia[];
      }
      return (data ?? []) as Pendencia[];
    })(),
    getAutorizacoes(),
  ]);

  return (
    <PainelTranspClientView
      dadosSSR={{ cargas, ordens, pendencias, autorizacoes }}
    />
  );
}
