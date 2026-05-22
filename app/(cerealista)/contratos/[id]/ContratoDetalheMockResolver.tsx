"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { useDataStore } from "@/lib/data-store";
import { ContratoDetalheClientView } from "./ContratoDetalheClientView";

/**
 * Em modo mock (sem Supabase configurado), resolve o contrato pelo id
 * lendo do useDataStore. Mantém compat com dev local.
 */
export function ContratoDetalheMockResolver({ id }: { id: string }) {
  const { contratos, produtos, produtores, clientes, locais, terminais, cargas, ordens } = useDataStore();

  const dados = useMemo(() => {
    const contrato = contratos.find((c) => c.id === id);
    if (!contrato) return null;
    const produto = produtos.find((p) => p.id === contrato.produto_id) ?? null;
    const produtor = produtores.find((p) => p.id === contrato.produtor_id) ?? null;
    const cliente = contrato.cliente_id ? clientes.find((c) => c.id === contrato.cliente_id) ?? null : null;
    const origem = locais.find((l) => l.id === contrato.local_origem_id) ?? null;
    const destino = contrato.destino_local_id ? locais.find((l) => l.id === contrato.destino_local_id) ?? null : null;
    const terminal = contrato.terminal_id ? terminais.find((t) => t.id === contrato.terminal_id) ?? null : null;
    const cargasDoContrato = cargas.filter((c) => c.contrato_id === contrato.id);
    const ordensDoContrato = ordens.filter((o) => o.contrato_id === contrato.id);
    return { contrato, produto, produtor, cliente, origem, destino, terminal, cargasDoContrato, ordensDoContrato };
  }, [id, contratos, produtos, produtores, clientes, locais, terminais, cargas, ordens]);

  if (!dados) notFound();

  return <ContratoDetalheClientView {...dados} />;
}
