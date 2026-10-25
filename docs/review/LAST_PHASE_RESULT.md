# Resultado mais recente — integração pública Sanitário V2 F6–F9

Atualizado em: 2026-10-25 (America/Sao_Paulo)
Baseline pós-merge: `origin/main@0e7f5137a865f2671d035e51d624609a563e441e`
Main atual consultada na revisão final: `origin/main@20fd5c6fbd7cfbccf1d3db1446cf8a8e3fd60aaa`; HEAD da worktree documental mantido em `0e7f5137`, sem merge/rebase.
Decisão: **F9 / INTEGRAÇÃO PÚBLICA F6–F9 = CLOSED / INTEGRATED**, sem encerrar todo o Sanitário V2.

## Resultado confirmado do PR #244

- [PR #244](https://github.com/maresdeandrade/RebanhoSync/pull/244) `MERGED` em 25/10/2026 às 14:24:49 (America/Sao_Paulo), merge `0e7f5137a865f2671d035e51d624609a563e441e`, head integrado `00f42b6804ce1cb8a4329daf6a45d13c4e607551`. Merge presente na `origin/main` após fetch.
- Quatro commits: `f650e6a` (integração), `31a311b` (entrypoint Fallow), `6270592` (guard antes da leitura) e `00f42b6` (manifests temporários de closure nos testes).
- Oito arquivos integrados: `.fallowrc.json`, `docs/review/SANITARIO_V2_F6_F9_PUBLIC_SUMMARY.md`, `docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json`, `docs/review/evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json`, `scripts/codex/import-sanitario-protocols-v2.mjs`, `scripts/codex/prepare-sanitario-products-f6.mjs`, `tests/codex/sanitario-v2-publisher.test.mjs` e `tests/codex/sanitario-v2-closure-preparation.test.mjs`.
- O [recibo público histórico](./evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json) registra 39 produtos criados e 42 totais após a publicação, zero UPDATE/skip/reject. Não é uma leitura atual do banco. Produtos continuam sujeitos à revisão curatorial, sem autorização operacional; três candidatos retidos fora do lote.

## Evidências observadas e limites

`gh pr view 244`, `gh run view 40215999700`, `gh run view 40215999663`, `git fetch origin`, `git diff 0e7f513^1 0e7f513 --name-status` e `git merge-base --is-ancestor` confirmaram merge, escopo e checks. [Required validation](https://github.com/maresdeandrade/RebanhoSync/actions/runs/40215999700) e [Fill PR description](https://github.com/maresdeandrade/RebanhoSync/actions/runs/40215999663): SUCCESS. Na validação final do PR: lint, Fallow, integridade e gates documentais passaram; Vitest incremental de closure 6/6, build skipped. Esse run não comprova aprovação da suíte global ou build do head final.

As correções anteriores tiveram 221/221 testes locais focados aprovados nesta conversa, além de sintaxe, ESLint e diff check nos respectivos escopos. Não foram repetidos neste fechamento documental. Também não foram reexecutados VF1–VF5, homologação, publicação dos 39 produtos ou consultas Supabase. Não houve mudança funcional, migration, deploy ou rollout nesta atividade.

## Continuidade

O [handoff pós-F9](./CURRENT_PHASE_HANDOFF.md#sanitário-v2--continuidade-pós-f9--25102026) distingue integração, curadoria e certificação funcional parcial, com proposta da próxima execução. A main avançou pelo [PR #245](https://github.com/maresdeandrade/RebanhoSync/pull/245), merge `20fd5c6f`, com proteção da seleção de fazenda no provider e isolamento de Insumos; código/testes desse delta foram consultados via `origin/main`, sem alterar a base da worktree. Seus checks obrigatórios passaram, incluindo teste/build no [CI #245](https://github.com/maresdeandrade/RebanhoSync/actions/runs/40217452023). O handoff passa a reutilizar essas entregas, sem registrá-las como pendências nem atribuir certificação sanitária integrada ao CI. [Pendências prioritárias](./OPEN_REVIEW_ITEMS.md#sanitário-v2--pendências-pós-f9) permanecem abertas. F24.6 e o plano ativo mantêm seus estados anteriores; nenhuma próxima fase foi iniciada. Relatórios históricos e recibos F6–F9 foram mantidos.

## Registro anterior preservado — Entregas comerciais B / C / E / D

Atualizado em: 2026-10-11 (America/Sao_Paulo)
Baseline da implementação integrada: `main@b65db318342d36dd42144c7ae0b300676ebe3476`
Decisão final: **B/C/E/D INTEGRADOS — ENTREGA ENCERRADA**

## Resultado confirmado

| Entrega | PR | Estado | Merge commit |
|---|---|---|---|
| B — Peso de aquisição | [#192](https://github.com/maresdeandrade/RebanhoSync/pull/192) | MERGED | `b004207bb1fd22716d9b33e88c3b243271e52837` |
| C — Mobile action bar | [#193](https://github.com/maresdeandrade/RebanhoSync/pull/193) | MERGED | `2f8e618452c753c4787f3182735e2d2b4165b195` |
| E — Responsividade dos seletores | [#194](https://github.com/maresdeandrade/RebanhoSync/pull/194) | MERGED | `35df487c2b21b3e98fc27fdd255cf82b80748140` |
| D — Simulação Comercial | [#195](https://github.com/maresdeandrade/RebanhoSync/pull/195) | MERGED | `b65db318342d36dd42144c7ae0b300676ebe3476` |

B preserva peso e valor factuais de aquisição por animal. C organiza a action bar mobile;
E impede overflow dos seletores. D adiciona Simulação como quarta opção, reaproveita os
cálculos existentes e restaura os dados anteriores, sem persistência factual. Os guards
de B e a responsividade de C/E estão na base de D e não foram duplicados em seu delta.

## Arquivos afetados

- `src/lib/comercial/animalCommercialHistory.ts` e seu teste;
- `src/lib/comercial/commercialOperationCommand.ts` e `commercialOperationCommandV2.test.ts`;
- testes offline `commercialPurchasePull`, `commercialPurchaseSyncWorker`, `factualDetailsPull` e `syncWorkerAtomicAck`;
- `src/pages/AnimalDetalhe.tsx` e seu teste;
- `src/pages/Registrar/index.tsx`;
- `src/pages/Registrar/createRegistrarFinalizeController.ts` e seu teste;
- componentes `RegistrarComercialSection`, `RegistrarSociedadeSection` e `RegistrarStickyActionBar`, com testes dos dois primeiros;
- este registro de continuidade, atualizado após a integração.

## Evidências e comandos observados

- Validações anteriores: B 126 testes, C 6, E 21 e D 60 aprovados; lint/build aprovados nos respectivos escopos.
- Composição local já comprovada: `BCD_INTEGRATION_VERIFIED`; 320 px, 390 px e desktop aprovados, overflow 0 px. Essas baterias não foram repetidas pela integração.
- B: ajuste mínimo autorizado para o Fallow em três arquivos, preservando comportamento. Fallow passou; 66 testes existentes dos arquivos afetados, lint e `git diff --check` passaram.
- D: atualização sobre B/C/E; resolução do conflito de layout preservou o grid de quatro opções e o wrap do escopo. Extração local da condição de seleção para o Fallow; 25 testes existentes do componente, lint e Fallow passaram. Nenhum novo teste foi criado nesse fechamento.
- `git diff origin/main...HEAD --stat`, `--name-only` e `git diff --check` confirmaram delta final de D em dois arquivos, exclusivamente Simulação.
- Todos os merges ocorreram após os checks existentes verdes. `Required validation` de B: run `38110502841`, aprovado; D: run `38111205875`, aprovado. C/E também foram integrados com checks verdes.
- `git fetch origin` e consulta aos quatro PRs confirmaram os estados MERGED e a baseline acima.

## Limites e pendências finais

- Backend remoto específico não recertificado.
- Teclado físico Android/iOS não certificado.
- TypeScript global permanece baseline independente.

Esses limites conhecidos não bloqueiam o fechamento e não originam nova fase desta
entrega. Nenhum comando de deploy de produção foi executado. Não há pendência de
integração de B/C/E/D nem próximo passo de QA para essas entregas. Este registro não
altera o estado da Fase 24 ou de suas trilhas independentes.

## Registro anterior preservado — F24.3 / Offline Recovery

Atualizado em: 2026-09-23
Baseline auditada para o closeout: `main@ddd1ba3c2a5fb8055027723c0b9b3c83abe449d5`
Decisão final: **F24.3 CLOSED**

## Resultado

O [closeout canônico](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md) confirma farm-aware replace,
reconciliação de fazenda não ativa, ownership legado fail-closed, reset explícito de
`UNKNOWN`, retry genérico/HTTP 429/reconnect e restart lógico com fila heterogênea multi-farm.

## Validação técnica

- suíte focada F24.3 reexecutada: 12 arquivos, 62 testes, aprovada;
- restart certificado: reabertura Dexie no mesmo processo;
- `REAL_PROCESS_KILL = NOT_PROVEN` e mantido como dívida E2E futura;
- gates documentais e `git diff --check` pertencem ao patch de closeout.

## Guardrails confirmados

- nenhuma nova fonte de verdade, migration, RLS, RPC ou alteração de produção;
- Agenda, Evento, `state_*` e Protocolo mantêm seus papéis;
- offline-first, idempotência, pending work, reconciliação e isolamento por fazenda/ownership
  permanecem preservados.

## Próximo estado

`NEXT = F24.4A — Conflict Inventory / Characterization`. A fase não foi iniciada por este
fechamento.
