# Importação de Contratos via CSV

Sistema de importação batch de contratos vindos do ERP de origem.

## Fluxo

```
ERP de origem
    │
    │ exporta CSV no padrão definido
    ↓
Supabase Storage
  bucket: importacoes
    └── contratos/
         ├── pendentes/       ← arquivos aguardando importação
         ├── processados/<ts> ← arquivos já importados
         └── erros/<ts>.csv   ← relatório de linhas rejeitadas
    │
    │ Edge Function `import-contratos-csv` é disparada
    │ (manual ou via cron a definir)
    ↓
Supabase Postgres
  tabela: contratos
```

## Formato esperado do CSV

**Encoding**: Latin-1 (CP1252) — o parser converte automaticamente pra UTF-8.
**Separador**: `;` (ponto-e-vírgula).
**Decimal**: vírgula. **Separador de milhar**: ponto. (Padrão pt-BR.)
**Datas**: `dd.mm.yyyy`.

### Cabeçalho obrigatório (ordem pode variar)

| Coluna | Conteúdo | Exemplo |
|---|---|---|
| `ESTAB` | Código do estabelecimento (informativo) | `5` ou `6` |
| `TIPO` | `COMPRA` ou `VENDA` | `COMPRA` |
| `CONTRATO` | Número do contrato no ERP | `10.244` |
| `DESCSAFRA` | Safra | `26-2026` |
| `DTEMISSAO` | Data de emissão | `03.03.2026` |
| `DTVENCTO` | Data vencimento financeiro | `20.03.2026` |
| `DTINICIO` | Data inicial do contrato | `04.03.2026` |
| `DTFINAL` | Data final do contrato | `30.04.2026` |
| `PRODUTOR` | Código + nome do produtor | `5138, ANDREA VICENTINI` |
| `PRODUTO` | Código + nome do produto | `3, SOJA A GRANEL` |
| `QUANTIDADE` | Quantidade em **kg** | `180.000` |
| `VALORUNIT` | R$ por saca de 60kg | `118` |
| `VALORTOTAL` | Valor total em R$ | `353.299` |
| `ORIGEM` | Cidade-UF + razão (opcional, livre) | `Pedrinhas Paulista-SP, ANDREA VICENTINI` |
| `NQTDSALDO` | Saldo restante em kg | `24.000` |
| `NVLRSALDO` | Saldo financeiro em R$ | (vazio ou número) |

## Regras de de-para

### TIPO
| CSV | Sistema |
|---|---|
| `COMPRA` | `compra` |
| `VENDA` | `venda` |

Linha com TIPO diferente → **rejeitada**.

### PRODUTO
Pega o nome após a vírgula (`3, SOJA A GRANEL` → `SOJA A GRANEL`), normaliza (uppercase + remove acentos), e procura match exato em `produtos.nome`.

**Se não encontra → linha rejeitada** com motivo:
> `PRODUTO "SOJA A GRANEL" não cadastrado no sistema (cadastre antes de re-importar)`

⚠️ Cadastre os produtos antes da primeira importação. Não criamos automaticamente pra evitar duplicação.

### PRODUTOR
Pega o nome após a vírgula e procura em `produtores.nome`.

**Se não encontra → cria automaticamente** com:
- `nome`: do CSV
- `razao_social`: do campo ORIGEM se preenchido, senão usa o nome
- `cpf_cnpj`: `ERP-<código_csv>` (pra rastrear depois)
- `cidade` / `uf`: do campo ORIGEM se tem formato `Cidade-UF`
- `tipo`: `vendedor` (padrão)
- `ativo`: `true`

Produtores criados auto aparecem com `cpf_cnpj` começando com `ERP-` — vale revisar e completar os dados depois.

### ORIGEM
**Não** vincula a `locais`. Apenas grava como texto livre em `contratos.origem_descricao`. O vínculo manual com um Local de origem pode ser feito depois pela UI.

## Idempotência

O `numero` do contrato é gerado como `ERP-<ESTAB>-<CONTRATO>` (ex: `ERP-5-10.244`).
Re-importar o mesmo arquivo (ou um CSV com contratos repetidos) faz **upsert**: atualiza o contrato existente em vez de duplicar.

## Como subir um CSV (manual)

Pelo **Supabase Studio**:
1. Storage → bucket `importacoes` → pasta `contratos/pendentes/`
2. Upload do arquivo CSV (ex: `contratos_2026-05-23.csv`)

Pelo **CLI** (script automatizado do ERP):
```bash
curl -X POST 'https://<projeto>.supabase.co/storage/v1/object/importacoes/contratos/pendentes/contratos_2026-05-23.csv' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: text/csv" \
  --data-binary @contratos_2026-05-23.csv
```

## Como disparar a importação (manual)

Por **HTTP** (admin/comercial autenticado):
```bash
curl -X POST 'https://<projeto>.supabase.co/functions/v1/import-contratos-csv' \
  -H "Authorization: Bearer <user-jwt>"
```

Por **Supabase Studio**:
- Edge Functions → `import-contratos-csv` → Invoke

Retorno:
```json
{
  "ok": true,
  "processados": 1,
  "relatorios": [
    {
      "arquivo": "contratos_2026-05-23.csv",
      "total": 118,
      "importadas": 115,
      "rejeitadas": 3,
      "produtores_criados": 12,
      "linhas": [ ... ]
    }
  ]
}
```

## Onde ver o histórico

Tabela `importacao_log` (consulte pelo Supabase Studio → Table Editor):

| Coluna | Descrição |
|---|---|
| `arquivo` | nome do CSV |
| `iniciada_em` / `concluida_em` | timestamps |
| `total_linhas` | linhas no CSV |
| `importadas` / `rejeitadas` | contagens |
| `produtores_criados` | quantos produtores foram criados auto |
| `arquivo_erros` | caminho do CSV de erros (se houver) |
| `status` | `sucesso` / `sucesso_parcial` / `erro` |

## Onde baixar o CSV de erros

Bucket `importacoes/contratos/erros/<timestamp>_<nome>.csv`.
Formato: `linha;contrato;motivo`.

Exemplo:
```csv
linha;contrato;motivo
17;10.564;PRODUTO "TRIGO A GRANEL ESPECIAL" não cadastrado no sistema (cadastre antes de re-importar)
99;9.985;TIPO inválido: "ARRENDAMENTO" (esperado COMPRA ou VENDA)
```

## Próximos passos (Fase 2 e 3 do plano)

- [ ] Cron pg_cron pra invocar a função a cada N minutos
- [ ] Tela `/configuracoes/importacoes` com status visual
- [ ] Botão "Importar agora" pela UI
- [ ] Botão "Vincular local de origem manualmente" no detalhe do contrato
