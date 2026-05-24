import { createClient } from "@/lib/supabase/server";
import {
  getContratos,
  getMotoristas,
  getOrdens,
  getTransportadoras,
} from "@/lib/api/queries.server";
import { OrdensClientView, type OrdensSSR } from "./OrdensClientView";
import type { OrdemCarregamento } from "@/lib/types";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function OrdensPage() {
  if (!SUPABASE_CONFIGURED) {
    return <OrdensClientView dadosSSR={null} />;
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  // Descobre transp_id quando o usuário for transportadora
  let transpId: string | undefined;
  if (authUser) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("perfil, transp_id")
      .eq("auth_user_id", authUser.id)
      .single();
    if (usuario?.perfil === "transportadora" && usuario.transp_id) {
      transpId = usuario.transp_id;
    }
  }

  // OCs filtradas pelo escopo do usuário
  let ordens: OrdemCarregamento[] = [];
  if (transpId) {
    const { data } = await supabase
      .from("ordens_carregamento")
      .select("*")
      .eq("transp_id", transpId)
      .order("emitida_em", { ascending: false });
    ordens = (data ?? []) as OrdemCarregamento[];
  } else {
    ordens = await getOrdens();
  }

  // Dados auxiliares pra mostrar nome de transp/motorista/contrato em cada linha
  const [transportadoras, motoristas, contratos] = await Promise.all([
    getTransportadoras(),
    getMotoristas(),
    getContratos(),
  ]);

  const dados: OrdensSSR = { ordens, transportadoras, motoristas, contratos };
  return <OrdensClientView dadosSSR={dados} />;
}
