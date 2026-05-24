"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Badge } from "@/components/ui/Badge";
import { AlertBox } from "@/components/ui/AlertBox";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Timeline } from "@/components/ui/Timeline";
import { PublicarCargaModal } from "@/components/cargas/PublicarCargaModal";
import { ChecklistOC } from "@/components/checklist/ChecklistOC";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { gerarOcsFaltantesAction } from "@/lib/api/actions";
import { calcSeveridade } from "@/lib/domain/sla";
import { calcChecklist, progressoChecklist } from "@/lib/domain/checklist";
import { buildOCSnapshot } from "@/lib/domain/oc-snapshot";
import type { PassoStatus } from "@/lib/domain/checklist";
import type { DashSSRData } from "@/app/(cerealista)/dashboard/DashboardCerealistaClientView";

interface DashProps { dadosSSR?: DashSSRData | null }

export function DashLogistica({ dadosSSR = null }: DashProps) {
  const { supabaseConfigured } = useAuth();
  const store = useDataStore();
  const usandoSSR = supabaseConfigured && dadosSSR !== null;
  const ordens = usandoSSR ? dadosSSR!.ordens : store.ordens;
  const cargas = usandoSSR ? dadosSSR!.cargas : store.cargas;
  const pendencias = usandoSSR ? dadosSSR!.pendencias : store.pendencias;
  const autorizacoesCarregamento = usandoSSR ? dadosSSR!.autorizacoes : store.autorizacoesCarregamento;
  const transportadoras = usandoSSR ? dadosSSR!.transportadoras : store.transportadoras;
  const [publicarOpen, setPublicarOpen] = useState(false);
  const [ocAberta, setOcAberta] = useState<string | null>(null);

  const stats = useMemo(() => {
    const reservasPendentes = cargas.flatMap((c) => c.reservas.filter((r) => r.status === "pendente")).length;
    const ocsAtivas = ordens.filter((o) => !["finalizada", "cancelada"].includes(o.status));
    const emTransito = ordens.filter((o) => o.status_operacional === "em_transito").length;
    const descarregadas = ordens.filter((o) => o.status_operacional === "descarregado" || o.status_operacional === "operacional_concluido").length;

    const minhasPend = pendencias.filter((p) => p.status === "aberta" && p.setor_responsavel === "logistica");
    const agora = new Date();
    const atrasadas = minhasPend.filter((p) => {
      const s = calcSeveridade(p, agora);
      return s === "atrasada" || s === "critica";
    }).length;

    // Para cada OC ativa, calcula próximo passo da LOGÍSTICA
    type ItemOC = {
      ocId: string;
      ocNumero: string;
      transpNome: string;
      passos: PassoStatus[];
      progresso: ReturnType<typeof progressoChecklist>;
      proxPassoLog?: PassoStatus;
      refugada: boolean;
    };
    const ocsItem: ItemOC[] = ocsAtivas.map((oc) => {
      const snapInputs = usandoSSR
        ? { ...store, ordens, autorizacoesCarregamento }
        : store;
      const snap = buildOCSnapshot(oc.id, snapInputs)!;
      const passos = calcChecklist(snap);
      const progresso = progressoChecklist(passos);
      const proxPassoLog = passos.find((p) => p.status === "pendente" && p.setor === "logistica");
      const transp = transportadoras.find((t) => t.id === oc.transp_id);
      return {
        ocId: oc.id,
        ocNumero: oc.numero,
        transpNome: transp?.nome_fantasia ?? "?",
        passos,
        progresso,
        proxPassoLog,
        refugada: !!oc.refugada,
      };
    });

    // OCs aguardando ação da LOGÍSTICA (próximo passo é da logística)
    const aguardandoLog = ocsItem.filter((i) => i.proxPassoLog);

    // OCs recém-criadas (autorização anexada nas últimas 24h)
    const agora24h = Date.now() - 24 * 3600 * 1000;
    const recemCriadas = ocsItem.filter((i) => {
      const oc = ocsAtivas.find((o) => o.id === i.ocId);
      const aut = oc?.autorizacao_id
        ? autorizacoesCarregamento.find((a) => a.id === oc.autorizacao_id)
        : autorizacoesCarregamento.find((a) => a.reserva_id === oc?.reserva_id);
      if (!aut) return false;
      return new Date(aut.anexada_em).getTime() >= agora24h;
    });

    // Autorizações já anexadas pela transp mas SEM OC vinculada
    // (a OC deveria ter sido gerada automaticamente — geralmente é, mas se
    //  a Server Action falhar na metade, sobra autorização órfã.)
    const ocsReservaIds = new Set(
      ordens.map((o) => o.reserva_id).filter(Boolean) as string[],
    );
    const autorizacoesOrfas = autorizacoesCarregamento.filter(
      (a) => !ocsReservaIds.has(a.reserva_id),
    );

    return {
      reservasPendentes,
      ocsAtivas,
      emTransito,
      descarregadas,
      minhasPend,
      atrasadas,
      ocsItem,
      aguardandoLog,
      recemCriadas,
      autorizacoesOrfas,
    };
  }, [cargas, ordens, pendencias, autorizacoesCarregamento, transportadoras, store]);

  // Auto-cura: gera OC para autorizações órfãs (botão visível só para cerealista)
  const router = useRouter();
  const toast = useToast();
  const [gerando, setGerando] = useState(false);
  async function tentarGerarOCs() {
    setGerando(true);
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
      setGerando(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🚛 Dashboard Logística</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            OCs ativas, trânsito e atalhos por etapa do fluxo
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/pendencias">
            <Button>📋 Fila operacional</Button>
          </Link>
          <Button variant="primary" onClick={() => setPublicarOpen(true)}>📦 Publicar Carga</Button>
        </div>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="a" label="Reservas Pendentes" value={stats.reservasPendentes} sub="aguardando aprovação" />
        <StatBox tone="b" label="OCs Ativas" value={stats.ocsAtivas.length} sub="em operação" />
        <StatBox tone="t" label="Em Trânsito" value={stats.emTransito} sub="caminhão na estrada" />
        <StatBox tone="g" label="Descarregadas" value={stats.descarregadas} sub="aguardando validação fiscal" />
      </div>

      {stats.autorizacoesOrfas.length > 0 && (
        <div className="section-gap">
          <AlertBox
            tone="amber"
            icon="⚠️"
            title={`${stats.autorizacoesOrfas.length} autorização(ões) sem OC gerada`}
            actions={
              <Button size="sm" variant="primary" onClick={tentarGerarOCs} disabled={gerando}>
                {gerando ? "Gerando..." : "🔧 Gerar OCs faltantes"}
              </Button>
            }
          >
            Transportadora(s) anexou autorização de carregamento mas a Ordem de Carregamento interna
            não foi gerada automaticamente. Clique para criar as OCs agora — vincula motorista, placa,
            origem e produtor conforme a reserva aprovada.
          </AlertBox>
        </div>
      )}

      {stats.atrasadas > 0 && (
        <div className="section-gap">
          <AlertBox
            tone="red"
            icon="🔴"
            title={`${stats.atrasadas} pendência(s) ATRASADA(S) — ação imediata`}
            actions={<Link href="/pendencias"><Button size="sm" variant="danger">Ver Pendências →</Button></Link>}
          >
            Pendências da logística que passaram do SLA.
          </AlertBox>
        </div>
      )}

      {/* Recém-criadas — autorização chegou nas últimas 24h (gera OC automática) */}
      {stats.recemCriadas.length > 0 && (
        <Card className="section-gap">
          <CardHeader>
            <CardTitle>🆕 OCs recém-criadas (últimas 24h)</CardTitle>
          </CardHeader>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            Transportadoras anexaram autorização e o sistema gerou estas OCs automaticamente. Acompanhe o andamento.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {stats.recemCriadas.map((i) => (
              <div
                key={i.ocId}
                style={{
                  padding: "10px 12px",
                  background: "var(--g100)",
                  border: "1px solid var(--g400)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Link href={`/ordens/${i.ocId}`} style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 700, color: "var(--g700)" }}>
                    {i.ocNumero}
                  </Link>
                  <Badge tone="green">✓ OC gerada</Badge>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{i.transpNome}</div>
                <Link href={`/ordens/${i.ocId}`} style={{ fontSize: 11, color: "var(--g700)", fontWeight: 600 }}>
                  Ver detalhe →
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Atalhos por etapa — OCs aguardando ação da logística */}
      {stats.aguardandoLog.length > 0 && (
        <Card className="section-gap">
          <CardHeader>
            <CardTitle>⚡ Atalhos por etapa — OCs aguardando sua ação ({stats.aguardandoLog.length})</CardTitle>
          </CardHeader>
          {stats.aguardandoLog.map((i) => {
            const cor =
              i.proxPassoLog?.passo === "nf_venda"
                ? "var(--a600)"
                : i.proxPassoLog?.passo === "anexo_agendamento"
                ? "var(--b600)"
                : i.proxPassoLog?.passo === "confirmacao_refugo"
                ? "var(--r600)"
                : "var(--muted)";
            const cta =
              i.proxPassoLog?.passo === "nf_venda"
                ? "📑 Anexar NF"
                : i.proxPassoLog?.passo === "anexo_agendamento"
                ? "📅 Anexar Agendamento"
                : i.proxPassoLog?.passo === "confirmacao_refugo"
                ? "⚠️ Confirmar Refugo"
                : "Ver OC";

            return (
              <div
                key={i.ocId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/ordens/${i.ocId}`} style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--g700)", fontWeight: 700 }}>
                      {i.ocNumero}
                    </Link>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{i.transpNome}</span>
                    {i.refugada && <Badge tone="red">⚠️ Refugada</Badge>}
                    <Badge tone="blue">{i.progresso.concluidos}/{i.progresso.total}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: cor, fontWeight: 600, marginTop: 4 }}>
                    ⏳ {i.proxPassoLog?.label}
                    {i.proxPassoLog?.hint && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> — {i.proxPassoLog.hint}</span>
                    )}
                  </div>
                </div>
                <Link href={`/ordens/${i.ocId}`}>
                  <Button size="sm" variant="primary">{cta}</Button>
                </Link>
              </div>
            );
          })}
        </Card>
      )}

      {/* Todas as OCs em andamento — visão global com checklist expansível */}
      <Card className="section-gap">
        <CardHeader>
          <CardTitle>🚚 Todas as OCs em andamento ({stats.ocsItem.length})</CardTitle>
        </CardHeader>
        {stats.ocsItem.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--hint)", padding: "10px 0" }}>Nenhuma OC ativa.</div>
        ) : (
          stats.ocsItem.map((i) => {
            const aberta = ocAberta === i.ocId;
            return (
              <div
                key={i.ocId}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: "var(--surf2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/ordens/${i.ocId}`} style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--g700)", fontWeight: 700 }}>
                        {i.ocNumero}
                      </Link>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{i.transpNome}</span>
                      {i.refugada && <Badge tone="red">⚠️ Refugada</Badge>}
                      <Badge tone="blue">{i.progresso.concluidos}/{i.progresso.total}</Badge>
                    </div>
                    <div style={{ marginTop: 6, maxWidth: 320 }}>
                      <ProgressBar
                        percent={i.progresso.pct}
                        color={i.progresso.pct >= 100 ? "green" : i.progresso.pct >= 50 ? "amber" : "red"}
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setOcAberta(aberta ? null : i.ocId)}>
                    {aberta ? "▲ Recolher" : "▼ Ver checklist"}
                  </Button>
                </div>
                {aberta && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <ChecklistOC passos={i.passos} compact />
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      <div className="grid-2 section-gap">
        <Card>
          <CardHeader>
            <CardTitle>⚡ Minhas pendências ({stats.minhasPend.length})</CardTitle>
          </CardHeader>
          {stats.minhasPend.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Nenhuma pendência aberta. 🎉</div>
          ) : (
            stats.minhasPend.slice(0, 6).map((p) => (
              <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{p.descricao}</strong>
                  <Badge tone="amber">{p.sla_horas}h SLA</Badge>
                </div>
                {p.oc_id && (
                  <Link href={`/ordens/${p.oc_id}`} style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "var(--g700)" }}>
                    {p.oc_id}
                  </Link>
                )}
              </div>
            ))
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🕐 Histórico recente</CardTitle>
          </CardHeader>
          {(store.historico ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--hint)" }}>Sem eventos ainda.</div>
          ) : (
            <Timeline events={(store.historico ?? []).slice(0, 8)} />
          )}
        </Card>
      </div>

      <PublicarCargaModal open={publicarOpen} onClose={() => setPublicarOpen(false)} />
    </>
  );
}
