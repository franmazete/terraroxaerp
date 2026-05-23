import { CargasClientView } from "./CargasClientView";
import {
  getCargas,
  getClientes,
  getContratos,
  getLocais,
  getProdutos,
  getTransportadoras,
} from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

export default async function GerenciarCargasPage() {
  if (!SUPABASE_CONFIGURED) {
    return (
      <CargasClientView
        cargasSSR={null}
        contratosSSR={null}
        produtosSSR={null}
        locaisSSR={null}
        clientesSSR={null}
        transportadorasSSR={null}
      />
    );
  }
  const [cargas, contratos, produtos, locais, clientes, transportadoras] = await Promise.all([
    getCargas(),
    getContratos(),
    getProdutos(),
    getLocais(),
    getClientes(),
    getTransportadoras(),
  ]);
  return (
    <CargasClientView
      cargasSSR={cargas}
      contratosSSR={contratos}
      produtosSSR={produtos}
      locaisSSR={locais}
      clientesSSR={clientes}
      transportadorasSSR={transportadoras}
    />
  );
}
