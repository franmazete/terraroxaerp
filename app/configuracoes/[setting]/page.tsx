import { notFound } from "next/navigation";
import { UsuariosView } from "@/components/cadastros/UsuariosView";
import { PermissoesView } from "@/components/cadastros/PermissoesView";
import { getTransportadoras, getUsuarios } from "@/lib/api/queries.server";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("xxxxxxxx");

interface Props {
  params: Promise<{ setting: string }>;
}

export default async function ConfigPage({ params }: Props) {
  const { setting } = await params;
  switch (setting) {
    case "usuarios": {
      if (SUPABASE_CONFIGURED) {
        const [usuarios, transportadoras] = await Promise.all([
          getUsuarios(),
          getTransportadoras(),
        ]);
        return <UsuariosView usuariosSSR={usuarios} transportadorasSSR={transportadoras} />;
      }
      return <UsuariosView />;
    }
    case "permissoes":
      return <PermissoesView />;
    default:
      notFound();
  }
}
