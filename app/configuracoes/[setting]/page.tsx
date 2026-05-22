import { notFound } from "next/navigation";
import { UsuariosView } from "@/components/cadastros/UsuariosView";
import { PermissoesView } from "@/components/cadastros/PermissoesView";

interface Props {
  params: Promise<{ setting: string }>;
}

export default async function ConfigPage({ params }: Props) {
  const { setting } = await params;
  switch (setting) {
    case "usuarios":
      return <UsuariosView />;
    case "permissoes":
      return <PermissoesView />;
    default:
      notFound();
  }
}
