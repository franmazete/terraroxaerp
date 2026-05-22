# B1 — Plano de migração página-a-página

> **Pré-requisito**: você aplicou as 3 migrations no Supabase (`docs/SETUP_ETAPA_2_SUPABASE.md`) e criou o usuário admin. O app já detecta o `.env.local` e usa Supabase para auth automaticamente.

## Estado atual (B1 entregue)

- ✅ `lib/api/queries.server.ts` — 27 funções de leitura server-side. Cada uma retorna `[]` ou `null` se Supabase não configurado (não quebra modo mock).
- ✅ `lib/api/actions.ts` — Server Actions de mutations principais: `publicarContrato`, `disponibilizarContrato`, `publicarCarga`, `criarReserva`, `aprovarReserva`, `cancelarOrdem`, `resolverPendencia`, `criarPendenciaServer` (helper interno).
- ⏳ Faltam ~20 actions menores (anexarAutorizacao, anexarTicket, calcularQuebra, etc.) — template está no fim de `actions.ts`. Padrão idêntico, dá pra fazer em lote.

## Estratégia: migração incremental por página

A regra: cada página vira **Server Component** que `await getX()` no topo, e botões de mutation chamam **Server Actions** com `revalidatePath`. O `data-store.tsx` mock continua existindo como fallback enquanto não migramos tudo.

### Ordem sugerida (mais fácil → mais complexa)

#### 1. `/contratos` (página listagem)

**Antes** (`app/(cerealista)/contratos/page.tsx`):
```tsx
"use client";
const { contratos } = useDataStore();
```

**Depois**:
```tsx
// page.tsx (Server Component — sem "use client")
import { getContratos, getProdutores, getClientes } from "@/lib/api/queries.server";

export default async function ContratosPage() {
  const [contratos, produtores, clientes, produtos] = await Promise.all([
    getContratos(),
    getProdutores(),
    getClientes(),
    getProdutos(),
  ]);
  return <ContratosClientView contratos={contratos} produtores={produtores} ... />;
}

// ContratosClientView.tsx ("use client" — recebe via props)
```

**Mutations** (no `LancarContratoModal`):
```tsx
"use client";
import { publicarContratoAction } from "@/lib/api/actions";

async function submit() {
  const r = await publicarContratoAction({ ... });
  if ("error" in r) toast.error(r.error);
  else toast.success("Contrato criado");
}
```

`revalidatePath("/contratos")` na action faz a página recarregar automaticamente.

#### 2. `/contratos/[id]` (detalhe)
Praticamente igual. `await getContrato(id)`. `disponibilizarContratoAction(id)` no botão.

#### 3. `/cargas`
Cargas têm reservas aninhadas. `getCargas()` já faz `.select("*, reservas(*)")`. O componente recebe array com `reservas` populado.

#### 4. `/ordens` (listagem)
`getOrdens()` ou `getOrdensDaTransp(user.transp_id)` se for transp. Filtros (período/status/transp) podem virar `searchParams` (server-side) ou continuar client-side com o array todo.

#### 5. `/ordens/[id]` (detalhe — o mais pesado)
```tsx
export default async function OrdemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = await getOCSnapshot(id);   // já agrega 13 queries em 1 Promise.all
  if (!snap) notFound();
  return <OrdemDetalheClient snap={snap} />;
}
```

#### 6. `/pendencias`
```tsx
const pendencias = user.perfil === "transportadora"
  ? await getPendenciasDoSetor("transportadora", user.transp_id)
  : await getPendenciasAbertas();
```

`resolverPendenciaAction(id)` em cada botão.

#### 7. `/dashboard`, `/painel` — analytics
Migrar mais tarde (precisa de `count`/`sum` agregados; bom candidato a uma view SQL ou função RPC).

## O que MANTÉM mock (não migrar)

- `mock-data.ts` continua como seed local pra dev sem Supabase
- `data-store.tsx` continua, mas vira **opt-in**: páginas migradas não usam mais. Mantém compatibilidade com o que ainda não foi migrado.

## Auth real (já está em modo dual)

`AuthContext` já alterna entre mock e Supabase. Quando a página vira Server Component, o auth ainda funciona via cookies/middleware (`lib/supabase/middleware.ts`). User context do client ainda existe para CSR.

## Realtime (B3, vem depois)

Para o **sino do J.12** ficar instant cross-portal:

```tsx
"use client";
useEffect(() => {
  const supabase = createClient();
  const channel = supabase
    .channel("pendencias")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pendencias" }, (payload) => {
      // toast + revalidate
      router.refresh();
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

## Upload de arquivos (B4)

Substituir `pending-upload://nome.pdf` por upload real:

```tsx
const file = e.target.files?.[0];
if (!file) return;
const path = `${ocId}/${categoria}/${Date.now()}_${file.name}`;
const { error } = await supabase.storage.from("operacao").upload(path, file);
if (error) toast.error(error.message);
else {
  // path agora é o "arquivo_url" que vai pro banco
  await anexarDocumentoAction({ oc_id: ocId, categoria, arquivo_url: path, ... });
}
```

## Checklist do que fazer quando você voltar com Supabase aplicado

- [ ] Confirmar que `.env.local` está completo (ver `SETUP_ETAPA_2_SUPABASE.md` passo 1)
- [ ] Confirmar `npx supabase db push` aplicou as 3 migrations
- [ ] Confirmar admin criado em `public.usuarios` (passo 4 do setup)
- [ ] Testar login real em `http://localhost:3000/login`
- [ ] Confirmar que badge "modo Supabase" aparece (hint do login muda)
- [ ] Avançar pra `/contratos` primeiro (mais simples) — me peça pra migrar essa página

## Migrações remanescentes do `data-store.tsx`

Quando todas as páginas migrarem, o data-store fica **redundante**. A ordem natural pra depreciar:

1. Páginas usam queries.server + actions (atual)
2. AuthContext usa Supabase puro (já usa em modo dual)
3. Sino do J.12 vira Realtime channel
4. Upload vira Storage
5. data-store fica só como cache otimista (opcional) ou é removido

## Erros comuns esperados

- **"Auth session missing"** — middleware funcionando mas user não logou. Faça login primeiro.
- **RLS bloqueando** — mensagens estilo "row violates row-level security policy". Confira o perfil do user (`select * from public.usuarios where email=...`).
- **`use server`** em arquivo errado — Server Actions só funcionam em arquivos com `"use server"` no topo.
- **Tipos divergentes** — ENUMs Postgres viram `string` em Supabase TS client. Cast explícito quando precisar (`as OCStatus`).
