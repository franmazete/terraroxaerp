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
  const [usarSenhaManual, setUsarSenhaManual] = useState(false);
  const [senhaTemp, setSenhaTemp] = useState("");

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
    if (usarSenhaManual && senhaTemp.length < 6) {
      toast.warn("A senha temporária precisa ter ao menos 6 caracteres.");
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
          senha: usarSenhaManual ? senhaTemp : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao criar usuário.");
        return;
      }
      if (usarSenhaManual) {
        toast.success(
          `Usuário criado. Login: ${email} | Senha: ${senhaTemp}. Será forçado a trocar no 1º acesso.`,
          "Usuário pronto pra testar",
        );
      } else {
        toast.success(
          `Link enviado para ${email}. O usuário receberá um e-mail para definir senha.`,
          "Convite enviado",
        );
      }
      setEmail("");
      setNome("");
      setPerfil("logistica");
      setTranspId("");
      setSenhaTemp("");
      setUsarSenhaManual(false);
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
      title={usarSenhaManual ? "🔑 Criar usuário com senha temporária" : "📧 Convidar usuário por e-mail"}
      subtitle={usarSenhaManual ? "O usuário será forçado a trocar no 1º acesso" : "O convidado receberá um link para definir senha"}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <LoadingButton
            variant="primary"
            onClick={enviar}
            loadingLabel={usarSenhaManual ? "Criando usuário..." : "Enviando convite..."}
          >
            {usarSenhaManual ? "🔑 Criar usuário" : "📧 Enviar convite"}
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
      ) : usarSenhaManual ? (
        <AlertBox tone="amber" icon="🔑" title="Modo: senha temporária (ideal pra testes)">
          Você define uma senha agora. O usuário consegue logar imediatamente, mas é forçado a trocar a senha no primeiro acesso.
        </AlertBox>
      ) : (
        <AlertBox tone="blue" icon="ℹ️" title="Modo: convite por e-mail">
          O Supabase envia um e-mail com link único. Ao clicar, o usuário define a senha e ganha acesso conforme o perfil.
        </AlertBox>
      )}

      {/* Toggle de modo */}
      <div style={{
        background: "var(--surf2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "10px 12px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <input
          type="checkbox"
          id="usarSenhaManual"
          checked={usarSenhaManual}
          onChange={(e) => setUsarSenhaManual(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <label htmlFor="usarSenhaManual" style={{ flex: 1, fontSize: 13, cursor: "pointer" }}>
          <strong>Definir senha temporária agora</strong> (recomendado pra testar menu antes de enviar)
        </label>
      </div>

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

      {usarSenhaManual && (
        <FormRow variant="single">
          <Field label="Senha temporária *" hint="Mínimo 6 caracteres. Será trocada no primeiro login.">
            <Input
              type="text"
              value={senhaTemp}
              onChange={(e) => setSenhaTemp(e.target.value)}
              placeholder="Ex: terraroxa2026"
              autoComplete="new-password"
            />
          </Field>
        </FormRow>
      )}
    </Modal>
  );
}
