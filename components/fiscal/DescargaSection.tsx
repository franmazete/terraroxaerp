"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { fmtKg, fmtDate } from "@/lib/domain/format";

interface Props {
  ocId: string;
}

export function DescargaSection({ ocId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const { dadosDescarga, ordens, registrarDescarga, validarDescarga, rejeitarDescarga } = useDataStore();

  const oc = ordens.find((o) => o.id === ocId);
  const descarga = useMemo(() => dadosDescarga.find((d) => d.oc_id === ocId), [dadosDescarga, ocId]);

  const ehLogistica = user?.perfil === "logistica" || user?.perfil === "admin";
  const ehFiscal = user?.perfil === "fiscal" || user?.perfil === "admin";

  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [peso, setPeso] = useState<number | "">("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [canhotoUrl, setCanhotoUrl] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [laudoUrl, setLaudoUrl] = useState("");
  const [obs, setObs] = useState("");
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  if (!oc) return null;

  function confirmarRegistrar() {
    if (!user) return;
    if (peso === "" || peso <= 0) { toast.warn("Informe o peso descarregado em kg."); return; }

    registrarDescarga({
      oc_id: ocId,
      peso_descarregado_kg: peso,
      ticket_descarga_url: ticketUrl || undefined,
      canhoto_url: canhotoUrl || undefined,
      comprovante_porto_url: comprovanteUrl || undefined,
      laudo_classificacao_url: laudoUrl || undefined,
      descarregado_por_user_id: user.usuario_id,
      observacoes: obs || undefined,
    });
    toast.success("Aguardando validação do fiscal.", "Descarga registrada");
    setRegistrarOpen(false);
    setPeso("");
    setTicketUrl("");
    setCanhotoUrl("");
    setComprovanteUrl("");
    setLaudoUrl("");
    setObs("");
  }

  async function aprovar() {
    if (!user || !descarga) return;
    const ok = await confirmar({
      titulo: "Validar descarga?",
      mensagem: "A operação entrará em status 'Operação Concluída' e poderá ser liberada para faturamento.",
      variante: "info",
      confirmarLabel: "Validar",
    });
    if (!ok) return;
    validarDescarga(descarga.id, user.usuario_id, user.nome);
    toast.success("Descarga validada.");
  }

  function confirmarRejeicao() {
    if (!user || !descarga) return;
    if (motivoRejeicao.trim().length < 5) {
      toast.warn("Informe o motivo da rejeição (mín. 5 caracteres).");
      return;
    }
    rejeitarDescarga(descarga.id, user.usuario_id, user.nome, motivoRejeicao);
    toast.info("Descarga rejeitada. Logística deve corrigir e registrar novamente.");
    setRejeitarOpen(false);
    setMotivoRejeicao("");
  }

  return (
    <Card className="section-gap">
      <CardHeader>
        <CardTitle>
          🏗️ Descarga
          {descarga?.validado_em && <Badge tone="green">✓ Validada</Badge>}
          {descarga?.rejeitado_em && <Badge tone="red">✗ Rejeitada</Badge>}
          {descarga && !descarga.validado_em && !descarga.rejeitado_em && <Badge tone="amber">⏳ Aguardando fiscal</Badge>}
        </CardTitle>
      </CardHeader>

      {!descarga ? (
        <>
          <AlertBox tone="blue" icon="🚚" title="Descarga ainda não registrada">
            Quando o caminhão chegar no porto/destino, a <strong>logística registra os dados da descarga</strong> (peso, ticket, canhoto). Em seguida, o <strong>fiscal valida</strong> para liberar a próxima etapa.
          </AlertBox>
          {ehLogistica && (
            <Button variant="primary" onClick={() => setRegistrarOpen(true)} style={{ marginTop: 10 }}>
              📝 Registrar Descarga
            </Button>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Peso Descarregado</div>
              <div style={{ fontWeight: 700, color: "var(--g700)" }}>{fmtKg(descarga.peso_descarregado_kg)}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Previsto: {fmtKg(oc.peso_previsto_kg)} ({(((descarga.peso_descarregado_kg / oc.peso_previsto_kg) - 1) * 100).toFixed(1)}%)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Descarregado em</div>
              <div style={{ fontWeight: 600 }}>{fmtDate(descarga.descarregado_em)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
            <DocBadge label="Ticket Descarga" url={descarga.ticket_descarga_url} />
            <DocBadge label="Canhoto" url={descarga.canhoto_url} />
            <DocBadge label="Comprovante Porto" url={descarga.comprovante_porto_url} />
            <DocBadge label="Laudo Classificação" url={descarga.laudo_classificacao_url} />
          </div>

          {descarga.observacoes && (
            <div style={{ padding: "8px 10px", background: "var(--surf2)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
              💬 {descarga.observacoes}
            </div>
          )}

          {descarga.validado_em && (
            <AlertBox tone="green" icon="✅" title={`Descarga validada em ${fmtDate(descarga.validado_em)}`}>
              Operação operacional concluída. Fiscal pode liberar faturamento.
            </AlertBox>
          )}

          {descarga.rejeitado_em && (
            <AlertBox tone="red" icon="✗" title={`Descarga rejeitada em ${fmtDate(descarga.rejeitado_em)}`}>
              Motivo: <em>"{descarga.motivo_rejeicao}"</em>. Logística deve corrigir e registrar de novo.
            </AlertBox>
          )}

          {ehFiscal && !descarga.validado_em && !descarga.rejeitado_em && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button variant="success" onClick={aprovar}>✓ Validar Descarga</Button>
              <Button variant="danger" onClick={() => setRejeitarOpen(true)}>✗ Rejeitar</Button>
            </div>
          )}

          {ehLogistica && descarga.rejeitado_em && (
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={() => setRegistrarOpen(true)}>
                📝 Registrar Nova Descarga (corrigir)
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={registrarOpen}
        onClose={() => setRegistrarOpen(false)}
        title="📝 Registrar Descarga"
        wide
        footer={
          <>
            <Button onClick={() => setRegistrarOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarRegistrar}>Confirmar registro</Button>
          </>
        }
      >
        <AlertBox tone="amber" icon="⚖️" title="Após registrar, o fiscal será notificado para validar a descarga." />

        <FormRow>
          <Field label="Peso Descarregado *" hint={`Peso previsto era ${fmtKg(oc.peso_previsto_kg)}`}>
            <NumberInput value={peso} onChange={setPeso} suffix="kg" placeholder="Ex: 40.300" />
          </Field>
          <Field label="—">
            <div />
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Ticket Descarga">
            <UploadZone label="Anexar ticket de pesagem" icon="⚖️" optional />
            <Input style={{ marginTop: 6 }} value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} placeholder="OU cole a URL temporária" />
          </Field>
          <Field label="Canhoto">
            <UploadZone label="Anexar canhoto" icon="📋" optional />
            <Input style={{ marginTop: 6 }} value={canhotoUrl} onChange={(e) => setCanhotoUrl(e.target.value)} placeholder="OU cole a URL temporária" />
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Comprovante do Porto">
            <UploadZone label="Anexar comprovante" icon="🏗️" optional />
            <Input style={{ marginTop: 6 }} value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} placeholder="OU cole a URL temporária" />
          </Field>
          <Field label="Laudo de Classificação">
            <UploadZone label="Anexar laudo" icon="📄" optional />
            <Input style={{ marginTop: 6 }} value={laudoUrl} onChange={(e) => setLaudoUrl(e.target.value)} placeholder="OU cole a URL temporária" />
          </Field>
        </FormRow>

        <FormRow variant="single">
          <Field label="Observações">
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações da descarga (qualidade, ocorrências, etc.)" />
          </Field>
        </FormRow>
      </Modal>

      <Modal
        open={rejeitarOpen}
        onClose={() => setRejeitarOpen(false)}
        title="✗ Rejeitar Descarga"
        footer={
          <>
            <Button onClick={() => setRejeitarOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarRejeicao}>Confirmar rejeição</Button>
          </>
        }
      >
        <AlertBox tone="red" icon="⚠️" title="A logística deverá corrigir e registrar nova descarga">
          Descreva claramente o que precisa ser corrigido.
        </AlertBox>
        <FormRow variant="single">
          <Field label="Motivo da rejeição *" hint="Mínimo 5 caracteres">
            <Textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex: Ticket de pesagem ilegível; canhoto não anexado; peso diverge..."
            />
          </Field>
        </FormRow>
      </Modal>
    </Card>
  );
}

function DocBadge({ label, url }: { label: string; url?: string }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        background: url ? "var(--g100)" : "var(--surf2)",
        border: `1px dashed ${url ? "var(--g400)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        fontSize: 11,
        color: url ? "var(--g700)" : "var(--muted)",
        textAlign: "center",
      }}
    >
      {url ? "✅" : "⏸"} {label}
    </div>
  );
}
