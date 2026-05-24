"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Textarea, UploadZone } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { anexarAutorizacaoAction } from "@/lib/api/actions";
import type { Carga, Reserva } from "@/lib/types";

interface Props {
  /** Dados da reserva aprovada. */
  data: { carga: Carga; reserva: Reserva } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AnexarAutorizacaoModal({ data, onClose, onSuccess }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { anexarAutorizacaoCarregamento } = useDataStore();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!data || !user) return null;
  const { carga, reserva } = data;

  async function submit() {
    if (!user) return;
    if (!arquivo) {
      toast.warn("Selecione o arquivo da autorização.");
      return;
    }

    setEnviando(true);
    try {
      if (supabaseConfigured) {
        // Modo real: monta FormData e chama Server Action
        const fd = new FormData();
        fd.append("arquivo", arquivo);
        fd.append("reserva_id", reserva.id);
        fd.append("carga_id", carga.id);
        if (observacoes.trim()) fd.append("observacoes", observacoes.trim());

        const res = await anexarAutorizacaoAction(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(
          `OC ${res.data!.ocNumero} gerada automaticamente. Aguarde instruções da logística.`,
          "Autorização anexada",
        );
        setArquivo(null);
        setObservacoes("");
        router.refresh();
        onSuccess?.();
        onClose();
        return;
      }

      // Fallback mock
      const r = anexarAutorizacaoCarregamento({
        reserva_id: reserva.id,
        carga_id: carga.id,
        transp_id: reserva.transp_id,
        arquivo_url: "mock://" + arquivo.name,
        nome_arquivo: arquivo.name,
        observacoes: observacoes || undefined,
        anexada_por_user_id: user.usuario_id,
        anexada_por_nome: user.nome,
      });
      if (!r) {
        toast.error(
          "Verifique se a reserva está aprovada, com motorista/veículo definidos e ainda não tem autorização anexada.",
          "Não foi possível anexar",
        );
        return;
      }
      toast.success(
        `OC ${r.oc.numero} gerada automaticamente.`,
        "Autorização anexada",
      );
      setArquivo(null);
      setObservacoes("");
      onSuccess?.();
      onClose();
    } finally {
      setEnviando(false);
    }
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
          <Button onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={enviando}>
            {enviando ? "Enviando..." : "✓ Confirmar e gerar OC"}
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
        <Field label="Arquivo da autorização *" hint="PDF ou imagem · até 20MB">
          <UploadZone
            label="Clique para escolher o arquivo da autorização"
            icon="📄"
            required
            onFileSelected={setArquivo}
            accept="application/pdf,image/*"
          />
        </Field>
      </FormRow>

      <FormRow variant="single">
        <Field label="Observações (opcional)">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Informações adicionais relevantes..."
          />
        </Field>
      </FormRow>
    </Modal>
  );
}
