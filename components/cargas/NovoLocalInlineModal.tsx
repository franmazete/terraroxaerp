"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, FormRow, Input, Select } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { criarLocal } from "@/lib/api/cadastros-actions";
import { useRouter } from "next/navigation";
import type { Local, TipoLocal } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Hint do tipo padrão (origem ou destino). */
  tipoSugerido?: TipoLocal;
  /** Callback chamado com o local recém-criado pra o pai selecionar automaticamente. */
  onCriado: (local: Local) => void;
}

const TIPOS: { v: TipoLocal; label: string }[] = [
  { v: "fazenda", label: "Fazenda" },
  { v: "armazem_origem", label: "Armazém de Origem" },
  { v: "destino", label: "Destino" },
  { v: "porto", label: "Porto" },
  { v: "terminal", label: "Terminal" },
];

export function NovoLocalInlineModal({ open, onClose, tipoSugerido = "armazem_origem", onCriado }: Props) {
  const { supabaseConfigured } = useAuth();
  const store = useDataStore();
  const router = useRouter();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoLocal>(tipoSugerido);
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("SP");
  const [salvando, setSalvando] = useState(false);

  // Reset quando reabre
  function reset() {
    setNome("");
    setTipo(tipoSugerido);
    setCidade("");
    setUf("SP");
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.warn("Informe o nome.");
      return;
    }
    if (!cidade.trim()) {
      toast.warn("Informe a cidade.");
      return;
    }
    setSalvando(true);
    try {
      const payload = { nome: nome.trim(), tipo, cidade: cidade.trim(), uf: uf.trim().toUpperCase() };
      if (supabaseConfigured) {
        const res = await criarLocal(payload);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Local "${nome}" criado.`);
        if (res.data) onCriado(res.data);
        router.refresh();
      } else {
        const novo = store.addLocal(payload);
        toast.success(`Local "${nome}" criado.`);
        onCriado(novo);
      }
      reset();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="📍 Novo Local (criação rápida)"
      footer={
        <>
          <Button onClick={() => { reset(); onClose(); }} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Criar local"}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Cria um local mínimo (nome + cidade/UF + tipo). Você pode completar os outros campos depois em <strong>Cadastros → Locais</strong>.
      </div>
      <FormRow>
        <Field label="Nome *">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: ITAPEVA - SILO BALEIA" autoFocus />
        </Field>
        <Field label="Tipo *">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLocal)}>
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </Select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Cidade *">
          <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Itapeva" />
        </Field>
        <Field label="UF *">
          <Input value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
        </Field>
      </FormRow>
    </Modal>
  );
}
