# Sanitario/Protocolos - Fase 1B

## Resumo executivo

A Fase 1B introduz versionamento imutavel para etapas de protocolos sanitarios. A identidade operacional estavel passa a ser `logical_item_key`; o `id` de `protocolos_sanitarios_itens` representa a versao fisica usada por agenda e evento.

Alteracoes semanticas em etapa customizada deixam de atualizar a versao ativa in-place: o cliente emite tres operacoes offline (`UPDATE` antiga inativa, `INSERT` nova versao, `UPDATE` antiga com `superseded_by_id`). Alteracoes simples de descricao/observacao/label seguem como update comum.

## Decisao arquitetural

- Etapa logica: `logical_item_key`.
- Versao fisica: `protocolos_sanitarios_itens.id`.
- Agenda sanitaria: referencia a versao fisica por `protocol_item_version_id`.
- Evento sanitario: persiste a versao fisica e um snapshot da regra aplicada.
- Protocolos antigos sem `logical_item_key` nao sao adaptados em fluxo de edicao; a revisao imutavel falha explicitamente.

## Schema final adotado

Migration criada: `supabase/migrations/20260531000000_protocolos_sanitarios_itens_immutable_versions.sql`.

Campos adicionados em `protocolos_sanitarios_itens`:
- `logical_item_key uuid not null`
- `item_code text`
- `ativo boolean not null default true`
- `superseded_by_id uuid`
- `superseded_at timestamptz`

Constraints/indices:
- unique `(fazenda_id, protocolo_id, logical_item_key, version)`
- unique parcial de versao ativa por `(fazenda_id, protocolo_id, logical_item_key)` onde `ativo=true and deleted_at is null`
- FK deferrable `superseded_by_id -> protocolos_sanitarios_itens(id)`

Campos adicionados em `agenda_itens`:
- `protocol_item_logical_key`
- `protocol_item_version`
- `protocol_item_code`

Campos adicionados em `eventos_sanitario`:
- `protocol_item_version_id`
- `protocol_item_logical_key`
- `protocol_item_version`
- `protocol_item_snapshot`

## Contrato de versionamento

- `logical_item_key` e obrigatorio para versionar.
- `version` incrementa em alteracao semantica.
- Apenas uma versao ativa pode existir por etapa logica.
- A versao antiga recebe `ativo=false`, `superseded_at` e depois `superseded_by_id`.
- `protocol_item_id` permanece apenas como campo tecnico legado existente no schema; a decisao operacional nova usa `logical_item_key` e `id`.

## Como agenda referencia versao

A migration adiciona trigger `fill_sanitario_agenda_protocol_item_snapshot`, que preenche snapshots estruturados quando uma agenda sanitaria recebe `protocol_item_version_id`:
- `protocol_item_logical_key`
- `protocol_item_version`
- `protocol_item_code`

O cliente tambem removeu fallback de navegacao baseado em `protocol_item_id`/`protocolo_item_id` dentro de `source_ref`.

## Como evento referencia versao

`buildEventGesture` grava em `eventos_sanitario`:
- `protocol_item_version_id`
- `protocol_item_logical_key`
- `protocol_item_version`
- `protocol_item_snapshot`

A migration adiciona trigger `fill_eventos_sanitario_protocol_item_snapshot` para completar o snapshot a partir da agenda ou da versao fisica, inclusive no caminho SQL `sanitario_complete_agenda_with_event`.

## O que foi descartado da estrutura antiga

- Fallback operacional para `protocol_item_id`/`protocolo_item_id` em `source_ref` ao abrir Agenda -> Registrar.
- Edicao semantica in-place de etapa customizada.
- Materializacao oficial sem `item_code` estavel.
- Revisao de item sem `logical_item_key`.

## Migrations criadas

- `supabase/migrations/20260531000000_protocolos_sanitarios_itens_immutable_versions.sql`

## Testes adicionados

- `src/lib/sanitario/__tests__/protocolItemRevisions.test.ts`
- `src/lib/sanitario/__tests__/protocolItemSchemaContract.test.ts`

Testes ajustados:
- `src/lib/sanitario/__tests__/officialCatalogOps.test.ts`
- `src/lib/events/__tests__/buildEventGesture.test.ts`
- `src/pages/Agenda/__tests__/createAgendaActionController.helper.test.ts`
- `src/pages/Registrar/__tests__/sourceTaskPrefill.effect.test.ts`
- `tests/smoke/agenda_registrar_conclusao.smoke.test.ts`
- `tests/integration/flows/agenda_registrar_estado.flow.test.ts`

## Comandos executados

- `pnpm exec vitest run src/lib/sanitario/__tests__/protocolItemRevisions.test.ts src/lib/sanitario/__tests__/protocolItemSchemaContract.test.ts src/lib/sanitario/__tests__/officialCatalogOps.test.ts src/lib/events/__tests__/buildEventGesture.test.ts src/pages/Registrar/__tests__/eventInput.helper.test.ts src/pages/Registrar/__tests__/sourceTaskPrefill.effect.test.ts src/pages/Agenda/__tests__/createAgendaActionController.helper.test.ts`
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`
- `supabase db reset`
- `node scripts/codex/validate-supabase-baseline-functional.mjs`
- `powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/sanitario","src/lib/offline","src/pages/Registrar","src/pages/Agenda","src/lib/events","supabase/migrations","scripts/codex/validate-supabase-baseline-functional.mjs"`
- `graphify update .`

Resultado: todos passaram. O `supabase db reset` aplicou a migration `20260531000000_protocolos_sanitarios_itens_immutable_versions.sql`; o validador funcional passou apos atualizar o fixture do script para inserir `logical_item_key`/`item_code` no novo contrato.

## Riscos remanescentes

- `protocol_item_id` ainda existe fisicamente por compatibilidade tecnica do schema atual; a regra operacional ja foi deslocada para `logical_item_key`/`id`.
- Triggers cobrem os caminhos SQL existentes de agenda/evento e passaram no reset Supabase local.
- Relatorios/read models que exibem identificadores de etapa podem precisar trocar copy para `item_code` em fase posterior.

## Proxima fase recomendada

Fase 1C: contrair o campo tecnico `protocol_item_id` quando nao houver mais dependencia em schema/testes/read models, e revisar copies/read models para exibir `item_code`/versao de forma mais amigavel.
