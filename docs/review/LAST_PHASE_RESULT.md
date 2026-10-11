# Resultado funcional mais recente — Entregas comerciais B / C / E / D

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
