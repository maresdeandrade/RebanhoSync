# Handoff atual — Fase 12 encerrada / entrada da Fase 13

Atualizado em: 2026-08-05
Baseline técnico do fechamento: `7e43248`
Status: **Fase 12 tecnicamente encerrada; rollout sanitário bloqueado**
Próxima fase de desenvolvimento: **Fase 13 — Reprodução Operacional v1**

## Resumo executivo

A Conformidade Sanitária v2 permanece um read model derivado/somente leitura. Os incrementos 3.9, 3.13, 4, 5 e 6 estão validados localmente e passaram pelo hardening integrado da cadeia de execução factual, snapshots, correção append-only, projeção de carência, fila, pull/reconcile e estoque.

As validações locais e a certificação remota funcional estão consolidadas, incluindo histórico externo/documental, núcleo factual, estoque, correções, carência, pull/Conformidade, sucesso parcial e a recertificação de `BLOCKED_DEPENDENCY` no `sync-batch` v20.

Decisão atual: encerrar o desenvolvimento técnico da Fase 12, manter o rollout bloqueado pela pendência externa `SANITARIO_V2_E2E_PLATFORM_BLOCKED` e liberar o início da Fase 13 sem ativar o Sync Sanitário v2 para usuários.

## Fontes autoritativas

- plano corrente: [ACTIVE_PHASE_PLAN.md](./ACTIVE_PHASE_PLAN.md);
- decisão permanente: [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md);
- estado macro: [ROADMAP.md](../product/ROADMAP.md);
- contratos de domínio: [SANITARIO.md](../domain/SANITARIO.md) e [SOURCE_OF_TRUTH.md](../context/SOURCE_OF_TRUTH.md);
- contratos técnicos: [OFFLINE_SYNC.md](../technical/OFFLINE_SYNC.md) e [SUPABASE_RLS.md](../technical/SUPABASE_RLS.md).

Planos encerrados e evidências em `docs/review/evidence/` permanecem históricos e não substituem este handoff.

## Estado consolidado da Fase 12

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync Remoto Sanitário v2 — **desenvolvimento técnico concluído**.

| Subitem | Estado |
|---|---|
| 3.1 Diagnóstico schema local/remoto | Concluído |
| 3.2 Migrations necessárias | Fundação concluída |
| 3.3 RLS/multi-tenant/fazenda | Concluído tecnicamente |
| 3.4 Agenda sanitária | Concluída |
| 3.5 Agenda animais | Concluída |
| 3.6 Evento sanitário | Concluído |
| 3.7 Detalhe sanitário | Concluído |
| 3.8 Histórico externo/documental | Concluído |
| 3.9 Movimento de estoque sanitário | Concluído e recertificado no staging |
| 3.10 Retry/replay/idempotência | Concluído |
| 3.11 Sucesso parcial | Concluído |
| 3.12 Conflito multi-dispositivo | Desenvolvimento concluído; rollout bloqueado pela plataforma |
| 3.13 Recalcular Conformidade após pull | Concluído |
| 4 Produto técnico e fonte por campo | Concluído |
| 5 Correção sanitária append-only | Concluído |
| 6 Carência sanitária operacional | Concluído |
| Hardening integrado local | Concluído |

A Fase 12 está tecnicamente encerrada. A pendência externa do conflito não bloqueia o desenvolvimento das próximas fases.

## Componentes implementados

### Fundação remota

- migration expand do Sync Sanitário v2;
- `revision` e `expected_revision`;
- `client_op_id`, `client_tx_id` e `domain_op_id`;
- vínculo Evento → Agenda Sanitária v2;
- relação append-only Evento–Animal;
- ledger de idempotência;
- gate autoritativo fail-closed;
- comandos `create_agenda`, `replace_agenda_animals`, `apply_factual_core` e `close_agenda`.

### Transporte e processamento

- `sync-batch` v20;
- typecheck Deno limpo;
- worker com resultados canônicos `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- retry/replay sem assumir `23505` genérico como sucesso;
- sucesso parcial por operação;
- fila compartilhada existente, sem `queue_ops` paralelo;
- pull/reconcile não destrutivo.

### Cutover local

- Dexie v28;
- store factual `event_eventos_animais`;
- manifesto idempotente com estados `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- preservação das filas de outros domínios;
- feature flag local fail-closed e mantida em `false`.

## Contratos de domínio preservados

- Agenda é intenção/tarefa futura.
- Evento é fato histórico executado.
- Closure administrativa encerra a intenção; não prova execução.
- `state_*` é estado atual/read model.
- Protocolo é regra/configuração.
- Conformidade é leitura derivada e não fonte primária.
- Agenda concluída sem Evento não comprova execução.
- Cancelamento e dispensa não criam fato sanitário.
- Execução parcial vale apenas para animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.
- Nenhuma resposta de sync libera venda, abate, leite ou aptidão operacional.

## Ambiente e rollout

| Item | Estado confirmado |
|---|---|
| Supabase staging | `zqloazqzhwauamcejmuz` |
| Produção | Não alterada |
| Gate sanitário remoto | Desligado |
| Feature flag local | `false` |
| Rollout para usuários | Não autorizado |
| Fixtures sintéticas residuais | Zero |

O staging não é produção. Este documento não registra credenciais, secrets, tokens ou dados pessoais de fixtures.

## Risco externo atual

Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED`

Fatos confirmados:

- criação de Agenda remota aprovada;
- replay aprovado;
- substituição de animais aprovada;
- revisão chegou corretamente a `1`;
- PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- no caminho Edge Function/PostgREST/gateway, a resposta não retorna antes do timeout;
- o worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Inferência vedada: não há evidência atual para atribuir defeito ao SQL ou à regra de domínio.

Conduta:

- não aumentar timeout;
- não alterar RPC sem nova evidência;
- manter rollout bloqueado;
- continuar desenvolvimento sob gate remoto desligado e feature flag local `false`.

IDs e rastros detalhados da execução remota devem permanecer em relatório técnico/evidência específica, sem reprodução nas fontes resumidas.

## Validações registradas nos incrementos recentes

- migration expand e sentinelas SQL;
- rebaseline completo do staging;
- baseline funcional Supabase;
- testes focados do `sync-batch`;
- `deno check` e `deno fmt --check`;
- testes focados do worker/reconcile;
- testes do cutover e pull;
- suíte local completa, lint e build nos respectivos incrementos;
- limpeza remota com zero fixtures sintéticas residuais.

## Recertificação mínima de `BLOCKED_DEPENDENCY`

O staging `zqloazqzhwauamcejmuz` recebeu o `sync-batch` v20 com `verify_jwt=true`. No único batch sintético, o fato deliberadamente inválido retornou `REJECTED` e o movimento dependente retornou `BLOCKED_DEPENDENCY / SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED`. Não houve Evento, detalhe, relação, ledger ou movimento persistido; o saldo permaneceu `10.000`. O cleanup removeu usuário Auth, fazenda, membership, animal, insumo, lote e gate, com zero gates habilitados ao final. O defeito de dependência está encerrado; o conflito `SQLSTATE 40001` continua como bloqueio externo independente.

No incremento 3.8 foram reexecutados: preflight e validação agregada, testes focados do domínio/sync, suíte completa com 2.241 testes em 310 arquivos, lint, build, `deno fmt --check`, `deno check --no-lock` e baseline funcional Supabase com 5/5 verificações. Não houve migration, alteração de RPC, deploy ou push.

Este handoff registra resultados já executados; não afirma que essas validações foram reexecutadas por uma alteração puramente documental.

## Resultado do incremento 3.8

Fatos confirmados:

- UUID e identidades de operação são gerados na origem e enfileirados na fila compartilhada;
- existe registro na tabela factual `event_eventos`/`eventos`, classificado como `standalone_fact`; ele não é Evento de execução `primary_execution`;
- referência presente, classe e cobertura são validações estruturais e não autenticam o conteúdo do documento;
- `external_declared` não comprova; documento sem referência permanece fail-closed; `external_documented` apoia somente a cobertura declarada;
- o cutover com contexto de ativação faz backfill idempotente dos históricos locais elegíveis criados com o gate desligado, inclusive quando o manifesto já está `APPLIED`;
- a relação Evento–Animal canônica é exclusiva quando existe; fallback legado ocorre somente na ausência dela, sem união ou duplicidade;
- o fingerprint cobre evento, detalhe e relações completos; alteração de referência, cobertura ou snapshot crítico com a mesma identidade produz conflito, não replay;
- pull incremental/idempotente protege conjuntamente evento, detalhe e relação de operação local pendente, inclusive contra tombstone remoto parcial;
- replay, conflito de conteúdo, sucesso parcial e divergência de tenant estão cobertos;
- não são criados Agenda, `primary_execution`, movimento de estoque, carência ou autorização operacional;
- nenhuma migration ou ampliação da RPC foi necessária.

O incremento 3.8 não introduziu recálculo global após todos os pulls; essa integração foi realizada posteriormente no item 3.13.

## Resultado do incremento 3.9

Fatos confirmados:

- execução sanitária `primary_execution` persiste evento, detalhe, relações, movimento, saldo local e fila no mesmo limite transacional Dexie;
- o movimento reutiliza `insumo_movimentacoes` e permanece ligado ao Evento por `source_evento_id`;
- o gesto inicial ordena fato antes do movimento; em retry isolado, o servidor exige ledger factual confirmado e valida fazenda, natureza, produto, insumo, lote, quantidade e unidade antes do INSERT;
- Agenda, closure administrativa, `standalone_fact`, `external_declared` e `external_documented` não são elegíveis;
- replay por identidade ou chave lógica compara fingerprint canônico; conteúdo idêntico é no-op e conteúdo divergente é conflito;
- pull de `insumo_movimentacoes` é incremental, idempotente e protege operação local pendente, inclusive contra tombstone parcial;
- sucesso parcial e retry continuam preservando resultado individual; saldo confirmado não é reaplicado;
- schema, migrations, RPCs, `db.ts`, `tableMap.ts` e `syncWorker.ts` permaneceram inalterados;
- nenhuma carência nova, Conformidade recalculada ou autorização de venda, abate ou leite foi criada.

Validação local concluída com testes focados, suíte completa, lint, build, Deno fmt/check e baseline funcional Supabase 5/5. O movimento e seu `BLOCKED_DEPENDENCY` foram posteriormente certificados no staging; `SANITARIO_V2_E2E_PLATFORM_BLOCKED` permanece como pendência externa sem autorizar rollout.

## Resultado do incremento 3.13

Fatos confirmados:

- o pull de cutover busca as fontes sanitárias ordenadas e somente grava depois que todas respondem sem erro;
- agenda, alvos, Evento, detalhe, relações com animais, movimentos e closures são mesclados em uma única transação Dexie;
- a Conformidade é reconstruída após esse commit, diretamente das fontes locais filtradas por `fazenda_id`, sem persistir uma fonte primária paralela;
- cursor incremental, idempotência e proteção de operação local pendente foram preservados;
- falha de fonte não produz estado factual parcial nem recálculo;
- o recálculo declara e testa ausência de criação de Agenda, Evento, estoque, carência e autorização operacional;
- não houve migration, RPC, alteração de schema Dexie, `tableMap`, `syncWorker`, gate, deploy ou push.

Validação local concluída com 45 testes focados, suíte completa, lint, build e baseline funcional Supabase 5/5. O `rtk` não estava disponível; os comandos equivalentes foram executados diretamente. Warnings existentes de Browserslist, chunking e imports mistos do Dexie não bloquearam o build.

## Resultado do item 4

Fatos confirmados:

- `eventos_sanitario.produto_snapshot` permanece a única persistência factual do snapshot do produto executado;
- o núcleo tipado do item 4 contém produto executado e evidência por campo; o `withdrawalSnapshot` permanece uma extensão separada, materializada posteriormente pelo item 6;
- evidência `covers` exige produto, fonte e versão atuais, cobertura exata, vínculo produto–fonte, regra técnica e aplicabilidade determinística ao animal; cobertura ausente, ambígua ou divergente permanece não comprovada;
- dose e via factuais nunca são substituídas pelo catálogo, e produto planejado, Agenda, closure ou Protocolo isolado não criam snapshot factual;
- o snapshot é gravado atomicamente com o detalhe e a fila existentes, participa do fingerprint remoto e faz round-trip pelo pull sem sobrescrever operação local pendente;
- a validação remota foi adicionada antes da RPC existente e preserva replay por ledger; nenhuma migration, nova coluna, RPC ou segunda fonte de verdade foi criada;
- estoque, Conformidade, carência, autorização operacional, gates e rollout permaneceram inalterados.

Validação local concluída com testes focados, suíte completa, lint, build, Deno fmt/check, gate local agregado e baseline funcional Supabase 5/5. O `rtk` não estava disponível; foram usados os comandos equivalentes diretamente.

## Resultado do item 5

Fatos confirmados:

- correção sanitária cria novo Evento factual vinculado e nunca altera o Evento original;
- cadeia linear é determinística; ramificação permanece conflito explícito, sem last-write-wins;
- correções técnicas congelam snapshot próprio; correção somente de custo preserva carência e significado sanitário;
- replay idêntico é no-op, identidade divergente é conflito, retry mantém identidades e rollback não deixa persistência parcial;
- correções comuns não criam estoque nem estorno; compensações continuam nos gestures especializados.

## Resultado do item 6

Fatos confirmados:

- carência operacional depende exclusivamente do Evento factual, produto executado, `produto_snapshot`, `withdrawalSnapshot` e fonte forte com cobertura explícita para o campo;
- estados calculado, ausência explícita, desconhecido, ambíguo e não permitido são semanticamente distintos;
- carne e leite são independentes por animal; aptidão ausente, produto não identificado ou catálogo insuficiente permanecem desconhecidos;
- períodos em horas usam duração exata desde o fato; períodos em dias usam data nominal em `America/Sao_Paulo` e término inclusivo no fim do dia;
- cada Evento mantém seu snapshot; correções projetam o estado vigente pela cadeia factual do item 5;
- round-trip preserva fonte, versão, cobertura e cálculo; retry reutiliza o snapshot persistido;
- carência encerrada não autoriza venda, abate, leite, movimentação ou qualquer operação comercial.

## Hardening integrado local

Fatos confirmados:

- 166 testes focados dos cinco incrementos e das fronteiras sanitário/offline/`sync-batch` passaram;
- suíte completa, lint, build, baseline funcional Supabase 5/5, validador agregado e Deno fmt/check passaram;
- a cobertura existente satisfez a matriz integrada; nenhum defeito de código ou lacuna que exigisse novo teste foi encontrado;
- não houve mudança em migration, RPC, RLS, schema Dexie, UI, gates ou rollout;
- o timeout inicial da suíte completa não foi falha funcional: a mesma suíte foi reexecutada integralmente e aprovada.

## Transição oficial

```txt
Fase 12 — desenvolvimento técnico concluído
→ Fase 13 — Reprodução Operacional v1
```

O ciclo Dexie completo permanece coberto pela certificação local existente e não exige novo E2E remoto apenas para renovar evidência. O rollout sanitário continua separado, sem autorização para workaround do 40001, aumento de timeout ou reescrita preventiva.
