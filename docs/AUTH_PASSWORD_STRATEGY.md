# Estratégia de senhas — terraroxa

## Decisão

A partir de B15, **o fluxo principal de gerenciamento de senha é direto pelo admin**, sem dependência de e-mail.

### Por quê

- Mais autonomia — admin não depende de o usuário ter acesso ao email
- Mais rápido — senha aplica imediatamente
- Mais confiável — não há link expirado, redirects quebrados, configs de SMTP, etc

## Fluxo principal (recomendado)

**Admin** → `/configuracoes/usuarios` → editar usuário → seção **"Alterar senha do usuário"** → preenche Nova Senha + Confirmar → **Alterar Senha**

Sob o capô:
1. Server Action `alterarSenhaUsuarioAction(usuarioId, novaSenha)`
2. Valida que solicitante é `perfil=admin`
3. Busca `auth_user_id` na tabela `public.usuarios`
4. Chama `supabase.auth.admin.updateUserById(authUserId, { password })`
5. Limpa flag `must_change_password` se existia
6. Tenta logar em `audit_log` (não bloqueia se tabela não existe)
7. Toast: "Senha atualizada. O usuário já pode acessar com a nova senha."

A `SERVICE_ROLE_KEY` **nunca** é exposta no frontend — toda a lógica está em `lib/api/usuarios-actions.ts` (server-only com `"use server"`).

## Fluxos secundários (mantidos)

Continuam disponíveis mas opcionais:

| Fluxo | Quando usar |
|---|---|
| 📧 **Enviar redefinição por e-mail** (botão na edição) | Usuário pediu nova senha e está distante do admin |
| **Convidar usuário com senha temporária** | Criar conta de teste / força troca no 1º login |
| **Convidar usuário sem senha (email)** | Onboarding tradicional via link |
| `/esqueci-senha` (público) | Usuário se vira sozinho |

## Investigação do "Internal Server Error" no link de redefinição

### Sintoma reportado

Usuário recebe email de redefinição → clica no link → cai em página com **500 Internal Server Error** no Vercel.

### Causa provável

O Supabase manda o link no formato:
```
https://<projeto>.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://<vercel>.app/auth/callback
```

Quando o redirect chega em `/auth/callback?code=XXX`, a rota faz:
```ts
const supabase = await createClient();
const { error } = await supabase.auth.exchangeCodeForSession(code);
```

Possíveis pontos de falha em produção (Vercel):

1. **URLs autorizadas no Supabase** — em **Auth → URL Configuration**:
   - `Site URL` precisa ser a URL exata da Vercel (ex: `https://terraroxaerp.vercel.app`)
   - `Redirect URLs` precisa ter `https://terraroxaerp.vercel.app/**`
   - Se faltar, o Supabase rejeita a troca de código e o `createClient` quebra ao tentar setar cookie

2. **Cookies da sessão** — `createClient` (server-side) usa `cookies()` do Next. Em produção, se o domínio do Vercel não bate com o domínio dos cookies que o Supabase setou, a sessão não persiste.

3. **Middleware** — se há middleware que requer auth em `/auth/callback`, fica em loop e estoura.

### Como diagnosticar (depois)

1. Abre **Vercel → Logs** e captura o erro 500 quando alguém clica no link
2. Confere `Auth → URL Configuration` no Supabase
3. Confere `app/auth/callback/route.ts` e verifica se `await createClient()` tá pegando os cookies corretos

### Por que não vamos investigar agora

A usuária decidiu eliminar essa dependência. O fluxo direto via `admin.auth.admin.updateUserById` resolve o caso de uso principal (admin alterar senha de qualquer user) sem depender de email/link/callback.

## Como **desabilitar completamente** o reset por email (opcional)

Se quiser ir além e bloquear o botão `/esqueci-senha` na tela de login pública:

1. Remover o `<Link href="/esqueci-senha">` da `app/(auth)/login/page.tsx`
2. Remover a rota `app/(auth)/esqueci-senha/`
3. No Supabase Studio → Auth → URL Configuration: zerar Redirect URLs

Recomendo manter por enquanto — é fallback caso o admin esteja fora do ar.

## Política de senha

- Mínimo: **6 caracteres** (limite do Supabase Auth gratuito)
- Recomendado: ≥ 8 caracteres com letras + números
- Máximo: 72 caracteres (limite bcrypt)
- Sem requisitos complexos (símbolos obrigatórios etc) — UX > paranoia

## Audit log

Toda alteração de senha tenta gravar em `audit_log`:
```sql
{
  tabela: 'usuarios',
  registro_id: <usuario_id>,
  acao: 'alterar_senha',
  usuario_id: <id do admin que alterou>,
  payload: { email_alvo: <email do usuário cuja senha foi alterada> }
}
```

Se a tabela `audit_log` não existir ainda, o erro é silenciado (não bloqueia a alteração de senha).
