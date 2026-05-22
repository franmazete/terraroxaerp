# Deploy — GitHub + Vercel

Este projeto é **Next.js 15 App Router**, então o destino natural é o **Vercel** (criado pela mesma empresa que mantém o Next).

## Parte 1 — Subir pro GitHub

### 1. Conferir que segredos NÃO vão pro repo

```bash
# .env.local deve estar no .gitignore (já está):
grep -n "env" .gitignore
# Esperado: .env*.local, .env, .env.*.bak

# Confirmar que nenhum .env real está sendo trackado:
ls .env* 2>/dev/null
# Esperado: .env.local (local), .env.local.example (template público)
```

⚠ **NUNCA commitar**:
- `.env.local`
- `.env.local.bak`
- `supabase/.temp/` (tokens do CLI local)

### 2. Inicializar git (se ainda não inicializou)

```bash
git init
git add .
git commit -m "feat: terraroxa v0.1.0 — TMS completo em mock + Supabase pronto"
```

### 3. Criar repo no GitHub

Via web (mais simples):

1. https://github.com/new
2. Nome: `terraroxa` (ou outro)
3. **Privado** recomendado pra SaaS interno
4. **NÃO** marcar "Initialize with README" (você já tem)
5. Criar

Via gh CLI (se instalada):

```bash
gh repo create terraroxa --private --source=. --remote=origin
```

### 4. Conectar e fazer o primeiro push

```bash
git remote add origin https://github.com/SEU_USUARIO/terraroxa.git
git branch -M main
git push -u origin main
```

### 5. (Opcional, mas recomendado) Verificar que `.env.local` não foi pro GitHub

Abrir o repo no GitHub e procurar por "service_role" ou "supabase". Não deve aparecer nenhum valor real.

Se aparecer alguma chave: rotacione no Supabase Studio (Settings → API → "Reset") **imediatamente** e remova o arquivo do histórico:

```bash
git rm --cached .env.local
git commit -m "chore: remove .env.local do tracking"
git push
# Para limpar do histórico (se já foi pra remoto):
# https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
```

## Parte 2 — Deploy no Vercel

### 1. Criar conta Vercel

https://vercel.com/signup — recomendo login com GitHub (integração mais simples).

### 2. Importar o projeto

1. Dashboard Vercel → **Add New → Project**
2. **Import Git Repository** → escolher `terraroxa`
3. **Framework Preset**: Next.js (auto-detectado)
4. **Root Directory**: `./` (padrão)
5. **Build Command**: `next build` (padrão)
6. **Output Directory**: `.next` (padrão)

### 3. Configurar variáveis de ambiente

Antes de clicar em "Deploy", expandir **Environment Variables** e adicionar:

| Nome | Valor | Ambientes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://btptijrdxtncyacsownb.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (sua nova anon key após rotação) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | (sua nova service_role após rotação) | Production, Preview |
| `SUPABASE_DB_URL` | (connection string com senha URL-encoded) | Production |

> ⚠ **Não precisa** colar `SUPABASE_DB_URL` se você não vai rodar migrations a partir do Vercel. Para o app em si, só as 3 primeiras bastam.

### 4. Deploy

Clicar em **Deploy**. Em ~3 minutos a Vercel:
- Faz `npm ci`
- Roda `npm run build` (que valida TS + lint)
- Publica numa URL `https://terraroxa-XXX.vercel.app`

### 5. Configurar URLs no Supabase (importante!)

Voltar no **Supabase Studio → Authentication → URL Configuration**:

- **Site URL**: `https://terraroxa-XXX.vercel.app` (o domínio final)
- **Redirect URLs**: adicionar
  - `https://terraroxa-XXX.vercel.app/auth/callback`
  - Se for usar domínio custom: o equivalente

Sem isso, os links de convite e reset de senha apontam pra `localhost` e quebram em produção.

### 6. (Opcional) Domínio custom

Vercel Dashboard → projeto → **Settings → Domains** → adicionar `app.terraroxa.com.br` (ou o seu). Vercel mostra os DNS records pra você apontar no Registro.br.

Depois de propagar, atualizar **Site URL** no Supabase pra esse domínio.

## Parte 3 — CI já configurado

O arquivo `.github/workflows/ci.yml` já roda em cada PR/push:

- `npx tsc --noEmit` (typecheck)
- `npm run lint`
- `npm run build`

Para o **build no CI** funcionar sem `.env.local`, ele usa o caminho mock — não precisa configurar nada lá. Para o **build no Vercel** funcionar, precisa das env vars (passo 3 acima).

## Parte 4 — Checklist final pré-produção

- [ ] `.env.local` no `.gitignore` (confirmado)
- [ ] `.env.local.bak` removido (feito)
- [ ] Repo no GitHub criado (privado)
- [ ] Push inicial OK
- [ ] Vercel conectado
- [ ] Env vars configuradas no Vercel
- [ ] Deploy passou (verde no dashboard)
- [ ] Site URL atualizado no Supabase com o domínio Vercel
- [ ] Admin criado e testado (login funciona em produção)
- [ ] (Recomendado) Domínio custom configurado
- [ ] (Recomendado) Habilitar 2FA na conta GitHub e Supabase
