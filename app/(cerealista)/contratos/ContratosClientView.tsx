"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { gerarPDFContratos } from "@/lib/pdf/contratos-pdf";
import { percentualContratoUsado, saldoColor } from "@/lib/domain/saldo";
import type { Carga, Cliente, Contrato, ContratoStatus, Local, OrdemCarregamento, Produto, Produtor, Terminal } from "@/lib/types";

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
  locaisSSR: Local[] | null;
  terminaisSSR: Terminal[] | null;
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
  locaisSSR,
  terminaisSSR,
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
  const [filtroOperacao, setFiltroOperacao] = useState<string>("");
  const [filtroSafra, setFiltroSafra] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(25);

  // Operações distintas (pra preencher o select + cards)
  const operacoesUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const c of contratos) if (c.operacao) set.add(c.operacao);
    return Array.from(set).sort();
  }, [contratos]);

  // Safras distintas
  const safrasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const c of contratos) if (c.safra) set.add(c.safra);
    return Array.from(set).sort();
  }, [contratos]);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return contratos.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (filtroOperacao && c.operacao !== filtroOperacao) return false;
      if (filtroSafra && c.safra !== filtroSafra) return false;
      const prod = produtores.find((p) => p.id === c.produtor_id)?.nome.toLowerCase() ?? "";
      const cli = clientes.find((cl) => cl.id === c.cliente_id)?.nome.toLowerCase() ?? "";
      const op = (c.operacao ?? "").toLowerCase();
      const sf = (c.safra ?? "").toLowerCase();
      return (
        c.numero.toLowerCase().includes(q) ||
        prod.includes(q) ||
        cli.includes(q) ||
        op.includes(q) ||
        sf.includes(q)
      );
    });
  }, [contratos, search, filtroStatus, filtroOperacao, filtroSafra, produtores, clientes]);

  // Paginação client-side
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * tamanhoPagina;
  const fim = inicio + tamanhoPagina;
  const listaPaginada = useMemo(() => lista.slice(inicio, fim), [lista, inicio, fim]);

  // Reset página quando filtros mudam
  useEffect(() => { setPagina(1); }, [search, filtroStatus, filtroOperacao, filtroSafra, tamanhoPagina]);

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

  // Totalizadores por operação (com base na lista filtrada por status/search, ignorando filtroOperacao
  // pra mostrar a contagem total disponível em cada operação).
  const statsPorOperacao = useMemo(() => {
    const base = contratos.filter((c) => !filtroStatus || c.status === filtroStatus);
    return operacoesUnicas.map((op) => {
      const items = base.filter((c) => c.operacao === op);
      return {
        operacao: op,
        count: items.length,
        kg: items.reduce((s, c) => s + c.qtd_kg_total, 0),
      };
    });
  }, [contratos, operacoesUnicas, filtroStatus]);

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
            {operacoesUnicas.length > 0 && (
              <select
                value={filtroOperacao}
                onChange={(e) => setFiltroOperacao(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit", maxWidth: 220 }}
              >
                <option value="">Todas operações</option>
                {operacoesUnicas.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            )}
            {safrasUnicas.length > 0 && (
              <select
                value={filtroSafra}
                onChange={(e) => setFiltroSafra(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Todas safras</option>
                {safrasUnicas.map((sf) => <option key={sf} value={sf}>{sf}</option>)}
              </select>
            )}
            <SearchInput value={search} onChange={setSearch} placeholder="Número, produtor, cliente, operação ou safra..." />
            <Button
              size="sm"
              onClick={() =>
                downloadCSV(
                  lista,
                  [
                    { header: "Número", value: (c) => c.numero_manual || c.numero },
                    { header: "Tipo", value: (c) => c.tipo_contrato ?? "" },
                    { header: "Operação", value: (c) => c.operacao ?? "" },
                    { header: "Safra", value: (c) => c.safra ?? "" },
                    { header: "Produtor", value: (c) => produtores.find((p) => p.id === c.produtor_id)?.nome ?? "" },
                    { header: "Cliente", value: (c) => clientes.find((x) => x.id === c.cliente_id)?.nome ?? "" },
                    { header: "Produto", value: (c) => produtos.find((p) => p.id === c.produto_id)?.nome ?? "" },
                    { header: "Qtd Total (kg)", value: (c) => c.qtd_kg_total },
                    { header: "Saldo (kg)", value: (c) => c.saldo_kg },
                    { header: "Valor Total (R$)", value: (c) => c.valor_total ?? "" },
                    { header: "Status", value: (c) => c.status },
                    { header: "Disponível", value: (c) => (c.disponivel ? "Sim" : "Não") },
                    { header: "Emissão", value: (c) => fmtDataCSV(c.data_emissao) },
                    { header: "Vencimento", value: (c) => fmtDataCSV(c.data_vencto_financeiro) },
                  ],
                  `contratos_${new Date().toISOString().split("T")[0]}`,
                )
              }
              disabled={lista.length === 0}
            >
              📥 CSV
            </Button>
            <Button
              size="sm"
              onClick={() =>
                gerarPDFContratos({
                  contratos: lista,
                  produtos,
                  produtores,
                  clientes,
                  filtros: {
                    status: filtroStatus || undefined,
                    operacao: filtroOperacao || undefined,
                    safra: filtroSafra || undefined,
                    search: search || undefined,
                  },
                })
              }
              disabled={lista.length === 0}
            >
              📄 PDF
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

      {statsPorOperacao.length > 0 && (
        <div className="section-gap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {statsPorOperacao.map((s) => {
            const ativo = filtroOperacao === s.operacao;
            return (
              <button
                key={s.operacao}
                onClick={() => setFiltroOperacao(ativo ? "" : s.operacao)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  border: `1.5px solid ${ativo ? "var(--g600)" : "var(--border)"}`,
                  background: ativo ? "var(--g100)" : "var(--surf2)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
                title={ativo ? "Clique para limpar filtro" : "Clique para filtrar por esta operação"}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  📋 Operação {ativo && "· Filtro ativo"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>{s.operacao}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                  <span><strong>{s.count}</strong> contratos</span>
                  <span style={{ color: "var(--muted)" }}>{fmtKg(s.kg)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
              {listaPaginada.map((c) => {
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
                      <div style={{ fontSize: 10, color: "var(--hint)" }}>→ {c.data_vencto_financeiro ? fmtDate(c.data_vencto_financeiro) : "—"}</div>
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
        {lista.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 6px 2px",
              borderTop: "1px solid var(--border)",
              marginTop: 12,
              gap: 12,
              flexWrap: "wrap",
              fontSize: 12,
            }}
          >
            <div style={{ color: "var(--muted)" }}>
              Mostrando{" "}
              <strong style={{ color: "var(--g700)" }}>
                {inicio + 1}–{Math.min(fim, lista.length)}
              </strong>{" "}
              de <strong style={{ color: "var(--g700)" }}>{lista.length}</strong> contratos
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ color: "var(--muted)" }}>Por página:</label>
              <select
                value={tamanhoPagina}
                onChange={(e) => setTamanhoPagina(Number(e.target.value))}
                style={{ padding: "6px 8px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <Button size="sm" onClick={() => setPagina(1)} disabled={paginaAtual === 1}>
                ⏮
              </Button>
              <Button size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1}>
                ← Anterior
              </Button>
              <span style={{ color: "var(--muted)", padding: "0 6px" }}>
                Página <strong style={{ color: "var(--g700)" }}>{paginaAtual}</strong> de{" "}
                <strong style={{ color: "var(--g700)" }}>{totalPaginas}</strong>
              </span>
              <Button size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}>
                Próxima →
              </Button>
              <Button size="sm" onClick={() => setPagina(totalPaginas)} disabled={paginaAtual === totalPaginas}>
                ⏭
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LancarContratoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        produtoresSSR={produtoresSSR}
        clientesSSR={clientesSSR}
        produtosSSR={produtosSSR}
        locaisSSR={locaisSSR}
        terminaisSSR={terminaisSSR}
      />
    </>
  );
}
