"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select, UploadZone } from "@/components/ui/Form";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  criarMotorista,
  atualizarMotorista,
  vincularMotoristaTransp,
} from "@/lib/api/cadastros-actions";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Motorista, Transportadora } from "@/lib/types";

interface FormState {
  nome: string;
  cpf: string;
  cnh: string;
  celular: string;
  email: string;
  foto_url: string;
  transp_ids: string[];
  ativo: boolean;
}

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: Motorista[] | null;
  transportadorasSSR?: Transportadora[] | null;
}

export function MotoristasView({ dadosSSR = null, transportadorasSSR = null }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const router = useRouter();
  const store = useDataStore();
  const motoristas = dadosSSR ?? store.motoristas;
  const transportadoras = transportadorasSSR ?? store.transportadoras;
  const { veiculos, cargas, ordens, addMotorista, updateMotorista, vincularTranspAoMotorista } = store;
  const ehTransp = user?.perfil === "transportadora";
  const minhaTranspId = user?.transp_id;
  const [salvando, setSalvando] = useState(false);

  const EMPTY: FormState = {
    nome: "",
    cpf: "",
    cnh: "",
    celular: "",
    email: "",
    foto_url: "",
    transp_ids: ehTransp ? [minhaTranspId!] : transportadoras[0] ? [transportadoras[0].id] : [],
    ativo: true,
  };

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [filtroTransp, setFiltroTransp] = useState<string>("");

  // Motoristas já usados por essa transp em reservas ou OCs (mesmo sem estar em transp_ids)
  const motoristasUsados = useMemo(() => {
    if (!ehTransp || !minhaTranspId) return new Set<string>();
    const ids = new Set<string>();
    cargas.forEach((c) => c.reservas.forEach((r) => { if (r.transp_id === minhaTranspId && r.motorista_id) ids.add(r.motorista_id); }));
    ordens.forEach((o) => { if (o.transp_id === minhaTranspId && o.motorista_id) ids.add(o.motorista_id); });
    return ids;
  }, [cargas, ordens, ehTransp, minhaTranspId]);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return motoristas.filter((m) => {
      if (ehTransp) {
        const vinculado = m.transp_ids.includes(minhaTranspId!);
        const jaUsei = motoristasUsados.has(m.id);
        if (!vinculado && !jaUsei) return false;
      }
      if (filtroTransp && !m.transp_ids.includes(filtroTransp)) return false;
      return m.nome.toLowerCase().includes(q) || m.cpf.includes(q) || m.cnh.includes(q);
    });
  }, [motoristas, search, filtroTransp, ehTransp, minhaTranspId, motoristasUsados]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", criado_em: "", ...EMPTY } as Motorista);
  }

  function openEdit(m: Motorista) {
    setForm({
      nome: m.nome,
      cpf: m.cpf,
      cnh: m.cnh,
      celular: m.celular,
      email: m.email ?? "",
      foto_url: m.foto_url ?? "",
      transp_ids: m.transp_ids,
      ativo: m.ativo,
    });
    setEditing(m);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.warn("Informe o nome.");
      return;
    }
    if (!form.cpf.trim()) {
      toast.warn("Informe o CPF.");
      return;
    }
    if (!form.cnh.trim()) {
      toast.warn("Informe a CNH.");
      return;
    }

    // Detector de duplicata por CPF (só em criação)
    if (!editing?.id) {
      const cpfLimpo = form.cpf.replace(/\D+/g, "");
      const existente = motoristas.find((m) => m.cpf.replace(/\D+/g, "") === cpfLimpo);
      if (existente) {
        const transpsExistentes =
          existente.transp_ids.map((tid) => transportadoras.find((t) => t.id === tid)?.nome_fantasia).filter(Boolean).join(", ") || "nenhuma";
        const minhaTransp = form.transp_ids[0];
        const minhaNome = transportadoras.find((t) => t.id === minhaTransp)?.nome_fantasia ?? "esta transportadora";

        if (existente.transp_ids.includes(minhaTransp)) {
          toast.info(`Motorista "${existente.nome}" já está vinculado a ${minhaNome}.`);
          return;
        }

        const ok = await confirmar({
          titulo: "CPF já cadastrado",
          mensagem: (
            <>
              Já existe um motorista com este CPF no sistema:
              <div style={{ marginTop: 8, padding: 8, background: "var(--surf2)", borderRadius: 4, fontSize: 12 }}>
                <div><strong>{existente.nome}</strong></div>
                <div>CNH: {existente.cnh}</div>
                <div>Vinculado a: {transpsExistentes}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                Deseja vincular <strong>{minhaNome}</strong> a este motorista existente em vez de criar uma duplicata?
              </div>
            </>
          ),
          variante: "warn",
          confirmarLabel: "Vincular ao existente",
          cancelarLabel: "Revisar CPF",
        });
        if (ok) {
          if (supabaseConfigured) {
            const res = await vincularMotoristaTransp(existente.id, minhaTransp);
            if ("error" in res) {
              toast.error(res.error);
              return;
            }
            router.refresh();
          } else {
            vincularTranspAoMotorista(existente.id, minhaTransp);
          }
          toast.success(`${minhaNome} agora opera com ${existente.nome}.`);
          setEditing(null);
        }
        return;
      }
    }

    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const payload = {
          nome: form.nome,
          cpf: form.cpf,
          cnh: form.cnh,
          celular: form.celular,
          email: form.email || undefined,
          foto_url: form.foto_url || undefined,
          transp_ids: form.transp_ids,
        };
        const res = editing && editing.id
          ? await atualizarMotorista(editing.id, { ...payload, ativo: form.ativo })
          : await criarMotorista(payload);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Motorista "${form.nome}" ${editing?.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
      } else {
        if (editing && editing.id) {
          updateMotorista(editing.id, form);
          toast.success(`Motorista "${form.nome}" atualizado.`);
        } else {
          addMotorista(form);
          toast.success(`Motorista "${form.nome}" cadastrado.`);
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
        title={ehTransp ? "Meus Motoristas" : "Motoristas"}
        description={ehTransp ? "Cadastro de motoristas da sua empresa" : "Cadastro de motoristas vinculados às transportadoras"}
        icon="👤"
        count={lista.length}
        onNovo={openNew}
        novoLabel="Novo Motorista"
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
            <SearchInput value={search} onChange={setSearch} placeholder="Nome, CPF ou CNH..." />
          </>
        }
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="👤">Nenhum motorista encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Foto</th>
                <th>ID</th>
                <th>Nome</th>
                <th>CPF</th>
                <th>CNH</th>
                <th>Celular</th>
                {!ehTransp && <th>Transportadoras</th>}
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td><Avatar src={m.foto_url} nome={m.nome} size={36} ativo={m.ativo} /></td>
                  <td><span className={tableStyles.mono}>{m.id}</span></td>
                  <td><strong>{m.nome}</strong></td>
                  <td className={tableStyles.mono}>{m.cpf}</td>
                  <td className={tableStyles.mono}>{m.cnh}</td>
                  <td>{m.celular}</td>
                  {!ehTransp && (
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.transp_ids.map((tid) => {
                          const t = transportadoras.find((x) => x.id === tid);
                          return t ? <Badge key={tid} tone="blue">{t.nome_fantasia}</Badge> : null;
                        })}
                      </div>
                    </td>
                  )}
                  <td><Badge tone={m.ativo ? "green" : "gray"}>{m.ativo ? "Ativo" : "Inativo"}</Badge></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button size="sm" onClick={() => openEdit(m)}>Editar</Button>
                      {m.foto_url && (
                        <Button size="sm" onClick={() => toast.info(`URL: ${m.foto_url}`, "Download da foto disponível com Supabase Storage (Etapa 4)")}>📥</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Editar ${editing.nome}` : "Novo Motorista"}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, padding: 12, background: "var(--surf2)", borderRadius: "var(--radius)" }}>
          <Avatar src={form.foto_url} nome={form.nome || "?"} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              Foto do motorista
            </div>
            <UploadZone label="Clique para anexar foto (PNG/JPG)" icon="📷" optional />
            <Input
              style={{ marginTop: 6, width: "100%" }}
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
              placeholder="OU cole uma URL temporária aqui (até Etapa 4)"
            />
          </div>
        </div>

        <FormRow>
          <Field label="Nome Completo *">
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Celular *">
            <Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} placeholder="(65) 99000-0000" />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="CPF *">
            <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
          </Field>
          <Field label="CNH *">
            <Input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          {!ehTransp ? (
            <Field label="Transportadora *" hint="Motorista pode estar vinculado a mais de uma transp (auto). Aqui você define a principal.">
              <Select value={form.transp_ids[0] ?? ""} onChange={(e) => setForm({ ...form, transp_ids: [e.target.value] })}>
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Status">
              <Select value={String(form.ativo)} onChange={(e) => setForm({ ...form, ativo: e.target.value === "true" })}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </Field>
          )}
        </FormRow>

        {/* Bloco I.4½: facilidade UX — mostra placas disponíveis da(s) transp(s) do motorista */}
        {form.transp_ids.length > 0 && (() => {
          const placasDaTransp = veiculos.filter(
            (v) => v.ativo && form.transp_ids.some((tid) => v.transp_ids.includes(tid)),
          );
          return (
            <div style={{ marginTop: 12, padding: 12, background: "var(--surf2)", borderRadius: "var(--radius)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                🚛 Placas disponíveis para este motorista
              </div>
              {placasDaTransp.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--hint)" }}>
                  Nenhum veículo cadastrado na transp ainda. Vá em <strong>Cadastros → Veículos</strong> para adicionar.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {placasDaTransp.map((v) => (
                      <Badge key={v.id} tone="blue">{v.placa_cavalo}{v.placa_carreta ? ` + ${v.placa_carreta}` : ""} · {v.tipo}</Badge>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--hint)" }}>
                    Na hora de fazer uma reserva, este motorista poderá ser combinado com qualquer placa acima — ou cadastrar nova.
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
