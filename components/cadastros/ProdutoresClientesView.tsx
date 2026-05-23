"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select } from "@/components/ui/Form";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  criarProdutor,
  atualizarProdutor,
  criarCliente,
  atualizarCliente,
} from "@/lib/api/cadastros-actions";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Cliente, Produtor, TipoProdutor } from "@/lib/types";

interface FormState {
  nome: string;
  razao_social: string;
  tipo: TipoProdutor;
  cpf_cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
  ativo: boolean;
}

const EMPTY: FormState = {
  nome: "",
  razao_social: "",
  tipo: "vendedor",
  cpf_cnpj: "",
  cidade: "",
  uf: "MT",
  contato: "",
  ativo: true,
};

const TIPOS_PRODUTOR: { v: TipoProdutor; label: string; tone: "green" | "blue" | "teal" }[] = [
  { v: "vendedor", label: "Vendedor (fornece grãos)", tone: "green" },
  { v: "comprador", label: "Comprador (recebe)", tone: "blue" },
  { v: "ambos", label: "Ambos (compra e vende)", tone: "teal" },
];

interface Props {
  tipo: "produtores" | "clientes";
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: (Produtor | Cliente)[] | null;
}

/** Componente compartilhado para Produtores e Clientes (estrutura idêntica). */
export function ProdutoresClientesView({ tipo, dadosSSR = null }: Props) {
  const store = useDataStore();
  const { supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const ehProdutor = tipo === "produtores";
  const lista0 = dadosSSR ?? ((tipo === "produtores" ? store.produtores : store.clientes) as (Produtor | Cliente)[]);

  const config = ehProdutor
    ? { title: "Produtores", description: "Fazendas / fornecedores e compradores do agronegócio", icon: "🌾", novoLabel: "Novo Produtor" }
    : { title: "Clientes Compradores", description: "Compradores finais (exportadoras, indústrias)", icon: "🏭", novoLabel: "Novo Cliente" };

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<(Produtor | Cliente) | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return lista0.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.cpf_cnpj.includes(q) ||
        p.cidade.toLowerCase().includes(q) ||
        ((p as Produtor).razao_social ?? "").toLowerCase().includes(q),
    );
  }, [lista0, search]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", ...EMPTY } as Produtor);
  }

  function openEdit(p: Produtor | Cliente) {
    setForm({
      nome: p.nome,
      razao_social: (p as Produtor).razao_social ?? "",
      tipo: (p as Produtor).tipo ?? "vendedor",
      cpf_cnpj: p.cpf_cnpj,
      cidade: p.cidade,
      uf: p.uf,
      contato: p.contato,
      ativo: p.ativo,
    });
    setEditing(p);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.warn(ehProdutor ? "Informe o nome da fazenda." : "Informe o nome.");
      return;
    }
    if (!form.cpf_cnpj.trim()) {
      toast.warn("Informe CPF/CNPJ.");
      return;
    }
    setSalvando(true);
    try {
      if (supabaseConfigured) {
        if (ehProdutor) {
          const payload = {
            nome: form.nome,
            cpf_cnpj: form.cpf_cnpj,
            cidade: form.cidade,
            uf: form.uf,
            contato: form.contato,
            razao_social: form.razao_social || undefined,
            tipo: form.tipo,
          };
          const res = editing && editing.id
            ? await atualizarProdutor(editing.id, { ...payload, ativo: form.ativo })
            : await criarProdutor(payload);
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
        } else {
          const payload = {
            nome: form.nome,
            cpf_cnpj: form.cpf_cnpj,
            cidade: form.cidade,
            uf: form.uf,
            contato: form.contato,
          };
          const res = editing && editing.id
            ? await atualizarCliente(editing.id, { ...payload, ativo: form.ativo })
            : await criarCliente(payload);
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
        }
        toast.success(`${ehProdutor ? "Produtor" : "Cliente"} "${form.nome}" ${editing?.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
      } else {
        // Modo mock: usa store em memória
        const payload = ehProdutor
          ? form
          : {
              nome: form.nome,
              cpf_cnpj: form.cpf_cnpj,
              cidade: form.cidade,
              uf: form.uf,
              contato: form.contato,
              ativo: form.ativo,
            };
        if (editing && editing.id) {
          if (ehProdutor) store.updateProdutor(editing.id, payload as Partial<Produtor>);
          else store.updateCliente(editing.id, payload as Partial<Cliente>);
          toast.success(`${ehProdutor ? "Produtor" : "Cliente"} "${form.nome}" atualizado.`);
        } else {
          if (ehProdutor) store.addProdutor(payload as Omit<Produtor, "id">);
          else store.addCliente(payload as Omit<Cliente, "id">);
          toast.success(`${ehProdutor ? "Produtor" : "Cliente"} "${form.nome}" cadastrado.`);
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
        {...config}
        count={lista.length}
        onNovo={openNew}
        extras={<SearchInput value={search} onChange={setSearch} placeholder={ehProdutor ? "Fazenda, CPF/CNPJ, cidade ou razão social..." : "Nome, CPF/CNPJ ou cidade..."} />}
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon={config.icon}>Nenhum registro encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{ehProdutor ? "Nome da Fazenda" : "Nome"}</th>
                {ehProdutor && <th>Razão Social</th>}
                {ehProdutor && <th>Tipo</th>}
                <th>CPF / CNPJ</th>
                <th>Cidade / UF</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const prod = p as Produtor;
                const tipoInfo = ehProdutor ? TIPOS_PRODUTOR.find((t) => t.v === (prod.tipo ?? "vendedor")) : null;
                return (
                  <tr key={p.id}>
                    <td><span className={tableStyles.mono}>{p.codigo ?? "—"}</span></td>
                    <td><strong>{p.nome}</strong></td>
                    {ehProdutor && <td>{prod.razao_social ?? <span style={{ color: "var(--hint)" }}>—</span>}</td>}
                    {ehProdutor && tipoInfo && <td><Badge tone={tipoInfo.tone}>{tipoInfo.label.split(" ")[0]}</Badge></td>}
                    <td className={tableStyles.mono}>{p.cpf_cnpj}</td>
                    <td>{p.cidade} / {p.uf}</td>
                    <td>{p.contato}</td>
                    <td><Badge tone={p.ativo ? "green" : "gray"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td><Button size="sm" onClick={() => openEdit(p)}>Editar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Editar ${editing.nome}` : config.novoLabel}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <FormRow>
          <Field label={ehProdutor ? "Nome da Fazenda *" : "Nome *"}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder={ehProdutor ? "Ex: Fazenda Boa Esperança" : "Nome do cliente"} />
          </Field>
          <Field label="CPF / CNPJ *">
            <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </Field>
        </FormRow>

        {ehProdutor && (
          <FormRow>
            <Field label="Razão Social / Nome Completo" hint="Pessoa física ou jurídica responsável pela fazenda">
              <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Ex: João Silva ou Agro Sorriso S/A" />
            </Field>
            <Field label="Tipo *" hint="Define se o produtor atua como fornecedor de grãos, comprador, ou ambos">
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoProdutor })}>
                {TIPOS_PRODUTOR.map((t) => (
                  <option key={t.v} value={t.v}>{t.label}</option>
                ))}
              </Select>
            </Field>
          </FormRow>
        )}

        <FormRow variant="triple">
          <Field label="Cidade *">
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </Field>
          <Field label="UF *">
            <Input value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Status">
            <Select value={String(form.ativo)} onChange={(e) => setForm({ ...form, ativo: e.target.value === "true" })}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Contato *">
            <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="(65) 99000-0000" />
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}
