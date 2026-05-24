"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { gerarUrlDownloadAction } from "@/lib/api/actions";
import { fmtDate } from "@/lib/domain/format";
import type { OCSnapshot } from "@/lib/domain/checklist";

/** Quem anexa cada tipo de documento. Usado pro filtro do portal transportadora. */
type Origem = "transportadora" | "cerealista";

interface AnexoItem {
  /** Chave única na lista. */
  key: string;
  /** Tipo legível (ex: "Autorização de Carregamento"). */
  tipo: string;
  /** Ícone PT-BR pra exibição rápida. */
  icone: string;
  /** Path ou URL do arquivo no bucket. */
  arquivo_url: string;
  /** Nome de exibição (fallback se path não tiver). */
  nome_arquivo: string;
  /** Quem fez upload (texto livre). */
  uploader?: string | null;
  /** Quando (ISO ou date). */
  data?: string | null;
  /** Quem é o "lado" responsável por esse tipo de doc (controla visibilidade pra transp). */
  origem: Origem;
}

interface Props {
  snapshot: OCSnapshot;
}

/**
 * Lista todos os anexos da OC com botão "Baixar" gerando URL assinada
 * sob demanda. Filtra pela visibilidade do portal logado.
 */
export function OCAnexosCard({ snapshot }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [baixando, setBaixando] = useState<string | null>(null);

  // Coleta todos os anexos disponíveis no snapshot
  const todos: AnexoItem[] = [];

  if (snapshot.autorizacao?.arquivo_url) {
    todos.push({
      key: `autorizacao-${snapshot.autorizacao.id}`,
      tipo: "Autorização de Carregamento",
      icone: "📋",
      arquivo_url: snapshot.autorizacao.arquivo_url,
      nome_arquivo: snapshot.autorizacao.nome_arquivo ?? "autorizacao",
      uploader: snapshot.autorizacao.anexada_por_nome,
      data: snapshot.autorizacao.anexada_em,
      origem: "transportadora",
    });
  }

  if (snapshot.ticketCarreg?.arquivo_url) {
    todos.push({
      key: `ticket-${snapshot.ticketCarreg.id}`,
      tipo: "Ticket de Carregamento",
      icone: "⚖️",
      arquivo_url: snapshot.ticketCarreg.arquivo_url,
      nome_arquivo: snapshot.ticketCarreg.nome_arquivo ?? "ticket-carregamento",
      uploader: snapshot.ticketCarreg.carregado_por_nome,
      data: snapshot.ticketCarreg.carregado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.laudo?.arquivo_url) {
    todos.push({
      key: `laudo-${snapshot.laudo.id}`,
      tipo: "Laudo de Classificação",
      icone: "🌾",
      arquivo_url: snapshot.laudo.arquivo_url,
      nome_arquivo: snapshot.laudo.nome_arquivo ?? "laudo",
      uploader: snapshot.laudo.anexado_por_nome,
      data: snapshot.laudo.anexado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.notaFiscal?.xml_url) {
    todos.push({
      key: `nf-${snapshot.notaFiscal.id}`,
      tipo: `Nota Fiscal ${snapshot.notaFiscal.numero}`,
      icone: "🧾",
      arquivo_url: snapshot.notaFiscal.xml_url,
      nome_arquivo: `nf-${snapshot.notaFiscal.numero}.xml`,
      uploader: null,
      data: snapshot.notaFiscal.emitida_em,
      origem: "cerealista",
    });
  }

  if (snapshot.anexoAgendamento?.arquivo_url) {
    todos.push({
      key: `agendamento-${snapshot.anexoAgendamento.id}`,
      tipo: "Comprovante de Agendamento",
      icone: "📅",
      arquivo_url: snapshot.anexoAgendamento.arquivo_url,
      nome_arquivo: snapshot.anexoAgendamento.nome_arquivo ?? "agendamento",
      uploader: snapshot.anexoAgendamento.anexado_por_nome,
      data: snapshot.anexoAgendamento.anexado_em,
      origem: "cerealista",
    });
  }

  if (snapshot.cte?.xml_url) {
    todos.push({
      key: `cte-${snapshot.cte.id}`,
      tipo: `CT-e ${snapshot.cte.numero}`,
      icone: "📦",
      arquivo_url: snapshot.cte.xml_url,
      nome_arquivo: `cte-${snapshot.cte.numero}.xml`,
      uploader: null,
      data: snapshot.cte.emitido_em,
      origem: "transportadora",
    });
  }

  if (snapshot.descarga?.ticket_descarga_url) {
    todos.push({
      key: `descarga-ticket-${snapshot.descarga.id}`,
      tipo: "Ticket de Descarga",
      icone: "📥",
      arquivo_url: snapshot.descarga.ticket_descarga_url,
      nome_arquivo: "ticket-descarga",
      uploader: null,
      data: snapshot.descarga.descarregado_em,
      origem: "transportadora",
    });
  }
  if (snapshot.descarga?.laudo_classificacao_url) {
    todos.push({
      key: `descarga-laudo-${snapshot.descarga.id}`,
      tipo: "Laudo de Classificação (descarga)",
      icone: "🌾",
      arquivo_url: snapshot.descarga.laudo_classificacao_url,
      nome_arquivo: "laudo-descarga",
      uploader: null,
      data: snapshot.descarga.descarregado_em,
      origem: "transportadora",
    });
  }
  if (snapshot.descarga?.comprovante_porto_url) {
    todos.push({
      key: `descarga-porto-${snapshot.descarga.id}`,
      tipo: "Comprovante do Porto",
      icone: "⚓",
      arquivo_url: snapshot.descarga.comprovante_porto_url,
      nome_arquivo: "comprovante-porto",
      uploader: null,
      data: snapshot.descarga.descarregado_em,
      origem: "transportadora",
    });
  }
  if (snapshot.descarga?.canhoto_url) {
    todos.push({
      key: `descarga-canhoto-${snapshot.descarga.id}`,
      tipo: "Canhoto da NF",
      icone: "📄",
      arquivo_url: snapshot.descarga.canhoto_url,
      nome_arquivo: "canhoto",
      uploader: null,
      data: snapshot.descarga.descarregado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.avisoRefugo?.arquivo_url) {
    todos.push({
      key: `refugo-${snapshot.avisoRefugo.id}`,
      tipo: "Aviso de Refugo",
      icone: "⚠️",
      arquivo_url: snapshot.avisoRefugo.arquivo_url,
      nome_arquivo: snapshot.avisoRefugo.nome_arquivo ?? "aviso-refugo",
      uploader: snapshot.avisoRefugo.avisado_por_nome,
      data: snapshot.avisoRefugo.avisado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.cteRetorno?.arquivo_url) {
    todos.push({
      key: `cte-retorno-${snapshot.cteRetorno.id}`,
      tipo: "CT-e de Retorno",
      icone: "🔄",
      arquivo_url: snapshot.cteRetorno.arquivo_url,
      nome_arquivo: snapshot.cteRetorno.nome_arquivo ?? "cte-retorno",
      uploader: snapshot.cteRetorno.anexado_por_nome,
      data: snapshot.cteRetorno.anexado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.estadia?.arquivo_url) {
    todos.push({
      key: `estadia-${snapshot.estadia.id}`,
      tipo: "Estadia",
      icone: "⏱️",
      arquivo_url: snapshot.estadia.arquivo_url,
      nome_arquivo: snapshot.estadia.nome_arquivo ?? "estadia",
      uploader: snapshot.estadia.anexada_por_nome,
      data: snapshot.estadia.anexada_em,
      origem: "transportadora",
    });
  }

  if (snapshot.faturamento?.fatura_url) {
    todos.push({
      key: `fatura-${snapshot.faturamento.id}`,
      tipo: `Fatura ${snapshot.faturamento.numero_fatura ?? ""}`.trim(),
      icone: "💰",
      arquivo_url: snapshot.faturamento.fatura_url,
      nome_arquivo: snapshot.faturamento.numero_fatura
        ? `fatura-${snapshot.faturamento.numero_fatura}`
        : "fatura",
      uploader: null,
      data: snapshot.faturamento.criado_em,
      origem: "transportadora",
    });
  }

  if (snapshot.pagamento?.comprovante_url) {
    todos.push({
      key: `pagamento-${snapshot.pagamento.id}`,
      tipo: "Comprovante de Pagamento",
      icone: "🏦",
      arquivo_url: snapshot.pagamento.comprovante_url,
      nome_arquivo: "comprovante-pagamento",
      uploader: null,
      data: snapshot.pagamento.data_pagamento,
      origem: "cerealista",
    });
  }

  // Filtra por perfil — transp só vê seus próprios uploads
  const ehTransp = user?.perfil === "transportadora";
  const itens = ehTransp ? todos.filter((a) => a.origem === "transportadora") : todos;

  async function baixar(item: AnexoItem) {
    setBaixando(item.key);
    try {
      const r = await gerarUrlDownloadAction(item.arquivo_url);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // Abre em nova aba — força download via attr download não funciona com signed URLs cross-origin
      window.open(r.data!.url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixando(null);
    }
  }

  return (
    <Card className="section-gap">
      <CardHeader>
        <CardTitle>
          📎 Anexos da Operação
          <span style={{ marginLeft: 8 }}>
            <Badge tone="blue">{itens.length}</Badge>
          </span>
        </CardTitle>
      </CardHeader>

      {itens.length === 0 ? (
        <EmptyState icon="📁">
          {ehTransp
            ? "Você ainda não anexou nenhum documento nesta OC."
            : "Nenhum documento anexado nesta operação."}
        </EmptyState>
      ) : (
        <div>
          {itens.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 22 }}>{item.icone}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.tipo}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ fontFamily: "DM Mono, monospace" }}>{item.nome_arquivo}</span>
                  {item.uploader && <> · por <strong>{item.uploader}</strong></>}
                  {item.data && <> · {fmtDate(item.data)}</>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Badge tone={item.origem === "transportadora" ? "blue" : "teal"}>
                  {item.origem === "transportadora" ? "Transp" : "Cerealista"}
                </Badge>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => baixar(item)}
                  disabled={baixando === item.key}
                >
                  {baixando === item.key ? "Gerando..." : "⬇ Baixar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 8,
          padding: "6px 8px",
          background: "var(--surf2)",
          borderRadius: "var(--radius)",
        }}
      >
        🔒 Cada download gera link válido por 1 hora.
        {ehTransp
          ? " Você vê apenas os documentos que sua transportadora anexou."
          : " Como cerealista, você vê todos os anexos da operação."}
      </div>
    </Card>
  );
}
