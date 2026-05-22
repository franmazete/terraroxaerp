"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { fmtBRL, fmtDate } from "@/lib/domain/format";
import type { NotaFiscal, SolicitacaoTrocaNota } from "@/lib/types";

interface Props {
  ocId: string;
}

export function TrocaNotaSection({ ocId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const {
    notasFiscais,
    solicitacoesTrocaNota,
    solicitarTrocaNota,
    decidirTrocaNota,
    anexarNovaNFSubstituta,
  } = useDataStore();

  const [solicitarPara, setSolicitarPara] = useState<NotaFiscal | null>(null);
  const [motivo, setMotivo] = useState("");

  const [decidir, setDecidir] = useState<SolicitacaoTrocaNota | null>(null);
  const [obsFiscal, setObsFiscal] = useState("");

  const [anexarNova, setAnexarNova] = useState<SolicitacaoTrocaNota | null>(null);
  const [novoNumero, setNovoNumero] = useState("");
  const [novoValor, setNovoValor] = useState<number | "">("");
  const [novaChave, setNovaChave] = useState("");

  const nfsDaOc = useMemo(() => notasFiscais.filter((n) => n.oc_id === ocId), [notasFiscais, ocId]);
  const ativa = nfsDaOc.find((n) => (n.status ?? "ativa") === "ativa");
  const substituidas = nfsDaOc.filter((n) => n.status === "substituida");
  const solicitacoes = useMemo(
    () => solicitacoesTrocaNota.filter((s) => s.oc_id === ocId),
    [solicitacoesTrocaNota, ocId],
  );
  const solicitacoesPendentes = solicitacoes.filter((s) => s.status === "pendente");
  const solicitacoesAprovadasSemNova = solicitacoes.filter((s) => s.status === "aprovada" && !s.nova_nf_id);

  const ehFiscal = user?.perfil === "fiscal" || user?.perfil === "admin";
  const podeSolicitar = ehFiscal || user?.perfil === "logistica";

  function confirmarSolicitar() {
    if (!solicitarPara || !user) return;
    if (!motivo.trim()) { toast.warn("Motivo é obrigatório."); return; }
    solicitarTrocaNota({
      oc_id: ocId,
      nf_original_id: solicitarPara.id,
      motivo,
      solicitada_por_user_id: user.usuario_id,
      solicitada_por_nome: user.nome,
    });
    setSolicitarPara(null);
    setMotivo("");
    toast.success("Fiscal pode aprovar/rejeitar.", "Solicitação registrada");
  }

  function confirmarDecisao(decisao: "aprovada" | "rejeitada") {
    if (!decidir || !user) return;
    if (decisao === "rejeitada" && !obsFiscal.trim()) {
      toast.warn("Para rejeitar, informe a observação.");
      return;
    }
    decidirTrocaNota(decidir.id, decisao, user.usuario_id, user.nome, obsFiscal || undefined);
    setDecidir(null);
    setObsFiscal("");
    if (decisao === "aprovada") {
      toast.success("Solicitação aprovada — aguardando nova NF.");
    } else {
      toast.info("Solicitação rejeitada.");
    }
  }

  function confirmarAnexarNova() {
    if (!anexarNova || !user) return;
    if (!novoNumero.trim()) { toast.warn("Informe o número da nova NF."); return; }
    if (novoValor === "" || novoValor <= 0) { toast.warn("Informe o valor."); return; }
    const nova = anexarNovaNFSubstituta(
      anexarNova.id,
      {
        numero: novoNumero,
        valor: novoValor,
        chave_nfe: novaChave || undefined,
        emitida_em: new Date().toISOString().split("T")[0],
      },
      user.usuario_id,
    );
    if (nova) {
      toast.success(`NF antiga marcada como substituída.`, `Nova NF ${nova.numero} anexada`);
      setAnexarNova(null);
      setNovoNumero("");
      setNovoValor("");
      setNovaChave("");
    }
  }

  return (
    <Card className="section-gap">
      <CardHeader><CardTitle>📋 Notas Fiscais & Trocas</CardTitle></CardHeader>

      {nfsDaOc.length === 0 ? (
        <EmptyState icon="📋">Nenhuma NF anexada ainda — fiscal precisa anexar a NF do cliente.</EmptyState>
      ) : (
        <>
          {/* NF ativa */}
          {ativa && (
            <div style={{ padding: 12, border: "2px solid var(--g400)", borderRadius: "var(--radius)", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Badge tone="green">✓ Ativa</Badge>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>NF {ativa.numero}</span>
                    {ativa.substitui_nf_id && <Badge tone="blue">↳ substitui anterior</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Valor: <strong>{fmtBRL(ativa.valor)}</strong> · Emitida em {fmtDate(ativa.emitida_em)}
                  </div>
                  {ativa.chave_nfe && (
                    <div style={{ fontSize: 10, fontFamily: "DM Mono, monospace", color: "var(--hint)", marginTop: 2, wordBreak: "break-all" }}>
                      {ativa.chave_nfe}
                    </div>
                  )}
                </div>
                {podeSolicitar && (
                  <Button size="sm" variant="warning" onClick={() => setSolicitarPara(ativa)}>
                    🔄 Solicitar troca
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Solicitações pendentes (visíveis ao fiscal) */}
          {solicitacoesPendentes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                Solicitações de troca pendentes
              </div>
              {solicitacoesPendentes.map((s) => (
                <div key={s.id} style={{ padding: 10, background: "var(--a100)", borderRadius: "var(--radius)", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    ⏳ Solicitação {s.id} — por {s.solicitada_por_nome}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Motivo: <em>"{s.motivo}"</em>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--hint)" }}>{fmtDate(s.solicitada_em)}</div>
                  {ehFiscal && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                      <Button size="sm" variant="success" onClick={() => { setDecidir(s); }}>✓ Analisar</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Trocas aprovadas aguardando anexar nova NF */}
          {solicitacoesAprovadasSemNova.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g700)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                ✓ Troca aprovada — anexar nova NF
              </div>
              {solicitacoesAprovadasSemNova.map((s) => (
                <div key={s.id} style={{ padding: 10, background: "var(--g100)", borderRadius: "var(--radius)", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    Troca {s.id} aprovada — aguardando nova NF do cliente
                  </div>
                  {ehFiscal && (
                    <Button size="sm" variant="primary" onClick={() => setAnexarNova(s)}>
                      📎 Anexar nova NF substituta
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* NFs substituídas (histórico) */}
          {substituidas.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Histórico de NFs substituídas ({substituidas.length})
              </summary>
              <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--border)", marginTop: 6 }}>
                {substituidas.map((n) => (
                  <div key={n.id} style={{ padding: 8, marginBottom: 6, background: "var(--surf2)", borderRadius: "var(--radius)", fontSize: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Badge tone="red">SUBSTITUÍDA</Badge>
                      <strong>NF {n.numero}</strong>
                      <span style={{ color: "var(--muted)" }}>· {fmtBRL(n.valor)}</span>
                    </div>
                    {n.motivo_substituicao && (
                      <div style={{ marginTop: 4, color: "var(--muted)" }}>
                        Motivo: <em>"{n.motivo_substituicao}"</em>
                      </div>
                    )}
                    {n.trocada_em && (
                      <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>
                        Trocada em {fmtDate(n.trocada_em)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* Modal: Solicitar troca */}
      <Modal
        open={!!solicitarPara}
        onClose={() => setSolicitarPara(null)}
        title={<>🔄 Solicitar troca da NF {solicitarPara?.numero}</>}
        footer={
          <>
            <Button onClick={() => setSolicitarPara(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarSolicitar}>Enviar solicitação</Button>
          </>
        }
      >
        <AlertBox tone="amber" icon="⚠️" title="A NF antiga será mantida no histórico" />
        <FormRow variant="single">
          <Field label="Motivo da troca *" hint="Será visível para o fiscal e registrado no histórico">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: CFOP errado, valor divergente, dados do destinatário incorretos..." />
          </Field>
        </FormRow>
      </Modal>

      {/* Modal: Aprovar/rejeitar */}
      <Modal
        open={!!decidir}
        onClose={() => setDecidir(null)}
        title={<>Decidir solicitação {decidir?.id}</>}
        footer={
          <>
            <Button onClick={() => setDecidir(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmarDecisao("rejeitada")}>✗ Rejeitar</Button>
            <Button variant="success" onClick={() => confirmarDecisao("aprovada")}>✓ Aprovar</Button>
          </>
        }
      >
        {decidir && (
          <>
            <div style={{ marginBottom: 12, fontSize: 12 }}>
              <strong>Solicitada por:</strong> {decidir.solicitada_por_nome}<br />
              <strong>Motivo:</strong> <em>"{decidir.motivo}"</em>
            </div>
            <FormRow variant="single">
              <Field label="Observação do fiscal" hint="Obrigatória se for rejeitar">
                <Textarea value={obsFiscal} onChange={(e) => setObsFiscal(e.target.value)} />
              </Field>
            </FormRow>
          </>
        )}
      </Modal>

      {/* Modal: Anexar nova NF */}
      <Modal
        open={!!anexarNova}
        onClose={() => setAnexarNova(null)}
        title={<>📎 Anexar nova NF substituta</>}
        footer={
          <>
            <Button onClick={() => setAnexarNova(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarAnexarNova}>Confirmar substituição</Button>
          </>
        }
      >
        <AlertBox tone="blue" icon="ℹ️" title="A NF antiga será marcada como substituída — histórico preservado." />
        <FormRow variant="single">
          <Field label="Número da nova NF *">
            <Input value={novoNumero} onChange={(e) => setNovoNumero(e.target.value)} placeholder="000124" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Valor *">
            <NumberInput value={novoValor} onChange={setNovoValor} variant="currency" suffix="R$" placeholder="0,00" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Chave NF-e">
            <Input value={novaChave} onChange={(e) => setNovaChave(e.target.value)} placeholder="44 dígitos" />
          </Field>
        </FormRow>
      </Modal>
    </Card>
  );
}
