"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, tableStyles } from "@/components/ui/Table";
import { CadastroHeader } from "@/components/cadastros/CadastroHeader";
import { SearchInput } from "@/components/cadastros/SearchInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/domain/format";
import { calcSeveridade, SEVERIDADE_LABEL, SEVERIDADE_TONE } from "@/lib/domain/sla";
import { downloadCSV, fmtDataCSV } from "@/lib/domain/csv";
import { resolverPendenciaAction } from "@/lib/api/actions";
import type { Pendencia, PendenciaCategoria, PendenciaSetor, PendenciaSeveridade } from "@/lib/types";

const SETORES: { v: PendenciaSetor; label: string }[] = [
  { v: "comercial", label: "Comercial" },
  { v: "logistica", label: "Logística" },
  { v: "fiscal", label: "Fiscal" },
  { v: "financeiro", label: "Financeiro" },
  { v: "transportadora", label: "Transportadora" },
];

const CATEGORIAS_LABEL: Record<PendenciaCategoria, string> = {
  aprovar_reserva: "Aprovar reserva",
  anexar_autorizacao_carreg: "Anexar autorização de carregamento",
  anexar_ticket_carreg: "Anexar ticket de carregamento + peso",
  registrar_descarga: "Registrar descarga",
  validar_descarga: "Validar descarga",
  anexar_ticket_descarga: "Anexar comprovante de descarga",
  anexar_laudo: "Anexar laudo de classificação",
  anexar_nf: "Anexar NF",
  validar_nf: "Validar NF",
  aprovar_troca_nf: "Aprovar troca de NF",
  anexar_nova_nf: "Anexar nova NF",
  anexar_cte: "Anexar CT-e",
  liberar_faturamento: "Liberar faturamento",
  anexar_fatura: "Anexar fatura dos CT-es",
  processar_pagamento: "Processar pagamento",
  anexar_agendamento: "Anexar comprovante de agendamento",
  confirmar_refugo: "Confirmar refugo da carga",
  anexar_cte_retorno: "Anexar CT-e de retorno",
  calc_quebra: "Calcular quebra",
  conferir_fatura_ia: "IA conferindo fatura",
  conferir_fatura_fiscal: "Conferir resultado da IA",
};

interface Props {
  pendenciasSSR: Pendencia[] | null;
}

export function PendenciasClientView({ pendenciasSSR }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const store = useDataStore();
  const pendenciasFonte = pendenciasSSR ?? store.pendencias;

  const [search, setSearch] = useState("");
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [filtroSev, setFiltroSev] = useState<string>("");

  const meuSetor: PendenciaSetor | undefined =
    user?.perfil === "comercial" ? "comercial"
    : user?.perfil === "logistica" ? "logistica"
    : user?.perfil === "fiscal" ? "fiscal"
    : user?.perfil === "financeiro" ? "financeiro"
    : user?.perfil === "transportadora" ? "transportadora"
    : undefined;

  async function resolver(id: string) {
    if (!user) return;
    if (supabaseConfigured) {
      const r = await resolverPendenciaAction(id);
      if ("error" in r) return toast.error(r.error);
      toast.success("Pendência resolvida.");
      router.refresh();
    } else {
      store.resolverPendencia(id, user.usuario_id, user.nome);
      toast.success("Pendência resolvida.");
    }
  }

  const lista = useMemo(() => {
    const agora = new Date();
    return pendenciasFonte
      .filter((p) => p.status === "aberta")
      .map((p) => ({ ...p, severidade: calcSeveridade(p, agora) }))
      .filter((p) => {
        if (filtroSetor && p.setor_responsavel !== filtroSetor) return false;
        if (filtroSev && p.severidade !== filtroSev) return false;
        const q = search.toLowerCase();
        return p.descricao.toLowerCase().includes(q) || (p.oc_id ?? "").includes(q);
      })
      .sort((a, b) => {
        const ordem: Record<PendenciaSeveridade, number> = { critica: 0, atrasada: 1, vencendo: 2, proximo: 3, no_prazo: 4 };
        return ordem[a.severidade] - ordem[b.severidade];
      });
  }, [pendenciasFonte, search, filtroSetor, filtroSev]);

  const minhas = useMemo(() => {
    if (!meuSetor) return lista;
    return lista.filter((p) => {
      if (p.setor_responsavel !== meuSetor) return false;
      if (meuSetor === "transportadora" && p.transp_id && p.transp_id !== user?.transp_id) return false;
      return true;
    });
  }, [lista, meuSetor, user?.transp_id]);

  const stats = useMemo(() => {
    const todas = pendenciasFonte.filter((p) => p.status === "aberta");
    const agora = new Date();
    return {
      total: todas.length,
      atrasadas: todas.filter((p) => {
        const s = calcSeveridade(p, agora);
        return s === "atrasada" || s === "critica";
      }).length,
      proximas: todas.filter((p) => {
        const s = calcSeveridade(p, agora);
        return s === "vencendo" || s === "proximo";
      }).length,
      noPrazo: todas.filter((p) => calcSeveridade(p, agora) === "no_prazo").length,
    };
  }, [pendenciasFonte]);

  return (
    <>
      <CadastroHeader
        title="Central de Pendências"
        description={meuSetor ? `Suas pendências (${SETORES.find((s) => s.v === meuSetor)?.label}) + visão global` : "Pendências abertas em todos os setores"}
        icon="⏳"
        count={lista.length}
        extras={
          <>
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todos setores</option>
              {SETORES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
            <select
              value={filtroSev}
              onChange={(e) => setFiltroSev(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todas severidades</option>
              <option value="critica">⚫ Crítica</option>
              <option value="atrasada">🔴 Atrasada</option>
              <option value="vencendo">🟠 Vencendo</option>
              <option value="proximo">🟡 Próximo</option>
              <option value="no_prazo">🟢 No prazo</option>
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="OC ou descrição..." />
            <Button
              size="sm"
              onClick={() =>
                downloadCSV(
                  lista,
                  [
                    { header: "OC", value: (p) => p.oc_id ?? "" },
                    { header: "Reserva", value: (p) => p.reserva_id ?? "" },
                    { header: "Categoria", value: (p) => CATEGORIAS_LABEL[p.categoria] ?? p.categoria },
                    { header: "Descrição", value: (p) => p.descricao },
                    { header: "Setor", value: (p) => p.setor_responsavel },
                    { header: "Transp", value: (p) => p.transp_id ?? "" },
                    { header: "SLA (h)", value: (p) => p.sla_horas },
                    { header: "Severidade", value: (p) => p.severidade },
                    { header: "Vence em", value: (p) => fmtDataCSV(p.vence_em) },
                  ],
                  `pendencias_${new Date().toISOString().split("T")[0]}`,
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
        <StatBox tone="b" label="Total Pendências" value={stats.total} sub="abertas" />
        <StatBox tone="r" label="Atrasadas / Críticas" value={stats.atrasadas} sub="precisam ação imediata" />
        <StatBox tone="a" label="Próximas / Vencendo" value={stats.proximas} sub="ficar de olho" />
        <StatBox tone="g" label="No Prazo" value={stats.noPrazo} sub="tudo certo" />
      </div>

      {meuSetor && minhas.length > 0 && (
        <div className="section-gap">
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g700)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            ⚡ Minhas pendências ({minhas.length})
          </div>
          <Card>
            <TabelaPendencias pendencias={minhas} resolver={resolver} />
          </Card>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
        Todas as pendências
      </div>
      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="✅">Nenhuma pendência aberta. Tudo em dia!</EmptyState>
        ) : (
          <TabelaPendencias pendencias={lista} resolver={resolver} />
        )}
      </Card>
    </>
  );
}

function TabelaPendencias({
  pendencias,
  resolver,
}: {
  pendencias: (Pendencia & { severidade: PendenciaSeveridade })[];
  resolver: (id: string) => void;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Severidade</th>
          <th>OC</th>
          <th>Categoria</th>
          <th>Descrição</th>
          <th>Setor</th>
          <th>Vence em</th>
          <th>SLA</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {pendencias.map((p) => (
          <tr key={p.id}>
            <td>
              <Badge tone={SEVERIDADE_TONE[p.severidade]}>{SEVERIDADE_LABEL[p.severidade]}</Badge>
            </td>
            <td>
              {p.oc_id ? (
                <Link href={`/ordens/${p.oc_id}`} className={tableStyles.mono} style={{ color: "var(--g700)" }}>{p.oc_id}</Link>
              ) : (
                <span style={{ color: "var(--hint)" }}>—</span>
              )}
            </td>
            <td><strong>{CATEGORIAS_LABEL[p.categoria]}</strong></td>
            <td style={{ fontSize: 11 }}>{p.descricao}</td>
            <td><Badge tone="blue">{SETORES.find((s) => s.v === p.setor_responsavel)?.label}</Badge></td>
            <td>{fmtDate(p.vence_em)}</td>
            <td style={{ fontSize: 11 }}>{p.sla_horas}h</td>
            <td>
              <Button size="sm" onClick={() => resolver(p.id)}>✓ Resolver</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
