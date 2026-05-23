"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select, SectionLabel, Textarea } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { publicarCargaAction } from "@/lib/api/actions";
import { fmtKg, fmtBRL, fmtDate } from "@/lib/domain/format";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando fornecido, pré-seleciona o contrato (útil para "Gerar carga deste contrato"). */
  contratoIdInicial?: string;
}

export function PublicarCargaModal({ open, onClose, contratoIdInicial }: Props) {
  const { publicarCarga, contratos, locais, produtos, clientes, transportadoras } = useDataStore();
  const toast = useToast();
  const { supabaseConfigured } = useAuth();
  const router = useRouter();
  const ativos = useMemo(
    () => contratos.filter((c) => c.status === "ativo" && c.disponivel === true && c.saldo_kg > 0),
    [contratos],
  );

  const [contratoId, setContratoId] = useState<string>("");
  const [totalKg, setTotalKg] = useState<number | "">("");
  const [tipoCarga, setTipoCarga] = useState("");
  const [origemLocalId, setOrigemLocalId] = useState("");
  const [destinoLocalId, setDestinoLocalId] = useState("");
  const [dataCarg, setDataCarg] = useState("");
  const [obs, setObs] = useState("");
  /** Bloco I — allowlist de transportadoras. Vazio = todas podem reservar. */
  const [transpsPermitidas, setTranspsPermitidas] = useState<string[]>([]);

  // Auto-preenche quando o contrato muda
  useEffect(() => {
    if (!contratoId) return;
    const c = contratos.find((x) => x.id === contratoId);
    if (!c) return;
    const prod = produtos.find((p) => p.id === c.produto_id);
    setTipoCarga(prod ? `Granel — ${prod.nome}` : "");
    setOrigemLocalId(c.local_origem_id);
    setDestinoLocalId(c.destino_local_id ?? "");
    setDataCarg(c.data_emissao ?? "");
    setTotalKg(c.saldo_kg);
  }, [contratoId, contratos, produtos]);

  // Inicializa com contrato sugerido (ou primeiro ativo)
  useEffect(() => {
    if (!open) return;
    if (contratoIdInicial) {
      setContratoId(contratoIdInicial);
    } else if (!contratoId && ativos.length > 0) {
      setContratoId(ativos[0].id);
    }
  }, [open, contratoIdInicial, ativos, contratoId]);

  // Reset quando fechar
  useEffect(() => {
    if (!open) {
      setTotalKg("");
      setObs("");
    }
  }, [open]);

  const contrato = contratos.find((c) => c.id === contratoId);
  const produto = contrato ? produtos.find((p) => p.id === contrato.produto_id) : null;
  const saldoContrato = contrato?.saldo_kg ?? 0;
  const totalKgN = typeof totalKg === "number" ? totalKg : 0;
  const excedeSaldo = totalKgN > saldoContrato;

  async function submit() {
    if (!contrato) { toast.warn("Selecione um contrato."); return; }
    if (!totalKgN || totalKgN <= 0) { toast.warn("Informe a quantidade em kg."); return; }
    if (excedeSaldo) {
      toast.error(`Quantidade (${fmtKg(totalKgN)}) excede o saldo do contrato (${fmtKg(saldoContrato)}).`);
      return;
    }
    if (!origemLocalId) { toast.warn("Selecione a origem."); return; }
    if (!dataCarg) { toast.warn("Informe a data de carregamento."); return; }

    const origem = locais.find((l) => l.id === origemLocalId);
    const destino = destinoLocalId ? locais.find((l) => l.id === destinoLocalId) : undefined;
    if (!origem || !produto) { toast.error("Dados inválidos."); return; }

    const payload = {
      contrato_id: contrato.id,
      contrato_interno: contrato.numero_manual || contrato.numero,
      produto_id: produto.id,
      produto: produto.nome,
      tipo_carga: tipoCarga,
      origem_local_id: origem.id,
      destino_local_id: destino?.id,
      origem: `${origem.nome} / ${origem.uf}`,
      destino: destino ? `${destino.nome} / ${destino.uf}` : undefined,
      total_kg: totalKgN,
      data_carg: dataCarg,
      obs,
      transps_permitidas: transpsPermitidas.length > 0 ? transpsPermitidas : undefined,
    };

    if (supabaseConfigured) {
      const r = await publicarCargaAction(payload);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Transportadoras já podem ver e reservar.", "Carga publicada");
      router.refresh();
      onClose();
      return;
    }

    publicarCarga(payload);
    toast.success("Transportadoras já podem ver e reservar.", "Carga publicada");
    onClose();
  }

  if (ativos.length === 0 && open) {
    return (
      <Modal open={open} onClose={onClose} title="📦 Publicar Nova Carga">
        <AlertBox tone="red" icon="⚠️" title="Nenhum contrato disponível">
          Crie um contrato ativo (com saldo) antes de publicar uma carga.
        </AlertBox>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📦 Publicar Nova Carga para Reserva"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>
            📦 Publicar Carga
          </Button>
        </>
      }
    >
      <AlertBox tone="amber" icon="🔒" title="Dados sigilosos protegidos">
        O número do contrato interno e valores de compra/venda NÃO serão exibidos para as transportadoras. Apenas dados operacionais serão visíveis.
      </AlertBox>

      <SectionLabel>Vínculo com Contrato</SectionLabel>
      <FormRow>
        <Field label="Contrato *" hint={`${ativos.length} contratos disponíveis`}>
          <Select value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
            <option value="">Selecione...</option>
            {ativos.map((c) => {
              const p = produtos.find((x) => x.id === c.produto_id);
              return (
                <option key={c.id} value={c.id}>
                  {c.numero_manual || c.numero} — {p?.nome ?? "?"} — saldo {fmtKg(c.saldo_kg)}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Quantidade desta carga *" hint={contrato ? `Saldo do contrato: ${fmtKg(saldoContrato)}` : undefined}>
          <NumberInput
            value={totalKg}
            onChange={setTotalKg}
            placeholder="Ex: 1.000.000"
            suffix="kg"
          />
        </Field>
      </FormRow>

      {contrato && (
        <div style={{ background: "var(--surf2)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 12, fontSize: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Saldo Contrato</div>
              <div style={{ fontWeight: 700, color: "var(--g700)" }}>{fmtKg(contrato.saldo_kg)}</div>
            </div>
            {contrato.data_vencto_financeiro && (
              <div>
                <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Vence em</div>
                <div style={{ fontWeight: 600 }}>{fmtDate(contrato.data_vencto_financeiro)}</div>
              </div>
            )}
            {typeof contrato.valor_unitario === "number" && (
              <div>
                <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Valor Unitário</div>
                <div style={{ fontWeight: 600 }}>{fmtBRL(contrato.valor_unitario)} / kg</div>
              </div>
            )}
            {contrato.cliente_id ? (
              <div>
                <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Cliente</div>
                <div style={{ fontWeight: 600 }}>{clientes.find((c) => c.id === contrato.cliente_id)?.nome ?? "—"}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Cliente</div>
                <div style={{ color: "var(--a600)", fontWeight: 600 }}>— A definir nesta carga —</div>
              </div>
            )}
          </div>
        </div>
      )}

      {excedeSaldo && (
        <div style={{ marginBottom: 10 }}>
          <AlertBox tone="red" icon="⚠️" title="Quantidade excede o saldo do contrato">
            Reduza a quantidade ou selecione outro contrato com mais saldo.
          </AlertBox>
        </div>
      )}

      <hr className="divider" />

      <SectionLabel>Dados Operacionais (visíveis para transportadoras)</SectionLabel>
      <FormRow>
        <Field label="Produto" hint="Vinculado ao contrato">
          <Input value={produto?.nome ?? ""} disabled />
        </Field>
        <Field label="Tipo de Carga">
          <Input value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Local de Origem *" hint={contrato ? "Pré-selecionado pelo contrato — pode trocar" : undefined}>
          <Select value={origemLocalId} onChange={(e) => setOrigemLocalId(e.target.value)}>
            <option value="">Selecione...</option>
            {(() => {
              const padrao = locais.filter((l) => l.tipo === "fazenda" || l.tipo === "armazem_origem");
              // Garante que o local atualmente selecionado (vindo do contrato) sempre aparece
              const atual = locais.find((l) => l.id === origemLocalId);
              const lista = atual && !padrao.some((l) => l.id === atual.id) ? [atual, ...padrao] : padrao;
              return lista.map((l) => (
                <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
              ));
            })()}
          </Select>
        </Field>
        <Field label="Destino" hint="Opcional — se ainda não definido, deixe em branco">
          <Select value={destinoLocalId} onChange={(e) => setDestinoLocalId(e.target.value)}>
            <option value="">— A definir —</option>
            {(() => {
              const padrao = locais.filter((l) => l.tipo === "destino" || l.tipo === "porto" || l.tipo === "terminal");
              const atual = locais.find((l) => l.id === destinoLocalId);
              const lista = atual && !padrao.some((l) => l.id === atual.id) ? [atual, ...padrao] : padrao;
              return lista.map((l) => (
                <option key={l.id} value={l.id}>{l.nome} — {l.cidade}/{l.uf}</option>
              ));
            })()}
          </Select>
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Data Prevista Carregamento *">
          <Input type="date" value={dataCarg} onChange={(e) => setDataCarg(e.target.value)} />
        </Field>
      </FormRow>
      <FormRow variant="single">
        <Field label="Observações para transportadoras">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções operacionais, requisitos do veículo, etc. NÃO incluir valores ou dados financeiros." />
        </Field>
      </FormRow>

      <SectionLabel>🔒 Transportadoras permitidas (allowlist)</SectionLabel>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Deixe vazio para que <strong>qualquer transportadora ativa</strong> possa reservar.
        Selecione transportadoras específicas para restringir quem vê e pode reservar esta carga.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6, marginBottom: 14 }}>
        {transportadoras.filter((t) => t.status === "ativa").map((t) => {
          const selected = transpsPermitidas.includes(t.id);
          return (
            <label
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: selected ? "var(--g100)" : "var(--surf2)",
                border: `1px solid ${selected ? "var(--g400)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {
                  setTranspsPermitidas((arr) =>
                    arr.includes(t.id) ? arr.filter((x) => x !== t.id) : [...arr, t.id],
                  );
                }}
              />
              <span>{t.nome_fantasia}</span>
            </label>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: transpsPermitidas.length > 0 ? "var(--g700)" : "var(--hint)", marginBottom: 8 }}>
        {transpsPermitidas.length === 0
          ? "✓ Carga ABERTA — qualquer transportadora ativa pode reservar"
          : `🔒 Carga RESTRITA — só ${transpsPermitidas.length} transportadora(s) podem ver e reservar`}
      </div>
    </Modal>
  );
}
