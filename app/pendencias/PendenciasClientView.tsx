"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  textoChecklist,
  contarPorEstado,
  proximoMeuPasso,
  type EstadoUX,
} from "@/lib/domain/checklist-textos";
import { progressoChecklist, type OCSnapshot, type PassoStatus } from "@/lib/domain/checklist";
import type { PassoChecklist } from "@/lib/types";
import { gerarUrlDownloadAction } from "@/lib/api/actions";
import { useToast } from "@/components/ui/Toast";

export interface CargaPendencia {
  kind: "oc" | "reserva_aprovada";
  /** id da OC ou id da reserva (quando ainda não virou OC) */
  id: string;
  ocId: string | null;
  ocNumero: string | null;
  produto: string;
  origem: string;
  destino: string | null;
  transpNome: string;
  transpId: string;
  criadaEm: string;
  refugada: boolean;
  passos: PassoStatus[];
  /** Snapshot completo da OC quando disponível — usado pra resolver anexos. */
  snapshot?: OCSnapshot | null;
}

/**
 * Resolve o arquivo (path no bucket "operacao") correspondente a um passo do
 * checklist a partir do snapshot da OC. Retorna null se não houver anexo.
 */
function arquivoDoPasso(
  passo: PassoChecklist,
  snapshot: OCSnapshot | null | undefined,
): { url: string; nome: string } | null {
  if (!snapshot) return null;
  switch (passo) {
    case "autorizacao_carregamento":
      return snapshot.autorizacao?.arquivo_url
        ? { url: snapshot.autorizacao.arquivo_url, nome: snapshot.autorizacao.nome_arquivo ?? "autorizacao" }
        : null;
    case "ticket_carregamento":
      return snapshot.ticketCarreg?.arquivo_url
        ? { url: snapshot.ticketCarreg.arquivo_url, nome: snapshot.ticketCarreg.nome_arquivo ?? "ticket-carregamento" }
        : null;
    case "laudo_classificacao":
      return snapshot.laudo?.arquivo_url
        ? { url: snapshot.laudo.arquivo_url, nome: snapshot.laudo.nome_arquivo ?? "laudo" }
        : null;
    case "nf_venda":
      return snapshot.notaFiscal?.xml_url
        ? { url: snapshot.notaFiscal.xml_url, nome: `nf-${snapshot.notaFiscal.numero}.xml` }
        : null;
    case "anexo_agendamento":
      return snapshot.anexoAgendamento?.arquivo_url
        ? { url: snapshot.anexoAgendamento.arquivo_url, nome: snapshot.anexoAgendamento.nome_arquivo ?? "agendamento" }
        : null;
    case "cte_emissao":
      return snapshot.cte?.xml_url
        ? { url: snapshot.cte.xml_url, nome: `cte-${snapshot.cte.numero}.xml` }
        : null;
    case "comprovante_descarga":
      return snapshot.descarga?.ticket_descarga_url
        ? { url: snapshot.descarga.ticket_descarga_url, nome: "ticket-descarga" }
        : null;
    case "aviso_refugo":
      return snapshot.avisoRefugo?.arquivo_url
        ? { url: snapshot.avisoRefugo.arquivo_url, nome: snapshot.avisoRefugo.nome_arquivo ?? "aviso-refugo" }
        : null;
    case "cte_retorno":
      return snapshot.cteRetorno?.arquivo_url
        ? { url: snapshot.cteRetorno.arquivo_url, nome: snapshot.cteRetorno.nome_arquivo ?? "cte-retorno" }
        : null;
    case "estadia":
      return snapshot.estadia?.arquivo_url
        ? { url: snapshot.estadia.arquivo_url, nome: snapshot.estadia.nome_arquivo ?? "estadia" }
        : null;
    case "fatura_ctes":
      return snapshot.faturamento?.fatura_url
        ? { url: snapshot.faturamento.fatura_url, nome: "fatura" }
        : null;
    case "pagamento":
      return snapshot.pagamento?.comprovante_url
        ? { url: snapshot.pagamento.comprovante_url, nome: "comprovante-pagamento" }
        : null;
    default:
      return null;
  }
}

interface Props {
  dadosSSR: CargaPendencia[] | null;
  ehTransp: boolean;
}

type Filtro = "todas" | "minha_vez" | "aguardando" | "atrasadas" | "concluidas_hoje";

const CORES: Record<EstadoUX, { bg: string; border: string; text: string }> = {
  minha_vez: { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" },
  aguardando_outro: { bg: "#fef3c7", border: "#f59e0b", text: "#78350f" },
  concluido: { bg: "#d1fae5", border: "#10b981", text: "#064e3b" },
  bloqueado: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280" },
  opcional: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6" },
};

export function PendenciasClientView({ dadosSSR, ehTransp }: Props) {
  const itens = dadosSSR ?? [];
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixandoKey, setBaixandoKey] = useState<string | null>(null);
  const toast = useToast();

  async function baixarArquivo(arquivoUrl: string, key: string) {
    setBaixandoKey(key);
    try {
      const r = await gerarUrlDownloadAction(arquivoUrl);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      window.open(r.data!.url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixandoKey(null);
    }
  }

  /** Calcula resumos por carga (qual é a próxima ação, contagem de passos). */
  const itensComResumo = useMemo(() => {
    return itens.map((it) => {
      const proxMeu = proximoMeuPasso(it.passos, ehTransp);
      const proxQualquer = it.passos.find((p) => p.status === "pendente" && !p.opcional);
      const contagens = contarPorEstado(it.passos, ehTransp);
      const prog = progressoChecklist(it.passos);
      const concluidasHoje = it.passos.filter((p) => {
        if (p.status !== "concluido" || !p.concluido_em) return false;
        const d = new Date(p.concluido_em);
        const hoje = new Date();
        return (
          d.getFullYear() === hoje.getFullYear() &&
          d.getMonth() === hoje.getMonth() &&
          d.getDate() === hoje.getDate()
        );
      }).length;
      return { ...it, proxMeu, proxQualquer, contagens, prog, concluidasHoje };
    });
  }, [itens, ehTransp]);

  const totais = useMemo(() => {
    let minhaVez = 0;
    let aguardando = 0;
    let concluidasHoje = 0;
    let cargasComMinhaVez = 0;
    let cargasComAguardando = 0;
    for (const it of itensComResumo) {
      minhaVez += it.contagens.minhaVez;
      aguardando += it.contagens.aguardandoOutro;
      concluidasHoje += it.concluidasHoje;
      if (it.contagens.minhaVez > 0) cargasComMinhaVez++;
      else if (it.contagens.aguardandoOutro > 0) cargasComAguardando++;
    }
    return { minhaVez, aguardando, concluidasHoje, cargasComMinhaVez, cargasComAguardando };
  }, [itensComResumo]);

  const filtradas = useMemo(() => {
    switch (filtro) {
      case "minha_vez":
        return itensComResumo.filter((it) => it.contagens.minhaVez > 0);
      case "aguardando":
        return itensComResumo.filter(
          (it) => it.contagens.minhaVez === 0 && it.contagens.aguardandoOutro > 0,
        );
      case "concluidas_hoje":
        return itensComResumo.filter((it) => it.concluidasHoje > 0);
      case "atrasadas":
        // Refugadas + cargas paradas há mais de 7 dias com passos pendentes
        return itensComResumo.filter((it) => {
          if (it.refugada) return true;
          const diasParada = (Date.now() - new Date(it.criadaEm).getTime()) / (1000 * 3600 * 24);
          return diasParada > 7 && it.contagens.minhaVez + it.contagens.aguardandoOutro > 0;
        });
      default:
        return itensComResumo;
    }
  }, [itensComResumo, filtro]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Fila operacional</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {ehTransp ? "Acompanhe suas cargas em andamento" : "Visão de todas as cargas e seus próximos passos"}
          </div>
        </div>
      </div>

      {/* Cards de filtro — clica e filtra a lista abaixo */}
      <div className="grid-4 section-gap">
        <button
          type="button"
          onClick={() => setFiltro("minha_vez")}
          style={{ all: "unset", cursor: "pointer", outline: filtro === "minha_vez" ? "2px solid var(--g600)" : "none", borderRadius: 8 }}
        >
          <StatBox
            tone="b"
            label="Sua vez"
            value={totais.minhaVez}
            sub={`em ${totais.cargasComMinhaVez} carga(s)`}
          />
        </button>
        <button
          type="button"
          onClick={() => setFiltro("aguardando")}
          style={{ all: "unset", cursor: "pointer", outline: filtro === "aguardando" ? "2px solid var(--g600)" : "none", borderRadius: 8 }}
        >
          <StatBox
            tone="a"
            label="Aguardando outro responsável"
            value={totais.aguardando}
            sub={`em ${totais.cargasComAguardando} carga(s)`}
          />
        </button>
        <button
          type="button"
          onClick={() => setFiltro("concluidas_hoje")}
          style={{ all: "unset", cursor: "pointer", outline: filtro === "concluidas_hoje" ? "2px solid var(--g600)" : "none", borderRadius: 8 }}
        >
          <StatBox tone="g" label="Concluídas hoje" value={totais.concluidasHoje} sub="passos finalizados" />
        </button>
        <button
          type="button"
          onClick={() => setFiltro("atrasadas")}
          style={{ all: "unset", cursor: "pointer", outline: filtro === "atrasadas" ? "2px solid var(--g600)" : "none", borderRadius: 8 }}
        >
          <StatBox
            tone="r"
            label="Cargas com atraso/refugo"
            value={itensComResumo.filter((it) => it.refugada || (Date.now() - new Date(it.criadaEm).getTime()) / 86400000 > 7).length}
            sub="precisam de atenção"
          />
        </button>
      </div>

      {/* Toggle ver todas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Button size="sm" variant={filtro === "todas" ? "primary" : undefined} onClick={() => setFiltro("todas")}>
          Ver todas ({itensComResumo.length})
        </Button>
        {filtro !== "todas" && (
          <Button size="sm" onClick={() => setFiltro("todas")}>
            Limpar filtro
          </Button>
        )}
      </div>

      {/* Lista de cargas */}
      {filtradas.length === 0 ? (
        <Card>
          <EmptyState icon="✅">
            {filtro === "minha_vez"
              ? "Nenhuma carga aguardando sua ação. 🎉"
              : filtro === "aguardando"
              ? "Não há cargas aguardando outros responsáveis."
              : filtro === "concluidas_hoje"
              ? "Nenhum passo concluído hoje ainda."
              : filtro === "atrasadas"
              ? "Nenhuma carga atrasada ou refugada."
              : "Nenhuma carga em andamento."}
          </EmptyState>
        </Card>
      ) : (
        filtradas.map((it) => {
          const expandido = aberto === it.id;
          const prox = it.proxMeu ?? it.proxQualquer;
          const proxTexto = prox ? textoChecklist(prox, ehTransp) : null;
          return (
            <Card key={it.id} className="section-gap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    {it.ocNumero ? (
                      <Link href={`/ordens/${it.ocId}`} style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 700, color: "var(--g700)" }}>
                        {it.ocNumero}
                      </Link>
                    ) : (
                      <Badge tone="amber">Pré-OC · Reserva aprovada</Badge>
                    )}
                    <strong>{it.produto}</strong>
                    {it.refugada && <Badge tone="red">⚠️ Refugada</Badge>}
                    <Badge tone="blue">{it.prog.concluidos}/{it.prog.total} passos</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {it.origem.split("/")[0]} → {it.destino?.split("/")[0] ?? "A definir"} · {it.transpNome}
                  </div>

                  {/* Próxima ação destacada */}
                  {proxTexto && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: CORES[proxTexto.estado].bg,
                        borderLeft: `4px solid ${CORES[proxTexto.estado].border}`,
                        color: CORES[proxTexto.estado].text,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ marginRight: 8 }}>{proxTexto.icone}</span>
                      {proxTexto.titulo}
                    </div>
                  )}

                  <div style={{ marginTop: 8, maxWidth: 360 }}>
                    <ProgressBar percent={it.prog.pct} color={it.prog.pct >= 100 ? "green" : it.prog.pct >= 50 ? "amber" : "red"} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {it.ocId && it.proxMeu && (
                    <Link href={`/ordens/${it.ocId}`}>
                      <Button variant="primary" size="sm">Executar ação →</Button>
                    </Link>
                  )}
                  {!it.ocId && it.kind === "reserva_aprovada" && ehTransp && (
                    <Link href="/minhas-reservas">
                      <Button variant="primary" size="sm">Anexar autorização →</Button>
                    </Link>
                  )}
                  {it.ocId && (
                    <Button size="sm" onClick={() => setAberto(expandido ? null : it.id)}>
                      {expandido ? "▲ Recolher" : "▼ Ver checklist"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Checklist expandido — todas as fases */}
              {expandido && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  {it.passos.map((p, idx) => {
                    const t = textoChecklist(p, ehTransp);
                    const arquivo = arquivoDoPasso(p.passo, it.snapshot);
                    const dlKey = `${it.id}-${p.passo}-${idx}`;
                    return (
                      <div
                        key={`${p.passo}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 10px",
                          marginBottom: 4,
                          borderRadius: 6,
                          background: CORES[t.estado].bg,
                          borderLeft: `3px solid ${CORES[t.estado].border}`,
                          color: CORES[t.estado].text,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{t.icone}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{t.titulo}</div>
                          {p.hint && (
                            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{p.hint}</div>
                          )}
                        </div>
                        {arquivo && (
                          <Button
                            size="sm"
                            onClick={() => baixarArquivo(arquivo.url, dlKey)}
                            disabled={baixandoKey === dlKey}
                            title={arquivo.nome}
                          >
                            {baixandoKey === dlKey ? "Gerando..." : "⬇ Baixar anexo"}
                          </Button>
                        )}
                        {t.estado === "minha_vez" && it.ocId && (
                          <Link href={`/ordens/${it.ocId}`}>
                            <Button size="sm" variant="primary">Executar →</Button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}

// Re-export pra DashLogistica e outros poderem importar o tipo
export type { Filtro };
