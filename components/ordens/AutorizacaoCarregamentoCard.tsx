"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import type {
  Local,
  Motorista,
  OrdemCarregamento,
  Produtor,
  Transportadora,
  Veiculo,
} from "@/lib/types";

interface Props {
  oc: OrdemCarregamento;
  produtoNome: string | null;
  transp: Transportadora | null;
  motorista: Motorista | null;
  veiculo: Veiculo | null;
  origem: Local | null;
  produtor: Produtor | null;
}

/**
 * Card destacado no topo da OC mostrando a "Autorização de Carregamento":
 * a ordem interna da Terra Roxa que autoriza a transportadora a carregar.
 *
 * Mostra: produto, quantidade, motorista (nome+CPF), placa, município/endereço
 * origem e nome do produtor. Equivale a um romaneio simplificado em tela.
 */
export function AutorizacaoCarregamentoCard({
  oc,
  produtoNome,
  transp,
  motorista,
  veiculo,
  origem,
  produtor,
}: Props) {
  const enderecoLinha = origem?.endereco
    ? [
        origem.endereco.logradouro,
        origem.endereco.numero,
        origem.endereco.bairro,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

  const placa = veiculo
    ? `${veiculo.placa_cavalo}${veiculo.placa_carreta ? ` + ${veiculo.placa_carreta}` : ""}`
    : "—";

  return (
    <Card
      className="section-gap"
      style={{ borderLeft: "4px solid var(--g600)", background: "var(--g50, #f6f9f4)" }}
    >
      <CardHeader>
        <CardTitle>
          📋 Carregamento Autorizado — Ordem Interna
          <span style={{ marginLeft: 8 }}>
            <Badge tone="green">✓ {oc.numero}</Badge>
          </span>
        </CardTitle>
      </CardHeader>

      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Terra Roxa autoriza a transportadora <strong>{transp?.nome_fantasia ?? "—"}</strong> a
        carregar a mercadoria abaixo, emitida em <strong>{fmtDate(oc.emitida_em)}</strong>.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <Campo label="Produto" valor={produtoNome ?? "—"} />
        <Campo label="Quantidade autorizada" valor={fmtKg(oc.peso_previsto_kg)} destaque />
        <Campo label="Motorista" valor={motorista?.nome ?? "—"} />
        <Campo
          label="CPF do motorista"
          valor={motorista?.cpf ?? "—"}
          mono
        />
        <Campo label="Placa do veículo" valor={placa} mono />
        <Campo
          label="Município origem"
          valor={origem ? `${origem.cidade}/${origem.uf}` : "—"}
        />
        <Campo
          label="Endereço origem"
          valor={enderecoLinha}
          colSpan2
        />
        <Campo label="Produtor / Fazenda" valor={produtor?.nome ?? "—"} />
      </div>

      <div
        style={{
          marginTop: 4,
          padding: "8px 10px",
          background: "rgba(255,255,255,0.6)",
          borderRadius: "var(--radius)",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        <strong>Documento interno Terra Roxa.</strong> Esta ordem autoriza a transportadora a
        retirar a quantidade especificada no local de origem indicado. A operação está vinculada
        à autorização de carregamento anexada e à reserva aprovada anteriormente.
      </div>
    </Card>
  );
}

function Campo({
  label,
  valor,
  mono,
  destaque,
  colSpan2,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  destaque?: boolean;
  colSpan2?: boolean;
}) {
  return (
    <div style={colSpan2 ? { gridColumn: "span 2", minWidth: 0 } : { minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--hint)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: destaque ? 18 : 14,
          fontWeight: destaque ? 700 : 600,
          color: destaque ? "var(--g700)" : "var(--text)",
          fontFamily: mono ? "DM Mono, monospace" : undefined,
          wordBreak: "break-word",
        }}
      >
        {valor}
      </div>
    </div>
  );
}
