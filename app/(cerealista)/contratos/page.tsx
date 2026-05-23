import { ContratosClientView } from "./ContratosClientView";
import {
  getCargas,
  getClientes,
  getContratos,
  getLocais,
  getOrdens,
  getProdutores,
  getProdutos,
  getTerminais,
} from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

/**
 * Server Component (Bloco B2.d — primeira página migrada para Supabase).
 *
 * Quando NEXT_PUBLIC_SUPABASE_URL está configurado, busca os dados via
 * lib/api/queries.server.ts (RSC → Postgres direto) e passa pra view client.
 *
 * Quando NÃO configurado (modo dev sem .env.local), passa null e a view
 * client cai no useDataStore() — assim o app continua rodando 100% mockado.
 */
export default async function ContratosPage() {
  if (!SUPABASE_CONFIGURED) {
    return (
      <ContratosClientView
        contratosSSR={null}
        produtosSSR={null}
        produtoresSSR={null}
        clientesSSR={null}
        cargasSSR={null}
        ordensSSR={null}
        locaisSSR={null}
        terminaisSSR={null}
      />
    );
  }

  const [contratos, produtos, produtores, clientes, cargas, ordens, locais, terminais] = await Promise.all([
    getContratos(),
    getProdutos(),
    getProdutores(),
    getClientes(),
    getCargas(),
    getOrdens(),
    getLocais(),
    getTerminais(),
  ]);

  return (
    <ContratosClientView
      contratosSSR={contratos}
      produtosSSR={produtos}
      produtoresSSR={produtores}
      clientesSSR={clientes}
      cargasSSR={cargas}
      ordensSSR={ordens}
      locaisSSR={locais}
      terminaisSSR={terminais}
    />
  );
}
