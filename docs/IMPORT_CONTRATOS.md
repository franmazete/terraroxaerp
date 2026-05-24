# Importação de Contratos via CSV

Importação batch de contratos vindos do ERP de origem (Terra Roxa) para o banco do terraroxa.

---

## 📤 Fluxo de uso

```
ERP de origem
    │
    │ 1. Exporta CSV no padrão definido (separador ;, encoding Latin-1)
    ↓
Supabase Storage  →  bucket "importacoes"
   contratos/
   ├── pendentes/      ← VOCÊ coloca o arquivo aqui
   ├── processados/<ts>/   ← arquivo movido após sucesso
   └── erros/<ts>_<nome>.csv ← linhas rejeitadas
    │
    │ 2. Você dispara a Edge Function `import-contratos-csv`
    │    (via Supabase Dashboard → Edge Functions → Invoke,
    │     ou via `supabase functions invoke import-contratos-csv`)
    ↓
Postgres:
  • contratos: 1 linha inserida ou atualizada por linha do CSV
  • produtores: criado se não existir, atualizado se já tiver (de-para por CPF/CNPJ)
  • importacao_log: registro do lote com sucesso/parcial/erro
```

Após o processamento:
- arquivo original vai pra `processados/<timestamp>/<nome>` (preservado)
- linhas rejeitadas viram um CSV em `erros/<timestamp>_<nome>.csv`
- log do lote fica em `public.importacao_log` (consulta SQL)

---

## 📝 Formato esperado do CSV

| Aspecto       | Valor                                                         |
| ------------- | ------------------------------------------------------------- |
| Encoding      | **Latin-1 (CP1252)** — parser converte para UTF-8             |
| Separador     | `;` (ponto-e-vírgula)                                         |
| Decimal       | vírgula (ex: `1.234,56` → `1234.56`)                          |
| Separador mil | ponto                                                         |
| Data          | `dd.mm.yyyy` (ex: `15.03.2026`)                               |
| Códigos       | `<codigo>-<nome>` (ex: `270-OTAVIO JOVELLI`, `3-SOJA GRANEL`) |

**Linha 1 = cabeçalho.** Demais linhas = dados.

### Cabeçalho (ordem fixa, separado por `;`)

```
ESTAB;TIPO;OPERACAO;CONTRATO;DESCSAFRA;DTEMISSAO;DTVENCTO;DTINICIO;DTFINAL;P_PRODUTOR;P_DOCCPF;P_NOMEFAZENDA;P_CIDADE_PRODUTOR;PRODUTO;QUANTIDADE;VALORUNIT;VALORTOTAL;ORIGEM;NQTDSALDO;NVLRSALDO
```

### Exemplo de linha válida

```
5;COMPRA;RETIRADA ARMAZEM DE TERCEIRO;10718;26-2026;15.03.2026;30.06.2026;15.03.2026;31.07.2026;270-OTAVIO JOVELLI;08740825000316;FAZ SANTO ANTONIO;Arandu-SP;3-SOJA A GRANEL;500.000,00;180,000000;90.000.000,00;Taquarituba-SP, ELIANO ANTUNES;500.000,00;90.000.000,00
```

---

## 🔗 De-para: CSV → banco

### Tabela `contratos` (1 linha de CSV = 1 contrato)

| Campo CSV          | Coluna `contratos`              | Tratamento                                                                                                         |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ESTAB`            | `empresa_origem_codigo`         | string como veio. Informativo.                                                                                     |
| `TIPO`             | `tipo_contrato`                 | minúsculo: `compra` ou `venda`. Outro valor → linha rejeitada.                                                     |
| `OPERACAO`         | `operacao`                      | string livre (ex: "RETIRADA ARMAZEM DE TERCEIRO").                                                                 |
| `CONTRATO`         | `numero_manual` + `numero_origem` | pontos removidos (`9.985` → `9985`).                                                                              |
| `CONTRATO`         | `numero`                        | prefixado: `ERP-<ESTAB>-<contrato>` (ex: `ERP-5-9985`). Chave de upsert.                                          |
| `DESCSAFRA`        | `safra`                         | string como veio (ex: `26-2026`).                                                                                  |
| `DTEMISSAO`        | `data_emissao`                  | `dd.mm.yyyy` → `yyyy-mm-dd`.                                                                                       |
| `DTVENCTO`         | `data_vencto_financeiro`        | idem.                                                                                                              |
| `DTINICIO`         | `data_inicio`                   | idem.                                                                                                              |
| `DTFINAL`          | `data_fim`                      | idem.                                                                                                              |
| `P_PRODUTOR`       | → `produtor_id`                 | extrai nome do formato `<codigo>-<nome>`. Resolve produtor por CPF/CNPJ (ver abaixo).                              |
| `P_DOCCPF`         | (lookup `produtores.cpf_cnpj`) | só dígitos. **Obrigatório.** Vazio → linha rejeitada.                                                              |
| `P_NOMEFAZENDA`    | `produtores.nome`               | usado se for criar/atualizar o produtor. Sobrescreve nome se já existir.                                           |
| `P_CIDADE_PRODUTOR`| `produtores.cidade`, `.uf`      | `"Arandu-SP"` → cidade=`Arandu`, uf=`SP`.                                                                          |
| `PRODUTO`          | → `produto_id`                  | extrai nome do `<codigo>-<nome>`. Lookup em `produtos.nome` (normalizado). Sem match → **linha rejeitada**.        |
| `QUANTIDADE`       | `qtd_kg_total`, `saldo_kg`      | número pt-BR → kg. `saldo_kg` é setado igual e o trigger recalcula depois com base nas cargas.                     |
| `VALORUNIT`        | `valor_unitario_saca`           | R$ por saca de 60 kg.                                                                                              |
| `VALORUNIT/60`     | `valor_unitario`                | derivado: R$/kg (calculado pelo importador).                                                                       |
| `VALORTOTAL`       | `valor_total`                   | número pt-BR → R$.                                                                                                 |
| `ORIGEM`           | `origem_descricao`              | string livre (ex: `"Taquarituba-SP, ELIANO ANTUNES"`). Não vincula a um Local cadastrado — texto puro.            |
| `NQTDSALDO`        | `qtd_kg_origem_erp`             | **informativo** — saldo do ERP de origem. NÃO afeta o `saldo_kg` do sistema (trigger é a fonte da verdade).        |
| `NVLRSALDO`        | `valor_saldo`                   | informativo — R$ restantes no ERP.                                                                                 |

**Defaults sempre setados:**
- `status` = `"ativo"`
- `disponivel` = `false` (precisa abrir manualmente em `/contratos/<id>` clicando "Disponibilizar para publicação")

**Upsert:** o importador usa `numero` como chave de conflito. Re-rodar com o mesmo CSV **atualiza** os contratos existentes em vez de duplicar.

### Tabela `produtores` (de-para por CPF/CNPJ)

| Cenário                                                | Ação                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| CPF/CNPJ não existe na tabela `produtores`             | **Cria** novo registro com nome, cidade, UF, tipo, ativo=true |
| CPF/CNPJ existe                                        | **Atualiza** nome + cidade + UF (sobrescreve se mudou)     |
| Vazio (`P_DOCCPF` em branco)                           | Linha **rejeitada** com motivo `P_DOCCPF vazio`            |

**Tipo do produtor:**
- `TIPO=COMPRA` → `produtores.tipo = "vendedor"` (Terra Roxa compra dele)
- `TIPO=VENDA` → `produtores.tipo = "comprador"`

### Tabela `produtos` (lookup obrigatório, NÃO cria)

| Cenário                              | Ação                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| Nome do produto existe em `produtos` | Vincula `contratos.produto_id`                                        |
| Não existe                           | Linha **rejeitada**. Mensagem: `PRODUTO "X" não cadastrado (cadastre antes de re-importar)` |

**→ Pra importar:** cadastre todos os produtos do CSV (SOJA, MILHO, etc.) em `/cadastros/produtos` antes.

---

## 🧮 O que é recalculado

Depois do `upsert` em `contratos`, o importador chama:

```sql
SELECT public.recalcular_saldo_contrato(contrato.id);
```

Esse RPC zera o `saldo_kg` para `qtd_kg_total − SUM(cargas.total_kg WHERE status != 'cancelada')`. Útil em re-importação: se você já publicou cargas a partir desse contrato, o saldo correto é preservado (não reseta pro total).

> ⚠️ A migration `20260523120000_saldo_reservado_triggers.sql` precisa estar aplicada pra a função `recalcular_saldo_contrato` existir.

---

## ❌ Linhas rejeitadas

Motivos possíveis:

| Motivo                                     | Como corrigir                                    |
| ------------------------------------------ | ------------------------------------------------ |
| `TIPO inválido`                            | TIPO deve ser exatamente `COMPRA` ou `VENDA`     |
| `PRODUTO "X" não cadastrado`               | Cadastrar em `/cadastros/produtos` e re-importar |
| `PRODUTO vazio` / `P_PRODUTOR vazio`       | Preencher no CSV                                 |
| `P_DOCCPF vazio`                           | Preencher CPF/CNPJ no CSV (obrigatório)          |
| `QUANTIDADE inválida`                      | Número pt-BR válido > 0                          |
| `Falha ao criar produtor` / `Insert contrato` | Erro no banco — checar log no Vercel/Supabase   |

Cada linha rejeitada vira uma entrada no CSV gerado em `erros/<timestamp>_<nome>.csv` com formato:

```
linha;contrato;motivo
2;10718;PRODUTO "SOJA EM CASCA" não cadastrado
5;10721;P_DOCCPF vazio (CPF/CNPJ obrigatório pra de-para)
```

---

## 🚀 Como rodar a importação

### Opção A — Pelo Supabase Dashboard (mais fácil)

1. Upload do CSV em **Storage → importacoes → contratos/pendentes/**
2. Abre **Edge Functions → import-contratos-csv**
3. Clica **Invoke** (sem payload necessário — a function varre `pendentes/`)
4. Vê o resultado no log da function

### Opção B — Pela CLI

```bash
# Faz upload do CSV (substitua o caminho)
supabase storage cp ./meus-contratos.csv \
  importacoes/contratos/pendentes/meus-contratos.csv

# Dispara a function
supabase functions invoke import-contratos-csv

# Resposta no formato:
# {
#   "arquivos_processados": [{
#     "arquivo": "meus-contratos.csv",
#     "total": 100,
#     "importadas": 98,
#     "rejeitadas": 2,
#     "produtores_criados": 12,
#     "produtores_atualizados": 5,
#     ...
#   }]
# }
```

### Opção C — Ver os logs depois

```sql
-- Últimas 10 importações
select arquivo, status, total_linhas, importadas, rejeitadas, produtores_criados,
       iniciada_em, concluida_em
from public.importacao_log
where tipo = 'contratos'
order by iniciada_em desc
limit 10;
```

---

## 🔍 Cheatsheet de testes pré-import

Antes de subir um CSV grande, valide com 2-3 linhas:

```sql
-- 1. Todos os produtos do CSV existem?
select distinct extract_part(produto_csv, '-', 2) from temp_csv
left join produtos on lower(produtos.nome) = lower(...)
where produtos.id is null;
-- (ajuste manual; ideia: ver quais produtos faltam cadastrar)

-- 2. Contratos que vão dar upsert (atualizar):
select c.numero, c.qtd_kg_total, c.saldo_kg
from contratos c
where c.numero = 'ERP-5-10718';

-- 3. Após importação, conferir 1 contrato:
select numero, qtd_kg_total, saldo_kg, qtd_kg_origem_erp, status, disponivel,
       produtor_id, produto_id, criado_em
from contratos
where numero_manual = '10718';
```

---

## 💡 Boas práticas

- **Sempre 1 lote pequeno primeiro** (5-10 linhas) pra ver se o de-para de produto está OK.
- Os contratos importados nascem com `disponivel = false`. Pra publicar carga a partir deles, abra o contrato em `/contratos/<id>` e clique **"Disponibilizar para publicação"**.
- Re-importar o mesmo arquivo é seguro: `numero` é chave única e o upsert atualiza em vez de duplicar. O trigger preserva o saldo correto se já há cargas publicadas.
- **NQTDSALDO** do ERP é apenas informativo. Não confie nele depois da primeira importação — o sistema mantém seu próprio saldo via trigger.

---

## 📚 Arquivos relacionados

- Edge Function: `supabase/functions/import-contratos-csv/index.ts`
- Parser CSV: `supabase/functions/import-contratos-csv/parser.ts`
- Tipo `Contrato`: `lib/types.ts` (linhas 263+)
- Migration do trigger de saldo: `supabase/migrations/20260523120000_saldo_reservado_triggers.sql`
- Script de fix saldo zumbi: `supabase/scripts/fix-saldo-contratos-zumbi.sql`
