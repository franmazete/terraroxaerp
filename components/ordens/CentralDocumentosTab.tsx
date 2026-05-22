"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select, Textarea, UploadZone } from "@/components/ui/Form";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/domain/format";
import type { CategoriaDocumento, DocumentoOperacao } from "@/lib/types";

interface Props {
  ocId: string;
}

interface CategoriaConfig {
  id: CategoriaDocumento;
  label: string;
  grupo: "pre" | "carregamento" | "descarga" | "fiscal" | "financeiro" | "outros";
  /** Quem pode anexar (perfis). */
  podeAnexar: string[];
  /** Múltiplos uploads permitidos (ex: NF tem várias por substituição). */
  multipla?: boolean;
}

const CATEGORIAS: CategoriaConfig[] = [
  { id: "autorizacao_carregamento", label: "Autorização de Carregamento", grupo: "pre", podeAnexar: ["transportadora", "admin"] },
  { id: "ticket_carregamento", label: "Ticket de Carregamento", grupo: "carregamento", podeAnexar: ["logistica", "admin"] },
  { id: "comprovante_fazenda", label: "Comprovante da Fazenda", grupo: "carregamento", podeAnexar: ["logistica", "admin"] },
  { id: "peso_origem", label: "Peso na Origem", grupo: "carregamento", podeAnexar: ["logistica", "admin"] },
  { id: "ticket_descarga", label: "Ticket de Descarga", grupo: "descarga", podeAnexar: ["logistica", "admin"] },
  { id: "laudo_classificacao", label: "Laudo de Classificação", grupo: "descarga", podeAnexar: ["logistica", "admin"] },
  { id: "comprovante_porto", label: "Comprovante do Porto", grupo: "descarga", podeAnexar: ["logistica", "admin"] },
  { id: "canhoto", label: "Canhoto", grupo: "descarga", podeAnexar: ["logistica", "admin"] },
  { id: "peso_descarga", label: "Peso na Descarga", grupo: "descarga", podeAnexar: ["logistica", "admin"] },
  { id: "nota_fiscal", label: "Nota Fiscal (NF)", grupo: "fiscal", podeAnexar: ["fiscal", "admin"], multipla: true },
  { id: "cte", label: "CT-e", grupo: "fiscal", podeAnexar: ["transportadora", "fiscal", "admin"] },
  { id: "fatura_transp", label: "Fatura da Transportadora", grupo: "financeiro", podeAnexar: ["transportadora", "financeiro", "admin"] },
  { id: "comprovante_pagamento", label: "Comprovante de Pagamento", grupo: "financeiro", podeAnexar: ["financeiro", "admin"] },
  { id: "outros", label: "Outros Documentos", grupo: "outros", podeAnexar: ["admin", "logistica", "fiscal", "comercial", "financeiro", "transportadora"], multipla: true },
];

const GRUPO_LABEL: Record<CategoriaConfig["grupo"], string> = {
  pre: "📦 Pré-operacional",
  carregamento: "🚛 Carregamento",
  descarga: "🏗️ Descarga",
  fiscal: "📋 Fiscais",
  financeiro: "💰 Financeiro",
  outros: "📎 Outros",
};

export function CentralDocumentosTab({ ocId }: Props) {
  const { user } = useAuth();
  const { documentosOperacao, autorizacoesCarregamento, anexarDocumento, aprovarDocumento, rejeitarDocumento, substituirDocumento } = useDataStore();
  const toast = useToast();
  const [anexandoCategoria, setAnexandoCategoria] = useState<CategoriaConfig | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [novoObs, setNovoObs] = useState("");
  const [rejeitarDocId, setRejeitarDocId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  // Documentos da OC (apenas ativos, exceto se for histórico de uma categoria multipla)
  const docsDaOc = useMemo(() => documentosOperacao.filter((d) => d.oc_id === ocId), [documentosOperacao, ocId]);

  // Autorização também aparece na central (do estado próprio)
  const autorizacaoOC = autorizacoesCarregamento.find((a) => {
    // procura pela OC associada
    return docsDaOc.find((d) => d.categoria === "autorizacao_carregamento") === undefined && a;
  });

  function podeAnexarCategoria(cat: CategoriaConfig): boolean {
    if (!user) return false;
    if (cat.podeAnexar.includes("admin") && user.perfil === "admin") return true;
    return cat.podeAnexar.includes(user.perfil);
  }

  function abrirAnexar(cat: CategoriaConfig) {
    setAnexandoCategoria(cat);
    setNovoNome("");
    setNovoUrl("");
    setNovoObs("");
  }

  function confirmarAnexo() {
    if (!anexandoCategoria || !user) return;
    if (!novoNome.trim()) {
      toast.warn("Informe o nome do arquivo.");
      return;
    }
    const arquivoUrl = novoUrl || "pending-upload://" + novoNome;
    // Se já existe um ativo dessa categoria E não é múltipla → substituir (mantém versão anterior)
    const ativo = docsDaOc.find((d) => d.categoria === anexandoCategoria.id && d.ativo);
    if (ativo && !anexandoCategoria.multipla) {
      const r = substituirDocumento(ativo.id, {
        arquivo_url: arquivoUrl,
        nome_original: novoNome,
        enviado_por_user_id: user.usuario_id,
        enviado_por_nome: user.nome,
      });
      if (r) {
        toast.success(
          `Versão ${r.versao} anexada. A anterior fica no histórico.`,
          `${anexandoCategoria.label} substituído`,
        );
      }
    } else {
      const novo = anexarDocumento({
        oc_id: ocId,
        categoria: anexandoCategoria.id,
        arquivo_url: arquivoUrl,
        nome_original: novoNome,
        versao_anterior_id: undefined,
        enviado_por_user_id: user.usuario_id,
        enviado_por_nome: user.nome,
        observacao: novoObs || undefined,
      });
      toast.success(`Documento "${novo.nome_original}" anexado.`, anexandoCategoria.label);
    }
    setAnexandoCategoria(null);
    setNovoNome("");
    setNovoUrl("");
    setNovoObs("");
  }

  const grupos: CategoriaConfig["grupo"][] = ["pre", "carregamento", "descarga", "fiscal", "financeiro", "outros"];

  return (
    <Card>
      <div style={{ marginBottom: 14, fontSize: 12, color: "var(--muted)" }}>
        Central documental unificada da OC. Cada categoria de documento pode ter múltiplas versões (histórico mantido).
      </div>

      {grupos.map((g) => {
        const cats = CATEGORIAS.filter((c) => c.grupo === g);
        return (
          <div key={g} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--g700)" }}>{GRUPO_LABEL[g]}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {cats.map((cat) => {
                const docs = docsDaOc.filter((d) => d.categoria === cat.id);
                const ativo = docs.find((d) => d.ativo);
                const historico = docs.filter((d) => !d.ativo);
                const podeAnex = podeAnexarCategoria(cat);
                const temAtivo = !!ativo;

                // Mostra autorização externa também
                const isAutorizacao = cat.id === "autorizacao_carregamento";
                const autorizExterna = isAutorizacao && autorizacaoOC;

                return (
                  <div
                    key={cat.id}
                    style={{
                      padding: 12,
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: temAtivo || autorizExterna ? "var(--surf2)" : "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {temAtivo || autorizExterna ? "✅" : "⏸"} {cat.label}
                        </span>
                        {ativo && <Badge tone={ativo.status === "aprovado" ? "green" : ativo.status === "rejeitado" ? "red" : "blue"}>{ativo.status}</Badge>}
                        {ativo && ativo.versao > 1 && <Badge tone="gray">v{ativo.versao}</Badge>}
                        {historico.length > 0 && <Badge tone="amber">+{historico.length} no histórico</Badge>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {podeAnex && !(cat.multipla === false && temAtivo) && (
                          <Button size="sm" onClick={() => abrirAnexar(cat)}>
                            {temAtivo && !cat.multipla ? "↻ Substituir" : "+ Anexar"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {ativo && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                        <div>📄 <strong>{ativo.nome_original}</strong></div>
                        <div>Enviado por {ativo.enviado_por_nome} em {fmtDate(ativo.enviado_em)}</div>
                        {ativo.observacao && <div style={{ marginTop: 2 }}>💬 {ativo.observacao}</div>}
                        {ativo.status === "enviado" && (user?.perfil === "fiscal" || user?.perfil === "admin" || user?.perfil === "logistica") && (
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <Button size="sm" variant="success" onClick={() => { aprovarDocumento(ativo.id, user!.usuario_id); toast.success(`${cat.label} aprovado.`); }}>✓ Aprovar</Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setRejeitarDocId(ativo.id)}
                            >
                              ✗ Rejeitar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {autorizExterna && !temAtivo && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                        <div>📄 <strong>{autorizExterna.nome_arquivo}</strong></div>
                        <div>Anexado por {autorizExterna.anexada_por_nome} em {fmtDate(autorizExterna.anexada_em)}</div>
                        <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--hint)" }}>
                          Anexada no fluxo de geração da OC — disponível também aqui.
                        </div>
                      </div>
                    )}

                    {historico.length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>
                          Histórico ({historico.length})
                        </summary>
                        <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
                          {historico.map((h) => (
                            <div key={h.id} style={{ fontSize: 11, color: "var(--hint)", marginBottom: 4 }}>
                              v{h.versao} · {h.nome_original} · {fmtDate(h.enviado_em)} · status: {h.status}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {docsDaOc.length === 0 && !autorizacaoOC && (
        <EmptyState icon="📋">Nenhum documento anexado ainda. Use os botões acima para anexar por categoria.</EmptyState>
      )}

      <Modal
        open={anexandoCategoria !== null}
        onClose={() => setAnexandoCategoria(null)}
        title={`📎 Anexar ${anexandoCategoria?.label ?? ""}`}
        footer={
          <>
            <Button onClick={() => setAnexandoCategoria(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarAnexo}>Confirmar anexo</Button>
          </>
        }
      >
        <FormRow variant="single">
          <Field label="Arquivo">
            <UploadZone label="Clique para selecionar (PDF/imagem)" icon="📄" optional />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Nome do arquivo *">
            <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: ticket_descarga_001.pdf" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="URL temporária" hint="No mock, cole uma URL pública para teste (até Etapa 4 com Supabase Storage)">
            <Input value={novoUrl} onChange={(e) => setNovoUrl(e.target.value)} placeholder="https://..." />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Observação">
            <Textarea value={novoObs} onChange={(e) => setNovoObs(e.target.value)} />
          </Field>
        </FormRow>
      </Modal>

      <Modal
        open={rejeitarDocId !== null}
        onClose={() => { setRejeitarDocId(null); setMotivoRejeicao(""); }}
        title="✗ Rejeitar documento"
        footer={
          <>
            <Button onClick={() => { setRejeitarDocId(null); setMotivoRejeicao(""); }}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (motivoRejeicao.trim().length < 5) {
                  toast.warn("Informe o motivo (mín. 5 caracteres).");
                  return;
                }
                rejeitarDocumento(rejeitarDocId!, user!.usuario_id, motivoRejeicao);
                toast.info("Documento rejeitado.");
                setRejeitarDocId(null);
                setMotivoRejeicao("");
              }}
            >
              Confirmar rejeição
            </Button>
          </>
        }
      >
        <FormRow variant="single">
          <Field label="Motivo da rejeição *">
            <Textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex: arquivo ilegível, dados divergentes, faltando assinatura..."
            />
          </Field>
        </FormRow>
      </Modal>
    </Card>
  );
}
