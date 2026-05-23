import { notFound } from "next/navigation";
import { ContratoDetalheClientView } from "./ContratoDetalheClientView";
import { ContratoDetalheMockResolver } from "./ContratoDetalheMockResolver";
import {
  getCargas,
  getClientes,
  getContrato,
  getLocais,
  getOrdens,
  getProdutores,
  getProdutos,
  getTerminais,
  getTransportadoras,
} from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function ContratoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!SUPABASE_CONFIGURED) {
    // Modo mock — resolver client lê do useDataStore
    return <ContratoDetalheMockResolver id={id} />;
  }

  // Modo Supabase: busca tudo no servidor em paralelo
  const [contrato, produtos, produtores, clientes, locais, terminais, cargas, ordens, transportadoras] = await Promise.all([
    getContrato(id),
    getProdutos(),
    getProdutores(),
    getClientes(),
    getLocais(),
    getTerminais(),
    getCargas(),
    getOrdens(),
    getTransportadoras(),
  ]);

  if (!contrato) notFound();

  const produto = produtos.find((p) => p.id === contrato.produto_id) ?? null;
  const produtor = produtores.find((p) => p.id === contrato.produtor_id) ?? null;
  const cliente = contrato.cliente_id ? clientes.find((c) => c.id === contrato.cliente_id) ?? null : null;
  const origem = locais.find((l) => l.id === contrato.local_origem_id) ?? null;
  const destino = contrato.destino_local_id ? locais.find((l) => l.id === contrato.destino_local_id) ?? null : null;
  const terminal = contrato.terminal_id ? terminais.find((t) => t.id === contrato.terminal_id) ?? null : null;
  const cargasDoContrato = cargas.filter((c) => c.contrato_id === contrato.id);
  const ordensDoContrato = ordens.filter((o) => o.contrato_id === contrato.id);

  return (
    <ContratoDetalheClientView
      contrato={contrato}
      produto={produto}
      produtor={produtor}
      cliente={cliente}
      origem={origem}
      destino={destino}
      terminal={terminal}
      cargasDoContrato={cargasDoContrato}
      ordensDoContrato={ordensDoContrato}
      produtosSSR={produtos}
      clientesSSR={clientes}
      locaisSSR={locais}
      terminaisSSR={terminais}
      transportadorasSSR={transportadoras}
    />
  );
}
