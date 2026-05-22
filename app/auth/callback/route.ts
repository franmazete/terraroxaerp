import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de OAuth / magic link / invite.
 * Troca o "code" da URL pela session e redireciona para "next" (default: /dashboard).
 *
 * Fluxo de convite:
 *  - Admin envia invite via dashboard ou API
 *  - User clica no link do e-mail → cai aqui com ?code=XXX
 *  - Trocamos o code por session e redirecionamos pra /definir-senha
 *    (na primeira vez, o user precisa definir uma senha)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/definir-senha";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Falha — manda pra login com erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback_falhou`);
}
