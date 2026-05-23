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
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { fmtDate } from "@/lib/domain/format";
import {
  atualizarUsuarioAction,
  enviarRedefinicaoSenhaAction,
} from "@/lib/api/usuarios-actions";
import { ConvidarUsuarioModal } from "./ConvidarUsuarioModal";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Perfil, Transportadora, Usuario } from "@/lib/types";

const PERFIS: { v: Perfil; label: string; tone: "blue" | "green" | "amber" | "red" | "teal" | "gray" }[] = [
  { v: "admin", label: "Administrador", tone: "red" },
  { v: "logistica", label: "Logística", tone: "green" },
  { v: "fiscal", label: "Fiscal", tone: "amber" },
  { v: "financeiro", label: "Financeiro", tone: "blue" },
  { v: "transportadora", label: "Transportadora", tone: "teal" },
  { v: "motorista", label: "Motorista", tone: "gray" },
  { v: "cliente", label: "Cliente/Terminal", tone: "gray" },
];

interface FormState {
  email: string;
  nome: string;
  perfil: Perfil;
  transp_id: string;
  ativo: boolean;
}

const EMPTY: FormState = { email: "", nome: "", perfil: "logistica", transp_id: "", ativo: true };

interface Props {
  /** Dados SSR. Quando ausentes, cai no useDataStore (mock). */
  usuariosSSR?: Usuario[] | null;
  transportadorasSSR?: Transportadora[] | null;
}

export function UsuariosView({ usuariosSSR = null, transportadorasSSR = null }: Props) {
  const store = useDataStore();
  const usuarios = usuariosSSR ?? store.usuarios;
  const transportadoras = transportadorasSSR ?? store.transportadoras;
  const { addUsuario, updateUsuario } = store;
  const toast = useToast();
  const confirmar = useConfirm();
  const router = useRouter();
  const { user: authUser, supabaseConfigured } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [redefinindo, setRedefinindo] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("");
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const podeConvidar = authUser?.perfil === "admin";

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return usuarios.filter(
      (u) =>
        (!filtroPerfil || u.perfil === filtroPerfil) &&
        (u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [usuarios, search, filtroPerfil]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", criado_em: "", ...EMPTY } as Usuario);
  }

  function openEdit(u: Usuario) {
    setForm({
      email: u.email,
      nome: u.nome,
      perfil: u.perfil,
      transp_id: u.transp_id ?? "",
      ativo: u.ativo,
    });
    setEditing(u);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.warn("Informe o nome do usuário.");
      return;
    }
    if (!form.email.trim()) {
      toast.warn("Informe o e-mail do usuário.");
      return;
    }
    if (form.perfil === "transportadora" && !form.transp_id) {
      toast.warn("Para o perfil Transportadora, é obrigatório selecionar uma transportadora.");
      return;
    }

    setSalvando(true);
    try {
      if (supabaseConfigured && editing?.id) {
        // ─── Modo Supabase real: persiste via Server Action ─────────────
        const r = await atualizarUsuarioAction(editing.id, {
          nome: form.nome,
          email: form.email,
          perfil: form.perfil,
          transp_id: form.transp_id || null,
          ativo: form.ativo,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        toast.success(`Usuário "${form.nome}" atualizado.`);
        router.refresh();
      } else if (supabaseConfigured && !editing?.id) {
        // Pra CRIAR usuário no Supabase, o caminho correto é o modal
        // "Convidar Usuário" (que cria no Auth + tabela). Aqui só edita.
        toast.warn(
          "Para criar um novo usuário com acesso ao sistema, use o botão \"Convidar usuário\" no topo. Isso cria o login no Supabase Auth.",
          "Use Convidar Usuário",
        );
        return;
      } else {
        // ─── Modo mock (sem Supabase) ───────────────────────────────────
        const payload = { ...form, transp_id: form.transp_id || undefined };
        if (editing && editing.id) {
          updateUsuario(editing.id, payload);
          toast.success(`Usuário "${form.nome}" atualizado.`);
        } else {
          addUsuario(payload);
          toast.success(`Usuário "${form.nome}" cadastrado.`);
        }
      }
      setEditing(null);
    } finally {
      setSalvando(false);
    }
  }

  async function redefinirSenhaUsuario() {
    if (!editing?.email) {
      toast.warn("E-mail do usuário não está preenchido.");
      return;
    }
    const ok = await confirmar({
      titulo: "Enviar redefinição de senha?",
      mensagem: (
        <>
          Um e-mail será enviado para <strong>{editing.email}</strong> com o link de redefinição.
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            O usuário precisa clicar no link em até 1 hora para definir a nova senha.
          </div>
        </>
      ),
      variante: "info",
      confirmarLabel: "Enviar e-mail",
    });
    if (!ok) return;

    setRedefinindo(true);
    try {
      const r = await enviarRedefinicaoSenhaAction(editing.email);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const provider = r.provider === "resend" ? "Resend" : "SMTP do Supabase";
      toast.success(
        `Link de redefinição enviado para ${editing.email}. (via ${provider})`,
        "E-mail enviado",
      );
    } finally {
      setRedefinindo(false);
    }
  }

  return (
    <>
      <CadastroHeader
        title="Usuários"
        description="Gestão de usuários do sistema e vínculo com empresas"
        icon="👥"
        count={lista.length}
        onNovo={openNew}
        novoLabel="Novo Usuário"
        extras={
          <>
            {podeConvidar && (
              <Button variant="primary" onClick={() => setConvidarOpen(true)}>
                📧 Convidar usuário
              </Button>
            )}
            <select
              value={filtroPerfil}
              onChange={(e) => setFiltroPerfil(e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">Todos perfis</option>
              {PERFIS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Nome ou e-mail..." />
          </>
        }
      />

      <ConvidarUsuarioModal
        open={convidarOpen}
        onClose={() => setConvidarOpen(false)}
        transportadorasSSR={transportadorasSSR}
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="👥">Nenhum usuário encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Transportadora</th>
                <th>Status</th>
                <th>Criado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => {
                const p = PERFIS.find((x) => x.v === u.perfil)!;
                return (
                  <tr key={u.id}>
                    <td><span className={tableStyles.mono} title={u.id}>{u.id.slice(0, 8)}…</span></td>
                    <td><strong>{u.nome}</strong></td>
                    <td>{u.email}</td>
                    <td><Badge tone={p.tone}>{p.label}</Badge></td>
                    <td>{u.transp_id ? transportadoras.find((t) => t.id === u.transp_id)?.nome_fantasia ?? "—" : "—"}</td>
                    <td><Badge tone={u.ativo ? "green" : "gray"}>{u.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td>{fmtDate(u.criado_em)}</td>
                    <td><Button size="sm" onClick={() => openEdit(u)}>Editar</Button></td>
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
        title={editing?.id ? `Editar ${editing.nome}` : "Novo Usuário"}
        footer={
          <>
            {/* Botão de redefinir senha — só em edição + modo Supabase */}
            {editing?.id && supabaseConfigured && (
              <Button
                variant="danger"
                onClick={redefinirSenhaUsuario}
                disabled={redefinindo || salvando}
                title="Enviar link de redefinição de senha por e-mail"
              >
                {redefinindo ? "Enviando..." : "🔑 Enviar redefinição de senha"}
              </Button>
            )}
            <div style={{ flex: 1 }} />
            <Button onClick={() => setEditing(null)} disabled={salvando || redefinindo}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando || redefinindo}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <FormRow>
          <Field label="Nome *">
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="E-mail *">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Perfil *">
            <Select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })}>
              {PERFIS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={String(form.ativo)} onChange={(e) => setForm({ ...form, ativo: e.target.value === "true" })}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </Field>
        </FormRow>
        {(form.perfil === "transportadora" || form.perfil === "motorista") && (
          <FormRow variant="single">
            <Field label="Transportadora *">
              <Select value={form.transp_id} onChange={(e) => setForm({ ...form, transp_id: e.target.value })}>
                <option value="">Selecione...</option>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
              </Select>
            </Field>
          </FormRow>
        )}
      </Modal>
    </>
  );
}
