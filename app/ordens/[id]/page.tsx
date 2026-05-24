import { createClient } from "@/lib/supabase/server";
import { getOCSnapshot } from "@/lib/api/queries.server";
import { OrdemDetalheClientView, type OrdemDetalheSSR } from "./OrdemDetalheClientView";
import type {
  Carga,
  Contrato,
  Local,
  Motorista,
  OrdemCarregamento,
  Produto,
  Produtor,
  Terminal,
  Transportadora,
  Veiculo,
} from "@/lib/types";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function OrdemDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!SUPABASE_CONFIGURED) {
    return <OrdemDetalheClientView ocId={id} dadosSSR={null} />;
  }

  const supabase = await createClient();

  // 1. Busca a OC primeiro (sem ela não tem o que fazer)
  const { data: ocRow } = await supabase
    .from("ordens_carregamento")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ocRow) {
    return <OrdemDetalheClientView ocId={id} dadosSSR={null} />;
  }
  const oc = ocRow as OrdemCarregamento;

  // 2. Resolve entidades vinculadas em paralelo
  const [
    contratoRes,
    cargaRes,
    transpRes,
    motoristaRes,
    veiculoRes,
    origemRes,
    destinoRes,
    terminalRes,
  ] = await Promise.all([
    supabase.from("contratos").select("*").eq("id", oc.contrato_id).maybeSingle(),
    supabase.from("cargas").select("*").eq("id", oc.carga_id).maybeSingle(),
    supabase.from("transportadoras").select("*").eq("id", oc.transp_id).maybeSingle(),
    oc.motorista_id
      ? supabase.from("motoristas").select("*").eq("id", oc.motorista_id).maybeSingle()
      : Promise.resolve({ data: null }),
    oc.veiculo_id
      ? supabase.from("veiculos").select("*").eq("id", oc.veiculo_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("locais").select("*").eq("id", oc.local_carg_id).maybeSingle(),
    oc.destino_local_id
      ? supabase.from("locais").select("*").eq("id", oc.destino_local_id).maybeSingle()
      : Promise.resolve({ data: null }),
    oc.terminal_id
      ? supabase.from("terminais").select("*").eq("id", oc.terminal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contrato = (contratoRes.data as Contrato | null) ?? null;
  const carga = (cargaRes.data as Carga | null) ?? null;
  const transp = (transpRes.data as Transportadora | null) ?? null;
  const motorista = (motoristaRes.data as Motorista | null) ?? null;
  const veiculo = (veiculoRes.data as Veiculo | null) ?? null;
  const origem = (origemRes.data as Local | null) ?? null;
  const destino = (destinoRes.data as Local | null) ?? null;
  const terminal = (terminalRes.data as Terminal | null) ?? null;

  // 3. Produto, Produtor e Snapshot completo (todos os anexos)
  let produto: Produto | null = null;
  let produtor: Produtor | null = null;
  const snapshotPromise = getOCSnapshot(oc.id);
  if (contrato) {
    const [pRes, prRes] = await Promise.all([
      supabase.from("produtos").select("*").eq("id", contrato.produto_id).maybeSingle(),
      supabase.from("produtores").select("*").eq("id", contrato.produtor_id).maybeSingle(),
    ]);
    produto = (pRes.data as Produto | null) ?? null;
    produtor = (prRes.data as Produtor | null) ?? null;
  }
  const snapshot = await snapshotPromise;

  const dados: OrdemDetalheSSR = {
    oc,
    contrato,
    carga,
    transp,
    motorista,
    veiculo,
    origem,
    destino,
    terminal,
    produto,
    produtor,
    snapshot,
  };

  return <OrdemDetalheClientView ocId={id} dadosSSR={dados} />;
}
