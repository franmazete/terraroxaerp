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
  };
  if (!body.email || !body.nome || !body.perfil) {
    return NextResponse.json({ error: "Campos obrigatórios: email, nome, perfil" }, { status: 400 });
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

  // 4) Atualiza public.usuarios (trigger criou no insert; aqui sobrescreve perfil/transp_id)
  await admin
    .from("usuarios")
    .update({ perfil: body.perfil, transp_id: body.transp_id ?? null, nome: body.nome })
    .eq("auth_user_id", inviteData.user.id);

  return NextResponse.json({ ok: true, user_id: inviteData.user.id });
}
