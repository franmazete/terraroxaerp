"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select } from "@/components/ui/Form";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Perfil } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PERFIS: { v: Perfil; label: string }[] = [
  { v: "admin", label: "Administrador" },
  { v: "comercial", label: "Comercial" },
  { v: "logistica", label: "Logística" },
  { v: "fiscal", label: "Fiscal" },
  { v: "financeiro", label: "Financeiro" },
  { v: "transportadora", label: "Transportadora" },
];

export function ConvidarUsuarioModal({ open, onClose }: Props) {
  const toast = useToast();
  const { supabaseConfigured } = useAuth();
  const { transportadoras } = useDataStore();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("logistica");
  const [transpId, setTranspId] = useState("");

  async function enviar(): Promise<void> {
    if (!email.trim() || !email.includes("@")) {
      toast.warn("Informe um e-mail válido.");
      return;
    }
    if (!nome.trim()) {
      toast.warn("Informe o nome do convidado.");
      return;
    }
    if (perfil === "transportadora" && !transpId) {
      toast.warn("Selecione uma transportadora para vincular.");
      return;
    }
    if (!supabaseConfigured) {
      toast.warn(
        "Configure o Supabase em .env.local primeiro (envio real de e-mail). Para criar usuário em modo mock, use 'Novo Usuário'.",
        "Convite requer Supabase",
      );
      return;
    }
    try {
      const res = await fetch("/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          nome,
          perfil,
          transp_id: transpId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao enviar convite.");
        return;
      }
      toast.success(`Link enviado para ${email}. O usuário receberá um e-mail para definir senha.`, "Convite enviado");
      setEmail("");
      setNome("");
      setPerfil("logistica");
      setTranspId("");
      onClose();
    } catch (e) {
      toast.error("Erro ao chamar o servidor. Veja o console.");
      console.error(e);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📧 Convidar usuário por e-mail"
      subtitle="O convidado receberá um link para definir senha"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <LoadingButton variant="primary" onClick={enviar} loadingLabel="Enviando convite...">
            📧 Enviar convite
          </LoadingButton>
        </>
      }
    >
      {!supabaseConfigured ? (
        <AlertBox tone="amber" icon="⚠️" title="Supabase não configurado">
          O envio de convite por e-mail exige <code>.env.local</code> configurado com o seu projeto Supabase.
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Veja o guia em <code>docs/SETUP_ETAPA_2_SUPABASE.md</code> ou use <strong>"Novo Usuário"</strong> no modo mock atual.
          </div>
        </AlertBox>
      ) : (
        <AlertBox tone="blue" icon="ℹ️" title="Como funciona">
          O Supabase envia um e-mail com link único. Ao clicar, o usuário define a senha e ganha acesso conforme o perfil.
        </AlertBox>
      )}

      <FormRow>
        <Field label="Nome completo *">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana Souza" />
        </Field>
        <Field label="E-mail *">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@empresa.com.br" autoComplete="email" />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Perfil *">
          <Select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {PERFIS.map((p) => (
              <option key={p.v} value={p.v}>{p.label}</option>
            ))}
          </Select>
        </Field>
        {perfil === "transportadora" && (
          <Field label="Transportadora *" hint="Obrigatória para perfil transportadora">
            <Select value={transpId} onChange={(e) => setTranspId(e.target.value)}>
              <option value="">— Selecione —</option>
              {transportadoras
                .filter((t) => t.status === "ativa")
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
                ))}
            </Select>
          </Field>
        )}
      </FormRow>
    </Modal>
  );
}
