"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Select, SectionLabel } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { criarLocal, atualizarLocal } from "@/lib/api/cadastros-actions";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Local, TipoLocal } from "@/lib/types";

const TIPOS: { v: TipoLocal; label: string; tone: "green" | "teal" | "amber" | "blue" | "red" }[] = [
  { v: "fazenda", label: "Fazenda", tone: "green" },
  { v: "armazem_origem", label: "Armazém Origem", tone: "teal" },
  { v: "destino", label: "Destino", tone: "blue" },
  { v: "porto", label: "Porto", tone: "amber" },
  { v: "terminal", label: "Terminal", tone: "red" },
];

interface FormState {
  nome: string;
  tipo: TipoLocal;
  cidade: string;
  uf: string;
  contato_nome: string;
  contato_whatsapp: string;
  contato_email: string;
  latitude: number | "";
  longitude: number | "";
}

const EMPTY: FormState = {
  nome: "",
  tipo: "fazenda",
  cidade: "",
  uf: "MT",
  contato_nome: "",
  contato_whatsapp: "",
  contato_email: "",
  latitude: "",
  longitude: "",
};

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock e devemos ler do store. */
  dadosSSR?: Local[] | null;
}

export function LocaisView({ dadosSSR = null }: Props) {
  const store = useDataStore();
  const { supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const locais = dadosSSR ?? store.locais;

  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [editing, setEditing] = useState<Local | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return locais.filter(
      (l) =>
        (!filtroTipo || l.tipo === filtroTipo) &&
        (l.nome.toLowerCase().includes(q) || l.cidade.toLowerCase().includes(q)),
    );
  }, [locais, search, filtroTipo]);

  function openNew() {
    setForm(EMPTY);
    setEditing({ id: "", ...EMPTY } as Local);
  }

  function openEdit(l: Local) {
    setForm({
      nome: l.nome,
      tipo: l.tipo,
      cidade: l.cidade,
      uf: l.uf,
      contato_nome: l.contato_nome ?? "",
      contato_whatsapp: l.contato_whatsapp ?? "",
      contato_email: l.contato_email ?? "",
      latitude: typeof l.latitude === "number" ? l.latitude : "",
      longitude: typeof l.longitude === "number" ? l.longitude : "",
    });
    setEditing(l);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.warn("Informe o nome.");
      return;
    }
    if (!form.cidade.trim()) {
      toast.warn("Informe a cidade.");
      return;
    }
    const payload = {
      nome: form.nome,
      tipo: form.tipo,
      cidade: form.cidade,
      uf: form.uf,
      contato_nome: form.contato_nome || undefined,
      contato_whatsapp: form.contato_whatsapp || undefined,
      contato_email: form.contato_email || undefined,
      latitude: typeof form.latitude === "number" ? form.latitude : undefined,
      longitude: typeof form.longitude === "number" ? form.longitude : undefined,
    };

    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const res = editing && editing.id
          ? await atualizarLocal(editing.id, payload)
          : await criarLocal(payload);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Local "${form.nome}" ${editing?.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
      } else {
        if (editing && editing.id) {
          store.updateLocal(editing.id, payload);
          toast.success(`Local "${form.nome}" atualizado.`);
        } else {
          store.addLocal(payload);
          toast.success(`Local "${form.nome}" cadastrado.`);
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
        title="Locais"
        description="Fazendas, armazéns, destinos, portos — reutilizáveis em contratos e cargas"
        icon="📍"
        count={lista.length}
        onNovo={openNew}
        novoLabel="Novo Local"
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
            <SearchInput value={search} onChange={setSearch} placeholder="Nome ou cidade..." />
          </>
        }
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="📍">Nenhum local encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Cidade / UF</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => {
                const tp = TIPOS.find((x) => x.v === l.tipo)!;
                const temCoord = l.latitude != null && l.longitude != null;
                return (
                  <tr key={l.id}>
                    <td><span className={tableStyles.mono}>{l.codigo ?? "—"}</span></td>
                    <td><strong>{l.nome}</strong></td>
                    <td><Badge tone={tp.tone}>{tp.label}</Badge></td>
                    <td>{l.cidade} / {l.uf}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Link href={`/cadastros/locais/${l.id}`} style={{ fontSize: 11, color: "var(--g700)", fontWeight: 600 }}>
                          Ver
                        </Link>
                        <Button size="sm" onClick={() => openEdit(l)}>Editar</Button>
                        {temCoord ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "var(--g700)", fontWeight: 600 }}
                          >
                            🗺️ Maps
                          </a>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--hint)" }}>sem coords</span>
                        )}
                      </div>
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
        title={editing?.id ? `Editar ${editing.nome}` : "Novo Local"}
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
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLocal })}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </Select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Cidade *">
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </Field>
          <Field label="UF *">
            <Input value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
          </Field>
        </FormRow>

        <SectionLabel>📨 Contato (para envio da OC por WhatsApp/Email)</SectionLabel>
        <FormRow>
          <Field label="Nome do contato">
            <Input value={form.contato_nome} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} placeholder="Ex: Carlos Recebimento" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.contato_whatsapp} onChange={(e) => setForm({ ...form, contato_whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="E-mail">
            <Input value={form.contato_email} onChange={(e) => setForm({ ...form, contato_email: e.target.value })} placeholder="contato@empresa.com.br" />
          </Field>
        </FormRow>

        <SectionLabel>🗺️ Google Maps (latitude/longitude — opcional)</SectionLabel>
        <FormRow>
          <Field label="Latitude" hint="Ex: -15.6014 (negativo = sul)">
            <NumberInput value={form.latitude} onChange={(n) => setForm({ ...form, latitude: n })} variant="currency" placeholder="-15.6014" />
          </Field>
          <Field label="Longitude" hint="Ex: -56.0979 (negativo = oeste)">
            <NumberInput value={form.longitude} onChange={(n) => setForm({ ...form, longitude: n })} variant="currency" placeholder="-56.0979" />
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}
