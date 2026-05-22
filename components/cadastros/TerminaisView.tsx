"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select, Textarea } from "@/components/ui/Form";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { criarTerminal, atualizarTerminal } from "@/lib/api/cadastros-actions";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Terminal, TipoTerminal } from "@/lib/types";

const TIPOS: { v: TipoTerminal; label: string; tone: "blue" | "teal" | "amber" | "green" }[] = [
  { v: "terminal", label: "Terminal", tone: "blue" },
  { v: "armazem", label: "Armazém", tone: "teal" },
  { v: "porto", label: "Porto", tone: "amber" },
  { v: "cliente", label: "Cliente", tone: "green" },
];

interface FormState {
  nome: string;
  cnpj: string;
  cidade: string;
  uf: string;
  contato: string;
  tipo: TipoTerminal;
  observacoes: string;
  ativo: boolean;
}

const EMPTY: FormState = { nome: "", cnpj: "", cidade: "", uf: "SP", contato: "", tipo: "terminal", observacoes: "", ativo: true };

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: Terminal[] | null;
}

export function TerminaisView({ dadosSSR = null }: Props) {
  const store = useDataStore();
  const { supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const terminais = dadosSSR ?? store.terminais;

  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [editing, setEditing] = useState<Terminal | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return terminais.filter(
      (t) =>
        (!filtroTipo || t.tipo === filtroTipo) &&
        (t.nome.toLowerCase().includes(q) || t.cnpj.includes(q) || t.cidade.toLowerCase().includes(q)),
    );
  }, [terminais, search, filtroTipo]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", ...EMPTY } as Terminal);
  }

  function openEdit(t: Terminal) {
    setForm({
      nome: t.nome,
      cnpj: t.cnpj,
      cidade: t.cidade,
      uf: t.uf,
      contato: t.contato,
      tipo: t.tipo,
      observacoes: t.observacoes ?? "",
      ativo: t.ativo,
    });
    setEditing(t);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.warn("Informe o nome.");
      return;
    }
    if (!form.cnpj.trim()) {
      toast.warn("Informe o CNPJ.");
      return;
    }
    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const payload = {
          nome: form.nome,
          cnpj: form.cnpj,
          cidade: form.cidade,
          uf: form.uf,
          contato: form.contato,
          tipo: form.tipo,
          observacoes: form.observacoes || undefined,
        };
        const res = editing && editing.id
          ? await atualizarTerminal(editing.id, { ...payload, ativo: form.ativo })
          : await criarTerminal(payload);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Terminal "${form.nome}" ${editing?.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
      } else {
        if (editing && editing.id) {
          store.updateTerminal(editing.id, form);
          toast.success(`Terminal "${form.nome}" atualizado.`);
        } else {
          store.addTerminal(form);
          toast.success(`Terminal "${form.nome}" cadastrado.`);
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
        title="Terminais e Armazéns"
        description="Terminais portuários, armazéns e pontos de entrega"
        icon="🏗️"
        count={lista.length}
        onNovo={openNew}
        novoLabel="Novo Terminal"
        extras={
          <>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todos tipos</option>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Nome, CNPJ ou cidade..." />
          </>
        }
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="🏗️">Nenhum terminal encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>CNPJ</th>
                <th>Cidade / UF</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => {
                const tp = TIPOS.find((x) => x.v === t.tipo)!;
                return (
                  <tr key={t.id}>
                    <td><span className={tableStyles.mono}>{t.id}</span></td>
                    <td><strong>{t.nome}</strong></td>
                    <td><Badge tone={tp.tone}>{tp.label}</Badge></td>
                    <td className={tableStyles.mono}>{t.cnpj}</td>
                    <td>{t.cidade} / {t.uf}</td>
                    <td>{t.contato}</td>
                    <td><Badge tone={t.ativo ? "green" : "gray"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td><Button size="sm" onClick={() => openEdit(t)}>Editar</Button></td>
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
        title={editing?.id ? `Editar ${editing.nome}` : "Novo Terminal"}
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
          <Field label="Nome *">
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Tipo *">
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoTerminal })}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </Select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label="CNPJ *">
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Contato *">
            <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
          </Field>
        </FormRow>
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
          <Field label="Observações">
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}
