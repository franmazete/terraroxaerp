"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Textarea } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { buildOCSnapshot } from "@/lib/domain/oc-snapshot";
import { calcularQuebra } from "@/lib/domain/checklist";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

const LIMITE_PCT = 0.5;

export function CalcularQuebraModal({ ocId, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const store = useDataStore();
  const { calcularQuebraOC } = store;
  const [pesoCarregadoOverride, setPesoCarregadoOverride] = useState<number | "">("");
  const [pesoDescarregadoOverride, setPesoDescarregadoOverride] = useState<number | "">("");
  const [justTransp, setJustTransp] = useState("");
  const [obsFiscal, setObsFiscal] = useState("");

  const snap = ocId ? buildOCSnapshot(ocId, store) : null;

  // Valores pré-preenchidos do snapshot (ticket de carregamento + dados de descarga)
  const pesoCarregadoBase = snap?.ticketCarreg?.peso_liquido_kg ?? 0;
  // Quando refugada e há CT-e retorno, considera o ciclo concluído mesmo com peso 0 no destino
  const pesoDescarregadoBase = snap?.descarga?.peso_descarregado_kg ?? 0;

  const pesoCarregado =
    typeof pesoCarregadoOverride === "number" && pesoCarregadoOverride > 0
      ? pesoCarregadoOverride
      : pesoCarregadoBase;
  const pesoDescarregado =
    typeof pesoDescarregadoOverride === "number"
      ? pesoDescarregadoOverride
      : pesoDescarregadoBase;

  const calc = useMemo(
    () => calcularQuebra(pesoCarregado, pesoDescarregado, LIMITE_PCT),
    [pesoCarregado, pesoDescarregado],
  );

  if (!ocId || !user) return null;

  if (!snap?.ticketCarreg || !snap?.descarga) {
    return (
      <Modal open={!!ocId} onClose={onClose} title="⚖️ Calcular Quebra">
        <AlertBox tone="amber" icon="ℹ️" title="Faltam pesos para calcular">
          O cálculo da quebra exige ticket de carregamento (peso na origem) E dados de descarga (peso no destino).
          {!snap?.ticketCarreg && <div style={{ marginTop: 6 }}>• Ticket de carregamento ainda não foi anexado.</div>}
          {!snap?.descarga && <div style={{ marginTop: 6 }}>• Dados de descarga ainda não foram registrados.</div>}
        </AlertBox>
      </Modal>
    );
  }

  function submit() {
    if (pesoCarregado <= 0) {
      toast.warn("Informe o peso carregado.");
      return;
    }
    if (pesoDescarregado < 0) {
      toast.warn("Peso descarregado inválido.");
      return;
    }
    if (calc.alerta) {
      if (justTransp.trim().length < 10) {
        toast.warn(
          `Quebra acima de ${LIMITE_PCT}%. Justificativa da transp obrigatória (mín. 10 caracteres).`,
        );
        return;
      }
      if (obsFiscal.trim().length < 10) {
        toast.warn("Observação fiscal obrigatória ao validar quebra acima do limite (mín. 10 caracteres).");
        return;
      }
    }
    const r = calcularQuebraOC({
      oc_id: ocId!,
      peso_carregado_kg: pesoCarregado,
      peso_descarregado_kg: pesoDescarregado,
      justificativa_transp: justTransp || undefined,
      observacao_fiscal: obsFiscal || undefined,
      user: { id: user!.usuario_id, nome: user!.nome },
    });
    if (!r) {
      toast.error("Falha ao calcular quebra. Verifique os dados.");
      return;
    }
    const resumo = `${calc.quebra_kg.toLocaleString("pt-BR")} kg (${calc.quebra_pct.toFixed(2)}%) — ${
      calc.alerta ? "acima do limite, registrada com justificativa" : "OK"
    }. Liberada para faturamento.`;
    if (calc.alerta) {
      toast.warn(resumo, "Quebra calculada");
    } else {
      toast.success(resumo, "Quebra calculada");
    }
    setPesoCarregadoOverride("");
    setPesoDescarregadoOverride("");
    setJustTransp("");
    setObsFiscal("");
    onClose();
  }

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="⚖️ Calcular Quebra (Origem × Destino)"
      subtitle={`Passo 10 — fiscal · limite operacional ${LIMITE_PCT}%`}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>
            ✓ {calc.alerta ? "Validar com justificativa" : "Calcular e validar"}
          </Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="ℹ️" title="Como funciona o cálculo">
        Quebra = peso carregado (origem) − peso descarregado (destino).<br />
        Limite operacional: {LIMITE_PCT}%. Acima disso, exige justificativa da transportadora E observação fiscal.
      </AlertBox>

      <FormRow>
        <Field
          label="Peso Carregado (origem) *"
          hint={`Pré-preenchido com ticket de carregamento: ${pesoCarregadoBase.toLocaleString("pt-BR")} kg`}
        >
          <NumberInput
            value={pesoCarregadoOverride === "" ? pesoCarregadoBase : pesoCarregadoOverride}
            onChange={setPesoCarregadoOverride}
            suffix="kg"
          />
        </Field>
        <Field
          label="Peso Descarregado (destino) *"
          hint={`Pré-preenchido com dados de descarga: ${pesoDescarregadoBase.toLocaleString("pt-BR")} kg`}
        >
          <NumberInput
            value={pesoDescarregadoOverride === "" ? pesoDescarregadoBase : pesoDescarregadoOverride}
            onChange={setPesoDescarregadoOverride}
            suffix="kg"
          />
        </Field>
      </FormRow>

      <div
        style={{
          background: calc.alerta ? "var(--r100)" : "var(--g100)",
          border: `2px solid ${calc.alerta ? "var(--r600)" : "var(--g500)"}`,
          borderRadius: "var(--radius)",
          padding: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14, color: calc.alerta ? "var(--r600)" : "var(--g700)" }}>
            {calc.alerta ? "⚠️ ALERTA — Quebra acima do limite" : "✓ Quebra dentro do limite"}
          </strong>
          <strong style={{ fontSize: 18, color: calc.alerta ? "var(--r600)" : "var(--g700)" }}>
            {calc.quebra_pct.toFixed(2)}%
          </strong>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Diferença: <strong>{calc.quebra_kg.toLocaleString("pt-BR")} kg</strong> (carregado − descarregado).
          {calc.alerta && (
            <>
              {" "}
              Esta operação está <strong>acima de {LIMITE_PCT}%</strong> — exige justificativa da transportadora e observação fiscal antes de prosseguir.
            </>
          )}
        </div>
      </div>

      {calc.alerta && (
        <>
          <FormRow variant="single">
            <Field label="Justificativa da transportadora *" hint="Obrigatório quando quebra > 0,5%">
              <Textarea
                value={justTransp}
                onChange={(e) => setJustTransp(e.target.value)}
                placeholder="Ex: Cliente reclamou perdas no transbordo no porto. Comprovante anexado no documento X..."
              />
            </Field>
          </FormRow>
          <FormRow variant="single">
            <Field label="Observação fiscal *" hint="Decisão do fiscal sobre a quebra">
              <Textarea
                value={obsFiscal}
                onChange={(e) => setObsFiscal(e.target.value)}
                placeholder="Ex: Aceito a justificativa. Encaminhar para faturamento. / Não aceito — abrir glosa..."
              />
            </Field>
          </FormRow>
        </>
      )}
    </Modal>
  );
}
