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

export function AnexarAgendamentoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { anexarAnexoAgendamento } = useDataStore();
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!ocId || !user) return null;

  function submit() {
    if (!dataAgendamento) {
      toast.warn("Informe a data do agendamento.");
      return;
    }
    if (!nomeArquivo.trim()) {
      toast.warn("Informe o nome do arquivo.");
      return;
    }
    anexarAnexoAgendamento({
      oc_id: ocId!,
      data_agendamento: dataAgendamento,
      horario_inicio: horarioInicio || undefined,
      horario_fim: horarioFim || undefined,
      arquivo_url: arquivoUrl || "pending-upload://" + nomeArquivo,
      nome_arquivo: nomeArquivo,
      observacoes: observacoes || undefined,
      anexado_por_user_id: user!.usuario_id,
      anexado_por_nome: user!.nome,
    });
    toast.success(
      "A transportadora agora pode anexar o CT-e e iniciar o trânsito.",
      "Agendamento anexado",
    );
    setDataAgendamento("");
    setHorarioInicio("");
    setHorarioFim("");
    setNomeArquivo("");
    setArquivoUrl("");
    setObservacoes("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="📅 Anexar Comprovante de Agendamento"
      subtitle="Passo 5 — agendamento no destino"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>✓ Anexar Agendamento</Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="📅" title="Agendamento no porto/destino">
        Anexe o comprovante de agendamento emitido pelo destino. Ao confirmar, a transp é notificada para anexar o CT-e e iniciar o trânsito.
      </AlertBox>

      <FormRow>
        <Field label="Data do agendamento *">
          <Input type="date" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)} />
        </Field>
        <Field label="Janela horária (opcional)">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
            <span style={{ color: "var(--hint)" }}>às</span>
            <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
          </div>
        </Field>
      </FormRow>

      <FormRow variant="single">
        <Field label="Arquivo do comprovante">
          <UploadZone label="Clique para anexar o comprovante" icon="📄" required />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Nome do arquivo *">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: agendamento_OC-2026-001.pdf" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="URL temporária (opcional)">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Janela alternativa, restrições do destino..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
