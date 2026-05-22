# Checklist Supabase — antes de rodar o projeto

## Já feito ✅

- [x] Projeto Supabase criado (`btptijrdxtncyacsownb`)
- [x] `.env.local` configurado com 4 variáveis (URL, anon, service_role, db_url)
- [x] 3 migrations aplicadas:
  - 38 tabelas + 22 ENUMs + indexes + triggers
  - ~90 RLS policies
  - 2 buckets de Storage (`operacao` privado, `publico` público)

## Falta você fazer ⏳

### 1. Criar o usuário admin inicial

1. **Studio → Authentication → Users → Add user → Create new user**
2. Preencher email + senha forte
3. **Marcar "Auto Confirm User"** (senão ele fica em "waiting confirmation")
4. Clicar **Create user**

O trigger `tg_on_auth_user_created` cria automaticamente uma linha em `public.usuarios` com perfil padrão `logistica`.

### 2. Promover esse usuário a admin

**Studio → SQL Editor → New query**, rodar:

```sql
update public.usuarios
set perfil = 'admin', nome = 'Seu Nome Completo'
where email = 'seu@email.com';
```

Conferir:
```sql
select id, email, nome, perfil, ativo from public.usuarios;
```

### 3. (Opcional) Confirmar que o trigger funcionou

```sql
-- Deve mostrar 1 linha com seu email
select count(*) from public.usuarios;
```

Se aparecer 0, o trigger não disparou — pode ter falhado por algum motivo. Inserir manualmente:

```sql
insert into public.usuarios (auth_user_id, email, nome, perfil, ativo)
values (
  (select id from auth.users where email = 'seu@email.com'),
  'seu@email.com',
  'Seu Nome',
  'admin',
  true
);
```

### 4. Testar login

1. `npm run dev`
2. Abrir `http://localhost:3000/login`
3. Login com email + senha do admin
4. Esperar redirecionamento para `/dashboard`

> **Como confirmar que tá em modo Supabase**: na página de login, o hint embaixo deve mostrar "Acesso por convite. Sem conta? Peça ao administrador para convidá-lo" — em vez das credenciais demo (`cerealista / logistica`).

### 5. (Opcional) Convidar outros usuários

Como admin, vá em `/configuracoes/usuarios` → botão **📧 Convidar usuário**. Preencha email/nome/perfil e o Supabase envia o link.

## Configuração de Auth no Studio (recomendado)

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (dev) ou seu domínio prod
- **Redirect URLs**: adicionar `http://localhost:3000/auth/callback` e o equivalente em prod

**Authentication → Email Templates**:

- Personalizar template do **Invite** (PT-BR, com link `{{ .ConfirmationURL }}`)
- Personalizar **Reset Password**

## Status atual da aplicação (mock vs real)

Hoje:

- **Auth**: real (Supabase)
- **Dados (cargas, contratos, OCs)**: ainda em memória — vão sumir ao recarregar o browser
- **Migração página-a-página**: vide `docs/B1_PLANO_MIGRACAO.md`

Quando você quiser migrar a primeira página (`/contratos`) pra ler de verdade, peça e vamos.
