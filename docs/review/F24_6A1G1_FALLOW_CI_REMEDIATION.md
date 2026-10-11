# F24.6A1-G1 — Fallow CI Remediation

Data: 2026-10-11. Decisão: **BLOCKED_WITH_REASON**.

## Baseline e evidência

Branch `codex/f24-6a0-benchmark`; HEAD
`1a78ba1bafd67b9dac9892d43c4706bc8afc730c`; referência `origin/main`
`117f3bfe5fc88c57ae2c58bb25dab694567075da`. Worktree dedicada, inicialmente
limpa. PR #196, execução CI `38141948498`, job `114477431018`.
Sem commit, push, merge, deploy ou alteração de backend nesta remediação.

Fallow 3.17.0, `.fallowrc.json` do repositório e base fixada por
`FALLOW_AUDIT_BASE=117f3bfe5fc88c57ae2c58bb25dab694567075da`.
O CI analisou 36 arquivos no checkout preparado; a reprodução inicial local
analisou os 35 arquivos publicados. Base e atribuição foram conferidas;
essa diferença de contagem não é evidência de arquivo adicional no PR.

| Atribuição do JSON | Antes | Depois |
|---|---:|---:|
| Dead code introduzido | 21 | 0 |
| Dead code herdado | 5 | 5 |
| Complexidade introduzida | 2 | 2 |
| Complexidade herdada (campo de atribuição) | 6 | 6 |
| Duplicação introduzida | 0 | 0 |
| Duplicação herdada | 5 | 5 |
| Verdict / exit do Fallow | fail / 1 | fail / 1 |

## Descoberta dos dez arquivos

Oito entradas exatas foram acrescentadas; nenhum glob ou ignore novo.
Seis são executáveis CLI, dois são módulos carregados pelo browser via Vite.
Helpers continuam descobertos por imports, não por inclusão indiscriminada.

| Arquivo em scripts/codex | Caminho real de execução / descoberta |
|---|---|
| performance-baseline.mjs | CLI; também subprocesso do provisionador e da série P0 |
| performance-isolated-backend.mjs | CLI do provisionador certificado |
| performance-p0-series.mjs | CLI da série storage/queue |
| performance-p0-report.mjs | CLI de análise P0 |
| performance-diagnostic-report.mjs | CLI de análise de diagnóstico |
| performance-post-ack-report.mjs | CLI de análise A/B |
| performance-browser.ts | import absoluto /scripts/codex no page.evaluate/Vite |
| performance-post-ack-proof.ts | import absoluto /scripts/codex no page.evaluate/Vite |
| performance-local-fixture.mjs | import estático dos runners/provas; não é entrypoint |
| performance-post-ack-proof.mjs | import relativo dinâmico do baseline; não é entrypoint |

Os nove exports reportados dentro de arquivos não alcançáveis são usados pelo
harness e foram preservados. `P0_DATASETS` não possui consumidor; os workloads
efetivos já são definidos pela série P0. Sua declaração redundante foi removida.
`code` é usado somente por `receiptSummary` no próprio módulo de diagnósticos;
apenas `export` foi removido, mantendo a função e a sanitização.

## Complexidade introduzida: bloqueio preservado

| Função | Arquivo / linha | Ciclomática | Cognitiva |
|---|---|---:|---:|
| pullDataForFarm | src/lib/offline/pull.ts:658 | 38 | 30 |
| selectPostAckAnimalObservation | src/lib/offline/syncWorker.ts:76 | 37 | 8 |

Ambos possuem `introduced: true` e continuam reprovando o gate. Não foram
suprimidos nem reclassificados. Os hashes E1 dos dois módulos e dos dois testes
permanecem iguais (4/4). Uma extração ou mudança nesses módulos altera esses
hashes; essa parte foi interrompida para preservar a restrição da tarefa.
Não há autorização implícita para refatorar os hotspots ou enfraquecer thresholds.

## Findings herdados, fora do escopo

Dead code: `@tailwindcss/typography`, `pg-mem`, `tailwindcss-animate`, `pg` e
`tailwindcss` nos grupos de dependências do JSON; todos `introduced: false`.
Nenhuma dependência foi removida, movida ou ignorada.

Todos os cinco grupos de duplicação em `pull.ts` / `syncWorker.ts` têm
`introduced: false`. Nenhuma extração foi feita por esses grupos.
Os demais hotspots individuais têm `introduced: false`, incluindo
`processSanitarioCanonicalResults`, `getPendingRecordIds`,
`pullSanitarioTechnicalCatalogV2`, `appendEventoAnimais` e callbacks existentes.
O campo agregado de atribuição registra seis findings herdados de complexidade;
a lista detalhada também contém callbacks herdados. Não tratar ausência de
atribuição introduzida como evidência de correção desses hotspots.

## Validação e limites

- `node --test` nos quatro arquivos `tests/codex/performance-*.test.mjs`:
  10 testes aprovados.
- ESLint direcionado aos dois módulos MJS modificados: aprovado.
- `node --check` nos dois módulos MJS e `git diff --check`: aprovados.
- `pnpm --config.verify-deps-before-run=false run gates:docs`: aprovado.
- JSON antes/depois: `node node_modules/fallow/bin/fallow audit --gate new-only
  --format json`, com a base fixa acima. Falha residual exclusivamente nos dois
  hotspots introduzidos de complexidade; nenhum unused file/export residual.
- O primeiro `pnpm exec` tentou instalação automática e foi bloqueado pela
  junction de dependências compartilhadas; não houve instalação. O fallback
  utiliza o mesmo Fallow 3.17.0 já instalado. Avisos de ausência de node_modules
  no snapshot temporário da análise foram observados e preservados.
- `pnpm --config.verify-deps-before-run=false exec fallow audit --gate new-only`,
  com a mesma base fixa: exit 1, zero dead code introduzido e os dois hotspots
  residuais. A opção do pnpm evita somente reinstalação das dependências; não
  altera gate, configuração ou thresholds do Fallow. Log local complementar:
  `test-results/f24-6/f24-6a1-g1-fallow-pnpm.txt`.
- Não repetir A/B: shapes, fluxo, sanitização, limites e fontes funcionais
  preservados. Os resultados históricos continuam vinculados aos hashes
  originais do harness; não relabelar esses artifacts com os hashes novos.

JSONs locais complementares preservados em
`test-results/f24-6/f24-6a1-g1-fallow-before.json` e
`test-results/f24-6/f24-6a1-g1-fallow-after.json`.
O PR remoto permanece no HEAD original. Não está pronto para CI revalidation
enquanto os dois blockers de complexidade permanecerem sem resolução autorizada.
