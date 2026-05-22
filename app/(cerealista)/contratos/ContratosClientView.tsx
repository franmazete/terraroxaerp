"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatBox } from "@/components/ui/StatBox";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CadastroHeader } from "@/components/cadastros/CadastroHeader";
import { SearchInput } from "@/components/cadastros/SearchInput";
import { LancarContratoModal } from "@/components/contratos/LancarContratoModal";
import { useDataStore } from "@/lib/data-store";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import { downloadCSV, fmtDataCSV } from "@/lib/domain/csv";
import { percentualContratoUsado, saldoColor } from "@/lib/domain/saldo";
import type { Carga, Cliente, Contrato, ContratoStatus, OrdemCarregamento, Produto, Produtor } from "@/lib/types";

const STATUS_OPTIONS: { v: ContratoStatus; label: string; tone: "green" | "teal" | "red" | "gray" }[] = [
  { v: "ativo", label: "Ativo", tone: "green" },
  { v: "concluido", label: "Concluído", tone: "teal" },
  { v: "cancelado", label: "Cancelado", tone: "red" },
  { v: "rascunho", label: "Rascunho", tone: "gray" },
];

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock e devemos ler do store. */
  contratosSSR: Contrato[] | null;
  produtosSSR: Produto[] | null;
  produtoresSSR: Produtor[] | null;
  clientesSSR: Cliente[] | null;
  cargasSSR: Carga[] | null;
  ordensSSR: OrdemCarregamento[] | null;
}

/**
 * View client-side que renderiza a listagem de contratos.
 *
 * Em modo Supabase: recebe `contratosSSR` etc via props (já vieram do servidor).
 * Em modo mock: passa `null` e a view cai no `useDataStore()` como antes.
 *
 * Esse padrão permite migração incremental — outras páginas vão seguir igual.
 */
export function ContratosClientView({
  contratosSSR,
  produtosSSR,
  produtoresSSR,
  clientesSSR,
  cargasSSR,
  ordensSSR,
}: Props) {
  const store = useDataStore();
  const contratos = contratosSSR ?? store.contratos;
  const produtos = produtosSSR ?? store.produtos;
  const produtores = produtoresSSR ?? store.produtores;
  const clientes = clientesSSR ?? store.clientes;
  const cargas = cargasSSR ?? store.cargas;
  const ordens = ordensSSR ?? store.ordens;

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return contratos.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      const prod = produtores.find((p) => p.id === c.produtor_id)?.nome.toLowerCase() ?? "";
      const cli = clientes.find((cl) => cl.id === c.cliente_id)?.nome.toLowerCase() ?? "";
      return c.numero.toLowerCase().includes(q) || prod.includes(q) || cli.includes(q);
    });
  }, [contratos, search, filtroStatus, produtores, clientes]);

  const stats = useMemo(() => {
    const ativos = contratos.filter((c) => c.status === "ativo");
    const disponiveis = ativos.filter((c) => c.disponivel && c.saldo_kg > 0);
    const totalKg = ativos.reduce((s, c) => s + c.qtd_kg_total, 0);
    const saldoTotal = ativos.reduce((s, c) => s + c.saldo_kg, 0);
    return {
      ativos: ativos.length,
      disponiveis: disponiveis.length,
      totalKg,
      saldoTotal,
      total: contratos.length,
    };
  }, [contratos]);

  return (
    <>
      <CadastroHeader
        title="Contratos"
        description="Lançamento e gestão de contratos com produtores e clientes compradores"
        icon="📑"
        count={contratos.length}
        onNovo={() => setModalOpen(true)}
        novoLabel="Lançar Contrato"
        extras={
          <>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todos status</option>
              {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Número, produtor ou cliente..." />
            <Button
              size="sm"
              onClick={() =>
                downloadCSV(
                  lista,
                  [
                    { header: "Número", value: (c) => c.numero_manual || c.numero },
                    { header: "Tipo", value: (c) => c.tipo_contrato ?? "" },
                    { header: "Produtor", value: (c) => produtores.find((p) => p.id === c.produtor_id)?.nome ?? "" },
                    { header: "Cliente", value: (c) => clientes.find((x) => x.id === c.cliente_id)?.nome ?? "" },
                    { header: "Produto", value: (c) => produtos.find((p) => p.id === c.produto_id)?.nome ?? "" },
                    { header: "Qtd Total (kg)", value: (c) => c.qtd_kg_total },
                    { header: "Saldo (kg)", value: (c) => c.saldo_kg },
                    { header: "Valor Total (R$)", value: (c) => c.valor_total ?? "" },
                    { header: "Status", value: (c) => c.status },
                    { header: "Disponível", value: (c) => (c.disponivel ? "Sim" : "Não") },
                    { header: "Emissão", value: (c) => fmtDataCSV(c.data_emissao) },
                    { header: "Vencimento", value: (c) => fmtDataCSV(c.data_vencimento) },
                  ],
                  `contratos_${new Date().toISOString().split("T")[0]}`,
                )
              }
              disabled={lista.length === 0}
            >
              📥 CSV
            </Button>
          </>
        }
      />

      <div className="grid-4 section-gap">
        <StatBox tone="g" label="Disponíveis para Publicar" value={stats.disponiveis} sub={`de ${stats.ativos} ativos`} />
        <StatBox tone="b" label="Qtd Contratada" value={fmtKg(stats.totalKg)} sub="soma dos ativos" />
        <StatBox tone="t" label="Saldo Disponível" value={fmtKg(stats.saldoTotal)} sub="ainda não gerado em cargas" />
        <StatBox tone="a" label="Já Despachado" value={fmtKg(stats.totalKg - stats.saldoTotal)} sub="virou carga" />
      </div>

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="📑">Nenhum contrato encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Produtor</th>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Saldo</th>
                <th>Cliente</th>
                <th>Vigência</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const st = STATUS_OPTIONS.find((o) => o.v === c.status)!;
                const prod = produtos.find((p) => p.id === c.produto_id);
                const produtor = produtores.find((p) => p.id === c.produtor_id);
                const cliente = clientes.find((cl) => cl.id === c.cliente_id);
                const pct = percentualContratoUsado(c);
                const cargasCount = cargas.filter((cg) => cg.contrato_id === c.id).length;
                const ordensCount = ordens.filter((o) => o.contrato_id === c.id).length;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contratos/${c.id}`} style={{ fontFamily: "DM Mono, monospace", color: "var(--g700)", fontWeight: 600 }}>
                        {c.numero_manual || c.numero}
                      </Link>
                      <div style={{ fontSize: 10, color: "var(--hint)" }}>
                        {cargasCount} cargas · {ordensCount} OCs
                      </div>
                    </td>
                    <td>{produtor?.nome ?? "—"}</td>
                    <td><strong>{prod?.nome ?? "—"}</strong></td>
                    <td><strong>{fmtKg(c.qtd_kg_total)}</strong></td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ fontWeight: 600, color: c.saldo_kg === 0 ? "var(--r600)" : "var(--g600)", fontSize: 12 }}>
                        {fmtKg(c.saldo_kg)}
                      </div>
                      <ProgressBar percent={pct} color={saldoColor(pct)} className="" />
                    </td>
                    <td>{cliente?.nome ?? <span style={{ color: "var(--hint)" }}>—</span>}</td>
                    <td>
                      <div style={{ fontSize: 11 }}>{c.data_emissao ? fmtDate(c.data_emissao) : "—"}</div>
                      <div style={{ fontSize: 10, color: "var(--hint)" }}>→ {c.data_vencimento ? fmtDate(c.data_vencimento) : "—"}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {c.disponivel ? (
                          <Badge tone="green">✓ Publicável</Badge>
                        ) : c.status === "ativo" ? (
                          <Badge tone="amber">⏸ Indisponível</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <Link href={`/contratos/${c.id}`}>
                        <Button size="sm">Detalhes</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <LancarContratoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
