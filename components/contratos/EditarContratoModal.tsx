"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select, SectionLabel, Textarea } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import type { Contrato, ContratoStatus } from "@/lib/types";

interface Props {
  contrato: Contrato | null;
  onClose: () => void;
}

const KG_POR_SACA = 60;

const STATUS_OPTIONS: { v: ContratoStatus; label: string }[] = [
  { v: "ativo", label: "Ativo" },
  { v: "concluido", label: "Concluído" },
  { v: "cancelado", label: "Cancelado" },
  { v: "rascunho", label: "Rascunho" },
];

export function EditarContratoModal({ contrato, onClose }: Props) {
  const { atualizarContrato, clientes, locais, terminais, produtos } = useDataStore();
  const toast = useToast();

  const [numeroManual, setNumeroManual] = useState("");
  const [qtdKgTotal, setQtdKgTotal] = useState<number | "">("");
  const [clienteId, setClienteId] = useState("");
  const [destinoLocalId, setDestinoLocalId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [valorSaca, setValorSaca] = useState<number | "">("");
  const [valorTotal, setValorTotal] = useState<number | "">("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<ContratoStatus>("ativo");

  // Pré-preencher quando o contrato muda
  useEffect(() => {
    if (!contrato) return;
    setNumeroManual(contrato.numero_manual ?? "");
    setQtdKgTotal(contrato.qtd_kg_total);
    setClienteId(contrato.cliente_id ?? "");
    setDestinoLocalId(contrato.destino_local_id ?? "");
    setTerminalId(contrato.terminal_id ?? "");
    setDataEmissao(contrato.data_emissao ?? "");
    setDataVencimento(contrato.data_vencto_financeiro ?? "");
    setValorTotal(contrato.valor_total ?? "");
    // R$/kg → R$/saca (60kg)
    setValorSaca(typeof contrato.valor_unitario === "number" ? +(contrato.valor_unitario * KG_POR_SACA).toFixed(2) : "");
    setObservacoes(contrato.observacoes ?? "");
    setStatus(contrato.status);
  }, [contrato]);

  if (!contrato) return null;

  const qtdSacas =
    typeof qtdKgTotal === "number" && qtdKgTotal > 0 ? qtdKgTotal / KG_POR_SACA : 0;

  function onChangeValorTotal(n: number | "") {
    setValorTotal(n);
    if (n !== "" && qtdSacas > 0) {
      setValorSaca(+(n / qtdSacas).toFixed(2));
    }
  }
  function onChangeValorSaca(n: number | "") {
    setValorSaca(n);
    if (n !== "" && qtdSacas > 0) {
      setValorTotal(+(n * qtdSacas).toFixed(2));
    }
  }

  function salvar() {
    if (qtdKgTotal === "" || qtdKgTotal <= 0) {
      toast.warn("Informe a quantidade total em kg.");
      return;
    }
    // Saldo não pode ficar negativo
    const consumido = contrato!.qtd_kg_total - contrato!.saldo_kg;
    if ((qtdKgTotal as number) < consumido) {
      toast.error(
        `Não é possível reduzir abaixo do já reservado/usado (${consumido.toLocaleString("pt-BR")} kg).`,
      );
      return;
    }

    const novoSaldo = (qtdKgTotal as number) - consumido;
    const valorUnitarioKg =
      typeof valorSaca === "number" && valorSaca > 0
        ? +(valorSaca / KG_POR_SACA).toFixed(4)
        : undefined;

    atualizarContrato(contrato!.id, {
      numero_manual: numeroManual || undefined,
      qtd_kg_total: qtdKgTotal as number,
      saldo_kg: novoSaldo,
      cliente_id: clienteId || undefined,
      destino_local_id: destinoLocalId || undefined,
      terminal_id: terminalId || undefined,
      data_emissao: dataEmissao || undefined,
      data_vencto_financeiro: dataVencimento || undefined,
      valor_unitario: valorUnitarioKg,
      valor_total: valorTotal === "" ? undefined : valorTotal,
      observacoes: observacoes || undefined,
      status,
    });
    toast.success(`Contrato ${contrato!.numero_manual || contrato!.numero} atualizado.`);
    onClose();
  }

  const destinoOpts = locais.filter(
    (l) => l.tipo === "destino" || l.tipo === "porto" || l.tipo === "terminal",
  );

  return (
    <Modal
      open={!!contrato}
      onClose={onClose}
      title={`✏️ Editar Contrato — ${contrato.numero_manual || contrato.numero}`}
      subtitle="Produtor, local de origem e produto não podem ser alterados após criação"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar}>Salvar alterações</Button>
        </>
      }
    >
      <AlertBox tone="blue" icon="ℹ️" title="Edição parcial">
        Você pode editar quantidade, valores, cliente, destino, datas, observações e status. Para mudar produtor ou produto, crie um novo contrato.
      </AlertBox>

      <SectionLabel>Identificação</SectionLabel>
      <FormRow>
        <Field label="Número manual" hint="Se vazio, o sistema gerado é mantido">
          <Input value={numeroManual} onChange={(e) => setNumeroManual(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ContratoStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.v} value={s.v}>{s.label}</option>
            ))}
          </Select>
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Produto" hint="Não editável">
          <Input value={produtos.find((p) => p.id === contrato.produto_id)?.nome ?? "—"} disabled />
        </Field>
        <Field label="Quantidade Total *" hint={`Já consumido: ${(contrato.qtd_kg_total - contrato.saldo_kg).toLocaleString("pt-BR")} kg (mínimo)`}>
          <NumberInput value={qtdKgTotal} onChange={setQtdKgTotal} suffix="kg" />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Data de Emissão">
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
        </Field>
        <Field label="Data de Vencimento">
          <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
        </Field>
      </FormRow>

      <SectionLabel>Valores (negociação em sacas de {KG_POR_SACA} kg)</SectionLabel>
      <FormRow>
        <Field label="Valor Total" hint={qtdSacas > 0 ? `Equivale a ${qtdSacas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sacas` : ""}>
          <NumberInput value={valorTotal} onChange={onChangeValorTotal} variant="currency" suffix="R$" />
        </Field>
        <Field label="Valor por Saca (60 kg)" hint="Bidirecional com o total">
          <NumberInput value={valorSaca} onChange={onChangeValorSaca} variant="currency" suffix="R$/saca" />
        </Field>
      </FormRow>

      <SectionLabel>Destino e Cliente (opcional)</SectionLabel>
      <FormRow>
        <Field label="Cliente">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— A definir —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} — {c.cidade}/{c.uf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Local de Destino">
          <Select value={destinoLocalId} onChange={(e) => setDestinoLocalId(e.target.value)}>
            <option value="">— A definir —</option>
            {destinoOpts.map((l) => (
              <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
            ))}
          </Select>
        </Field>
      </FormRow>

      <FormRow variant="single">
        <Field label="Terminal (opcional)">
          <Select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
            <option value="">Sem terminal específico</option>
            {terminais.map((t) => (
              <option key={t.id} value={t.id}>{t.nome} — {t.tipo}</option>
            ))}
          </Select>
        </Field>
      </FormRow>

      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>
      </FormRow>
    </Modal>
  );
}
