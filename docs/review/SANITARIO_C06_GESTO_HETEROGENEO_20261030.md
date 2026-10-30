# C06 — gesto heterogêneo, atomicidade e recuperação — 30/10/2026

## Decisão e baseline

**Incremento C06: `READY_FOR_REVIEW`. Contrato comprovado: `PARTIAL_PER_OPERATION`, no escopo sanitário planejado. Gate técnico: `READY`. F24.7 completa: `NOT_STARTED`.**

Base confirmada após fetch: `origin/main@20a7b3b673db0fbe16db31e60bc33d72350fa8a8`, merge do [PR #259](https://github.com/maresdeandrade/RebanhoSync/pull/259). C05 está `CLOSED / INTEGRATED`; seus sete cenários não foram repetidos. Branch local `codex/c06-heterogeneous-gesture`, worktree `C:/Users/mares/.codex/worktrees/c05-auth-sanitary/GestaoAgro`, inicialmente limpa. Demais worktrees e alterações concorrentes preservadas. Nenhum commit, push ou merge nesta execução.

## Contrato efetivo

- `supabase/functions/sync-batch/index.ts:387` percorre as operações e, em `:759`, chama uma RPC individual. A rejeição de uma RPC não desfaz o commit de outra. Envelope inválido e membership podem recusar a requisição antes desse laço; parcialidade não é garantia universal para qualquer lote/domínio.
- `20261017195545_sanitario_planning_convergence_v2.sql:74` implementa `reschedule_agenda` com CAS e recibo na mesma transação. A criação canônica também grava Agenda, vínculos e recibo na transação de sua RPC. Falha dessa RPC não deixa sua Agenda/recibo parcialmente gravados.
- `sanitarioV2Cutover.ts` valida identidades e persiste várias operações sob um `client_tx_id`, com `client_op_id` e `domain_op_id` distintos. O harness usa `buildManualSanitaryAgendaRecordsV2`, `buildCreateAgendaOperation`, `buildRescheduleAgendaV2`, `validateSanitarioV2Enqueue` e `writeSanitarioV2Queue`. Não escreve linhas de fila manualmente nem cria writer alternativo de produto.
- `syncWorker.ts:1141` instala resultados, rejeições e obrigação durável na mesma transação Dexie; apenas depois reconcilia. Operações aceitas saem da fila, resultados permanecem na auditoria do gesto. Rejeições ficam em `queue_rejections`. Identidades das duas operações permanecem nas origens da obrigação quando o pull falha.
- **Atomicidade local:** projeções/gesto/operações do agrupamento usado no teste são transacionais. **Atomicidade remota:** efeito e recibo por RPC. **Gesto remoto:** aplicação parcial explícita, não transação global.

## Matriz executada

Execução real: `node tests/codex/sanitario-v2-review.supabase.mjs --c06`, exit 0, **9/9 PROVEN**. Cada lote usa criação + reagendamento no mesmo gesto; no caso 02 o reagendamento de Agenda já existente antecede uma criação com animal de outra fazenda. Nenhuma resposta de aplicação foi fabricada. Faults abortam transporte real, interrompem pull real ou lançam erro dentro da transação Dexie.

| Caso | Resultado observado | Evidência por operação |
|---|---|---|
| 01 Integral | Dois resultados APPLIED, gesto DONE, Agenda reagendada | Dois recibos, IDs distintos, uma Agenda/vínculo; fila 2→0 |
| 02 Falha de uma operação | Reagendamento APPLIED e criação REJECTED; gesto REJECTED conserva ambos resultados | Um recibo do reagendamento; zero Agenda/recibo da criação cross-farm; rejeição rastreável |
| 03 Retry antes do commit | Abort do envio não altera PostgreSQL; ambas operações duráveis | Replay aplica ambas com os mesmos UUIDs, um recibo por operação |
| 04 Lost ACK após commit | Edge aplica ambas; resposta real é perdida; reload da página | Duas operações seguem duráveis; replay mantém revisões e um recibo por UUID |
| 05 Falha do ACK Dexie | Hook de deleção aborta transação local depois do commit remoto | Duas operações preservadas, dois recibos remotos; reload/replay não incrementa novamente revisões |
| 06 Falha da reconciliação | ACK remove fila; pull abortado deixa obrigação sanitária durável | Obrigação contém ambos IDs e o TX; reload + drain resolve; Agenda canônica reagendada |
| 07 Farm-switch e RLS | B processada com A pendente; drain(A) não consome obrigação B | Filas, Agendas e recibos por fazenda; A vê apenas A, B apenas B, outsider zero linhas |
| 08 Gate OFF | Ambas REJECTED, gesto REJECTED | Duas rejeições `SANITARIO_SYNC_DISABLED`, zero recibos/efeitos novos |
| 09 Abort da transação local | Rollback de projeções, gesto e operações | Snapshot local/remoto idêntico; nenhum recibo/envio para esse lote |

[Artefato sanitizado](./evidence/SANITARIO_C06_GESTO_HETEROGENEO_20261030.json): `final_run.cases[0..8]` contém snapshots `before`/`after` de `queue_gestures`, `queue_ops`, `queue_rejections`, `sync_reconcile_obligations`, Agendas/vínculos locais e PostgreSQL, revisões e recibos. Falhas intermediárias dos casos 03–07 têm snapshots adicionais em `evidence.pending`. `operation_outcomes` relaciona os **20 IDs** exercitados, comando, fazenda, resultado e contagem de recibos; 15 APPLIED, três REJECTED e dois abortados localmente. Auditoria offline do artefato confirmou recibo único e fazenda/domain ID correspondentes para cada APPLIED.

Final: sete Agendas remotas/vínculos, 15 recibos, três rejeições locais, fila 0 e obrigações 0. **Eventos, detalhes sanitários e movimentos de estoque = 0**, antes/depois de todos os cenários. Agenda permanece intenção; não há certificação de execução factual, carência ou aptidão.

## Preparação, alterações e verificações

Duas tentativas preparatórias terminaram antes do primeiro cenário: o helper `process` ocultava o global Node e causava `process.env` indefinido. A segunda tentativa capturou a stack sanitizada que provou a causa; helper renomeado para `processBatch`, execução posterior 9/9. Essas tentativas e seus cleanups estão preservados no artefato. **Nenhum defeito de runtime do produto foi reproduzido; nenhuma correção funcional foi necessária.**

Patch: novo fixture C06; seleção opt-in `--c06` no provisionador C05/VF4 e no dispatcher VF4; relatório/evidência; atualização delimitada de C05/C06 nos três documentos canônicos afetados. Runtime, migrations, RLS, RPC, catálogo, carência e regras técnicas inalterados. Modos C05/VF4 mantêm os caminhos anteriores.

- `node node_modules/vitest/vitest.mjs run src/lib/offline/__tests__/sanitarioV2Worker.test.ts tests/codex/c05-loopback-docker.test.mjs`: **17/17** (worker 12, adaptador 5).
- ESLint nos três MJS afetados; `node --check` do novo fixture; `git diff --check`: passaram.
- Gates documentais: executados após atualização documental, conforme registro da entrega.
- Não executados: build, suíte global, sete cenários C05, E2E amplo, F24.7 completa. Sem alteração nas superfícies de runtime que justificasse repeti-los.

## Ambiente e cleanup

Projeto próprio `sanitary-review-a39f7219`, Auth/JWT, RLS, Edge, PostgreSQL e Chromium/Dexie reais. API `127.0.0.1:55421`, DB `127.0.0.1:55422`, Vite `127.0.0.1:8181`. Adaptador Docker C05 restringe publicações antes do create; relatório registra todos os binds em loopback; rede exclusiva sem masquerade. Browser bloqueia destinos não loopback. Credenciais ficam só em memória, sem tokens/senhas no artefato.

Flags locais OFF, gates das duas fazendas OFF, browser/Vite fechados, conexão DB e Edge encerradas. Provisionador removeu projeto e rede próprios e fechou o adaptador. Consultas Docker posteriores pelas labels exatas de ownership retornaram **0 containers, 0 redes e 0 volumes**, tanto na execução final quanto nas duas preparatórias. Projetos compartilhados `GestaoAgro` e `animal-v2-1762db34` preservados.

## Limites e próxima unidade

1. Certificação delimitada a comandos sanitários de **planejamento**; não estende parcialidade a todos os domínios ou a comandos factuais/estoque.
2. Restart lógico por reload preservando IndexedDB; não certifica SIGKILL, cold start PWA sem assets, aparelho físico ou background móvel. O farm-switch é do contexto persistido usado pelo worker; composição do provider real pertence à evidência C05 integrada.
3. Não exercitou todas as combinações/conflitos/dependências/limites de tamanho de F24.7. Próxima unidade recomendada: dependências e conflito CAS dentro de um único gesto sanitário, com critérios próprios e autorização; F24.7 completa e rollout continuam separados.
