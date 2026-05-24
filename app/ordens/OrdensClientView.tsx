"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CadastroHeader } from "@/components/cadastros/CadastroHeader";
import { SearchInput } from "@/components/cadastros/SearchInput";
import { LancarOrdemModal } from "@/components/ordens/LancarOrdemModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { gerarOcsFaltantesAction } from "@/lib/api/actions";
import { fmtKg, fmtDate } from "@/lib/domain/format";
import { downloadCSV, fmtDataCSV } from "@/lib/domain/csv";
import type { Contrato, Motorista, OCStatus, OrdemCarregamento, Transportadora } from "@/lib/types";

export interface OrdensSSR {
  ordens: OrdemCarregamento[];
  transportadoras: Transportadora[];
  motoristas: Motorista[];
  contratos: Contrato[];
}

interface Props {
  dadosSSR?: OrdensSSR | null;
}

const STATUS_OPTIONS: { v: OCStatus; label: string; tone: "blue" | "amber" | "green" | "teal" | "red" }[] = [
  { v: "emitida", label: "Emitida", tone: "blue" },
  { v: "aguardando_docs", label: "Aguardando Docs", tone: "amber" },
  { v: "em_carregamento", label: "Em Carregamento", tone: "amber" },
  { v: "em_transito", label: "Em Trânsito", tone: "teal" },
  { v: "descarregada", label: "Descarregada", tone: "green" },
  { v: "finalizada", label: "Finalizada", tone: "green" },
  { v: "cancelada", label: "Cancelada", tone: "red" },
];

export function OrdensClientView({ dadosSSR = null }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const store = useDataStore();
  const usandoSSR = supabaseConfigured && dadosSSR !== null;
  const ordens = usandoSSR ? dadosSSR!.ordens : store.ordens;
  const transportadoras = usandoSSR ? dadosSSR!.transportadoras : store.transportadoras;
  const motoristas = usandoSSR ? dadosSSR!.motoristas : store.motoristas;
  const contratos = usandoSSR ? dadosSSR!.contratos : store.contratos;
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("");
  const [filtroTransp, setFiltroTransp] = useState<string>("");
  const [filtroDe, setFiltroDe] = useState<string>("");
  const [filtroAte, setFiltroAte] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [gerandoOC, setGerandoOC] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const podeLancarManual = user?.perfil === "admin" || user?.perfil === "logistica";
  const ehCerealista = user?.role === "cerealista";

  async function gerarOCsFaltantes() {
    setGerandoOC(true);
    try {
      const r = await gerarOcsFaltantesAction();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (r.data!.criadas.length === 0) {
        toast.info("Nenhuma autorização órfã — todas já têm OC.");
      } else {
        toast.success(
          `${r.data!.criadas.length} OC(s) gerada(s): ${r.data!.criadas.map((c) => c.ocNumero).join(", ")}`,
          "Ordens criadas",
        );
        router.refresh();
      }
    } finally {
      setGerandoOC(false);
    }
  }

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    const deDate = filtroDe ? new Date(filtroDe) : null;
    const ateDate = filtroAte ? new Date(filtroAte) : null;
    if (ateDate) ateDate.setHours(23, 59, 59, 999);
    return ordens.filter((o) => {
      if (user?.role === "transportadora" && o.transp_id !== user.transp_id) return false;
      if (filtroStatus && o.status !== filtroStatus) return false;
      if (filtroOrigem && o.origem !== filtroOrigem) return false;
      if (filtroTransp && o.transp_id !== filtroTransp) return false;
      if (deDate || ateDate) {
        const emitida = new Date(o.emitida_em);
        if (deDate && emitida < deDate) return false;
        if (ateDate && emitida > ateDate) return false;
      }
      const ct = contratos.find((c) => c.id === o.contrato_id);
      return o.numero.toLowerCase().includes(q) || (ct?.numero ?? "").toLowerCase().includes(q);
    });
  }, [ordens, search, filtroStatus, filtroOrigem, filtroTransp, filtroDe, filtroAte, user, contratos]);

  const stats = useMemo(() => {
    const escopo = user?.role === "transportadora" ? ordens.filter((o) => o.transp_id === user.transp_id) : ordens;
    return {
      total: escopo.length,
      ativas: escopo.filter((o) => ["emitida", "aguardando_docs", "em_carregamento", "em_transito"].includes(o.status)).length,
      finalizadas: escopo.filter((o) => o.status === "finalizada").length,
      semNF: escopo.filter((o) => !o.nota_fiscal_id).length,
    };
  }, [ordens, user]);

  return (
    <>
      <CadastroHeader
        title="Ordens de Carregamento"
        description={user?.role === "transportadora" ? "OCs emitidas para sua transportadora" : "Todas as OCs emitidas pela logística"}
        icon="📄"
        count={lista.length}
        onNovo={podeLancarManual ? () => setModalOpen(true) : undefined}
        novoLabel="Lançar OC Manual"
        extras={
          <>
            {ehCerealista && (
              <Button
                size="sm"
                onClick={gerarOCsFaltantes}
                disabled={gerandoOC}
                title="Verifica se há autorizações anexadas sem OC e cria as OCs faltantes"
              >
                {gerandoOC ? "Verificando..." : "🔧 Gerar OCs faltantes"}
              </Button>
            )}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todos status</option>
              {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            {podeLancarManual && (
              <select
                value={filtroOrigem}
                onChange={(e) => setFiltroOrigem(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Toda origem</option>
                <option value="automatica_reserva">Automática (reserva)</option>
                <option value="manual_logistica">Manual (logística)</option>
              </select>
            )}
            {user?.role === "cerealista" && (
              <select
                value={filtroTransp}
                onChange={(e) => setFiltroTransp(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Toda transp.</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={filtroDe}
              onChange={(e) => setFiltroDe(e.target.value)}
              title="De"
              style={{ padding: "7px 8px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit", width: 130 }}
            />
            <input
              type="date"
              value={filtroAte}
              onChange={(e) => setFiltroAte(e.target.value)}
              title="Até"
              style={{ padding: "7px 8px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit", width: 130 }}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Número OC ou contrato..." />
            <Button
              size="sm"
              onClick={() =>
                downloadCSV(
                  lista,
                  [
                    { header: "Número", value: (o) => o.numero },
                    { header: "Contrato", value: (o) => contratos.find((c) => c.id === o.contrato_id)?.numero ?? o.contrato_id },
                    { header: "Transportadora", value: (o) => transportadoras.find((t) => t.id === o.transp_id)?.nome_fantasia ?? "" },
                    { header: "Motorista", value: (o) => motoristas.find((m) => m.id === o.motorista_id)?.nome ?? "" },
                    { header: "Peso Previsto (kg)", value: (o) => o.peso_previsto_kg },
                    { header: "Status", value: (o) => STATUS_OPTIONS.find((s) => s.v === o.status)?.label ?? o.status },
                    { header: "Origem", value: (o) => o.origem },
                    { header: "Emitida em", value: (o) => fmtDataCSV(o.emitida_em) },
                  ],
                  `ordens_${new Date().toISOString().split("T")[0]}`,
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
        <StatBox tone="b" label="Total OCs" value={stats.total} />
        <StatBox tone="a" label="Ativas" value={stats.ativas} sub="em andamento" />
        <StatBox tone="g" label="Finalizadas" value={stats.finalizadas} />
        <StatBox tone="r" label="Sem NF" value={stats.semNF} sub="aguardando emissão" />
      </div>

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="📄">Nenhuma OC encontrada.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Contrato</th>
                <th>Transportadora</th>
                <th>Motorista</th>
                <th>Peso Previsto</th>
                <th>Docs</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Emitida em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const st = STATUS_OPTIONS.find((x) => x.v === o.status)!;
                const transp = transportadoras.find((t) => t.id === o.transp_id);
                const motorista = motoristas.find((m) => m.id === o.motorista_id);
                const contrato = contratos.find((c) => c.id === o.contrato_id);
                const temNF = !!o.nota_fiscal_id;
                const temCTE = !!o.cte_id;
                const temRO = !!o.romaneio_id;
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/ordens/${o.id}`} style={{ fontFamily: "DM Mono, monospace", color: "var(--g700)", fontWeight: 600 }}>
                        {o.numero}
                      </Link>
                    </td>
                    <td><span className={tableStyles.mono}>{contrato?.numero ?? o.contrato_id}</span></td>
                    <td>{transp?.nome_fantasia ?? "—"}</td>
                    <td>{motorista?.nome ?? "—"}</td>
                    <td><strong>{fmtKg(o.peso_previsto_kg)}</strong></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Badge tone={temNF ? "green" : "gray"}>NF</Badge>
                        <Badge tone={temCTE ? "green" : "gray"}>CTE</Badge>
                        <Badge tone={temRO ? "green" : "gray"}>RO</Badge>
                      </div>
                    </td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td>
                      <Badge tone={o.origem === "automatica_reserva" ? "teal" : "blue"}>
                        {o.origem === "automatica_reserva" ? "Auto" : "Manual"}
                      </Badge>
                    </td>
                    <td>{fmtDate(o.emitida_em)}</td>
                    <td>
                      <Link href={`/ordens/${o.id}`}>
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

      {podeLancarManual && <LancarOrdemModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </>
  );
}
