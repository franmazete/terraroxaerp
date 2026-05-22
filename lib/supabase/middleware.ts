import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware do Supabase Auth — chamado a cada request para:
 *  1. Atualizar a session expirada (refresh token)
 *  2. Redirecionar para /login se não houver session em rotas protegidas
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Se Supabase ainda não foi configurado, pula o middleware
  // (o AuthContext mock continua cuidando da autenticação até H4).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // IMPORTANTE: getUser() valida a session com o servidor.
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.pathname;
  const rotasPublicas = ["/login", "/definir-senha", "/esqueci-senha", "/auth/callback"];
  const ehRotaPublica = rotasPublicas.some((p) => url.startsWith(p));

  if (!user && !ehRotaPublica) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
