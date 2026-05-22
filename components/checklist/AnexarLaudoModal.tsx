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

export function AnexarLaudoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { anexarLaudoClassificacao } = useDataStore();
  const [umidade, setUmidade] = useState<number | "">("");
  const [impurezas, setImpurezas] = useState<number | "">("");
  const [avariados, setAvariados] = useState<number | "">("");
  const [emitidoEm, setEmitidoEm] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!ocId || !user) return null;

  function submit() {
    if (!nomeArquivo.trim()) {
      toast.warn("Informe o nome do arquivo do laudo.");
      return;
    }
    anexarLaudoClassificacao({
      oc_id: ocId!,
      arquivo_url: arquivoUrl || "pending-upload://" + nomeArquivo,
      nome_arquivo: nomeArquivo,
      umidade_pct: typeof umidade === "number" ? umidade : undefined,
      impurezas_pct: typeof impurezas === "number" ? impurezas : undefined,
      avariados_pct: typeof avariados === "number" ? avariados : undefined,
      emitido_em: emitidoEm || undefined,
      anexado_por_user_id: user!.usuario_id,
      anexado_por_nome: user!.nome,
      observacoes: observacoes || undefined,
    });
    toast.success("Laudo de classificação anexado.");
    setUmidade("");
    setImpurezas("");
    setAvariados("");
    setEmitidoEm("");
    setNomeArquivo("");
    setArquivoUrl("");
    setObservacoes("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="🔬 Anexar Laudo de Classificação"
      subtitle="Passo 3 (opcional) — qualidade do grão"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>✓ Anexar Laudo</Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="🔬" title="Passo opcional">
        O laudo registra umidade, impurezas e grãos avariados — não é obrigatório para o fluxo continuar.
      </AlertBox>

      <FormRow variant="triple">
        <Field label="Umidade (%)">
          <NumberInput value={umidade} onChange={setUmidade} suffix="%" placeholder="Ex: 12,5" variant="currency" />
        </Field>
        <Field label="Impurezas (%)">
          <NumberInput value={impurezas} onChange={setImpurezas} suffix="%" placeholder="Ex: 1,0" variant="currency" />
        </Field>
        <Field label="Avariados (%)">
          <NumberInput value={avariados} onChange={setAvariados} suffix="%" placeholder="Ex: 4,2" variant="currency" />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Data do laudo">
          <Input type="date" value={emitidoEm} onChange={(e) => setEmitidoEm(e.target.value)} />
        </Field>
        <Field label="Nome do arquivo *">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: laudo_OC-2026-001.pdf" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Upload do laudo">
          <UploadZone label="Clique para anexar PDF do laudo" icon="📄" optional />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="URL temporária (opcional)">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Restrições, peso da amostra, classificador..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
