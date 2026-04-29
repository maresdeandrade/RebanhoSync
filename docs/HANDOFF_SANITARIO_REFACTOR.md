# Handoff Sanitario Pos-Saneamento

> **Status:** Snapshot de handoff
> **Ultima atualizacao:** 2026-04-29
> **Fonte primaria:** codigo atual em `src/lib/sanitario/**`, `src/pages/Registrar/**`, migrations sanitarias e testes sanitarios.

Este documento separa o resumo da rodada de saneamento sanitario da documentacao operacional local do boundary `Registrar` x Sanitario.

## Estado consolidado

| Rodada | Estado atual |
|---|---|
| P0.1 | Golden/parity tests sanitarios criados para capturar divergencias TS/SQL. |
| P0.2 | Calendario TS -> SQL alinhado; leitura de payload legado PT-BR preservada. |
| P0.3 | Dedup sanitario unificado em contrato canonico estruturado TS/SQL. |
| P0.4 | Historico pre-P6 de sequenciamento sanitario estabilizado em testes TS; no contrato SQL P6.2 atual, raiva nao ganhou nova sequencia D1/D2/anual. |
| P0.5 | Gate global restaurado com estabilizacao do teste date-sensitive de Relatorios. |
| P1 | Taxonomia sanitaria passiva criada (`ProtocolKind`, `MaterializationMode`, `ComplianceKind`) sem mudar comportamento. |
| P2 | `src/lib/sanitario/**` reorganizado por responsabilidade. |
| P3.1A | Payload builder sanitario puro extraido. |
| P3.1B | Boundary RPC/fallback sanitario extraido. |
| P3.1C | Preflight sanitario puro extraido. |
| P3.2 | Resolver puro de pacote sanitario extraido do hook React. |
| P3.3 | Boundary `Registrar` x Sanitario documentado. |
| P3.4 | Facade `models/registrarProtocolEvaluation` adotada no Registrar; inventario de imports diretos atualizado. |
| P5 | Ultimo import direto de `engine/*` no Registrar removido por facade visual `models/calendarDisplay`. |
| P5.1 | Documentacao reconciliada para remover dividas falsas pos-P5. |
| P6.1 | Catalogo sanitario conservador consolidado: brucelose agenda automatica; raiva, PNEFA/IN50, GTA, checklists e tecnicos sem agenda por seed. |
| P6.2.1 | `sanitario_recompute_agenda_core` passou a materializar brucelose PNCEBT por sexo feminino, animal ativo, nascimento conhecido e janela 90-240 dias. |
| P6.2.2a/b | Recompute passou a bloquear reabertura de brucelose concluida por dedup historico e por `payload.sanitary_completion` em eventos sanitarios. |
| P6.2.3 | Raiva dos herbivoros passou a exigir risco/configuracao medio-alto e ativacao operacional explicita; sem vacinacao universal. |
| P6.2.4 | Protocolos tecnicos recomendados passaram a exigir ativacao operacional explicita; helmintos/carrapato tambem exigem pressao configurada medio-alto. |
| P6.3a | `animais.especie` foi adicionado como campo canonico nullable minimo (`bovino`/`bubalino`/`null`), sem backfill obrigatorio e sem tornar especie obrigatoria. |
| P6.3b | `sanitario_recompute_agenda_core` passou a aplicar gate sanitario transicional por especie, mantendo `especie=null` elegivel temporariamente. |

## Motor e contratos atuais

- SQL/Supabase e o motor lider atual de materializacao/recompute da agenda sanitaria, via `sanitario_recompute_agenda_core`.
- TypeScript mantem contratos, adapters, suporte offline/local e golden/parity tests.
- Calendario emitido pelo TS usa vocabulario SQL; leitura continua aceitando legado PT-BR.
- Dedup sanitario usa contrato canonico estruturado em TS e SQL.
- No recorte P6.2 atual, a agenda canonica nao implementa nova sequencia D1/D2/anual de raiva; raiva so pode gerar agenda quando ha protocolo operacional ativo, item `gera_agenda=true`, risco/configuracao valido e ativacao explicita.
- Taxonomia sanitaria e passiva e retrocompativel.
- No estado pos-P5, `src/pages/Registrar/**` nao importa diretamente `@/lib/sanitario/engine/*`.
- Labels visuais de calendario no Registrar passam por `src/lib/sanitario/models/calendarDisplay.ts`.
- Payload, preflight, package e RPC/fallback sanitario estao delegados a facades/models/infrastructure de `src/lib/sanitario/**`.

Contrato de agenda sanitaria pos-P6.3b:

- Catalogo global oficial/tecnico nao e fonte direta de agenda: `sanitario_recompute_agenda_core` nao consulta `catalogo_protocolos_oficiais`, `catalogo_protocolos_oficiais_itens` ou `catalogo_doencas_notificaveis`.
- Brucelose PNCEBT gera agenda somente para femeas ativas com nascimento conhecido e idade entre 90 e 240 dias, mantendo `requires_vet=true`, dedup canonico por janela e gate transicional de especie que permite `bovino`, `bubalino` e `null`.
- Conclusao de agenda sanitaria via `sanitario_complete_agenda_with_event` preserva `payload.sanitary_completion` em `eventos_sanitario.payload` e espelha em `eventos.payload`; recompute usa esse historico para nao recriar agenda concluida mesmo se a agenda original for soft-deletada.
- Raiva dos herbivoros exige protocolo/item operacional ativo, `gera_agenda=true`, `family_code='raiva_herbivoros'`, `fazenda_sanidade_config.zona_raiva_risco` em `medio|alto`, `risk_values` no payload, ativacao explicita e gate transicional de especie que permite `bovino`, `bubalino` e `null`.
- Tecnicos recomendados (`clostridioses`, `leptospirose_ibr_bvd`, `controle_parasitario`, `controle_carrapato`) exigem protocolo/item operacional ativo, `gera_agenda=true` e ativacao explicita. Quando o payload traz alvo explicito de especie (`species`, `especies_alvo` ou `gatilho_json.species`), especie conhecida precisa bater; `especie=null` passa transicionalmente. Sem alvo explicito, `bovino`, `bubalino` e `null` permanecem elegiveis. `controle_parasitario` exige `pressao_helmintos` em `medio|alto`; `controle_carrapato` exige `pressao_carrapato` em `medio|alto`.
- PNEFA/aftosa, IN50/doencas notificaveis, GTA, suspeitas, checklists, biosseguranca e itens dependentes de avaliacao manual continuam sem agenda automatica.

## Baseline Supabase sanitaria

- A baseline canonica atual de desenvolvimento e `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`.
- `supabase/seed.sql` repopula catalogos sanitarios canonicos conservadores; o seed e tecnico/idempotente, nao e fonte normativa completa e nao deve gerar agenda automatica exceto para a janela de brucelose PNCEBT.
- `supabase/migrations_legacy_pre_baseline/` preserva migrations antigas como backup documental.
- Shims de compatibilidade pos-squash foram removidos da pasta ativa; testes de contrato leem a baseline canonica ou fixtures canonicas de dominio.
- A validacao funcional pos-baseline roda por `node scripts/codex/validate-supabase-baseline-functional.mjs`.
- A validacao cobriu RLS por papel, FK composta cross-farm, agenda sanitaria -> evento sanitario e `sync-batch` com handler real.
- Caveat do `sync-batch`: o gateway local foi servido com `functions serve --no-verify-jwt`; dentro do handler, `auth.getUser(jwt)` e RLS user-scoped ainda foram exercitados.

Limites mantidos no contrato atual:

- sem nova sequencia D1/D2/anual de raiva neste recorte;
- `animais.especie` e canonica e nullable (`bovino`/`bubalino`/`null`), mas sem backfill obrigatorio, sem especie obrigatoria e sem bloquear legado `null` nesta etapa;
- sem coluna nova, indice JSONB ou backfill de eventos antigos para `sanitary_completion`;
- sem transformacao de boa pratica tecnica em obrigacao legal;
- seed sanitario conservador, nao normativo completo.

Contratos relevantes:

- `resolveRegistrarSanitaryPackage`
- `buildSanitaryExecutionPayload`
- `validateSanitaryExecutionPreflight`
- `executeSanitaryCompletion`
- `buildSanitaryDedupKey`
- `toSqlCalendarMode` / `fromSqlOrLegacyCalendarMode` e equivalentes de anchor
- `resolveProtocolKind`, `resolveMaterializationMode`, `resolveComplianceKind`
- `describeRegistrarSanitaryCalendarSchedule` via `src/lib/sanitario/models/calendarDisplay.ts`

## Estrutura atual de `src/lib/sanitario`

| Pasta | Responsabilidade |
|---|---|
| `models/` | Tipos, adapters, payload builder, preflight, resolver de pacote do Registrar e taxonomia passiva. |
| `engine/` | Calendario, dedup, scheduler, regimen, precedencia de layers e calculos deterministicos. |
| `catalog/` | Protocolos base, catalogo oficial, produtos e operacoes de catalogo. |
| `compliance/` | Read models, guards e regras regulatorio-documentais. |
| `infrastructure/` | Services e boundary RPC/fallback de execucao sanitaria. |
| `customization/` | Customizacao de protocolos por fazenda. |

## Resolvido

- Divergencia calendario TS/SQL.
- Divergencia dedup TS/SQL.
- Recriacao indevida de agenda sanitaria concluida quando existe dedup/evento valido.
- Payload sanitario montado diretamente no Registrar.
- RPC/fallback sanitario conhecido diretamente pelo Registrar.
- Import direto de `engine/protocolRules` no Registrar.
- Import direto de `engine/calendar` no Registrar.
- Qualquer import direto de `@/lib/sanitario/engine/*` dentro de `src/pages/Registrar/**`.

## Historico/obsoleto

- A recomendacao antiga de iniciar por "Rodada 1 — Evidencia e diagnostico" esta obsoleta: P0.1 ja criou golden/parity tests e P0.2-P0.4 corrigiram os contratos principais.
- Prompts antigos P0/P1/P2/P3 foram executados e nao devem ser reabertos como plano ativo.
- Riscos de calendario TS/SQL, dedup TS/SQL, reabertura de agenda concluida e imports diretos de `engine/protocolRules`/`engine/calendar` devem permanecer como historico resolvido, nao como backlog aberto.
- O saneamento do Registrar sanitario esta encerrado no escopo estrutural atual; novas frentes devem ser produto/dominio e separadas.

## Dividas remanescentes

- Helpers de compliance/transit ainda existem dentro de `src/pages/Registrar/**`.
- Carencia ainda e metadata/compliance parcial, nao motor pleno de withholding.
- Produto/lote/estoque ainda nao sao entidades completas de rastreabilidade sanitaria.
- SISBOV/fiscal permanecem fora do core sanitario.
- Legado com `animais.especie is null` ainda precisa de saneamento futuro e decisao explicita sobre eventual bloqueio de `null` na agenda sanitaria.

## Proximas frentes possiveis

Escolher uma frente por vez:

- carencia/rastreabilidade leve, sem estoque completo;
- continuidade documental/ADR apenas se surgir nova decisao normativa.

ADRs ja existentes para a rodada:

- `docs/ADRs/ADR-0003-sanitario-sql-materialization-leader.md`
- `docs/ADRs/ADR-0004-sanitario-canonical-dedup.md`
- `docs/ADRs/ADR-0005-registrar-sanitario-boundary.md`
- `docs/ADRs/ADR-0006-sanitario-passive-taxonomy.md`
