import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/types";

/**
 * Server Action / Route Handler — admin envia convite por e-mail.
 *
 * POST /auth/invite
 * Body: { email: string; nome: string; perfil: Perfil; transp_id?: string }
 *
 * Requer:
 *  - Usuário logado E com perfil = 'admin'
 *  - SUPABASE_SERVICE_ROLE_KEY no .env (lado server)
 *
 * Fluxo:
 *  1. Verifica permissão do solicitante
 *  2. Chama auth.admin.inviteUserByEmail (envia e-mail com link)
 *  3. Cria registro em public.usuarios (perfil + transp_id) — trigger
 *     populá-lo automaticamente quando o user aceitar
 *  4. Retorna { ok: true }
 */
export async function POST(request: NextRequest) {
  // 1) Verifica que o solicitante é admin
  const supabase = await createClient();
  const { data: { user: requester } } = await supabase.auth.getUser();
  if (!requester) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: requesterRow } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("auth_user_id", requester.id)
    .single();
  if (requesterRow?.perfil !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode convidar" }, { status: 403 });
  }

  // 2) Valida payload
  const body = (await request.json()) as {
    email?: string;
    nome?: string;
    perfil?: Perfil;
    transp_id?: string;
    /** Quando preenchido: cria user com senha temporária em vez de enviar convite por email. */
    senha?: string;
  };
  if (!body.email || !body.nome || !body.perfil) {
    return NextResponse.json({ error: "Campos obrigatórios: email, nome, perfil" }, { status: 400 });
  }
  if (body.senha && body.senha.length < 6) {
    return NextResponse.json({ error: "Senha temporária precisa ter ao menos 6 caracteres" }, { status: 400 });
  }

  // 3) Envia o convite com admin client (service_role — server-side only)
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  let novoUserId: string | undefined;
  let modo: "convite" | "senha_manual" = "convite";

  if (body.senha) {
    // ─── Modo "criar com senha temporária" ───────────────────────────
    modo = "senha_manual";
    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.senha,
      email_confirm: true, // já confirma o email (admin tá garantindo)
      user_metadata: {
        nome: body.nome,
        perfil: body.perfil,
        must_change_password: true, // flag pra forçar troca no 1º login
      },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Falha ao criar usuário" }, { status: 500 });
    }
    novoUserId = data.user.id;
  } else {
    // ─── Modo convite por email (padrão) ─────────────────────────────
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: { nome: body.nome, perfil: body.perfil },
        redirectTo: `${origin}/auth/callback?next=/definir-senha`,
      },
    );
    if (inviteError || !inviteData.user) {
      return NextResponse.json({ error: inviteError?.message ?? "Falha ao convidar" }, { status: 500 });
    }
    novoUserId = inviteData.user.id;
  }

  // 4) Garante row em public.usuarios (trigger pode ter criado no signup,
  //    aqui upsert pra cobrir os 2 fluxos)
  await admin
    .from("usuarios")
    .upsert(
      {
        auth_user_id: novoUserId,
        email: body.email,
        nome: body.nome,
        perfil: body.perfil,
        transp_id: body.transp_id ?? null,
        ativo: true,
      },
      { onConflict: "auth_user_id" },
    );

  return NextResponse.json({ ok: true, user_id: novoUserId, modo });
}
