# Setup da Etapa 2 — Conectar Supabase Cloud

**Status do código**: ✅ Tudo pronto no repositório
**O que falta**: aplicar nas suas credenciais Supabase

---

## 1. Preparar `.env.local`

Copie `.env.local.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...    # anon/public — pode ir pro browser
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...         # secreta — SÓ server-side
SUPABASE_DB_URL=postgresql://postgres:[SENHA]@db.SEU_PROJETO.supabase.co:5432/postgres
```

Pegue em: **Supabase Dashboard → seu projeto → Settings → API** e **Settings → Database → Connection string → URI → Direct connection (5432)**.

> ⚠️ NUNCA cole o `SERVICE_ROLE_KEY` ou a senha do banco no chat — eles ficam só no seu `.env.local`.

---

## 2. Linkar o CLI ao projeto

```bash
npx supabase link --project-ref SEU_PROJETO
```

Vai pedir a senha do banco (uma vez — fica salvo em `supabase/.temp/`).

---

## 3. Aplicar as 3 migrations

Os 3 arquivos em `supabase/migrations/` estão prontos:

| Arquivo                                | O que faz                                     |
| -------------------------------------- | --------------------------------------------- |
| `20260520120000_schema_base.sql`       | 38 tabelas + ENUMs + indexes + triggers       |
| `20260520130000_rls_policies.sql`      | Row Level Security em todas as tabelas        |
| `20260520140000_storage_buckets.sql`   | Buckets `operacao` (privado) e `publico`      |

```bash
npx supabase db push
```

> A CLI vai mostrar o diff e pedir confirmação. Após o push, confira no Studio (https://supabase.com/dashboard/project/SEU_PROJETO/editor) que as tabelas apareceram.

---

## 4. Criar o primeiro usuário admin

O sistema é "signup só por convite" — então o primeiro admin precisa ser criado **manualmente** no Studio:

1. **Supabase Studio → Authentication → Users → Add user**
2. Email: seu email, Marcar "Auto Confirm User"
3. Definir senha temporária
4. Após criar, o trigger `tg_on_auth_user_created` automaticamente cria a linha em `public.usuarios` com perfil padrão `logistica`
5. **No SQL Editor**, promover para admin:

```sql
update public.usuarios
set perfil = 'admin', nome = 'Seu Nome'
where email = 'seu@email.com';
```

Pronto. Faça login normalmente em `/login`.

---

## 5. Convidar outros usuários (admin)

Endpoint pronto: `POST /auth/invite` (precisa estar logado como admin).

Exemplo via `curl` (durante dev — substitua pela UI quando criar a tela de "Convidar usuário"):

```bash
curl -X POST http://localhost:3000/auth/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie-admin>" \
  -d '{
    "email": "ana@terraroxa.com.br",
    "nome": "Ana Logística",
    "perfil": "logistica"
  }'
```

Para transportadora, inclua `transp_id`:

```json
{
  "email": "joao@cerrado.com.br",
  "nome": "João Cerrado",
  "perfil": "transportadora",
  "transp_id": "<UUID-da-transp-em-public.transportadoras>"
}
```

O Supabase enviará um e-mail com link `https://SEU_DOMINIO/auth/callback?code=XXX`. Ao clicar, o user é redirecionado para `/definir-senha`.

---

## 6. Buckets de Storage

Após `db push`, **verificar no Studio → Storage**:

- `operacao` (privado): autorizações, tickets, laudos, NFs, CTEs, comprovantes, faturas, agendamentos, avisos de refugo, CT-es de retorno, estadias
- `publico` (público): fotos de motoristas, logos

Convenção de paths que o app usa (definida nas policies):

```
operacao/<oc_id>/<categoria>/<arquivo>.pdf
publico/motoristas/<motorista_id>/foto.jpg
```

> A integração de UPLOAD real (substituir os "pending-upload://..." dos modais) virá quando você plugar `supabase.storage.from('operacao').upload(...)` nos handlers — alteração pontual em cada modal.

---

## 7. Modo dual (mock OU Supabase)

O `AuthContext.tsx` detecta automaticamente se o `.env.local` está configurado:

- **`.env.local` ausente/incompleto** → fallback mock (login com usuário fake, credenciais hardcoded — útil pra dev sem Supabase)
- **`.env.local` válido** → Supabase Auth real

Você pode testar localmente sem Supabase agora mesmo e plugar quando estiver pronto.

---

## 8. Validações depois do setup

- [ ] `npx supabase link` sem erros
- [ ] `npx supabase db push` aplicou as 3 migrations
- [ ] Studio mostra 38+ tabelas em `public`
- [ ] `select * from public.usuarios` retorna o admin
- [ ] Login em `/login` funciona com email+senha real
- [ ] Sino 🔔 do J.12 mostra pendências reais (depois de criar fluxos)
- [ ] Convite via `/auth/invite` envia e-mail
- [ ] `/auth/callback` + `/definir-senha` funcionam ao clicar no link do e-mail

---

## 9. Próximos passos pós-Etapa 2

Quando estiver tudo conectado, o `data-store.tsx` atual ainda é **in-memory** (React state). Migrar pra Supabase queries é o próximo bloco — vai ser fatiado:

- **B1**: queries de leitura (substitui `useState` por `useEffect + supabase.from()`)
- **B2**: mutations escrevem no banco antes de atualizar o cache local
- **B3**: Realtime channels pra cross-portal (substitui o pulse manual do J.12 por updates ao vivo)
- **B4**: Upload real no Storage (substitui placeholders nos modais)
