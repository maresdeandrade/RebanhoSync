# Agent Context RebanhoSync

Este documento e o contexto ampliado e reutilizavel para agentes de IA. Ele complementa `AGENTS.md` e deve reduzir prompts longos futuros sem substituir a leitura inicial obrigatoria.

## 1. Snapshot atual

Estado operacional:
- produto em beta interno;
- MVP completo e operacional;
- fase atual: consolidacao SLC;
- prioridade: patches pequenos, locais, reversiveis e testaveis;
- refatoracao visual SLC aplicada em maio/2026; manter execucao primeiro, leitura/telemetria depois e superficies com headers/cards/badges consistentes;
- evolucao enquadrada por `capability_id` ou `infra.*`.

Stack confirmada em `package.json` e `README.md`:
- React 19, TypeScript, Vite 6;
- Supabase Auth/Postgres/RLS/Edge Functions;
- Dexie offline-first;
- TanStack React Query;
- Vitest, Testing Library e fake-indexeddb;
- pnpm como gerenciador usado pelos scripts.

## 2. Fontes de verdade

Ordem de confianca:
1. codigo + migrations ativas;
2. `docs/CURRENT_STATE.md`;
3. docs normativos;
4. docs derivados;
5. historico.

Fontes principais:
- `README.md`: snapshot executivo, baseline Supabase e scripts principais.
- `docs/CURRENT_STATE.md`: estado operacional vivo.
- `docs/PROCESS.md`: processo normativo capability-centric.
- `docs/ARCHITECTURE.md`: Two Rails, boundary sanitario, idempotencia e baseline Supabase.
- `docs/PRODUCT.md`: produto e dominio.
- `docs/SYSTEM.md`: visao sistemica.
- `docs/REFERENCE.md`: referencia de dominio/uso.
- `docs/review/RebanhoSync_auditoria.md`: contrato documental pos-validacao para fontes de verdade, `insights`, marcadores e decisoes bloqueadas.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/TECH_DEBT.md`, `docs/ROADMAP.md`, `docs/review/RECONCILIACAO_REPORT.md`: derivados.

Inspecao de docs:
- `docs/OFFLINE.md`: nao encontrado - locais inspecionados: `docs/`.
- `docs/CONTRACTS.md`: nao encontrado - locais inspecionados: `docs/`.
- `docs/DB.md`: nao encontrado - locais inspecionados: `docs/`.
- `docs/RLS.md`: nao encontrado - locais inspecionados: `docs/`.
- Versoes desses nomes em `docs/archive/**` existem, mas sao historicas e nao fonte normativa atual.

## 3. Baseline Supabase real

Estado inspecionado no repo:
- baseline canonica ativa: `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`;
- pasta ativa `supabase/migrations/` contem somente a baseline canonica e `AGENTS.md`;
- migrations antigas preservadas em `supabase/migrations_legacy_pre_baseline/`;
- shims pos-squash removidos da pasta ativa;
- seed tecnico/minimo/idempotente: `supabase/seed.sql`;
- seed sanitario nao e fonte normativa oficial.

O arquivo de baseline contem, entre outros:
- schema base multi-tenant;
- enums canonicos;
- FKs compostas com `fazenda_id`;
- RLS habilitado e policies por membership/RBAC;
- funcoes de membership e roles;
- eventos protegidos contra update destrutivo de negocio, com excecoes tecnicas controladas (`deleted_at`, `updated_at`, `server_received_at` e metadados);
- agenda sanitaria, recompute e RPCs sanitarias;
- catalogos sanitarios globais.

Validador funcional real:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Cobertura documentada pelo validador:
- bootstrap via `supabase status -o env` ou env vars;
- RLS por `owner`, `manager`, `cowboy` e usuario sem vinculo;
- bloqueio de cruzamento cross-farm por FK composta;
- fluxo agenda sanitaria -> `eventos` -> `eventos_sanitario`;
- `sync-batch` real com idempotencia, rejeicao e forbidden.

Caveat do `sync-batch` local:
- o script pode iniciar `supabase functions serve --no-verify-jwt`;
- isso e fallback local para CLI/runtime antiga;
- dentro do handler, `auth.getUser(jwt)` e operacoes user-scoped ainda exercem autenticacao e RLS.

## 4. Estrutura relevante do repo

Diretorios de produto:
- `src/pages/**`: telas e composicao.
- `src/lib/**`: dominio, infra, sync/offline e helpers.
- `src/components/**`: componentes reutilizaveis.
- `src/hooks/**`: hooks.
- `tests/**`: integracao/smoke.

Supabase:
- `supabase/migrations/**`: baseline ativa.
- `supabase/migrations_legacy_pre_baseline/**`: backup documental historico.
- `supabase/seed.sql`: seed tecnico minimo.
- `supabase/functions/sync-batch/**`: Edge Function de sync.

Operacao para agentes:
- `AGENTS.md`: entrada rapida.
- `.agents/skills/README.md`: indice real de skills locais.
- `scripts/codex/**`: bootstrap, preflight, validate, prepare-pr e validador Supabase.
- `docs/tasks/TEMPLATE_CODEX_TASK.md`: template para prompts curtos.

## 5. Dominios criticos

Tratar como risco alto:
- offline/sync/rollback: `src/lib/offline/**`, `supabase/functions/sync-batch/**`;
- sanitario: `src/lib/sanitario/**`, `src/pages/ProtocolosSanitarios/**`, recortes sanitarios de `Registrar` e `Agenda`;
- reproducao: `src/lib/reproduction/**`;
- animais/taxonomia/elegibilidade: `src/lib/animals/**`;
- eventos/builders/validators/payloads: `src/lib/events/**`;
- hotspots de UI: `src/pages/Registrar/**`, `src/pages/Agenda/**`;
- schema/RLS/RPC/FKs: `supabase/migrations/**`.

Antes de expandir leitura, procure `AGENTS.md` local na area afetada.

## 6. Two Rails

Modelo operacional:
- Rail 1: `agenda_itens` representa intencao futura mutavel.
- Rail 2: `eventos` e tabelas `eventos_*` representam fatos passados protegidos contra update destrutivo de negocio.

Regras:
- Agenda e Evento nao se confundem.
- `Registrar` e `Executar` escrevem evento.
- `Encerrar` e `Cancelar` atuam em pendencia de agenda.
- `Aplicar protocolo` recalcula/materializa agenda e nao cria evento diretamente.
- Avaliacao/ronda de pasto usa `dominio='pastagem'` e detalhe `eventos_pasto_avaliacao`; e historico factual append-only, nao atualiza `pastos`, `lotes`, `pasto_ocupacoes` e nao gera agenda.
- Correcao historica por `corrige_evento_id` esta parcialmente validada: o campo existe, mas o fluxo completo de correcao nao foi confirmado no codigo inspecionado.
- Agenda concluida sem evento vinculado nao deve ser tratada como execucao factual.
- Necessidade futura deve partir de agenda materializada valida quando o dominio tiver agenda confirmada; regra mais validada para sanitario e cria/pos-parto.

## 6.1 Contrato de fontes e bloqueios atuais

- `src/lib/insights/` existe como core puro/read-only de composicao operacional, sem IO, Supabase, Dexie, UI, persistencia ou relogio interno. Ele nao e fonte primaria nem motor de regra critica.
- `src/features/operationalInsights/` e a primeira integracao passiva: adapter, hook e painel read-only para a Central Operacional na Home.
- A Home consome dados ja carregados de `state_agenda_itens`, `state_animais`, `event_eventos`/eventos e `state_protocolos_sanitarios_itens`, mas a apresentacao atual e tática: atrasadas, agenda de hoje e acao imediata aparecem antes de leituras passivas.
- O painel read-only deve permanecer como contexto secundario: estados `Bloqueado`/`Vazio`/`Parcial`/`Completo`, limitacoes compactas e nenhum botao, link, `onClick` ou CTA de dominio.
- A listagem de Animais usa leitura card-first e filtros compactos; nao reintroduzir tabela tecnica duplicada como visual primario sem tarefa explicita.
- Em filtros de Animais, chips/baloes ficam restritos ao que ajuda decisao rapida (`Sexo`, `Status`, `Categoria`); demais filtros devem permanecer como seletores compactos ou controles equivalentes.
- Lotes, Pastos, Relatorios, Reproducao, Reconciliacao, Configuracoes, onboarding/cadastros e selecao de fazenda seguem o padrao visual SLC: PageIntro simples, cards objetivos, menor densidade, badges subordinados e superficies sem sombra pesada.
- A selecao de fazenda pode exibir metadados cadastrais existentes (municipio/UF, area, tipo de producao e manejo), mas nao deve solicitar nem inferir dado fiscal/oficial novo nesse fluxo.
- Nao existe camada real de marcadores/tags persistidos como fonte primaria; termos como tag, label, badge, chip, status e classificacao aparecem em UI, identificacao ou dominio, mas nao constituem camada persistida de marcadores operacionais.
- Sinais/marcadores, quando derivados por insights, devem ser auxiliares, recalculaveis ou auditaveis, nunca fonte primaria.
- Peso atual confiavel, pronto para venda/abate, `commercialReadiness.ts` conclusivo, tags/marcadores persistidos como fonte primaria, consulta em linguagem natural, IA gerando agenda, IA concluindo execucao e motor geral IATF permanecem bloqueados ate nova validacao. Carencia ativa existe apenas como sinal sanitario factual derivado de `eventos_sanitario` estruturado e nao autoriza venda/abate.
- Compliance sanitario esta parcialmente validado por overlays, views e regras sanitarias, mas nao e bloqueio operacional completo e universal.
- Ha RPC/funcoes de recompute sanitario por animal, mas disparo automatico por mutacao do animal nao foi confirmado; recompute por protocolo/config esta mais claramente validado.
- Inventario ja possui insumos, apresentacoes, lotes e movimentacoes tenant-scoped, com consumo manual vinculado a evento confirmado. Eventos sanitarios com `produto_veterinario_id` catalogado podem abrir `/insumos` com fonte pre-selecionada e lotes filtrados pelo mesmo produto. Relatorios medem demanda futura por agenda sanitaria aberta valida e consolidam rastreabilidade factual por `eventos_sanitario`: produto, lote, dose, via, responsavel, carencia, custo, lote de estoque, animal, lote pecuario e protocolo/version. Baixa automatica ao registrar evento segue desabilitada.

### 6.2 Contrato sanitario consolidado

- Historico sanitario auditavel usa `eventos` + `eventos_sanitario`, nunca agenda ou protocolo isolado como fato.
- `eventos_sanitario` estruturado e fonte de produto/lote/dose/via/responsavel/carencia/custo.
- `protocol_item_version_id` segue como detalhe tecnico; superficies humanas exibem `item_code` e versao quando disponiveis.
- Sinais sanitarios disponiveis: `sanitario:carencia_ativa`, `sanitario:livre_carencia`, `sanitario:evento_sem_rastreabilidade`, `sanitario:produto_sem_lote`, `sanitario:estoque_inconsistente`, `sanitario:custo_ausente`.
- Sinais bloqueados como decisao: `comercial:pronto_venda`, `comercial:apto_abate`, `peso:atual_confiavel`, `protocolo:executado`, `agenda:concluida_como_fato`.
- Reset Supabase e baseline funcional passaram apos a consolidacao sanitaria (`validate-supabase-baseline-functional.mjs`, `run_id=c56ac0ce`).

## 7. Offline-first e sync gestures

Invariantes:
- `1 acao -> 1 createGesture`;
- rollback deterministico;
- metadata obrigatoria de sync;
- idempotencia preservada em replay;
- compatibilidade com fila local e dados legados;
- reason codes e rejeicoes devem permanecer auditaveis.

Ao tocar sync/offline:
- revisar `tableMap`;
- revisar `queue_gestures`, `queue_ops`, `queue_rejections`;
- revisar `before_snapshot`;
- revisar retry, pull e reconcile;
- revisar `sync-batch` e seus testes.

## 8. RLS, RBAC e isolamento

Regras:
- `fazenda_id` e a fronteira de isolamento.
- UI nao e fronteira suficiente de autorizacao.
- RLS e RPCs precisam proteger o servidor.
- `service_role` nunca deve ser exposto no client.
- Roles operacionais confirmadas: `owner`, `manager`, `cowboy`.
- Alteracao em policies/RPCs exige tarefa explicita e auditoria especifica.

Ao tocar banco/edge:
- revisar isolamento por `fazenda_id`;
- revisar FKs compostas;
- revisar protecao contra update destrutivo de negocio em eventos;
- revisar `SECURITY DEFINER` quando existir;
- revisar grants e uso de cliente user-scoped.

## 9. Regras para migrations

- Nao alterar migrations sem tarefa explicita.
- Baseline ativa e o arquivo squash canonico em `supabase/migrations/`.
- `supabase/migrations_legacy_pre_baseline/**` e backup documental, nao cadeia ativa.
- Nao recriar shims pos-squash na pasta ativa sem decisao explicita.
- Qualquer mudanca estrutural deve preservar compatibilidade com dados legados e contratos offline.
- Mudancas de schema/RLS/RPC devem citar validacao de `fazenda_id`, FKs compostas e protecao contra update destrutivo de negocio em eventos.

## 10. Regras para seed

- `supabase/seed.sql` e tecnico, minimo e idempotente.
- Seed sanitario nao e fonte normativa oficial.
- Nao expandir conteudo normativo/regulatorio no seed sem tarefa explicita.
- Mudancas no seed exigem confirmar idempotencia e impacto em resets locais.

## 11. Regras para documentacao

- Atualizar docs derivados somente quando houver delta funcional real.
- Nao mover historico para fonte normativa.
- Nao declarar como concluido o que depende de reconciliacao.
- Em conflito documental, usar codigo/migrations antes da narrativa.

Ordem dos derivados quando aplicavel:
1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

## 12. Validacoes reais

Scripts reais em `package.json`:

```bash
pnpm run lint
pnpm test
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:hotspots
pnpm run test:smoke
pnpm run quality:gate
pnpm run test:e2e
pnpm run gates
pnpm run audit:data
```

Scripts reais em `scripts/codex/`:

```powershell
powershell -File scripts/codex/bootstrap.ps1
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
powershell -File scripts/codex/prepare-pr.ps1
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Nao encontrado:
- script `typecheck` em `package.json`.

Uso recomendado:
- docs-only: `pnpm run lint` e `pnpm run build`, se aplicavel ao tempo da tarefa.
- produto: `pnpm run lint`, `pnpm test`, `pnpm run build`.
- fluxo operacional: considerar `pnpm run quality:gate`.
- Supabase baseline: `node scripts/codex/validate-supabase-baseline-functional.mjs`.
- area critica: `powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"`.

## 13. Como relatar incertezas

Use estes formatos:
- `nao encontrado - locais inspecionados: ...`
- `inferido - confirmar antes de usar: ...`
- `nao executado - motivo: ...`

Nao invente scripts, arquivos, comandos, status de teste ou comportamento runtime.

## 14. Prompt curto recomendado

Base:

```text
Siga AGENTS.md e docs/AGENT_CONTEXT.md.
Use docs/tasks/TEMPLATE_CODEX_TASK.md.

Tarefa:
<objetivo curto>

Escopo permitido:
- <areas>

Escopo proibido:
- <areas>

Entregue:
- <formato esperado>
```

Exemplo:

```text
Siga AGENTS.md e docs/AGENT_CONTEXT.md.
Use docs/tasks/TEMPLATE_CODEX_TASK.md.

Tarefa:
Auditar fluxo de convites de usuarios.

Escopo permitido:
- auth
- access control
- invitations

Escopo proibido:
- migrations
- seed
- sanitario

Entregue:
- fluxo real
- riscos
- arquivos afetados
- testes recomendados
```
