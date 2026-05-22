"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

export function AnexarCteRetornoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { avisosRefugo, anexarCteRetorno } = useDataStore();
  const [numero, setNumero] = useState("");
  const [chave, setChave] = useState("");
  const [emitidoEm, setEmitidoEm] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!ocId || !user) return null;
  const aviso = avisosRefugo.find((a) => a.oc_id === ocId && a.status === "confirmado");

  if (!aviso) {
    return (
      <Modal open={!!ocId} onClose={onClose} title="📋 CT-e de Retorno">
        <AlertBox tone="amber" icon="ℹ️" title="Refugo ainda não foi confirmado">
          Aguarde a cerealista confirmar o refugo antes de anexar o CT-e de retorno.
        </AlertBox>
      </Modal>
    );
  }

  function submit() {
    if (!numero.trim()) {
      toast.warn("Informe o número do CT-e de retorno.");
      return;
    }
    if (!emitidoEm) {
      toast.warn("Informe a data de emissão.");
      return;
    }
    if (!nomeArquivo.trim()) {
      toast.warn("Informe o nome do arquivo do CT-e.");
      return;
    }
    anexarCteRetorno({
      oc_id: ocId!,
      aviso_refugo_id: aviso!.id,
      numero,
      chave_cte: chave || undefined,
      emitido_em: emitidoEm,
      arquivo_url: arquivoUrl || "pending-upload://" + nomeArquivo,
      nome_arquivo: nomeArquivo,
      observacoes: observacoes || undefined,
      anexado_por_user_id: user!.usuario_id,
      anexado_por_nome: user!.nome,
    });
    toast.success("Você pode anexar a estadia (opcional) se aplicável.", "CT-e de retorno anexado");
    setNumero("");
    setChave("");
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
      title="📋 Anexar CT-e de Retorno"
      subtitle="Fluxo refugado — passo 8"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>✓ Anexar CT-e Retorno</Button>
        </>
      }
    >
      <AlertBox tone="red" icon="⚠️" title="Carga refugada — CT-e de retorno">
        Cerealista confirmou o refugo em {new Date(aviso.decidido_em!).toLocaleString("pt-BR")}.
        Anexe o CT-e que documenta o transporte de retorno da carga.
      </AlertBox>

      <FormRow>
        <Field label="Número do CT-e Retorno *">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 35000123" />
        </Field>
        <Field label="Chave CT-e (opcional)">
          <Input value={chave} onChange={(e) => setChave(e.target.value)} placeholder="44 dígitos" />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Emitido em *">
          <Input type="date" value={emitidoEm} onChange={(e) => setEmitidoEm(e.target.value)} />
        </Field>
        <Field label="Nome do arquivo *">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: cte_retorno_OC-001.pdf" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Upload">
          <UploadZone label="Clique para anexar o XML/PDF do CT-e" icon="📄" required />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="URL temporária (opcional)">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes do retorno, rota..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
