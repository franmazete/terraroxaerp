"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

export function AvisarRefugoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const { criarAvisoRefugo } = useDataStore();
  const [motivo, setMotivo] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");

  if (!ocId || !user) return null;

  async function submit() {
    if (motivo.trim().length < 10) {
      toast.warn("Descreva o motivo do refugo (mínimo 10 caracteres).");
      return;
    }
    const ok = await confirmar({
      titulo: "Confirmar aviso de refugo?",
      mensagem: (
        <>
          Avisar refugo <strong>pausa o fluxo normal</strong>. A cerealista precisará confirmar antes
          de você poder anexar o CT-e de retorno.
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            Deseja continuar?
          </div>
        </>
      ),
      variante: "danger",
      confirmarLabel: "Sim, avisar refugo",
    });
    if (!ok) return;
    criarAvisoRefugo({
      oc_id: ocId!,
      motivo,
      arquivo_url: arquivoUrl || (nomeArquivo ? "pending-upload://" + nomeArquivo : undefined),
      nome_arquivo: nomeArquivo || undefined,
      avisado_por_user_id: user!.usuario_id,
      avisado_por_nome: user!.nome,
    });
    toast.warn("A cerealista foi notificada e deve confirmar para você prosseguir.", "Refugo informado");
    setMotivo("");
    setNomeArquivo("");
    setArquivoUrl("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="⚠️ Avisar Refugo da Carga"
      subtitle="Fluxo alternativo — passo 7a"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={submit}>⚠️ Confirmar Aviso de Refugo</Button>
        </>
      }
    >
      <AlertBox tone="red" icon="⚠️" title="Refugo pausa o fluxo normal">
        Ao avisar refugo, a OC é marcada como REFUGADA e o fluxo normal é interrompido. A cerealista precisa confirmar antes que você possa anexar o CT-e de retorno e a estadia (opcional).
      </AlertBox>

      <FormRow variant="single">
        <Field label="Motivo do refugo *" hint="Descreva o que aconteceu (mínimo 10 caracteres)">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Cliente recusou a carga por divergência no laudo de classificação..."
          />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Evidência (foto/laudo do destino — opcional)">
          <UploadZone label="Clique para anexar evidência do refugo" icon="📷" optional />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Nome do arquivo">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: refugo_evidencia.pdf" />
        </Field>
        <Field label="URL temporária">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
