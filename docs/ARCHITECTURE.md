# Arquitetura do RebanhoSync

> **Status:** Normativo
> **Fonte de Verdade:** Codigo fonte e migrations
> **Ultima Atualizacao:** 2026-04-06

Este documento consolida os principios arquiteturais do RebanhoSync: Two Rails, Offline-First, isolamento por fazenda e a derivacao canonica da taxonomia bovina.

---

## 1. Visao Geral

O RebanhoSync opera com persistencia local em Dexie/IndexedDB e sincronizacao transacional com Supabase/Postgres via `sync-batch`.

Objetivos estruturais:

- manter operacao offline-first
- separar fatos passados de intencoes futuras
- isolar tudo por `fazenda_id`
- derivar classificacoes a partir de fatos, nao de labels persistidos

---

## 2. Two Rails

### Rail 1: Agenda

- tabela: `agenda_itens`
- semantica: intencao futura mutavel
- exemplos: revisao neonatal, pesagem futura, protocolos sanitarios

### Rail 2: Eventos

- tabela cabecalho: `eventos`
- tabelas satelite: `eventos_*`
- semantica: fato passado append-only
- correcoes: por contra-lancamento, nunca por update de negocio

Nao existe FK dura entre agenda e eventos. O vinculo e logico por `source_task_id` e `source_evento_id`.

---

## 3. Taxonomia Canonica

O projeto adota tres eixos independentes:

- `categoria_zootecnica`
- `fase_veterinaria`
- `estado_produtivo_reprodutivo`

### Fonte de verdade

A fonte operacional de verdade da derivacao fica em [`src/lib/animals/taxonomy.ts`](../src/lib/animals/taxonomy.ts).

Principios:

- persistir apenas fatos minimos
- calcular labels e categorias em projection/selectors
- manter alias regionais apenas na apresentacao

### Fatos persistidos

Os fatos taxonomicos minimos ficam em `animais.payload.taxonomy_facts`.

Contrato:

- `schema_version = 1` obrigatorio
- schema TS central: `src/lib/animals/taxonomyFactsContract.ts`
- validacao local antes de enfileirar gesto em `src/lib/offline/ops.ts`
- validacao autoritativa no `sync-batch`

Campos do contrato v1:

- `castrado`
- `puberdade_confirmada`
- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`
- `em_lactacao`
- `secagem_realizada`
- `data_secagem`

Fatos complementares ja existentes e reutilizados:

- `sexo`
- `data_nascimento`
- `payload.weaning.completed_at`
- `payload.metrics.last_weight_kg`
- `payload.lifecycle.destino_produtivo`
- `payload.male_profile.status_reprodutivo`
- historico reprodutivo de `eventos_reproducao`

### Projecao composta

O modelo adota:

- multiplos fatos persistidos
- um label principal derivado por eixo

Exemplo:

- uma vaca pode estar simultaneamente com fatos de prenhez e secagem
- o label principal de `estado_produtivo_reprodutivo` segue uma precedencia centralizada

Precedencia feminina atual:

- `recem_parida`
- `seca`
- `pre_parto_imediato`
- `prenhe`
- `lactacao`
- `vazia`

### Ownership dos fatos

Manual:

- `castrado`
- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Derivado de evento reprodutivo:

- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`

Campos com escrita hibrida:

- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Precedencia de writer:

- fatos do writer `reproduction_event` vencem para o eixo reprodutivo
- UI manual nao pode sobrescrever `prenhez_confirmada`, `data_prevista_parto` nem `data_ultimo_parto`
- correcao de fatos event-driven deve acontecer por novo evento, nunca por edicao arbitraria

---

## 4. Fluxo Offline-First

1. UI cria um gesto com `client_tx_id`
2. o cliente grava `queue_gestures` e `queue_ops`
3. aplica optimistic update em `state_*`
4. o worker envia o lote para `sync-batch`
5. o servidor valida tenant, regras e constraints
6. em rejeicao, o cliente executa rollback local por `before_snapshot`

---

## 5. Multi-tenancy

Tudo e isolado por `fazenda_id`.

- tabelas de negocio carregam `fazenda_id`
- membership fica em `user_fazendas`
- RLS e `sync-batch` reforcam isolamento

---

## 6. Modulos de Dominio

- sanitario
- reproducao
- financeiro
- lifecycle
- taxonomia animal

Taxonomia nao substitui eventos nem agenda. Ela apenas projeta leitura canonica sobre fatos operacionais.

---

## 7. SQL de Apoio

A migration `0038_animais_taxonomia_canonica.sql` cria:

- enums canonicos de taxonomia
- a view `vw_animais_taxonomia`

Essa view e voltada a leitura SQL e relatorios. Ela nao substitui a derivacao principal do cliente.

A conformidade entre derivacao TS e view SQL e coberta por fixture de paridade em `src/lib/animals/__tests__/taxonomySqlParity.test.ts`.

---

## Veja Tambem

- [DB.md](./DB.md)
- [OFFLINE.md](./OFFLINE.md)
- [CONTRACTS.md](./CONTRACTS.md)
- [RLS.md](./RLS.md)
