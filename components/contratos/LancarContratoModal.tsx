"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select, SectionLabel, Textarea, UploadZone } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { publicarContratoAction } from "@/lib/api/actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Constante: peso de uma saca padrão de grãos (kg). */
const KG_POR_SACA = 60;

interface FormState {
  numero_manual: string;
  tipo_contrato: "compra" | "venda";
  produtor_id: string;
  local_origem_id: string;
  produto_id: string;
  qtd_kg_total: number | "";
  cliente_id: string;
  destino_local_id: string;
  terminal_id: string;
  data_emissao: string;
  data_vencimento: string;
  /** R$ por saca de 60 kg (convenção do mercado). */
  valor_saca: number | "";
  valor_total: number | "";
  observacoes: string;
}

const EMPTY: FormState = {
  numero_manual: "",
  tipo_contrato: "compra",
  produtor_id: "",
  local_origem_id: "",
  produto_id: "",
  qtd_kg_total: "",
  cliente_id: "",
  destino_local_id: "",
  terminal_id: "",
  data_emissao: new Date().toISOString().split("T")[0],
  data_vencimento: "",
  valor_saca: "",
  valor_total: "",
  observacoes: "",
};

export function LancarContratoModal({ open, onClose }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { produtores, clientes, produtos, locais, terminais, publicarContrato } = useDataStore();
  const [form, setForm] = useState<FormState>(EMPTY);

  const locaisOrigem = locais.filter((l) => l.tipo === "fazenda" || l.tipo === "armazem_origem");
  const locaisDestino = locais.filter((l) => l.tipo === "destino" || l.tipo === "porto" || l.tipo === "terminal");

  // Auto-preencher local de origem ao selecionar produtor (Bloco I.4½)
  useEffect(() => {
    if (!form.produtor_id) return;
    const localDoProdutor = locais.find(
      (l) => l.vinculado_a?.entidade === "produtor" && l.vinculado_a.id === form.produtor_id,
    );
    if (localDoProdutor && form.local_origem_id !== localDoProdutor.id) {
      setForm((f) => ({ ...f, local_origem_id: localDoProdutor.id }));
    }
  }, [form.produtor_id, locais]);

  const qtdSacas = useMemo(() => {
    if (typeof form.qtd_kg_total !== "number" || form.qtd_kg_total <= 0) return 0;
    return form.qtd_kg_total / KG_POR_SACA;
  }, [form.qtd_kg_total]);

  /** Ao editar VALOR TOTAL: recalcula valor_saca (se houver qtd). */
  function onChangeValorTotal(novo: number | "") {
    setForm((f) => {
      if (novo === "" || qtdSacas === 0) return { ...f, valor_total: novo };
      const novoValorSaca = +(novo / qtdSacas).toFixed(2);
      return { ...f, valor_total: novo, valor_saca: novoValorSaca };
    });
  }

  /** Ao editar VALOR DA SACA: recalcula valor_total (se houver qtd). */
  function onChangeValorSaca(novo: number | "") {
    setForm((f) => {
      if (novo === "" || qtdSacas === 0) return { ...f, valor_saca: novo };
      const novoValorTotal = +(novo * qtdSacas).toFixed(2);
      return { ...f, valor_saca: novo, valor_total: novoValorTotal };
    });
  }

  useEffect(() => {
    if (!open) setForm(EMPTY);
  }, [open]);

  async function submit() {
    if (!form.produtor_id) { toast.warn("Selecione o produtor."); return; }
    if (!form.local_origem_id) { toast.warn("Selecione o local de origem."); return; }
    if (!form.produto_id) { toast.warn("Selecione o produto."); return; }
    if (form.qtd_kg_total === "" || form.qtd_kg_total <= 0) { toast.warn("Informe a quantidade em kg."); return; }

    // Calcula valor_unitario (R$/kg) a partir do valor_saca (convenção do mercado é em saca de 60kg).
    const valorUnitarioKg =
      typeof form.valor_saca === "number" && form.valor_saca > 0
        ? +(form.valor_saca / KG_POR_SACA).toFixed(4)
        : undefined;

    const qtd = form.qtd_kg_total as number;

    if (supabaseConfigured) {
      // ─── Modo Supabase real: Server Action ────────────────────────────
      const r = await publicarContratoAction({
        produtor_id: form.produtor_id,
        produto_id: form.produto_id,
        local_origem_id: form.local_origem_id,
        qtd_kg_total: qtd,
        numero_manual: form.numero_manual || undefined,
        cliente_id: form.cliente_id || undefined,
        destino_local_id: form.destino_local_id || undefined,
        data_emissao: form.data_emissao || undefined,
        data_vencimento: form.data_vencimento || undefined,
        valor_unitario: valorUnitarioKg,
        valor_total: form.valor_total === "" ? undefined : (form.valor_total as number),
        observacoes: form.observacoes || undefined,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        "Para publicar cargas, abra o contrato e clique em 'Disponibilizar para publicação'.",
        "Contrato criado",
      );
      router.refresh(); // re-fetcha o Server Component
      onClose();
      return;
    }

    // ─── Modo mock (fallback) ─────────────────────────────────────────
    publicarContrato({
      numero_manual: form.numero_manual || undefined,
      tipo_contrato: form.tipo_contrato,
      produtor_id: form.produtor_id,
      local_origem_id: form.local_origem_id,
      produto_id: form.produto_id,
      qtd_kg_total: qtd,
      cliente_id: form.cliente_id || undefined,
      destino_local_id: form.destino_local_id || undefined,
      terminal_id: form.terminal_id || undefined,
      data_emissao: form.data_emissao || undefined,
      data_vencimento: form.data_vencimento || undefined,
      valor_unitario: valorUnitarioKg,
      valor_total: form.valor_total === "" ? undefined : form.valor_total,
      observacoes: form.observacoes || undefined,
      anexos: [],
      status: "ativo",
      criado_por: user?.nome ?? "Sistema",
    });
    toast.success(
      "Para publicar cargas, abra o contrato e clique em 'Disponibilizar para publicação'.",
      "Contrato criado",
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📑 Lançar Novo Contrato"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>Lançar Contrato</Button>
        </>
      }
    >
      <AlertBox tone="amber" icon="🔒" title="Dados internos + status inicial">
        Os dados deste contrato NÃO serão exibidos para transportadoras. Cliente e destino podem ser preenchidos depois.
        O contrato nasce <strong>indisponível para publicação</strong> — disponibilize-o no detalhe quando estiver pronto.
      </AlertBox>

      <SectionLabel>Identificação do Contrato</SectionLabel>
      <FormRow>
        <Field label="Número do Contrato (manual)" hint="Opcional — se vazio, o sistema gera um número automático">
          <Input value={form.numero_manual} onChange={(e) => setForm({ ...form, numero_manual: e.target.value })} placeholder="Ex: CT-EXP-2026-15" />
        </Field>
        <Field label="Tipo *" hint="Compra: cerealista compra do produtor. Venda: cerealista vende ao cliente.">
          <Select value={form.tipo_contrato} onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value as "compra" | "venda" })}>
            <option value="compra">🛒 Contrato de Compra (cerealista compra)</option>
            <option value="venda">💰 Contrato de Venda (cerealista vende)</option>
          </Select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Data de Emissão">
          <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
        </Field>
        <Field label="Data de Vencimento">
          <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
        </Field>
      </FormRow>

      <SectionLabel>Origem (Produtor / Fornecedor)</SectionLabel>
      <FormRow>
        <Field label="Produtor *" hint="Ao selecionar, o local de origem é preenchido automaticamente">
          <Select value={form.produtor_id} onChange={(e) => setForm({ ...form, produtor_id: e.target.value })}>
            <option value="">Selecione...</option>
            {produtores.filter((p) => p.ativo).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}{p.razao_social ? ` (${p.razao_social})` : ""} — {p.cidade}/{p.uf}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Local de Origem (fazenda/armazém) *" hint={form.produtor_id ? "Pré-selecionado pelo produtor — pode trocar" : "Selecione o produtor primeiro"}>
          <Select value={form.local_origem_id} onChange={(e) => setForm({ ...form, local_origem_id: e.target.value })}>
            <option value="">Selecione...</option>
            {(() => {
              const atual = locais.find((l) => l.id === form.local_origem_id);
              const lista = atual && !locaisOrigem.some((l) => l.id === atual.id) ? [atual, ...locaisOrigem] : locaisOrigem;
              return lista.map((l) => (
                <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
              ));
            })()}
          </Select>
        </Field>
      </FormRow>

      <SectionLabel>Produto, Quantidade e Valores</SectionLabel>
      <FormRow>
        <Field label="Produto *">
          <Select value={form.produto_id} onChange={(e) => setForm({ ...form, produto_id: e.target.value })}>
            <option value="">Selecione...</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="Quantidade Total *">
          <NumberInput
            value={form.qtd_kg_total}
            onChange={(n) => setForm({ ...form, qtd_kg_total: n })}
            placeholder="Ex: 1.500.000"
            suffix="kg"
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field
          label="Valor Total do Contrato"
          hint={qtdSacas > 0 ? `Equivale a ${qtdSacas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sacas de ${KG_POR_SACA} kg` : "Negociado no mercado — preencha total OU valor/saca"}
        >
          <NumberInput
            value={form.valor_total}
            onChange={onChangeValorTotal}
            variant="currency"
            placeholder="0,00"
            suffix="R$"
          />
        </Field>
        <Field label="Valor por Saca (60 kg)" hint="Convenção do mercado de grãos — bidirecional com o total">
          <NumberInput
            value={form.valor_saca}
            onChange={onChangeValorSaca}
            variant="currency"
            placeholder="0,00"
            suffix="R$/saca"
          />
        </Field>
      </FormRow>
      {qtdSacas > 0 && (typeof form.valor_total === "number" || typeof form.valor_saca === "number") && (
        <div style={{ fontSize: 11, color: "var(--g700)", marginTop: -8, marginBottom: 12, padding: "8px 10px", background: "var(--g100)", borderRadius: "var(--radius)" }}>
          📊 {qtdSacas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sacas × R$ {(typeof form.valor_saca === "number" ? form.valor_saca : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/saca = <strong>R$ {(typeof form.valor_total === "number" ? form.valor_total : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
        </div>
      )}

      <SectionLabel>Destino (Cliente Comprador — opcional)</SectionLabel>
      <AlertBox tone="blue" icon="ℹ️" title="Cliente e destino podem ficar em branco">
        Se o cliente comprador ainda não está definido, deixe em branco e atualize depois pelo botão "Editar" no detalhe do contrato.
      </AlertBox>
      <FormRow>
        <Field label="Cliente Comprador">
          <Select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
            <option value="">— A definir —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} — {c.cidade}/{c.uf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Local de Destino">
          <Select value={form.destino_local_id} onChange={(e) => setForm({ ...form, destino_local_id: e.target.value })}>
            <option value="">— A definir —</option>
            {locaisDestino.map((l) => (
              <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
            ))}
          </Select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Terminal (opcional)">
          <Select value={form.terminal_id} onChange={(e) => setForm({ ...form, terminal_id: e.target.value })}>
            <option value="">Sem terminal específico</option>
            {terminais.map((t) => (
              <option key={t.id} value={t.id}>{t.nome} — {t.tipo}</option>
            ))}
          </Select>
        </Field>
        <Field label="—">
          <div />
        </Field>
      </FormRow>

      <SectionLabel>Observações e Anexos</SectionLabel>
      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Especificações técnicas, qualidade exigida, restrições..." />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Anexar contrato (PDF)">
          <UploadZone label="Clique para anexar contrato físico" icon="📑" optional />
        </Field>
        <Field label="Outros anexos">
          <UploadZone label="Clique para anexar documentos adicionais" icon="📎" optional />
        </Field>
      </FormRow>
    </Modal>
  );
}
