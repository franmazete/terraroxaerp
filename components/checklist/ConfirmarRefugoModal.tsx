"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Badge } from "@/components/ui/Badge";
import { Field, FormRow, Textarea } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

export function ConfirmarRefugoModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { avisosRefugo, decidirAvisoRefugo } = useDataStore();
  const [observacao, setObservacao] = useState("");

  if (!ocId || !user) return null;
  const aviso = avisosRefugo.find((a) => a.oc_id === ocId && a.status === "aguardando_confirmacao");

  if (!aviso) {
    return (
      <Modal open={!!ocId} onClose={onClose} title="⚠️ Confirmar Refugo">
        <AlertBox tone="amber" icon="ℹ️" title="Nenhum aviso pendente">
          Não há aviso de refugo aguardando confirmação para esta OC.
        </AlertBox>
      </Modal>
    );
  }

  function decidir(decisao: "confirmado" | "rejeitado") {
    if (decisao === "rejeitado" && observacao.trim().length < 5) {
      toast.warn("Ao rejeitar, informe brevemente o motivo (mínimo 5 caracteres).");
      return;
    }
    decidirAvisoRefugo(
      aviso!.id,
      decisao,
      { id: user!.usuario_id, nome: user!.nome },
      observacao || undefined,
    );
    if (decisao === "confirmado") {
      toast.success("A transportadora foi notificada para anexar o CT-e de retorno.", "Refugo confirmado");
    } else {
      toast.info("O fluxo normal continua.", "Refugo rejeitado");
    }
    setObservacao("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="⚠️ Decidir sobre Refugo"
      subtitle="Fluxo alternativo — passo 7b"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => decidir("rejeitado")}>✗ Rejeitar Refugo</Button>
          <Button variant="primary" onClick={() => decidir("confirmado")}>✓ Confirmar Refugo</Button>
        </>
      }
    >
      <AlertBox tone="red" icon="⚠️" title="A transportadora informou que a carga foi refugada">
        Analise o motivo abaixo. Se confirmar, a transp poderá anexar CT-e de retorno e estadia (opcional). Se rejeitar, o fluxo normal continua.
      </AlertBox>

      <div style={{ padding: 12, background: "var(--surf2)", borderRadius: "var(--radius)", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
          Avisado por
        </div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {aviso.avisado_por_nome} · {new Date(aviso.avisado_em).toLocaleString("pt-BR")}
        </div>
        <div style={{ fontSize: 11, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
          Motivo informado
        </div>
        <div style={{ fontSize: 13, color: "var(--r600)", fontWeight: 600 }}>{aviso.motivo}</div>
        {aviso.nome_arquivo && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
            📎 Evidência: <strong>{aviso.nome_arquivo}</strong>
          </div>
        )}
      </div>

      <FormRow variant="single">
        <Field label="Observação (obrigatória ao rejeitar)" hint="Para confirmar, pode deixar em branco">
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: Confirmado conforme contato com o cliente. / Rejeitado: motivo não procede..."
          />
        </Field>
      </FormRow>
    </Modal>
  );
}
