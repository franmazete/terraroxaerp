import { createClient } from "@/lib/supabase/server";
import {
  getAutorizacoes,
  getCargas,
  getOCSnapshotsEmBatch,
  getTransportadoras,
} from "@/lib/api/queries.server";
import { calcChecklist, type OCSnapshot } from "@/lib/domain/checklist";
import { PendenciasClientView, type CargaPendencia } from "./PendenciasClientView";
import type { OrdemCarregamento, Transportadora } from "@/lib/types";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function PendenciasPage() {
  if (!SUPABASE_CONFIGURED) {
    return <PendenciasClientView dadosSSR={null} ehTransp={false} />;
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return <PendenciasClientView dadosSSR={null} ehTransp={false} />;
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("perfil, transp_id")
    .eq("auth_user_id", authUser.id)
    .single();
  const ehTransp = usuario?.perfil === "transportadora";
  const meuTid = usuario?.transp_id as string | undefined;

  // 1. OCs ativas (não finalizadas/canceladas). Filtra por transp em modo transp.
  let q = supabase
    .from("ordens_carregamento")
    .select("*")
    .not("status", "in", "(finalizada,cancelada)")
    .order("criada_em", { ascending: false });
  if (ehTransp && meuTid) q = q.eq("transp_id", meuTid);
  const { data: ocsRows } = await q;
  const ocs = (ocsRows ?? []) as OrdemCarregamento[];

  // 2. Snapshots em batch + dados auxiliares em paralelo
  const ocIds = ocs.map((o) => o.id);
  const [snapshots, cargasTodas, transportadoras, autorizacoes] = await Promise.all([
    getOCSnapshotsEmBatch(ocIds),
    getCargas(),
    getTransportadoras() as Promise<Transportadora[]>,
    getAutorizacoes(),
  ]);

  // 3. Constrói lista unificada: OCs em andamento + reservas aprovadas sem autorização
  const itens: CargaPendencia[] = [];

  // 3a. OCs em andamento — uma entrada por OC, com seu checklist completo
  for (const snap of snapshots) {
    const oc = snap.oc;
    // Pra contextualizar, achamos a carga relacionada à reserva da OC
    const carga = cargasTodas.find((c) => c.reservas.some((r) => r.id === oc.reserva_id));
    const passos = calcChecklist(snap as OCSnapshot);
    const transp = transportadoras.find((t) => t.id === oc.transp_id);
    itens.push({
      kind: "oc",
      id: oc.id,
      ocId: oc.id,
      ocNumero: oc.numero,
      produto: carga?.produto ?? "—",
      origem: carga?.origem ?? "—",
      destino: carga?.destino ?? null,
      transpNome: transp?.nome_fantasia ?? "—",
      transpId: oc.transp_id,
      criadaEm: oc.emitida_em,
      refugada: !!oc.refugada,
      passos,
    });
  }

  // 3b. Reservas APROVADAS sem autorização → fase pré-OC (Sua vez: anexar autorização)
  for (const carga of cargasTodas) {
    for (const r of carga.reservas ?? []) {
      if (r.status !== "aprovada") continue;
      if (ehTransp && meuTid && r.transp_id !== meuTid) continue;
      const temAutorizacao = autorizacoes.some((a) => a.reserva_id === r.id);
      if (temAutorizacao) continue; // já virou OC
      const transp = transportadoras.find((t) => t.id === r.transp_id);
      itens.push({
        kind: "reserva_aprovada",
        id: r.id,
        ocId: null,
        ocNumero: null,
        produto: carga.produto,
        origem: carga.origem,
        destino: carga.destino ?? null,
        transpNome: transp?.nome_fantasia ?? "—",
        transpId: r.transp_id,
        criadaEm: r.data,
        refugada: false,
        passos: [
          {
            passo: "autorizacao_carregamento",
            label: "Autorização de carregamento",
            setor: "transportadora",
            status: "pendente",
            hint: "Reserva aprovada — anexe a autorização para gerar a OC",
          },
        ],
      });
    }
  }

  return <PendenciasClientView dadosSSR={itens} ehTransp={ehTransp} />;
}
