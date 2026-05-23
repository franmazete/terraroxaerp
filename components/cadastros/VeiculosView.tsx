"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  criarVeiculo,
  atualizarVeiculo,
  vincularVeiculoTransp,
} from "@/lib/api/cadastros-actions";
import { fmtKg } from "@/lib/domain/format";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { TipoVeiculo, Transportadora, Veiculo } from "@/lib/types";

const TIPOS: TipoVeiculo[] = ["Bitrem", "Rodotrem", "Treminhão", "Carreta Simples", "Truck"];

interface FormState {
  placa_cavalo: string;
  placa_carreta: string;
  tipo: TipoVeiculo;
  capacidade_kg: number;
  transp_ids: string[];
  ativo: boolean;
}

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: Veiculo[] | null;
  transportadorasSSR?: Transportadora[] | null;
}

export function VeiculosView({ dadosSSR = null, transportadorasSSR = null }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const router = useRouter();
  const store = useDataStore();
  const veiculos = dadosSSR ?? store.veiculos;
  const transportadoras = transportadorasSSR ?? store.transportadoras;
  const { cargas, ordens, addVeiculo, updateVeiculo, vincularTranspAoVeiculo } = store;
  const toast = useToast();
  const confirmar = useConfirm();
  const ehTransp = user?.perfil === "transportadora";
  const minhaTranspId = user?.transp_id;
  const [salvando, setSalvando] = useState(false);

  const EMPTY: FormState = {
    placa_cavalo: "",
    placa_carreta: "",
    tipo: "Bitrem",
    capacidade_kg: 40000,
    transp_ids: ehTransp ? [minhaTranspId!] : transportadoras[0] ? [transportadoras[0].id] : [],
    ativo: true,
  };

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [filtroTransp, setFiltroTransp] = useState<string>("");

  // Veículos já usados por essa transp em reservas ou OCs
  const veiculosUsados = useMemo(() => {
    if (!ehTransp || !minhaTranspId) return new Set<string>();
    const ids = new Set<string>();
    cargas.forEach((c) => c.reservas.forEach((r) => { if (r.transp_id === minhaTranspId && r.veiculo_id) ids.add(r.veiculo_id); }));
    ordens.forEach((o) => { if (o.transp_id === minhaTranspId && o.veiculo_id) ids.add(o.veiculo_id); });
    return ids;
  }, [cargas, ordens, ehTransp, minhaTranspId]);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return veiculos.filter((v) => {
      if (ehTransp) {
        const vinculado = v.transp_ids.includes(minhaTranspId!);
        const jaUsei = veiculosUsados.has(v.id);
        if (!vinculado && !jaUsei) return false;
      }
      if (filtroTransp && !v.transp_ids.includes(filtroTransp)) return false;
      return v.placa_cavalo.toLowerCase().includes(q) || (v.placa_carreta ?? "").toLowerCase().includes(q);
    });
  }, [veiculos, search, filtroTransp, ehTransp, minhaTranspId, veiculosUsados]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", criado_em: "", ...EMPTY } as Veiculo);
  }

  function openEdit(v: Veiculo) {
    setForm({
      placa_cavalo: v.placa_cavalo,
      placa_carreta: v.placa_carreta ?? "",
      tipo: v.tipo,
      capacidade_kg: v.capacidade_kg,
      transp_ids: v.transp_ids,
      ativo: v.ativo,
    });
    setEditing(v);
  }

  async function salvar() {
    if (!form.placa_cavalo.trim()) {
      toast.warn("Informe a placa do cavalo.");
      return;
    }
    if (form.capacidade_kg <= 0) {
      toast.warn("Informe a capacidade em kg.");
      return;
    }

    // Detector de duplicata por placa do cavalo (só em criação)
    if (!editing?.id) {
      const placaUp = form.placa_cavalo.toUpperCase().replace(/\s+/g, "");
      const existente = veiculos.find((v) => v.placa_cavalo.toUpperCase().replace(/\s+/g, "") === placaUp);
      if (existente) {
        const transpsExistentes =
          existente.transp_ids.map((tid) => transportadoras.find((t) => t.id === tid)?.nome_fantasia).filter(Boolean).join(", ") || "nenhuma";
        const minhaTransp = form.transp_ids[0];
        const minhaNome = transportadoras.find((t) => t.id === minhaTransp)?.nome_fantasia ?? "esta transportadora";

        if (existente.transp_ids.includes(minhaTransp)) {
          toast.info(`Veículo "${existente.placa_cavalo}" já está vinculado a ${minhaNome}.`);
          return;
        }

        const ok = await confirmar({
          titulo: "Placa já cadastrada",
          mensagem: (
            <>
              Já existe um veículo com esta placa no sistema:
              <div style={{ marginTop: 8, padding: 8, background: "var(--surf2)", borderRadius: 4, fontSize: 12 }}>
                <div><strong>{existente.placa_cavalo}{existente.placa_carreta ? ` + ${existente.placa_carreta}` : ""}</strong></div>
                <div>{existente.tipo} · {existente.capacidade_kg.toLocaleString("pt-BR")} kg</div>
                <div>Vinculado a: {transpsExistentes}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                Deseja vincular <strong>{minhaNome}</strong> a este veículo existente?
              </div>
            </>
          ),
          variante: "warn",
          confirmarLabel: "Vincular ao existente",
          cancelarLabel: "Revisar placa",
        });
        if (ok) {
          if (supabaseConfigured) {
            const res = await vincularVeiculoTransp(existente.id, minhaTransp);
            if ("error" in res) {
              toast.error(res.error);
              return;
            }
            router.refresh();
          } else {
            vincularTranspAoVeiculo(existente.id, minhaTransp);
          }
          toast.success(`${minhaNome} agora opera com o veículo ${existente.placa_cavalo}.`);
          setEditing(null);
        }
        return;
      }
    }

    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const input = {
          placa_cavalo: form.placa_cavalo,
          placa_carreta: form.placa_carreta || undefined,
          tipo: form.tipo,
          capacidade_kg: form.capacidade_kg,
          transp_ids: form.transp_ids,
        };
        const res = editing && editing.id
          ? await atualizarVeiculo(editing.id, { ...input, ativo: form.ativo })
          : await criarVeiculo(input);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Veículo "${form.placa_cavalo}" ${editing?.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
      } else {
        const payload = {
          ...form,
          placa_carreta: form.placa_carreta || undefined,
        };
        if (editing && editing.id) {
          updateVeiculo(editing.id, payload);
          toast.success(`Veículo "${form.placa_cavalo}" atualizado.`);
        } else {
          addVeiculo(payload);
          toast.success(`Veículo "${form.placa_cavalo}" cadastrado.`);
        }
      }
      setEditing(null);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <CadastroHeader
        title={ehTransp ? "Meus Veículos" : "Veículos"}
        description={ehTransp ? "Cadastro de veículos da sua frota" : "Cavalos, carretas e capacidades"}
        icon="🚛"
        count={lista.length}
        onNovo={openNew}
        novoLabel="Novo Veículo"
        extras={
          <>
            {!ehTransp && (
              <select
                value={filtroTransp}
                onChange={(e) => setFiltroTransp(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Todas transportadoras</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
              </select>
            )}
            <SearchInput value={search} onChange={setSearch} placeholder="Placa..." />
          </>
        }
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="🚛">Nenhum veículo encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Placa Cavalo</th>
                <th>Placa Carreta</th>
                <th>Tipo</th>
                <th>Capacidade</th>
                {!ehTransp && <th>Transportadora</th>}
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id}>
                  <td><span className={tableStyles.mono}>{v.codigo ?? "—"}</span></td>
                  <td className={tableStyles.mono}><strong>{v.placa_cavalo}</strong></td>
                  <td className={tableStyles.mono}>{v.placa_carreta || "—"}</td>
                  <td>{v.tipo}</td>
                  <td><strong>{fmtKg(v.capacidade_kg)}</strong></td>
                  {!ehTransp && <td>{v.transp_ids.map((tid) => transportadoras.find((t) => t.id === tid)?.nome_fantasia).filter(Boolean).join(", ") || "—"}</td>}
                  <td><Badge tone={v.ativo ? "green" : "gray"}>{v.ativo ? "Ativo" : "Inativo"}</Badge></td>
                  <td><Button size="sm" onClick={() => openEdit(v)}>Editar</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Editar ${editing.placa_cavalo}` : "Novo Veículo"}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <FormRow variant="triple">
          <Field label="Placa Cavalo *">
            <Input value={form.placa_cavalo} onChange={(e) => setForm({ ...form, placa_cavalo: e.target.value.toUpperCase() })} placeholder="AAA-0000" />
          </Field>
          <Field label="Placa Carreta">
            <Input value={form.placa_carreta} onChange={(e) => setForm({ ...form, placa_carreta: e.target.value.toUpperCase() })} placeholder="BBB-1111" />
          </Field>
          <Field label="Tipo *">
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoVeiculo })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Capacidade *">
            <NumberInput
              value={form.capacidade_kg || ""}
              onChange={(n) => setForm({ ...form, capacidade_kg: typeof n === "number" ? n : 0 })}
              placeholder="Ex: 40.000"
              suffix="kg"
            />
          </Field>
          {!ehTransp && (
            <Field label="Transportadora *" hint="Veículo pode estar vinculado a mais de uma transp (fretes compartilhados).">
              <Select value={form.transp_ids[0] ?? ""} onChange={(e) => setForm({ ...form, transp_ids: [e.target.value] })}>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
              </Select>
            </Field>
          )}
        </FormRow>
      </Modal>
    </>
  );
}
