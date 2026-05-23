/* ════════════════════════════════════════════════════════════════════
 * Server Actions de Usuários
 *
 * Todas exigem que o solicitante seja `admin`. Usam SERVICE_ROLE
 * (createAdminClient) pra mexer no Auth (createUser, deleteUser,
 * generateLink). Mensagens de erro traduzidas pra pt-BR.
 * ════════════════════════════════════════════════════════════════════ */

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { traduzirErro } from "./erros-pt";
import type { Perfil } from "@/lib/types";

type ActionResult<T = unknown> = { ok: true; data?: T } | { error: string };

async function requireAdmin(): Promise<{ ok: true; userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  const { data: perfilRow } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("auth_user_id", user.id)
    .single();
  if (perfilRow?.perfil !== "admin") {
    return { error: "Apenas administradores podem gerenciar usuários." };
  }
  return { ok: true, userId: user.id };
}

/* ───────────────────────────────────────────────────────────────────
 * ATUALIZAR usuário (perfil, nome, transp_id, ativo)
 * ─────────────────────────────────────────────────────────────────── */
export async function atualizarUsuarioAction(
  id: string,
  patch: {
    nome?: string;
    email?: string;
    perfil?: Perfil;
    transp_id?: string | null;
    ativo?: boolean;
  },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  // Validação: perfil transportadora exige transp_id
  if (patch.perfil === "transportadora" && !patch.transp_id) {
    return { error: "Quando o perfil é Transportadora, é obrigatório selecionar uma transportadora." };
  }
  // Se NÃO é transportadora, limpa transp_id pra não ficar sujo no banco
  if (patch.perfil && patch.perfil !== "transportadora" && patch.perfil !== "motorista") {
    patch.transp_id = null;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update(patch).eq("id", id);
  if (error) return { error: traduzirErro(error) };

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

/* ───────────────────────────────────────────────────────────────────
 * EXCLUIR usuário (Auth + row em public.usuarios)
 * ─────────────────────────────────────────────────────────────────── */
export async function excluirUsuarioAction(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  // Pega o auth_user_id antes de deletar
  const { data: row } = await admin
    .from("usuarios")
    .select("auth_user_id, perfil")
    .eq("id", id)
    .single();
  if (!row) return { error: "Usuário não encontrado." };
  if (row.perfil === "admin") {
    // Proteção: não deixa apagar último admin
    const { count } = await admin
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("perfil", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Não é possível excluir o último administrador do sistema." };
    }
  }

  // Deleta row em public.usuarios primeiro
  const { error: errU } = await admin.from("usuarios").delete().eq("id", id);
  if (errU) return { error: traduzirErro(errU) };

  // Deleta Auth user
  if (row.auth_user_id) {
    const { error: errA } = await admin.auth.admin.deleteUser(row.auth_user_id);
    if (errA) {
      console.warn("Auth deleteUser falhou (row já apagada):", errA.message);
    }
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

/* ───────────────────────────────────────────────────────────────────
 * ALTERAR SENHA DIRETAMENTE (admin define nova senha sem enviar email)
 *
 * Usa supabase.auth.admin.updateUserById que é a API administrativa
 * segura. A senha é atualizada IMEDIATAMENTE no Supabase Auth e o
 * usuário pode logar com a nova senha já no próximo acesso.
 *
 * Requer:
 *  - Solicitante seja perfil=admin
 *  - Senha com pelo menos 6 caracteres
 *  - O usuário-alvo precisa ter auth_user_id (criado via Supabase Auth)
 * ─────────────────────────────────────────────────────────────────── */
export async function alterarSenhaUsuarioAction(
  usuarioId: string,
  novaSenha: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!novaSenha || novaSenha.length < 6) {
    return { error: "A senha precisa ter ao menos 6 caracteres." };
  }
  if (novaSenha.length > 72) {
    return { error: "A senha não pode ter mais de 72 caracteres." };
  }

  const admin = createAdminClient();

  // Busca o auth_user_id do usuário-alvo
  const { data: usuario, error: errUser } = await admin
    .from("usuarios")
    .select("auth_user_id, email, nome")
    .eq("id", usuarioId)
    .single();

  if (errUser || !usuario) {
    return { error: "Usuário não encontrado no sistema." };
  }
  if (!usuario.auth_user_id) {
    return {
      error:
        "Esse usuário ainda não tem login no Supabase Auth. Use o botão \"Convidar usuário\" para criar o acesso primeiro.",
    };
  }

  // Atualiza a senha via API administrativa
  const { error: errPwd } = await admin.auth.admin.updateUserById(usuario.auth_user_id, {
    password: novaSenha,
    // Limpa a flag de must_change_password (caso ainda exista)
    user_metadata: { must_change_password: false },
  });

  if (errPwd) return { error: traduzirErro(errPwd) };

  // Log opcional (não bloqueia se falhar)
  try {
    await admin.from("audit_log").insert({
      tabela: "usuarios",
      registro_id: usuarioId,
      acao: "alterar_senha",
      usuario_id: auth.userId,
      payload: { email_alvo: usuario.email },
    });
  } catch {
    // audit_log pode não existir ainda — silencia
  }

  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

/* ───────────────────────────────────────────────────────────────────
 * ENVIAR REDEFINIÇÃO DE SENHA
 *
 * Estratégia:
 *  1. Gera link de recovery via Supabase Auth Admin
 *  2. Se RESEND_API_KEY existe → manda email customizado via Resend
 *  3. Se não → usa SMTP padrão do Supabase via resetPasswordForEmail
 *
 * Sempre retorna o provider usado pra UI mostrar no toast.
 * ─────────────────────────────────────────────────────────────────── */
export async function enviarRedefinicaoSenhaAction(
  email: string,
): Promise<{ ok: true; provider: "resend" | "supabase-smtp" } | { error: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  const admin = createAdminClient();
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? hdrs.get("referer")?.split("/").slice(0, 3).join("/") ?? "http://localhost:3000";
  const redirectTo = `${origin}/auth/callback?next=/definir-senha`;

  // Tentativa 1: Resend (se configurado)
  if (process.env.RESEND_API_KEY) {
    // Gera link com o admin client
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      return { error: traduzirErro(error ?? "Falha ao gerar link de redefinição") };
    }
    const linkReset = data.properties.action_link;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Terra Roxa <no-reply@terraroxa.com.br>";

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "Terra Roxa — Redefinir sua senha",
          html: htmlEmailRedefinicao(linkReset, email),
        }),
      });
      if (!resp.ok) {
        const detalhe = await resp.text().catch(() => "");
        console.error("Resend retornou erro:", resp.status, detalhe);
        return { error: `Falha ao enviar pelo Resend (status ${resp.status}). Tente novamente.` };
      }
      return { ok: true, provider: "resend" };
    } catch (e) {
      console.error("Erro Resend:", e);
      return { error: "Falha ao conectar ao Resend. Verifique a chave de API." };
    }
  }

  // Tentativa 2: SMTP padrão do Supabase
  const { error: errReset } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (errReset) return { error: traduzirErro(errReset) };
  return { ok: true, provider: "supabase-smtp" };
}

/* ─── HTML do email Resend ─────────────────────────────────────────── */
function htmlEmailRedefinicao(link: string, email: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Redefinir senha — Terra Roxa</title>
</head>
<body style="margin:0;padding:0;background:#fbf6fc;font-family:Inter,Arial,sans-serif;color:#1a1320">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#8745a3,#5b2d75);padding:32px 32px 24px;text-align:center;color:#fff">
            <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:.02em">TERRA ROXA</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:.85">Portal de Cargas</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 12px;font-size:20px;color:#5b2d75">Redefinir sua senha</h2>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Olá,</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Recebemos uma solicitação para redefinir a senha da conta <strong>${email}</strong>. Clique no botão abaixo para criar uma nova senha:</p>
            <p style="text-align:center;margin:28px 0">
              <a href="${link}" style="display:inline-block;background:#8745a3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Redefinir senha</a>
            </p>
            <p style="margin:0 0 12px;font-size:12px;color:#5a4d65;line-height:1.6">Se o botão não funcionar, copie e cole o link no navegador:</p>
            <p style="margin:0 0 24px;font-size:11px;color:#5a4d65;word-break:break-all">${link}</p>
            <hr style="border:none;border-top:1px solid #e3cde7;margin:24px 0">
            <p style="margin:0;font-size:11px;color:#9a8aa3;line-height:1.5">Se você não solicitou essa redefinição, ignore este e-mail. Sua senha continuará a mesma.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f3e7f6;padding:16px 32px;text-align:center;font-size:11px;color:#5a4d65">
            © Terra Roxa Comércio de Cereais — Portal de Cargas
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
