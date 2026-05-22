"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import type { Carga, Reserva } from "@/lib/types";

interface Props {
  /** Dados da reserva aprovada. */
  data: { carga: Carga; reserva: Reserva } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AnexarAutorizacaoModal({ data, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { anexarAutorizacaoCarregamento } = useDataStore();
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!data || !user) return null;
  const { carga, reserva } = data;

  function submit() {
    if (!nomeArquivo.trim()) { toast.warn("Informe o nome do arquivo de autorização."); return; }
    const r = anexarAutorizacaoCarregamento({
      reserva_id: reserva.id,
      carga_id: carga.id,
      transp_id: reserva.transp_id,
      arquivo_url: arquivoUrl || "pending-upload://" + nomeArquivo,
      nome_arquivo: nomeArquivo,
      observacoes: observacoes || undefined,
      anexada_por_user_id: user!.usuario_id,
      anexada_por_nome: user!.nome,
    });
    if (!r) {
      toast.error(
        "Verifique se a reserva está aprovada, com motorista/veículo definidos e ainda não tem autorização anexada.",
        "Não foi possível anexar",
      );
      return;
    }
    toast.success(
      `OC ${r.oc.numero} gerada automaticamente. Aguarde instruções da logística.`,
      "Autorização anexada",
    );
    setArquivoUrl("");
    setNomeArquivo("");
    setObservacoes("");
    onSuccess?.();
    onClose();
  }

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title={<>📋 Anexar Autorização de Carregamento</>}
      subtitle={<>Reserva {reserva.id} · {carga.produto} · {carga.origem} → {carga.destino || "Destino a definir"}</>}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>
            ✓ Confirmar e gerar OC
          </Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="📋" title="Documento obrigatório">
        A autorização de carregamento é o documento emitido pela sua transportadora autorizando a operação.
        Ao anexar, o sistema irá <strong>gerar automaticamente a Ordem de Carregamento (OC)</strong> e liberar
        a fazenda para iniciar o carregamento.
      </AlertBox>

      <FormRow variant="single">
        <Field label="Arquivo da autorização">
          <UploadZone label="Clique para anexar o PDF da autorização" icon="📄" required />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Nome do arquivo *" hint="No mock, informe o nome do arquivo. Upload real virá na Etapa 4 (Supabase Storage).">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: autorizacao_TR-001_CRG-001.pdf" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="URL temporária (opcional)" hint="Cole uma URL pública pra teste de visualização">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Informações adicionais relevantes..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
