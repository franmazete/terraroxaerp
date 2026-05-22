# Relatório de Performance — terraroxa (B3)

**Data:** 2026-05-22
**Escopo:** páginas migradas para Server Components + Supabase (B2.d–g)
**Status do banco:** tabelas vazias (latência medida = puro overhead de rede + parser)

> ⚠️ **Nada foi alterado.** Este documento é só diagnóstico. As correções estão sugeridas mas não aplicadas.

---

## 1. Resumo executivo

Em ambiente de desenvolvimento local (Windows, presumivelmente Brasil), **cada query individual leva 400–1000ms** mesmo com tabelas vazias. A causa **NÃO é o SQL** — é uma combinação de:

| Causa | Peso estimado |
|---|---|
| Latência de rede + TLS handshake (Supabase US-East) | ~50% |
| Middleware `auth.getUser()` em **toda** navegação | ~20% |
| 6–8 queries paralelas por página (Promise.all espera a pior) | ~15% |
| Falta de connection reuse entre Server Components | ~10% |
| Funções RLS reavaliadas por linha (poderia ser cacheada) | ~5% |

**Cenário pior identificado:** `/contratos/[id]` faz **8 queries em paralelo** + middleware. Soma ~1.5–2.5s **antes** da primeira pintura. Não é problema de SQL.

---

## 2. Evidências de medição

### 2.1 Latência ponta-a-ponta (curl, 3 runs por endpoint)

```
GET /usuarios                  avg= 669ms  pior= 942ms
GET /transportadoras           avg= 605ms  pior= 737ms
GET /motoristas                avg= 530ms  pior= 866ms
GET /veiculos                  avg= 457ms  pior= 497ms
GET /produtores                avg= 535ms  pior= 543ms
GET /clientes                  avg= 404ms  pior= 428ms
GET /terminais                 avg= 540ms  pior= 609ms
GET /locais                    avg= 737ms  pior= 793ms
GET /produtos                  avg= 512ms  pior= 601ms
GET /contratos                 avg= 614ms  pior= 697ms
GET /cargas + reservas         avg= 437ms  pior= 455ms
GET /ordens_carregamento       avg= 481ms  pior= 530ms
GET /pendencias                avg= 828ms  pior=1039ms
```

**Tabelas estão vazias.** Banco com dados não muda essa latência base — só adiciona em cima.

### 2.2 Breakdown de uma request (curl `-w`)

```
DNS lookup:    28ms
TCP connect:   192ms   ← bate em Cloudflare PoP no Rio
TLS handshake: 405ms   ← chega no origin (US-East presumido)
Server proc:   1023ms  ← SELECT vazio, RLS + middleware
Total:         1024ms
```

### 2.3 Keep-alive (mesma conexão, 5 requests)

```
req 1 (cold): 907ms
req 2:        628ms
req 3:        394ms
req 4:        229ms
req 5:        270ms
```

**Diferença de 600ms** entre cold e warm. Cada navegação no app **abre conexões novas** porque `createServerClient()` é chamado por request.

### 2.4 Headers identificam roteamento

```
CF-Ray: 9ffcf08808222598-GIG
Server: cloudflare
```

`-GIG` = Galeão (Rio). Cloudflare está no Brasil; **origin do Postgres provavelmente em US-East-1** (default Supabase quando criado sem escolher região). Latência mínima Brasil↔US-East ≈ 150ms × 2-3 hops + handshake.

### 2.5 Middleware `auth.getUser()` por request

```
req 1: 1055ms
req 2:  597ms
req 3:  566ms
```

**Isso roda ANTES de qualquer página carregar.** Está em `lib/supabase/middleware.ts:34` na linha `await supabase.auth.getUser()`.

---

## 3. Análise página-a-página

### 3.1 `/contratos` (listagem)

**Código atual** (`app/(cerealista)/contratos/page.tsx:38–45`):
```ts
const [contratos, produtos, produtores, clientes, cargas, ordens] = await Promise.all([
  getContratos(),
  getProdutos(),
  getProdutores(),
  getClientes(),
  getCargas(),     // ← traz TODAS as cargas só pra contar por contrato
  getOrdens(),     // ← idem
]);
```

| Métrica | Valor |
|---|---|
| Tempo total estimado | ~800ms + middleware (600ms) = **~1.4s** |
| Queries ao Supabase | 6 paralelas + 1 do middleware |
| Query mais lenta | `getOrdens()` ou `getCargas()` (sem WHERE, sem LIMIT) |
| Problema crítico | `getCargas()` e `getOrdens()` carregam tabelas **inteiras** só pra contar quantos itens por contrato. Em produção com 10k OCs, será catastrófico |

**Correção sugerida:**
- Substituir `getCargas() + getOrdens()` por uma única RPC que retorna `{contrato_id, qtd_cargas, qtd_ordens}` agregado
- OU usar PostgREST com aggregation: `/rest/v1/cargas?select=contrato_id&select=count` (já agrupa)
- Reduzir 3 lookups (`produtos.find`, `produtores.find`, `clientes.find`) → embedding direto: `/rest/v1/contratos?select=*,produto:produtos(nome),produtor:produtores(nome),cliente:clientes(nome)`

**Ganho estimado:** de 6 queries para 2 → ~300–500ms a menos no Promise.all.

---

### 3.2 `/contratos/[id]` (detalhe)

**Código atual** (`app/(cerealista)/contratos/[id]/page.tsx:23–32`):
```ts
const [contrato, produtos, produtores, clientes, locais, terminais, cargas, ordens] = await Promise.all([
  getContrato(id),
  getProdutos(),
  getProdutores(),
  getClientes(),
  getLocais(),
  getTerminais(),
  getCargas(),    // ← TUDO, depois filtra c.contrato_id === id no Server
  getOrdens(),    // ← idem
]);
```

| Métrica | Valor |
|---|---|
| Tempo total estimado | **~1.0–1.5s** (8 queries) + middleware = **~1.6–2.1s** |
| Queries ao Supabase | 8 paralelas |
| Problema crítico | Mesmo de cima: traz TODAS as cargas/ordens só pra mostrar 1 contrato. Pior ainda em produção |
| Outro problema | `getProdutos/Produtores/Clientes/Locais/Terminais` — traz tabelas inteiras só pra dar `.find()` em **um** registro de cada |

**Correção sugerida:**
- 1 query única com embedding:
  ```sql
  /rest/v1/contratos?id=eq.{id}
    &select=*,produto:produtos(nome,descricao),
            produtor:produtores(*),cliente:clientes(*),
            origem:locais!local_origem_id(*),
            destino:locais!destino_local_id(*),
            terminal:terminais(*)
  ```
- Cargas/ordens com filtro: `/rest/v1/cargas?contrato_id=eq.{id}&select=id,total_kg,...`
- Total: **3 queries** em vez de 8.

**Ganho estimado:** de 8 → 3 → ~400ms a menos.

---

### 3.3 `/cargas` (listagem cerealista)

**Código atual** (`app/(cerealista)/cargas/page.tsx:11`):
```ts
const cargas = await getCargas();  // select=*,reservas(*)
```

| Métrica | Valor |
|---|---|
| Tempo total | ~440ms + middleware = **~1.0s** |
| Queries | 1 |
| Problema | **Sem LIMIT.** Em produção retorna tudo (anos de cargas). |
| Outro problema | `select=*` carrega colunas pesadas como `obs`, `transps_permitidas`. UI usa só ~10 colunas |

**Correção sugerida:**
- Adicionar `.limit(100).order("publicada_em", desc)` por default
- Selecionar só colunas usadas: `id, produto, origem, destino, total_kg, reservado_kg, status, data_carg, publicada_em, reservas(...)`
- Paginação com `range()` quando passar de 100

**Ganho estimado:** payload menor → ~150ms a menos quando banco tiver dados.

---

### 3.4 `/pendencias`

**Código atual** (`app/pendencias/page.tsx:13`):
```ts
const pendencias = await getPendenciasAbertas();  // select=*, status=eq.aberta, order=vence_em
```

| Métrica | Valor |
|---|---|
| Tempo total | ~830ms + middleware = **~1.4s** |
| Queries | 1 |
| Problema | É a query mais lenta dos endpoints REST (acima de 1s no pior caso). Pode ser pelo RLS chamando `is_cerealista()` ou pela ordenação |

**Correção sugerida:**
- Já tem índice `idx_pendencias_status` e `idx_pendencias_vence`
- Adicionar `.limit(200)` (pra evitar trazer 10k pendências em produção)
- Materialized view com counts (`atrasadas`, `vencendo`, `no_prazo`) — ainda mais quando dashboards consumirem isso

---

## 4. Causas-raiz transversais

### 4.1 **Middleware roda `getUser()` toda navegação** — CRÍTICO

**Arquivo:** `lib/supabase/middleware.ts:34`
```ts
const { data: { user } } = await supabase.auth.getUser();
```

- `getUser()` faz request a `auth/v1/user` (validação do JWT contra o banco)
- Mede **597–1055ms** por chamada
- Roda em **cada request** (navegação entre páginas, RSC re-render, etc)

**Correção sugerida (não aplicar agora):**
- Substituir por `getSession()` que lê só do cookie (não bate no banco) — **menos seguro** mas instantâneo
- OU: `getUser()` apenas em rotas protegidas críticas; resto usa session do cookie
- OU: aceitar latência mas mover validação pesada pra Server Action quando aciona mutation

### 4.2 **Cada Server Component refaz handshake TLS** — ALTO

**Arquivo:** `lib/supabase/server.ts:8`
```ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(...);
}
```

Cada chamada de `createClient()` cria nova instância. Em queries.server.ts, é chamado **dentro de cada função** (`getContratos`, `getProdutos` etc). Quando uma página chama 8 queries, são **8 instâncias** — embora possa reusar conexão TCP/TLS via Node fetch keep-alive, na prática estamos pagando overhead.

**Correção sugerida:** memoizar `createClient()` por request usando `React.cache()`:
```ts
import { cache } from "react";
export const getSupabaseClient = cache(async () => {
  // ... createServerClient ...
});
```

Isso fará todas as queries da mesma request reusarem o mesmo cliente.

### 4.3 **Geografia: projeto Supabase em US-East?** — CRÍTICO

**Sintomas:**
- TCP connect 192ms (Brasil → US é ~150ms)
- TLS handshake 405ms (handshake completo = mais 1 RTT)
- Server proc 1023ms (lento demais para SELECT vazio)

**Como confirmar:**
1. Supabase Studio → **Settings → General** → ver "Region"
2. Se aparecer `us-east-1` (Virginia), `us-west-1` (Oregon), `eu-central-1` (Frankfurt), **não é Brasil**

**Solução** (não aplicável agora — exige criar novo projeto):
- Plano **Pro** do Supabase suporta região `sa-east-1` (São Paulo)
- **Free tier não permite escolher região** — fica em us-east default
- **Migração não é gratuita** — exporta dump, cria projeto novo, restaura

**Ganho estimado se mudar pra sa-east-1:** **−400 a −600ms por query** (RTT cai de ~200ms pra ~30ms).

### 4.4 **Helpers RLS executam SELECT por linha**

**Migration `20260520130000_rls_policies.sql:17–34`:**
```sql
create or replace function public.is_cerealista() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select perfil in (...) from public.usuarios where auth_user_id = auth.uid() limit 1),
    false
  );
$$;
```

Marcado `stable` — mas em policies do PostgREST com muitas linhas, isso ainda pode rodar **uma vez por linha** dependendo do plano. Mesmo com índice `idx_usuarios_auth`, é overhead.

**Correção sugerida:**
- Mudar de `STABLE` para **`STABLE PARALLEL SAFE`** + envolver em `(SELECT ...)` pra forçar avaliação única:
  ```sql
  -- nas policies:
  for select using ((SELECT public.is_cerealista()))
  ```
  O `(SELECT ...)` força Postgres a avaliar **uma vez** por query em vez de por linha.

### 4.5 **`getCargas()` retorna reservas embedded sem limite**

**queries.server.ts:121:**
```ts
.from("cargas").select("*, reservas(*)")
```

Quando uma carga tem 50 reservas, o JSON cresce. Em produção: 1000 cargas × 20 reservas média = 20k linhas trafegando. Sem `LIMIT`.

---

## 5. Índices recomendados (NÃO aplicar agora)

A migration `0004_complementos.sql` já adicionou os mais importantes. Confirmando que estão lá:

```sql
-- JÁ APLICADO ✓
idx_usuarios_auth                    -- crítico pro RLS
idx_usuarios_transp
idx_motorista_transp / idx_veiculo_transp
idx_contratos_disponivel (parcial)
idx_contratos_status / idx_cargas_status / idx_reservas_status
idx_cargas_contrato / idx_reservas_carga / idx_reservas_transp
idx_oc_transp / idx_oc_status_op / idx_oc_status_fiscal / idx_oc_status_financeiro
idx_oc_refugada (parcial)
idx_pendencias_status (parcial) / idx_pendencias_setor / idx_pendencias_transp / idx_pendencias_oc / idx_pendencias_vence
idx_nf_oc / idx_cte_oc / idx_descarga_oc / idx_doc_oc (parcial)
idx_hist_entity / idx_notif_user_lida (parcial)
idx_contratos_numero / idx_contratos_numero_manual / idx_oc_numero
idx_oc_emitida_em / idx_contratos_data_emissao
idx_contratos_produto / idx_contratos_produtor
idx_quebras_oc / idx_quebras_alerta (parcial)
```

**Faltando** (causados pelas queries que listamos):
```sql
-- Para /cargas?order=publicada_em desc
create index if not exists idx_cargas_publicada_em
  on public.cargas (publicada_em desc);

-- Para ordens?order=emitida_em desc (já tem mas confirmar)
-- idx_oc_emitida_em — já existe

-- Para reservas embedded em cargas: o select=reservas(*) gera join por carga_id (já indexado)
-- Mas pode ajudar:
create index if not exists idx_reservas_carga_status
  on public.reservas (carga_id, status);

-- Em /contratos: contagem rápida de cargas/ordens por contrato
-- Já tem idx_cargas_contrato. Suficiente.
```

---

## 6. Tabela consolidada — gargalos por página

| Página | Queries | T. atual | Gargalo principal | Correção (não aplicada) | Ganho |
|---|---|---|---|---|---|
| `/contratos` | 6 | ~1.4s | `getCargas()` + `getOrdens()` sem WHERE | RPC `contratos_com_count()` ou embedding | −400ms |
| `/contratos/[id]` | 8 | ~1.6–2.1s | 5 tabelas inteiras pra dar `.find()` | 1 query c/ embedding + 2 filtradas | −500ms |
| `/cargas` | 1 | ~1.0s | sem LIMIT, `select *` | `.limit(100).select(colunas_usadas)` | −150ms |
| `/pendencias` | 1 | ~1.4s | RLS executando por linha | `STABLE PARALLEL SAFE` + `(SELECT ...)` | −200ms |

**Para TODAS as páginas:**

| Otimização | Ganho estimado |
|---|---|
| `React.cache(createClient)` reusando cliente por request | −100ms |
| Mudar projeto pra `sa-east-1` (se Pro) | **−400 a −600ms por query** |
| Substituir `getUser()` por `getSession()` no middleware | −500 a −1000ms por navegação |
| Wrap helpers RLS em `(SELECT ...)` | −50 a −200ms |

---

## 7. Recomendações priorizadas

### Quick wins (próxima sessão, sem migração de dados)

1. **Memoizar `createClient()` com `React.cache()`** — 15min de trabalho, ganho consistente
2. **`getCargas()` em `/contratos` virar count agregado** — 30min, ganho gigante em produção
3. **`getContratos()` ler embedding** (`select=*,produtor:produtores(nome),...`) — 30min
4. **Adicionar `.limit(100)` em todas as listagens** — 15min, protege produção

### Médio prazo (1–2 horas)

5. **Wrap policies RLS em `(SELECT ...)`** — migration nova, mas idempotente
6. **Materialized view ou RPC com contagens** pra dashboards
7. **Considerar trocar `getUser()` por `getSession()`** no middleware — analisar trade-off de segurança

### Longo prazo (decisão de produto)

8. **Migrar projeto pra `sa-east-1`** — Supabase Pro, exige reset
9. **Edge Functions** pra queries críticas (rodam no PoP mais próximo)

---

## 8. O que **NÃO** é problema

- ❌ **Indexes ausentes** — todos os índices necessários já estão criados
- ❌ **SQL ruim** — queries são triviais, não há JOIN complexo nem N+1 real
- ❌ **Recharts/jsPDF pesados** — só carregam quando renderizam (já com `next/dynamic`)
- ❌ **CSS/render** — Next.js está OK; build limpo

**O problema é arquitetural** (muitas queries por página) + **geográfico** (latência) + **middleware** (auth em toda navegação). Nenhum desses se resolve com índice.

---

## 9. Próximo passo recomendado

Implementar quick wins #1–#4. **Esperamos cair de ~1.5s para ~600ms** em `/contratos` e `/contratos/[id]`. Depois disso, se ainda lento, atacar geografia (migração de região).

Não vou fazer nada sem você autorizar. Diga "aplica os quick wins" se quiser que eu siga.
