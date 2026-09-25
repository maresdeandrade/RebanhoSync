# Sanitário v2 — C0.2A.1 Canonical Identity Contract

Atualizado em: 2026-09-23
Baseline: `main@dcece696deb1f7aa81cf5a0941aec9257239c317`
Branch: `feat/sanitario-v2-content-curation-c0`
Status: `READY_FOR_REVIEW`

## Decisão

```text
C0.2A1_STATUS = READY_FOR_REVIEW
CANONICAL_IDENTITY_MODEL = VERSIONED_EXPLICIT_UUID
SOURCE_KEY_SCHEMA_DECISION = ADD_COLUMN
```

O UUID das entidades canônicas globais pertence ao artefato versionado em source control. Ele
é alocado uma única vez fora do importer, gravado explicitamente no artefato e nunca é
recalculado durante seed, import, retry ou bootstrap. O publisher deve preservar a associação
imutável entre natural key e UUID e rejeitar qualquer divergência.

Esta fase define contrato e desenho. Não gera UUIDs, não cria migration e não materializa
fontes, classes, coverage ou members.

## Escopo persistido confirmado

| entidade | escopos representáveis | semântica de `fazenda_id` | natural key atual | acesso atual |
|---|---|---|---|---|
| `sanitario_fontes_tecnicas_v2` | `global` e `fazenda` | `NULL` para global; obrigatório para `fazenda`; `mv_responsavel` exige `fazenda` | ausente no schema; `source_key` existe apenas no contrato canônico | RLS permite leitura global ou da fazenda; migration original contém policy de escrita tenant para owner/manager, mas a reconciliação ACL F24 concede somente `SELECT` a `authenticated` |
| `sanitario_product_classes_v2` | `global` e `tenant` | `NULL` para global; obrigatório para `tenant` | `class_key`; unicidade ativa global e `(fazenda_id, class_key)` tenant | RLS permite leitura global ou da fazenda e policies tenant de insert/update; ACL F24 vigente concede somente `SELECT` a `authenticated` |

A identidade canônica de C0.2B cobre somente entidades `global`, sempre com
`fazenda_id = NULL`. Entidades `fazenda`/`tenant` continuam representáveis, mas não pertencem
ao artefato global desta fase e não podem reutilizar materialização global como autorização
de escrita tenant.

O inventário de classes permanece inalterado: `VALID_CLASS=7`, `TOO_BROAD=1` e
`NOT_A_CLASS=1`. `vacina_ibr_bvd` e `associacoes_antiparasitarias` não são materializáveis
nesta etapa.

## Contrato de identidade canônica

### Natural key

- fonte global: `source_key`, persistida em coluna própria;
- classe global: `class_key`, já persistida;
- a key é identificador técnico, não label, título, URL, emissor, produto ou indicação;
- forma canônica de fonte: ASCII, case-sensitive, `^SRC_[A-Z0-9_]+$`;
- forma canônica de classe nesta trilha: ASCII, case-sensitive, `^[a-z0-9_]+$`;
- authoring remove whitespace externo; importer e banco não fazem conversão silenciosa de
  caixa, acentos ou separadores: forma não canônica é rejeitada.

### UUID ownership e allocation

- o artefato canônico versionado é proprietário do par `natural key ↔ UUID`;
- o UUID deve ser padrão, explícito e alocado uma única vez durante curadoria controlada;
- UUID v4 é aceitável apenas nessa alocação única anterior ao commit do artefato;
- `crypto.randomUUID()` no importer e `gen_random_uuid()` por ambiente são proibidos para
  materialização canônica global;
- o default `gen_random_uuid()` existente pode permanecer para contratos não canônicos, mas
  o publisher global sempre envia o ID explícito.

### Conflitos e idempotência

O publisher deve consultar também tombstones e aplicar a matriz:

| estado persistido | ação |
|---|---|
| nenhuma linha com key ou UUID | criar com o par explícito |
| mesma key e mesmo UUID | `skip` ou update curatorial permitido |
| mesma key e UUID diferente | rejeitar `IDENTITY_CONFLICT` |
| mesmo UUID e key diferente | rejeitar `IDENTITY_CONFLICT` |
| mesma key/UUID tombstonada | não criar outra linha; exigir decisão explícita de restauração |

PK, unique natural key e validator são camadas complementares. Violação não deve virar
sucesso genérico nem provocar troca automática de ID.

### Rename, tombstone e recreation

- rename de `title`/`name` ou outro label preserva key e UUID;
- rename de natural key é proibido in-place;
- correção que realmente exija nova natural key fica bloqueada até decisão explícita de
  supersessão; quando representar nova entidade, recebe novo UUID e a antiga é tombstonada;
- tombstone preserva permanentemente o par key/UUID para auditoria;
- recriação da mesma entidade reutiliza o mesmo par e exige restauração explícita;
- nova entidade semanticamente distinta deve usar nova key, nunca reciclar key tombstonada.

### Bootstrap e reexecução

Banco vazio recebe exatamente os IDs do artefato. Reexecução valida primeiro o par persistido
e produz `skip` ou update permitido. Ambientes dev, staging e prod convergem porque nenhum
ambiente aloca identidade durante a publicação.

## Comparação de estratégias

| critério | UUID determinístico | UUID explícito versionado |
|---|---|---|
| simplicidade | exige algoritmo, namespace, normalização e implementações equivalentes | usa UUID já aceito pelo contrato e persistido no artefato |
| auditabilidade | key explica a derivação, mas mudanças de algoritmo/namespace ampliam o contrato | diff registra diretamente criação e associação key/UUID |
| cross-environment | convergente se todas as implementações forem idênticas | convergente porque todos publicam o mesmo artefato |
| coupling TS/SQL | alto; exige paridade e vetores fixos | baixo; validator e publisher apenas verificam o par |
| risco de drift | algoritmo, encoding, namespace e normalização podem divergir | risco humano de alocação, contido por review, unicidade e `IDENTITY_CONFLICT` |
| compatibilidade | precedente financeiro é tenant-scoped e usa SHA-256 customizado | corresponde ao contrato Sanitário vigente de UUID explícito |
| tombstone/rename | derivação pode trocar ID quando key muda; ainda requer política própria | política explícita preserva o par e bloqueia reciclagem |

Decisão: `VERSIONED_EXPLICIT_UUID`. O precedente financeiro continua válido para categorias
tenant-scoped, mas não deve criar acoplamento TS/Postgres adicional no catálogo Sanitário
global. `importV2`, customization, catálogo oficial e seeds por natural key não oferecem a
mesma garantia cross-environment exigida aqui.

## Gap de `source_key`

### Estado atual

`CanonicalData.source_rows` exige `source_key`, mas
`sanitario_fontes_tecnicas_v2` não a persiste e não possui natural key equivalente. Título,
URL e `metadata` são inadequados: são mutáveis, opcionais ou não constituem contrato de
identidade.

### Decisão

Adicionar `source_key text` por migration forward-only. O desenho é:

1. adicionar coluna nullable, sem default e sem derivar valor de título, URL ou metadata;
2. adicionar check de forma canônica para valores não nulos;
3. auditar todas as linhas, incluindo `deleted_at is not null`, por colisão de key e UUID;
4. backfill somente por mapping explícito aprovado e versionado; linha sem prova permanece
   bloqueio, nunca recebe key inferida;
5. criar unicidade global por `source_key` quando `scope='global'`, `fazenda_id IS NULL` e
   `source_key IS NOT NULL`, incluindo tombstones;
6. criar unicidade tenant por `(fazenda_id, source_key)` quando `scope='fazenda'` e
   `source_key IS NOT NULL`, também incluindo tombstones;
7. depois do backfill global e da atualização do publisher, validar constraint condicional
   equivalente a `scope <> 'global' OR source_key IS NOT NULL`;
8. manter `source_key` fisicamente nullable para compatibilidade de fontes tenant legadas;
   a identidade canônica desta fase exige não nulo apenas para globais.

Os índices atuais de `class_key` excluem tombstones. Para cumprir a mesma imutabilidade em
classes globais, a implementação deve auditar duplicatas históricas e substituir a unicidade
ativa por proteção que inclua tombstones, ou demonstrar proteção equivalente no banco. O
publisher, em qualquer caso, deve consultar linhas ativas e tombstonadas.

### Rollout e compensação

Ordem forward-only proposta:

1. migration aditiva: coluna nullable + check para valor presente;
2. cliente/types compatíveis e publisher capaz de ler/escrever `source_key` explícita;
3. auditoria e backfill por mapping aprovado dentro de transação;
4. índices permanentes de identidade após preflight de duplicatas;
5. constraint global de presença criada `NOT VALID`, seguida de validação;
6. habilitação da materialização somente depois dos testes de bootstrap e reexecução.

Não há rollback destrutivo. Se backfill, índice ou validação falhar, a transação falha e a
coluna nullable permanece compatível; uma migration corretiva posterior ajusta mapping ou
constraints. Não remover coluna nem apagar linhas como compensação.

## Impact analysis

### PostgreSQL

- mudança futura é aditiva para fontes e restritiva somente após backfill comprovado;
- `fazenda_id`, scope checks, FKs e coverage `(source_id, field_key)` permanecem;
- fontes/classes globais continuam read-only para clientes autenticados após ACL F24;
- defaults aleatórios não serão usados pelo publisher canônico;
- preflight deve incluir ativos e tombstones antes de qualquer unique permanente.

### RLS e grants

- adicionar coluna/check/index não altera visibilidade de linha;
- policies existentes continuam separando global de tenant/fazenda;
- a ACL vigente concede somente `SELECT` dessas tabelas a `authenticated`; não reabrir
  escrita direta para viabilizar materialização;
- publicação canônica precisa continuar em caminho administrativo controlado, sem expor
  `service_role` ao cliente.

### Publisher

- o importer atual publica somente grupos, protocolos e itens e permanece incompleto;
- implementação futura deve adicionar fontes/classes apenas quando autorizada pela fase;
- lookup por key deve incluir tombstones e também pesquisar por UUID;
- criação exige ID e key explícitos; conflito em qualquer direção aborta antes de escrever;
- não usar `ON CONFLICT` para substituir identidade nem alocar UUID em runtime.

### Validator

- já exige UUID explícito, keys referenciáveis e unicidade dentro do artefato;
- deve validar a forma canônica da própria `source_key` e da `class_key`, não apenas
  `source_ref`;
- deve manter detecção de UUID/key duplicados e testes de `IDENTITY_CONFLICT`;
- validação do artefato não substitui verificação contra o banco feita pelo publisher.

### Dexie

- `pull.ts` usa `select('*')` e `bulkPut`, portanto coluna remota aditiva é preservada e
  clientes antigos podem ignorá-la;
- `SanitarioFonteTecnicaLocalV2` precisará expor `source_key` quando o cliente passar a
  consumi-la;
- não é necessário bump do schema Dexie enquanto `source_key` não for índice/local lookup;
- se lookup local por key for introduzido, uma nova versão Dexie e testes de upgrade serão
  obrigatórios; não alterar o índice da v24 existente.

### Sync

- catálogos técnicos e ProductClass são pull-only; não há `queue_ops` ou push dessas tabelas;
- coluna aditiva não muda envelope, ownership, retry, rollback ou sync-batch;
- nenhum pending operation antigo precisa ser reescrito;
- `sync-batch` apenas lê fontes por ID no fluxo factual e não precisa usar `source_key`.

### Clientes antigos

- seguem lendo linhas por `id`; campo adicional de `select('*')` é compatível;
- não recebem autorização nova e não precisam materializar a key localmente;
- escrita autenticada direta já está bloqueada pelos grants F24;
- enforcement global só deve ser validado após publisher atualizado e backfill completo.

## Arquivos/áreas previstos para C0.2A.2

- nova migration forward-only em `supabase/migrations/` para `source_key`, checks, backfill
  controlado e índices de identidade;
- `scripts/codex/sanitario-v2-contract.mjs`;
- `tests/codex/sanitario-v2-contract.test.mjs`;
- `scripts/codex/import-sanitario-protocols-v2.mjs`;
- `src/lib/offline/types.ts`;
- testes focados em `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Store.test.ts` e
  `src/lib/offline/__tests__/sanitarioTechnicalCatalogV2Pull.test.ts`;
- `src/lib/offline/db.ts` somente se `source_key` virar índice local; não é necessário para
  simples armazenamento da coluna;
- `src/lib/offline/pull.ts`, `src/lib/offline/tableMap.ts` e
  `supabase/functions/sync-batch/index.ts` não exigem mudança pelo contrato atual; devem ser
  reavaliados apenas se o rollout ampliar lookup ou escrita.

## Guardrails

- nenhuma entidade foi materializada e nenhum UUID foi gerado;
- nenhuma migration, policy, grant, schema, publisher, validator, Dexie ou sync foi alterado;
- `PUBLISHER_COMPLETE=false`, `SYNC_CONTRACT_RECERTIFICATION=NOT_CLOSED` e
  `OPERATIONAL_RELEASE=NOT_AUTHORIZED` permanecem;
- classe, fonte e coverage continuam catálogo/configuração, nunca Evento ou prova de
  execução, dose, carência ou aptidão operacional.
