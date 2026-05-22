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

export function AnexarTicketCarregamentoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { anexarTicketCarregamento } = useDataStore();
  const [pesoBruto, setPesoBruto] = useState<number | "">("");
  const [pesoTara, setPesoTara] = useState<number | "">("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [arquivoUrl, setArquivoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!ocId || !user) return null;

  const bruto = typeof pesoBruto === "number" ? pesoBruto : 0;
  const tara = typeof pesoTara === "number" ? pesoTara : 0;
  const liquido = Math.max(0, bruto - tara);

  function submit() {
    if (bruto <= 0) {
      toast.warn("Informe o peso bruto.");
      return;
    }
    if (tara <= 0) {
      toast.warn("Informe o peso da tara.");
      return;
    }
    if (tara >= bruto) {
      toast.error("A tara não pode ser maior ou igual ao peso bruto.");
      return;
    }
    if (!nomeArquivo.trim()) {
      toast.warn("Informe o nome do arquivo do ticket.");
      return;
    }

    anexarTicketCarregamento({
      oc_id: ocId!,
      peso_bruto_kg: bruto,
      peso_tara_kg: tara,
      arquivo_url: arquivoUrl || "pending-upload://" + nomeArquivo,
      nome_arquivo: nomeArquivo,
      carregado_por_user_id: user!.usuario_id,
      carregado_por_nome: user!.nome,
      observacoes: observacoes || undefined,
    });
    toast.success(
      `Peso líquido: ${liquido.toLocaleString("pt-BR")} kg. A cerealista pode anexar a NF.`,
      "Ticket anexado",
    );
    setPesoBruto("");
    setPesoTara("");
    setNomeArquivo("");
    setArquivoUrl("");
    setObservacoes("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="📊 Anexar Ticket de Carregamento"
      subtitle="Passo 2 — peso bruto + tara da fazenda"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>✓ Anexar Ticket</Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="📊" title="Ticket de pesagem na origem">
        O ticket é emitido pela balança da fazenda. Informe peso bruto e tara — o sistema calcula o peso líquido automaticamente.
      </AlertBox>

      <FormRow>
        <Field label="Peso Bruto *" hint="Caminhão + carga (kg)">
          <NumberInput value={pesoBruto} onChange={setPesoBruto} suffix="kg" placeholder="Ex: 45.500" />
        </Field>
        <Field label="Peso Tara *" hint="Caminhão vazio (kg)">
          <NumberInput value={pesoTara} onChange={setPesoTara} suffix="kg" placeholder="Ex: 12.500" />
        </Field>
      </FormRow>

      {liquido > 0 && (
        <div style={{ background: "var(--g100)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 12, fontSize: 14, color: "var(--g700)", fontWeight: 700 }}>
          📊 Peso Líquido (carga): {liquido.toLocaleString("pt-BR")} kg
        </div>
      )}

      <FormRow variant="single">
        <Field label="Arquivo do ticket">
          <UploadZone label="Clique para anexar o PDF/foto do ticket" icon="📄" required />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Nome do arquivo *" hint="Mock: digite o nome. Upload real na Etapa 4.">
          <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} placeholder="Ex: ticket_carg_OC-2026-001.pdf" />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="URL temporária (opcional)">
          <Input value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)} placeholder="https://..." />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes do carregamento..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
