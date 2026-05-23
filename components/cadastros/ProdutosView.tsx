"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Field, FormRow, Input, Textarea } from "@/components/ui/Form";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { criarProduto, atualizarProduto } from "@/lib/api/cadastros-actions";
import { CadastroHeader } from "./CadastroHeader";
import { SearchInput } from "./SearchInput";
import type { Produto } from "@/lib/types";

interface Props {
  /** Dados vindos do Server Component (Supabase) — `null` quando estamos em modo mock. */
  dadosSSR?: Produto[] | null;
}

export function ProdutosView({ dadosSSR = null }: Props) {
  const store = useDataStore();
  const { supabaseConfigured } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const produtos = dadosSSR ?? store.produtos;

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; nome: string; descricao: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return produtos.filter((p) => p.nome.toLowerCase().includes(q));
  }, [produtos, search]);

  async function salvar() {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.warn("Informe o nome do produto.");
      return;
    }
    setSalvando(true);
    try {
      if (supabaseConfigured) {
        const res = editing.id
          ? await atualizarProduto(editing.id, { nome: editing.nome, descricao: editing.descricao || undefined })
          : await criarProduto({ nome: editing.nome, descricao: editing.descricao || undefined });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Produto "${editing.nome}" ${editing.id ? "atualizado" : "cadastrado"}.`);
        router.refresh();
        setEditing(null);
      } else {
        // Mock mode: store ainda não tem add/updateProduto
        toast.info("Persistência de Produtos requer Supabase configurado (modo mock somente leitura).");
        setEditing(null);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <CadastroHeader
        title="Produtos"
        description="Catálogo de produtos transportados"
        icon="📦"
        count={lista.length}
        onNovo={() => setEditing({ id: "", nome: "", descricao: "" })}
        novoLabel="Novo Produto"
        extras={<SearchInput value={search} onChange={setSearch} placeholder="Nome do produto..." />}
      />

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="📦">Nenhum produto encontrado.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td><span className={tableStyles.mono}>{p.codigo ?? "—"}</span></td>
                  <td><strong>{p.nome}</strong></td>
                  <td>{p.descricao ?? "—"}</td>
                  <td>
                    <Button
                      size="sm"
                      onClick={() => setEditing({ id: p.id, nome: p.nome, descricao: p.descricao ?? "" })}
                    >
                      Editar
                    </Button>
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
        title={editing?.id ? `Editar ${editing.nome}` : "Novo Produto"}
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
            <Input value={editing?.nome ?? ""} onChange={(e) => setEditing(editing ? { ...editing, nome: e.target.value } : null)} />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Descrição">
            <Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing(editing ? { ...editing, descricao: e.target.value } : null)} />
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}
