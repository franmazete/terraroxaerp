"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

export function AnexarEstadiaModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { anexarEstadia } = useDataStore();
  const [horas, setHoras] = useState<number | "">("");
  const [valor, setValor] = useState<number | "">("");
  const [justificativa, setJustificativa] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");

  if (!ocId || !user) return null;

  function submit() {
    if (typeof horas !== "number" || horas <= 0) {
      toast.warn("Informe as horas de estadia.");
      return;
    }
    if (typeof valor !== "number" || valor <= 0) {
      toast.warn("Informe o valor da estadia.");
      return;
    }
    if (justificativa.trim().length < 10) {
      toast.warn("Descreva a justificativa (mínimo 10 caracteres).");
      return;
    }
    anexarEstadia({
      oc_id: ocId!,
      horas_estadia: horas as number,
      valor: valor as number,
      justificativa,
      arquivo_url: arquivoUrl || (nomeArquivo ? "pending-upload://" + nomeArquivo : undefined),
      nome_arquivo: nomeArquivo || undefined,
      anexada_por_user_id: user!.usuario_id,
      anexada_por_nome: user!.nome,
    });
    toast.success(`${horas}h · R$ ${(valor as number).toFixed(2)}`, "Estadia anexada");
    setHoras("");
    setValor("");
    setJustificativa("");
    setNomeArquivo("");
    setArquivoUrl("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="⏱️ Anexar Estadia"
      subtitle="Fluxo refugado — passo 9 (opcional)"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>✓ Anexar Estadia</Button>
        </>
      }
    >
      <AlertBox tone="amber" icon="⏱️" title="Cobrança de estadia (opcional)">
        Se o caminhão ficou parado aguardando descarga ou retorno, registre as horas e o valor cobrado.
      </AlertBox>

      <FormRow>
        <Field label="Horas de estadia *">
          <NumberInput value={horas} onChange={setHoras} suffix="h" placeholder="Ex: 12" />
        </Field>
        <Field label="Valor cobrado *">
          <NumberInput value={valor} onChange={setValor} variant="currency" suffix="R$" placeholder="Ex: 850,00" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Justificativa *" hint="Descreva o motivo da estadia (mínimo 10 caracteres)">
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex: Caminhão ficou parado 12h aguardando confirmação do refugo..."
          />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Comprovante (opcional)">
          <UploadZone label="Anexe nota de cobrança da estadia" icon="📄" optional />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Nome do arquivo">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="estadia_OC-001.pdf" />
        </Field>
        <Field label="URL temporária">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
