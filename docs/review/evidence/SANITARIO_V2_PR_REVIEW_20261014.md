# Sanitário V2 — Revisão final da integração e preparação de PR

Atualizado em: 2026-10-15
Verification gate: **READY para revisão da integração de código**.
Reconciliação factual remota: **certificada somente no recorte executado**.
Liberação operacional de protocolos: **não autorizada**. Não se declara READY_FOR_ROLLOUT.

## Decisão e Git

Revisados os 40 arquivos anteriores e os cinco arquivos adicionais necessários para corrigir C5. O diff final tem **45 arquivos** (30 tracked modificados e 15 novos antes do commit). O estado final foi selado por SHA-256 de cada arquivo; runtime, migration, permissões, Edge, worker, testes e limites documentais foram conferidos contra o código. O inventário de todos os arquivos do ZIP, duplicações e justificativas de destino permanece em [integração inicial](SANITARIO_V2_INTEGRATION_20261014.md).

- Branch: `codex/sanitario-v2-integracao`; baseline de integração: `dbcbee9c14d168b70b598bf46b922bee69017369`.
- Main confirmada por fetch: `1fc5b24b631cb63e53355259717f7f64c76f2da7`.
- Worktree: `C:/Users/mares/.codex/worktrees/sanitario-v2-integracao/GestaoAgro`.
- Checkout original em `4be672390b78feffa1e81fdbada7b1e14c19805c`; alteração concorrente de `.codex/config.toml` preservada. Nenhuma outra worktree foi modificada.
- Sem merge/rebase. Projeção em cópia temporária da main aplicou o patch limpo e passou 44 testes de reconnect/worker.
- Preparação autorizada de commit local e texto do PR; sem push, PR remoto, merge ou deploy.

## Defeitos e correções

| Defeito reproduzido | Correção e prova |
|---|---|
| Agenda V2 apontava para FKs do catálogo legado (23503). | Migration aditiva com referências canônicas próprias; preserva FKs/colunas e envelope legado. Pull normaliza as referências. Sete casos nativos anteriores cobrem payload antigo/replay, escopos, tenant, vínculo, exclusão e concorrência; migration/harness sem delta nesta rodada. |
| Core rejeitado deixava consumo em retry órfão. | Edge terminaliza dependência sem ledger aplicado; worker audita e preserva fato. Ledger aplicado mantém precedência no replay. |
| C5 preservava o fato, mas apagava o envelope: retry público não tinha operação disponível. | Regressão antes da correção: dois testes falharam, esperados dois envelopes e observados zero. Core/consumo ficam REJECTED, fora do loop automático; retry explícito da API usada pela UI rearma ambos atomicamente, sem alterar IDs/payloads ou reaplicar estoque local. |
| Curadoria atual/timestamp geral impediam fato retrospectivo explícito. | Regressão antes da correção: teste retornou SANITARIO_PRODUCT_CATALOG_VERSION_MISMATCH. Edge distingue executed_fact + prospective_authorization=false; não dispensa identidade, tombstone, fontes, regras técnicas ou carência. Envelopes sem esses marcadores continuam estritos. Aviso auditável no payload e UI informa fato preservado. |

A migration concede somente SELECT e UPDATE(id) nas duas tabelas canônicas ao service_role para os row locks; funções de trigger SECURITY INVOKER, search_path fixo e EXECUTE restrito. Não altera policies, grants de anon/authenticated ou privilégios dos RPCs existentes. Locks e guards impedem mudar tenant/parent de catálogo já referenciado. Não há backfill, importação ou mudança de gate no SQL. As migrations anteriores foram preservadas. Aplicação ocorreu exclusivamente no banco local descartável autorizado.

## Evidência remota canônica

[JSON observado](SANITARIO_V2_CANONICAL_REMOTE_20261014.json) contém a rodada completa, tentativas iniciais, ACKs, SQL, campos factuais, hashes e fechamento. Harness com shell HTML mínimo e módulos reais: builders → Dexie/IndexedDB Chromium → worker → HTTP → Edge autenticada → RPC/PostgreSQL → ACK/pull. SQL prepara apenas fixtures sintéticas; não substitui o aceite canônico. A UI tem teste focado separado, não certificação visual ponta a ponta.

| Cenário | Resultado observado |
|---|---|
| C1 | PASS: Evento, detalhe, animal, estoque, alvo e ACK; um fato/consumo, revisão 1, saldo 98/100. |
| C2 | PASS: replay do checkpoint durável com mesma identidade, sem duplicação. |
| C3 | PASS: persistência real com ACK perdido; retry converge sem duplicar. |
| C4 | PASS: timeout e crash real do renderer durante SYNCING; recuperação converge. |
| C5 | PASS: mudança somente curatorial aceita fato explícito. Divergência real de nome rejeita core/consumo e conserva envelopes/fato; após reparo da identidade no catálogo, API pública de retry reenvia os mesmos envelopes e converge, mantendo curadoria precisa_validar, aviso e prospective_authorization=false. Um fato/consumo, saldo 98, carências null. |
| C6 | PASS: usuários/fazendas distintas, RLS zero linhas, 403, spoof, catálogo cross-farm, farm-switch, revogação e refresh real após JWT expirado/401. |
| C7 | PASS: contextos/conexões independentes na mesma Agenda; um aplicado e um rejeitado, sem duplicar fato/estoque. |
| C8 | PASS: fato offline, fechamento/reabertura de página no mesmo IndexedDB e reconnect/login; ACK e convergência. |

Leitura SQL posterior confirmou produto, dose, unidade, via, responsável, ator, vínculos e carências null em C1/C5/C8. Em C5 confirmou também a curadoria ainda pendente e o aviso persistido. Agenda.execution_evento_id é legado; o vínculo primário é o Evento e os alvos executados.

## Validação local observada nesta revisão

| Comando/recorte | Resultado |
|---|---|
| pnpm exec vitest run: sanitarioV2Worker, syncPartialBatch, sanitary-product-evidence | 24 testes aprovados |
| pnpm exec vitest run: sanitaryAgendaExecutionV2 e Edge sanitario-v2 | 79 testes aprovados; primeira execução conjunta parou apenas a suíte UI por ausência de variáveis de ambiente |
| pnpm exec vitest run: Reconciliacao | 3 testes aprovados com URLs loopback e chave sintética para módulos mockados; avisos React Router v7 |
| pnpm exec vitest run: sanitarioV2PullCutover, sanitarioAgendaV2Pull e inventory-dependency | 17 testes aprovados |
| pnpm exec vitest run: syncWorkerRecovery | 33 testes aprovados |
| ESLint de todos os TS/TSX/MJS alterados/novos | Exit 0 |
| pnpm run build | Exit 0; chunks acima de 500 kB |
| pnpm exec tsc -p tsconfig.app.json --noEmit --pretty false | Exit 2: 241 diagnósticos contra 242 na baseline; comparação integral sem novos diagnósticos. Não se declara typecheck aprovado. |
| node scripts/codex/validate-supabase-baseline-functional.mjs | Exit 0, run e22197cf: roles, grants/policies, RLS, FKs compostas, estoque, fato e sync-batch real/partial success |
| node tests/codex/sanitario-v2-canonical.browser.mjs | Exit 0, C1–C8 PASS na rodada completa |
| Projeção main + patch: node node_modules/vitest/vitest.mjs run syncWorkerRecovery sanitarioV2Worker | 44 testes aprovados; pnpm no arquivo temporário tentou auto-instalar e falhou, então usado o runner já instalado, sem instalar dependências |

Total local desta revisão: **156 testes focados**, mais 44 na projeção da main e oito cenários canônicos nativos. As evidências anteriores (370 + 42, gate de 58 e sete testes da migration) mantêm sua data e escopo. Contrato/importador/payload candidato não mudaram nesta rodada; não foram reexecutados. Não houve regressão global nem reabertura de Animal Detail V2.

## Ambiente e fechamento

Supabase nativo exclusivo sanitario-v2-review-ea70bd7c, API/DB 127.0.0.1:56321/56322, Vite 8180; PostgreSQL 17.6, GoTrue 2.196.0, PostgREST 16.2, Edge 1.74.3, CLI 2.117.0. Seed desativado. functions serve --no-verify-jwt somente local; o handler valida auth.getUser e membership reais. Identificador de staging usado apenas como seletor efêmero local; browser bloqueou destinos externos. Nenhuma credencial entrou em logs ou documentação.

SQL confirmou zero gates habilitados e o navegador confirmou flags false. O stop da instância exclusiva retornou exit 0 e backup=true; zero containers dela permanecem ativos. GestaoAgro e animal-v2-1762db34 preservadas. Evidências externas: C:/Users/mares/AppData/Local/Temp/sanitario-v2-remote-ea70bd7c5804416680627d5e4747811b.

## Limites por etapa

1. **Integração de código: READY para revisão de PR.** Sem defeito novo demonstrado restante no recorte revisado. Typecheck global tem dívida preexistente; não foi mascarada.
2. **Reconciliação factual completa: não concluída.** C5 corrigido e certificado no caminho descrito. Envelopes já apagados por workers antigos não são reconstruídos por esta API. Clientes sem declaração retrospectiva mantêm validação estrita. Produtos excluídos, fontes/regras alteradas, correções e supersessões não receberam certificação universal nesta rodada; não usar C5 como aprovação dessas situações.
3. **Liberação operacional: não autorizada.** Sem importação/aprovação de protocolos, migration operacional, ativação de flags ou deploy. Lifecycle de página/renderer certificado, não cold start de processo/OS ou dispositivo físico.

## Inventário do diff revisável

| Arquivo | Destino/papel e revisão |
|---|---|
| `docs/domain/SANITARIO.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/SANITARIO_V2_CONTENT_CURATION_C0_1_INVENTORY.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/SANITARIO_V2_TECHNICAL_VALIDATION_QUEUE.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json` | Payload candidato/evidência; sem seed |
| `docs/review/evidence/SANITARIO_PROTOCOLS_V2_DECISION_RECORD_12F10.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/SANITARIO_V2_CANONICAL_REMOTE_20261014.json` | Payload candidato/evidência; sem seed |
| `docs/review/evidence/SANITARIO_V2_INTEGRATION_20261014.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/SANITARIO_V2_PRODUCTS_RESEARCH_20261014.csv` | Evidência documental; não importar |
| `docs/review/evidence/SANITARIO_V2_PR_REVIEW_20261014.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/SANITARIO_V2_REMOTE_REVIEW_20261014.json` | Payload candidato/evidência; sem seed |
| `docs/review/evidence/SANITARIO_V2_RESEARCH_REMEDIATION_20261014.md` | Contrato/relatório/evidência; sem ativação |
| `docs/review/evidence/SANITARIO_V2_RESEARCH_SOURCES_20261014.csv` | Evidência documental; não importar |
| `docs/review/evidence/SANITARIO_V2_SQL_DRY_RUN_20261014.json` | Payload candidato/evidência; sem seed |
| `docs/review/evidence/SANITARIO_V2_VALIDATION_REVIEW_20261014.csv` | Evidência documental; não importar |
| `scripts/codex/import-sanitario-protocols-v2.mjs` | Importador controlado; não executado operacionalmente |
| `src/components/sanitario/SanitaryAgendaExecutionConfirmV2.tsx` | Runtime; domínio, identidade e sync revisados |
| `src/components/sanitario/__tests__/SanitaryLocalAgendaPanelV2.test.tsx` | Teste/harness; escopo e limitações revisados |
| `src/lib/offline/__tests__/sanitarioV2PullCutover.test.ts` | Teste/harness; escopo e limitações revisados |
| `src/lib/offline/__tests__/sanitarioV2Worker.test.ts` | Teste/harness; escopo e limitações revisados |
| `src/lib/offline/ops.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/offline/pull.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/offline/syncWorker.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/sanitario/agenda/__tests__/sanitaryLocalAgendaManagementV2.test.ts` | Teste/harness; escopo e limitações revisados |
| `src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/sanitario/checks/__tests__/sanitaryProtocolPrecheckV2.test.ts` | Teste/harness; escopo e limitações revisados |
| `src/lib/sanitario/checks/sanitaryProtocolPrecheckV2.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/sanitario/execution/__tests__/sanitaryAgendaExecutionV2.test.ts` | Teste/harness; escopo e limitações revisados |
| `src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/sanitario/execution/sanitaryProtocolExecutionAuthorizationV2.ts` | Runtime; domínio, identidade e sync revisados |
| `src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts` | Runtime; domínio, identidade e sync revisados |
| `src/pages/Reconciliacao.tsx` | Runtime; domínio, identidade e sync revisados |
| `src/pages/__tests__/Reconciliacao.test.tsx` | Teste/harness; escopo e limitações revisados |
| `supabase/functions/sync-batch/index.ts` | Runtime; domínio, identidade e sync revisados |
| `supabase/functions/sync-batch/inventory-dependency.test.ts` | Teste/harness; escopo e limitações revisados |
| `supabase/functions/sync-batch/inventory-dependency.ts` | Runtime; domínio, identidade e sync revisados |
| `supabase/functions/sync-batch/sanitary-product-evidence.test.ts` | Teste/harness; escopo e limitações revisados |
| `supabase/functions/sync-batch/sanitary-product-evidence.ts` | Runtime; domínio, identidade e sync revisados |
| `supabase/migrations/20261015070038_sanitario_agenda_catalog_v2_references.sql` | Migration aditiva; FK, tenant, locks e ACL revisados |
| `tests/codex/sanitario-v2-canonical.browser.mjs` | Teste/harness; escopo e limitações revisados |
| `tests/codex/sanitario-v2-catalog-reference.integration.mjs` | Teste/harness; escopo e limitações revisados |
| `tests/codex/sanitario-v2-contract.test.mjs` | Teste/harness; escopo e limitações revisados |
| `tests/codex/sanitario-v2-pglite.integration.mjs` | Teste/harness; escopo e limitações revisados |
| `tests/codex/sanitario-v2-publisher.test.mjs` | Teste/harness; escopo e limitações revisados |
| `tests/codex/sanitario-v2-remote-factual.integration.mjs` | Teste/harness; escopo e limitações revisados |
