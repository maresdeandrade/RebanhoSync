# Contratos de Sincronizacao e API

> **Status:** Normativo
> **Fonte de Verdade:** Edge Function `sync-batch`
> **Ultima Atualizacao:** 2026-04-07

Este documento resume o contrato do `sync-batch` e destaca o impacto da taxonomia canonica no fluxo de escrita.

---

## 1. Endpoint

`POST /functions/v1/sync-batch`

Payload:

```json
{
  "client_id": "uuid",
  "fazenda_id": "uuid",
  "client_tx_id": "uuid",
  "ops": [
    {
      "client_op_id": "uuid",
      "table": "nome_tabela",
      "action": "INSERT",
      "record": {}
    }
  ]
}
```

Resposta:

```json
{
  "server_tx_id": "srv-...",
  "client_tx_id": "uuid",
  "results": [
    {
      "op_id": "uuid",
      "status": "APPLIED"
    }
  ]
}
```

---

## 2. Status

- `APPLIED`
- `APPLIED_ALTERED`
- `REJECTED`

## 2. Status

- `APPLIED` — sucesso (ou idempotencia: `client_op_id` ja existia)
- `APPLIED_ALTERED` — sucesso com modificacao (ex: `dedup_key` colidiu)
- `REJECTED` — erro de negocio

Em `REJECTED`, o cliente executa rollback local usando `before_snapshot` na ordem reversa das ops.

---

## 2.1 Tabelas Bloqueadas

As seguintes tabelas sao rejeitadas sem processamento:

- `user_fazendas`
- `user_profiles`
- `user_settings`

Mutacoes nestas tabelas devem ocorrer apenas via RPCs `SECURITY DEFINER`.

---

## 2.2 Retry e Recuperacao

- Worker tenta ate 3 vezes em caso de falha de rede
- Gestos com erro de JWT sao recuperados no proximo startup
- `queue_rejections` recebe erros de negocio com TTL 7 dias (auto-purge a cada 6h)

---

## 2.3 Post-Sync Pull

Apos sincronizacao de `animais`, `eventos` e `agenda_itens`, o worker executa pull seletivo para refletir triggers server-side (ex: agenda automatica sanitaria, recompute).

---

## 3. Taxonomia Canonica no Sync

A taxonomia canonica nao cria endpoint novo e nao altera o envelope de batch.

Impacto real:

- novos fatos seguem como `UPDATE` normal em `animais.payload`
- nao existe tabela separada para categorias derivadas
- labels canonicos e aliases continuam sendo projecoes locais ou SQL views de leitura

### Contrato de `payload.taxonomy_facts`

O subcontrato taxonomico segue o mesmo rigor dos outros payloads versionados:

- `schema_version` obrigatorio
- versao atual: `1`
- fonte unica do schema: `src/lib/animals/taxonomyFactsContract.ts`
- shape invalido deve ser rejeitado localmente e no servidor

Campos canonicos v1:

- `schema_version`
- `castrado`
- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`
- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`

### Ownership de escrita

UI manual:

- `castrado`
- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Writer `reproduction_event`:

- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`
- tambem pode ajustar `puberdade_confirmada`, `secagem_realizada`, `data_secagem`, `em_lactacao`

Regra de conflito:

- campos event-driven nao aceitam override manual
- o cliente valida antes de enfileirar em `src/lib/offline/ops.ts`
- o servidor valida novamente em `supabase/functions/sync-batch/taxonomy.ts`

Exemplos de fatos sincronizados:

- `payload.taxonomy_facts.prenhez_confirmada`
- `payload.taxonomy_facts.data_prevista_parto`
- `payload.taxonomy_facts.data_ultimo_parto`
- `payload.taxonomy_facts.em_lactacao`
- `payload.taxonomy_facts.secagem_realizada`
- `payload.taxonomy_facts.castrado`

---

## 4. Regras de Rejeicao Relevantes

- `PERMISSION_DENIED`
- `ANTI_TELEPORTE`
- `VALIDATION_ERROR`
- `INVALID_EPISODE_REFERENCE`
- `TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED`
- `INVALID_TAXONOMY_FACTS_PAYLOAD`

Rejeicoes taxonomicas:

- `TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED`: `taxonomy_facts.schema_version` ausente ou diferente de `1`
- `INVALID_TAXONOMY_FACTS_PAYLOAD`: campo desconhecido, tipo invalido ou data fora do formato esperado

---

## Veja Tambem

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DB.md](./DB.md)
- [OFFLINE.md](./OFFLINE.md)
- [ADRs/ADR-0001-taxonomia-canonica-bovina.md](./ADRs/ADR-0001-taxonomia-canonica-bovina.md)
