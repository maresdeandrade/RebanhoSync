# Database Schema - RebanhoSync

> **Status:** Normativo
> **Fonte de Verdade:** Migrations PostgreSQL
> **Ultima Atualizacao:** 2026-04-09

Este documento descreve o schema logico do banco e destaca os pontos relevantes para offline-first, multi-tenant e taxonomia bovina canonica.

---

## 1. Tenant e Seguranca

O banco e multi-tenant por `fazenda_id`.

- toda tabela operacional possui `fazenda_id`
- o acesso e isolado por RLS
- FKs compostas com `fazenda_id` sao obrigatorias quando aplicavel

---

## 2. Tabelas Operacionais

### `animais`

Estado atual do animal.

Campos centrais:

- `identificacao`
- `sexo`
- `status`
- `lote_id`
- `data_nascimento`
- `data_entrada`
- `data_saida`
- `pai_id`
- `mae_id`
- `origem`
- `raca`
- `papel_macho`
- `habilitado_monta`
- `payload`

### `agenda_itens`

Rail mutavel para intencoes futuras.

### `eventos`

Cabecalho append-only de fatos passados.

Tabelas satelites:

- `eventos_sanitario`
- `eventos_pesagem`
- `eventos_nutricao`
- `eventos_movimentacao`
- `eventos_reproducao`
- `eventos_financeiro`

### `produtos_veterinarios`

Tabela global (sem `fazenda_id`) com catálogo de produtos veterinários.

- Criada em `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql`
- Campos: `id`, `nome`, `categoria`, `created_at`, `updated_at`
- RLS habilitado: SELECT pública para `authenticated`; sem política de WRITE (seed-only)
- Não é tenant-scoped — decisão intencional (catálogo compartilhado)
- Não sincronizada via `sync-batch` (somente leitura direta via Supabase)
- Seed expandido em `supabase/migrations/20260408133000_expand_produtos_veterinarios_seed.sql`
- Referências estruturadas podem ser copiadas para `protocolos_sanitarios_itens.payload` e `eventos_sanitario.payload` usando:
  - `produto_veterinario_id`
  - `produto_nome_catalogo`
  - `produto_categoria`
  - `produto_origem`

### `catalogo_protocolos_oficiais`

Tabela global e versionada com templates regulatorios oficiais.

- Criada em `supabase/migrations/20260409183000_official_sanitary_catalog_foundation.sql`
- Campos centrais: `slug`, `nome`, `versao`, `escopo`, `uf`, `aptidao`, `sistema`, `status_legal`
- Fonte de verdade do pack oficial: nucleo federal + overlays estaduais
- Nao entra no `sync-batch`; e cacheada localmente no Dexie

### `catalogo_protocolos_oficiais_itens`

Itens detalhados do catalogo oficial.

- Campos centrais: `template_id`, `area`, `codigo`, `gatilho_tipo`, `gatilho_json`, `frequencia_json`
- Pode representar obrigacao legal, recomendacao tecnica ou boa pratica
- Nem todo item e materializado no modelo atual de `protocolos_sanitarios_itens`; parte fica como contexto/checklist regulatorio

### `catalogo_doencas_notificaveis`

Tabela global com a base de suspeitas/doencas de notificacao obrigatoria.

- Campos centrais: `codigo`, `nome`, `tipo_notificacao`, `sinais_alerta_json`, `acao_imediata_json`
- Alimenta o futuro fluxo de suspeita/notificacao imediata

### `fazenda_sanidade_config`

Configuracao tenant-scoped da fazenda para ativacao do pack oficial.

- Chave primaria: `fazenda_id`
- Campos centrais: `uf`, `aptidao`, `sistema`, `zona_raiva_risco`, `pressao_carrapato`, `pressao_helmintos`, `modo_calendario`
- Participa do `sync-batch` e do pull offline
- Serve de overlay local para selecionar obrigacoes minimas, recomendacoes tecnicas e boas praticas

---

## 3. Taxonomia Canonica

O schema fisico de `animais` nao ganhou colunas novas para labels derivados.

### Fatos persistidos

Fatos taxonomicos minimos ficam em `animais.payload.taxonomy_facts`.

Contrato v1:

- `schema_version = 1` obrigatorio
- `castrado`
- `puberdade_confirmada`
- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`
- `em_lactacao`
- `secagem_realizada`
- `data_secagem`

Observacoes:

- o shape e validado pelo schema central `src/lib/animals/taxonomyFactsContract.ts`
- a persistencia continua em `payload` para evitar migração fisica destrutiva
- facts invalidos devem ser rejeitados antes de sync e novamente no servidor

Esses fatos coexistem com dados ja existentes em:

- `data_nascimento`
- `payload.weaning.completed_at`
- `payload.metrics.last_weight_kg`
- `payload.lifecycle.*`
- `payload.male_profile.*`

### Enums canonicos

A migration `0038_animais_taxonomia_canonica.sql` cria:

- `categoria_zootecnica_canonica_enum`
- `fase_veterinaria_enum`
- `estado_produtivo_reprodutivo_enum`

### View derivada

`vw_animais_taxonomia` projeta:

- `categoria_zootecnica`
- `fase_veterinaria`
- `estado_produtivo_reprodutivo`
- `taxonomy_facts_schema_version`

alem dos fatos auxiliares usados para leitura e auditoria.

Observacao importante:

- a view e uma projecao SQL de leitura
- a fonte operacional da regra continua no cliente em `src/lib/animals/taxonomy.ts`
- a paridade TS vs SQL e testada por fixture em `src/lib/animals/__tests__/taxonomySqlParity.test.ts`

### View de GMD

`vw_animal_gmd` (migration `20260308230811_indexes_performance_gmd.sql`) projeta:

- `animal_id`, `fazenda_id`
- `peso_atual`, `data_atual`
- `peso_anterior`, `data_anterior`
- `gmd_kg_dia` (Ganho Médio Diário calculado server-side)

Substitui cálculo in-memory que dependia de carregar histórico completo no cliente.

---

## 4. Sync Envelope

As tabelas de negocio mantem:

- `client_id`
- `client_tx_id`
- `client_op_id`
- `client_recorded_at`
- `server_received_at`
- `deleted_at`

---

## Veja Tambem

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [OFFLINE.md](./OFFLINE.md)
- [CONTRACTS.md](./CONTRACTS.md)
