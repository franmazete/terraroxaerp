import { notFound } from "next/navigation";
import { TransportadorasView } from "@/components/cadastros/TransportadorasView";
import { MotoristasView } from "@/components/cadastros/MotoristasView";
import { VeiculosView } from "@/components/cadastros/VeiculosView";
import { ProdutoresClientesView } from "@/components/cadastros/ProdutoresClientesView";
import { TerminaisView } from "@/components/cadastros/TerminaisView";
import { LocaisView } from "@/components/cadastros/LocaisView";
import { ProdutosView } from "@/components/cadastros/ProdutosView";
import {
  getClientes,
  getLocais,
  getMotoristas,
  getProdutores,
  getProdutos,
  getTerminais,
  getTransportadoras,
  getVeiculos,
} from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

interface Props {
  params: Promise<{ entity: string }>;
}

export default async function CadastroPage({ params }: Props) {
  const { entity } = await params;
  switch (entity) {
    case "transportadoras": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getTransportadoras() : null;
      return <TransportadorasView dadosSSR={dadosSSR} />;
    }
    case "motoristas": {
      if (SUPABASE_CONFIGURED) {
        const [motoristas, transportadoras] = await Promise.all([
          getMotoristas(),
          getTransportadoras(),
        ]);
        return <MotoristasView dadosSSR={motoristas} transportadorasSSR={transportadoras} />;
      }
      return <MotoristasView />;
    }
    case "veiculos": {
      if (SUPABASE_CONFIGURED) {
        const [veiculos, transportadoras] = await Promise.all([
          getVeiculos(),
          getTransportadoras(),
        ]);
        return <VeiculosView dadosSSR={veiculos} transportadorasSSR={transportadoras} />;
      }
      return <VeiculosView />;
    }
    case "produtores": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getProdutores() : null;
      return <ProdutoresClientesView tipo="produtores" dadosSSR={dadosSSR} />;
    }
    case "clientes": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getClientes() : null;
      return <ProdutoresClientesView tipo="clientes" dadosSSR={dadosSSR} />;
    }
    case "terminais": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getTerminais() : null;
      return <TerminaisView dadosSSR={dadosSSR} />;
    }
    case "locais": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getLocais() : null;
      return <LocaisView dadosSSR={dadosSSR} />;
    }
    case "produtos": {
      const dadosSSR = SUPABASE_CONFIGURED ? await getProdutos() : null;
      return <ProdutosView dadosSSR={dadosSSR} />;
    }
    default:
      notFound();
  }
}
