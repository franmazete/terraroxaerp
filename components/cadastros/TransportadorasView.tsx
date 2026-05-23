"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select, SectionLabel } from "@/components/ui/Form";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { criarTransportadora, atualizarTransportadora } from "@/lib/api/cadastros-actions";
import { fmtDate } from "@/lib/domain/format";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Transportadora, TransportadoraStatus } from "@/lib/types";

const STATUS_OPTIONS: { v: TransportadoraStatus; label: string; tone: "green" | "red" | "amber" }[] = [
  { v: "ativa", label: "Ativa", tone: "green" },
  { v: "pendente", label: "Pendente", tone: "amber" },
  { v: "inativa", label: "Inativa", tone: "red" },
];

interface FormState {
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  inscricao_estadual: string;
  telefone: string;
  email: string;
  responsavel: string;
  status: TransportadoraStatus;
}

const EMPTY: FormState = {
  razao_social: "",
  nome_fantasia: "",
  cnpj_cpf: "",
  inscricao_estadual: "",
  telefone: "",
  email: "",
  responsavel: "",
  status: "ativa",
};

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: Transportadora[] | null;
}

export function TransportadorasView({ dadosSSR = null }: Props) {
  const store = useDataStore();
  const { supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const transportadoras = dadosSSR ?? store.transportadoras;

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transportadora | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return transportadoras.filter(
      (t) =>
        t.razao_social.toLowerCase().includes(q) ||
        t.nome_fantasia.toLowerCase().includes(q) ||
        t.cnpj_cpf.includes(q),
    );
  }, [transportadoras, search]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", criada_em: "", nome: "", contato: "", cnpj: "", ...EMPTY } as Transportadora);
  }

  function openEdit(t: Transportadora) {
    setForm({
      razao_social: t.razao_social,
      nome_fantasia: t.nome_fantasia,
      cnpj_cpf: t.cnpj_cpf,
      inscricao_estadual: t.inscricao_estadual ?? "",
      telefone: t.telefone,
      email: t.email,
      responsavel: t.responsavel,
      status: t.status,
    });
    setEditing(t);
  }

  async function salvar() {
    if (!form.razao_social.trim()) {
      toast.warn("Informe a razão social.");
      return;
    }
    if (!form.cnpj_cpf.trim()) {
      toast.warn("Informe CNPJ/CPF.");
      return;
    }
    if (!form.email.trim()) {
      toast.warn("Informe o e-mail.");
      return;
    }

    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const input = {
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia || form.razao_social,
          cnpj_cpf: form.cnpj_cpf,
          telefone: form.telefone,
          email: form.email,
          responsavel: form.responsavel,
          inscricao_estadual: form.inscricao_estadual || undefined,
          status: form.status,
        };
        const res = editing && editing.id
          ? await atualizarTransportadora(editing.id, input)
          : await criarTransportadora(input);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Transportadora "${input.nome_fantasia}" ${editing?.id ? "atualizada" : "cadastrada"}.`);
        router.refresh();
      } else {
        const payload = {
          ...form,
          nome: form.nome_fantasia || form.razao_social,
          contato: form.telefone,
          cnpj: form.cnpj_cpf,
        };
        if (editing && editing.id) {
          store.updateTransportadora(editing.id, payload);
          toast.success(`Transportadora "${payload.nome}" atualizada.`);
        } else {
          store.addTransportadora(payload);
          toast.success(`Transportadora "${payload.nome}" cadastrada.`);
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
        title="Transportadoras"
        description="Empresas parceiras de transporte"
        icon="🚚"
        count={transportadoras.length}
        onNovo={openNew}
        novoLabel="Nova Transportadora"
        extras={<SearchInput value={search} onChange={setSearch} placeholder="Buscar por razão, fantasia ou CNPJ..." />}
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="🚚">Nenhuma transportadora encontrada.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Razão Social</th>
                <th>Fantasia</th>
                <th>CNPJ/CPF</th>
                <th>Responsável</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Criada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => {
                const st = STATUS_OPTIONS.find((o) => o.v === t.status)!;
                return (
                  <tr key={t.id}>
                    <td><span className={tableStyles.mono}>{t.codigo ?? "—"}</span></td>
                    <td><strong>{t.razao_social}</strong></td>
                    <td>{t.nome_fantasia}</td>
                    <td className={tableStyles.mono}>{t.cnpj_cpf}</td>
                    <td>{t.responsavel}</td>
                    <td>{t.telefone}</td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td>{fmtDate(t.criada_em)}</td>
                    <td>
                      <Button size="sm" onClick={() => openEdit(t)}>Editar</Button>
                    </td>
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
        title={editing?.id ? `Editar ${editing.razao_social}` : "Nova Transportadora"}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <SectionLabel>Dados da Empresa</SectionLabel>
        <FormRow>
          <Field label="Razão Social *">
            <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          </Field>
          <Field label="Nome Fantasia">
            <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="CNPJ / CPF *">
            <Input value={form.cnpj_cpf} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Inscrição Estadual">
            <Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} />
          </Field>
        </FormRow>

        <SectionLabel>Contato</SectionLabel>
        <FormRow>
          <Field label="Responsável *">
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </Field>
          <Field label="Telefone *">
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(65) 99000-0000" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="E-mail *">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TransportadoraStatus })}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </Select>
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}
