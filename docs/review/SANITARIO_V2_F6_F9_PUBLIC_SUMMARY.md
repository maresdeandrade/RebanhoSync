# Sanitário V2 — resumo público F6–F9

Este documento resume as evidências históricas F6–F9 preservadas em material operacional privado. A correção para integração pública não executa importação nem consulta remota. O [recibo público reduzido](evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json) é um derivado por seleção explícita de campos, separado do original.

## Resultado histórico documentado

- F6: preparação de 39 produtos comerciais para revisão; três candidatos retidos fora do payload.
- F7: certificação local do escritor canônico, incluindo concorrência, replay e rollback. Esses resultados são históricos e não foram repetidos nesta correção documental.
- F8: preparação do caminho comercial com autorização explícita, destino remoto verificado, TLS e guarda create-only também dentro da transação.
- F9: recibo com **39 inserções, 0 UPDATE, 0 skip e 0 reject**; total verificado após a publicação: **42 produtos**, com os três anteriores preservados. ACK: `F6 commercial products apply OK`; exit code: **0**.

As verificações históricas agregadas registram persistência dos produtos, ausência de duplicidades, estado ativo, revisão curatorial pendente, preservação do estado protegido e do contrato de schema, TLS verificado e convergência do plano somente leitura. Não houve replay remoto de escrita.

## Integridade dos artefatos

| Artefato | SHA-256 |
|---|---|
| Arquivo payload F6 | `c2ff9fb6b3df3cfc6df668a1fdccd374a3a0ed39abc7f6636d6622c3b7ff159a` |
| Conteúdo canônico F6 | `a777233b2d8083d4d1b89c93947df74cec210a9ef8571576dbd35dcbac3b84e1` |
| Publicador usado na F9 | `61cf2a8076746c255af6153b54ef4a040e640ef16dcc9dd4434037ae7b4b65f5` |

O payload F6 e o publicador foram preservados nesta correção. Os hashes foram conferidos localmente contra o recibo original.

## Limitações curatoriais e da evidência

Os produtos continuam `precisa_validar`; os importados são de revisão, sem aprovação operacional. O cadastro não comprova regularidade regulatória, registro vigente, composição, apresentação, autorização por espécie, dose, via ou carência. Não autoriza seleção automática, planejamento, agenda, estoque ou execução operacional. Os três candidatos retidos permanecem fora do lote.

As comparações históricas de snapshots não auditam transações concorrentes intermediárias. A evidência pública é agregada; a rastreabilidade operacional detalhada permanece nos originais privados. Não há nova certificação do estado remoto nesta correção.

## Allowlist exata para integração pública

Selecionar somente estes arquivos, sem staging de diretórios inteiros:

```text
docs/review/SANITARIO_V2_F6_F9_PUBLIC_SUMMARY.md
docs/review/evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json
docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json
scripts/codex/import-sanitario-protocols-v2.mjs
scripts/codex/prepare-sanitario-products-f6.mjs
tests/codex/sanitario-v2-publisher.test.mjs
```

O publicador e o preparador reutilizam `sanitario-v2-contract.mjs`, já versionado. Os demais imports e fixtures dos testes também são versionados no baseline. Os testes leem diretamente o payload F6; o preparador recebe as entradas F5 por argumentos e gera payload/matriz, mas não é necessário executá-lo para consumir o payload publicado. As entradas privadas e a matriz gerada não são dependências de execução dos testes. Não regenerar o payload durante esta integração.

Excluir todo o restante do working tree: `.tmp/**`, `supabase/.temp/**`, relatórios originais F6/F7/F8/F9, recibo operacional original, matrizes, consultas auxiliares, logs, dumps, demais evidências e alterações concorrentes. Preservar esses arquivos localmente. Esta allowlist não autoriza staging, commit, push, merge, deploy ou execução remota.

## Validação da correção pública — 2026-10-24

`node --check` e ESLint focalizados passaram para publicador, preparador e teste do publicador. `git diff --check` passou. A única mudança no teste foi a substituição da referência real de projeto por identificador sintético, preservando os cenários existentes.

O comando `pnpm exec vitest run --maxWorkers=1 tests/codex/sanitario-v2-publisher.test.mjs` falhou na inicialização por `spawn EPERM` no esbuild. A alternativa suportada `--configLoader runner` também falhou por `spawn EPERM` no Vite. Nenhum teste foi coletado ou aprovado nesta correção. Não foram repetidas as validações funcionais ou remotas históricas.

**NEEDS_CORRECTION:** a allowlist está delimitada, mas a execução dos testes focados precisa ser concluída em ambiente que permita os subprocessos exigidos pelo Vitest antes de classificar o delta como `READY_TO_STAGE`.

## Complemento de fechamento documental do gate — 2026-10-24

Conforme relato do operador, a validação posterior foi concluída fora do sandbox, com **192/192 testes aprovados**. Esses testes não foram reexecutados pelo revisor; sua revisão se limitou às verificações locais de sintaxe, payload e diff, aprovadas conforme o baseline informado para este fechamento.

O gate final Superpowers classificou os **seis arquivos da allowlist** como **READY_TO_STAGE**, conforme o resultado informado para a branch `codex/sanitario-f9-public-integration`. Esse é o status atual da integração pública; o `spawn EPERM` e o `NEEDS_CORRECTION` acima permanecem como registro histórico da tentativa anterior, cuja pendência de execução foi superada pela validação posterior relatada pelo operador.

Este complemento é exclusivamente documental: não altera payload ou hashes, não representa recertificação remota e não repete testes funcionais. O status `READY_TO_STAGE` não autoriza staging, commit, push, merge, deploy ou execução remota.
