"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select, SectionLabel, Textarea } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { fmtKg } from "@/lib/domain/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LancarOrdemModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { contratos, cargas, motoristas, veiculos, locais, terminais, emitirOrdem, transportadoras } = useDataStore();

  const [contratoId, setContratoId] = useState("");
  const [cargaId, setCargaId] = useState("");
  const [transpId, setTranspId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [localCargId, setLocalCargId] = useState("");
  const [destinoLocalId, setDestinoLocalId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [pesoKg, setPesoKg] = useState<number | "">("");
  const [obs, setObs] = useState("");

  const cargasDoContrato = useMemo(() => cargas.filter((c) => c.contrato_id === contratoId), [cargas, contratoId]);
  const motoristasDaTransp = useMemo(() => motoristas.filter((m) => transpId && m.transp_ids.includes(transpId) && m.ativo), [motoristas, transpId]);
  const veiculosDaTransp = useMemo(() => veiculos.filter((v) => transpId && v.transp_ids.includes(transpId) && v.ativo), [veiculos, transpId]);

  useEffect(() => {
    if (cargaId) {
      const c = cargas.find((x) => x.id === cargaId);
      if (c) {
        setLocalCargId(c.origem_local_id);
        setDestinoLocalId(c.destino_local_id ?? "");
      }
    }
  }, [cargaId, cargas]);

  function submit() {
    if (!contratoId) { toast.warn("Selecione o contrato."); return; }
    if (!cargaId) { toast.warn("Selecione a carga."); return; }
    if (!transpId) { toast.warn("Selecione a transportadora."); return; }
    if (!motoristaId) { toast.warn("Selecione o motorista."); return; }
    if (!veiculoId) { toast.warn("Selecione o veículo."); return; }
    const peso = typeof pesoKg === "number" ? pesoKg : 0;
    if (!peso || peso <= 0) { toast.warn("Informe o peso previsto em kg."); return; }

    emitirOrdem({
      contrato_id: contratoId,
      carga_id: cargaId,
      transp_id: transpId,
      motorista_id: motoristaId,
      veiculo_id: veiculoId,
      local_carg_id: localCargId,
      destino_local_id: destinoLocalId || undefined,
      terminal_id: terminalId || undefined,
      peso_previsto_kg: peso,
      origem: "manual_logistica",
      emitida_por: user?.nome ?? "Logística",
      observacoes: obs || undefined,
    });
    toast.success("OC lançada manualmente.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📄 Lançar OC Manualmente"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>Lançar OC</Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="ℹ️" title="Lançamento manual">
        Use para emitir OCs sem reserva prévia (carregamento direto pela logística). OCs originadas de reservas aprovadas são geradas automaticamente.
      </AlertBox>

      <SectionLabel>Vínculo</SectionLabel>
      <FormRow>
        <Field label="Contrato *">
          <Select value={contratoId} onChange={(e) => { setContratoId(e.target.value); setCargaId(""); }}>
            <option value="">Selecione...</option>
            {contratos.filter((c) => c.status === "ativo").map((c) => (
              <option key={c.id} value={c.id}>{c.numero} — saldo {fmtKg(c.saldo_kg)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Carga *" hint={contratoId ? `${cargasDoContrato.length} carga(s) deste contrato` : "Selecione o contrato primeiro"}>
          <Select value={cargaId} onChange={(e) => setCargaId(e.target.value)} disabled={!contratoId}>
            <option value="">Selecione...</option>
            {cargasDoContrato.map((c) => (
              <option key={c.id} value={c.id}>{c.id} — {fmtKg(c.total_kg)} ({c.status})</option>
            ))}
          </Select>
        </Field>
      </FormRow>

      <SectionLabel>Transporte</SectionLabel>
      <FormRow>
        <Field label="Transportadora *">
          <Select value={transpId} onChange={(e) => { setTranspId(e.target.value); setMotoristaId(""); setVeiculoId(""); }}>
            <option value="">Selecione...</option>
            {transportadoras.filter((t) => t.status === "ativa").map((t) => (
              <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
            ))}
          </Select>
        </Field>
        <Field label="Peso Previsto (kg) *">
          <NumberInput value={pesoKg} onChange={setPesoKg} placeholder="Ex: 40.000" suffix="kg" />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Motorista *" hint={!transpId ? "Selecione a transp primeiro" : `${motoristasDaTransp.length} cadastrados`}>
          <Select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} disabled={!transpId}>
            <option value="">Selecione...</option>
            {motoristasDaTransp.map((m) => (
              <option key={m.id} value={m.id}>{m.nome} — CPF {m.cpf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Veículo *" hint={!transpId ? "Selecione a transp primeiro" : `${veiculosDaTransp.length} cadastrados`}>
          <Select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={!transpId}>
            <option value="">Selecione...</option>
            {veiculosDaTransp.map((v) => (
              <option key={v.id} value={v.id}>{v.placa_cavalo} — {v.tipo} — {fmtKg(v.capacidade_kg)}</option>
            ))}
          </Select>
        </Field>
      </FormRow>

      <SectionLabel>Trajeto</SectionLabel>
      <FormRow>
        <Field label="Local de Carregamento *">
          <Select value={localCargId} onChange={(e) => setLocalCargId(e.target.value)}>
            {locais.filter((l) => l.tipo === "fazenda" || l.tipo === "armazem_origem").map((l) => (
              <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Destino *">
          <Select value={destinoLocalId} onChange={(e) => setDestinoLocalId(e.target.value)}>
            {locais.filter((l) => l.tipo === "destino" || l.tipo === "porto" || l.tipo === "terminal").map((l) => (
              <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
            ))}
          </Select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Terminal (opcional)">
          <Select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
            <option value="">Sem terminal</option>
            {terminais.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="—"><div /></Field>
      </FormRow>

      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>
      </FormRow>
    </Modal>
  );
}
