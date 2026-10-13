# RebanhoSync — F24.6A1: certificação reconnect 1k e fechamento

Atualizado em: 2026-10-13
Certificação executada em: 2026-10-12
Status: **F24.6A1 = CERTIFIED; integração administrativa pendente do merge**
Efeito deste pacote na main após merge: **F24.6A1 = CLOSED / INTEGRATED**, somente no envelope certificado.
Baseline de produto: `869f006679827f3baddb0afed3c3cbf22e976fa5`

## 1. Decisão e escopo

**FATO CONFIRMADO:** smoke de 10 gestos e cinco runs consecutivos de 1.000 gestos válidos, com a implementação integrada e fontes congeladas. A série certificada não reutiliza resultados das tentativas de preparação anteriores. Nenhum código de produto foi alterado.

Perfil: RECONNECT / WARM / INTEGRATED; 1.000 animais, duas fazendas com 500 animais cada, agenda vazia, uma operação UPDATE de observações por gesto. `createGesture`, `processGesture`, pull e reconciliação são os caminhos reais do produto. Contexto Chromium e fixtures novos por run; backend exclusivo permanece estável entre runs. Sem execução paralela, A/B ou 10k.

A decisão vale para esta execução local e baseline. Não constitui certificação de produção, 10k ou capacidade geral.

## 2. Baselines, hashes e ambiente

Main remota confirmada no início e no fechamento: `869f006679827f3baddb0afed3c3cbf22e976fa5`. PRs #196 e #198 integrados na cadeia first-parent. Baseline histórica E1/E2 preservada: `3b3bc96db331c2917167cf8370024332f505d9f7`.

Worktree técnica dedicada: `C:/Users/mares/.codex/worktrees/f24-6a1-reconnect-certification/GestaoAgro`; HEAD da execução detached na baseline; publicação administrativa na branch `codex/f24-6a1-reconnect-certification`. Checkout original e branches/worktrees concorrentes preservados.

Node v22.15.0; pnpm 11.23.0; Chromium 153.0.8010.12; Supabase CLI 2.117.0; Docker 29.8.0; dependências: {"dexie":"4.3.0","vite":"6.4.2","@playwright/test":"1.63.0"}. PostgreSQL 17.6.

Manifest agregado do executor (SHA-256): `3a23f64abab169d948c369ab96b8efd18e5462d0d315339d0937724d7795f9a2`. Os cinco runs têm exatamente o mesmo hash; os hashes individuais foram reconferidos após a série.

Fontes efetivas de produto (SHA-256):

| Arquivo | Hash |
|---|---|
| src/lib/offline/pull.ts | `06125a2bfb93f586687e3c235065f6851640d6fc9e8e4e675736f4c5f92eb678` |
| src/lib/offline/syncWorker.ts | `5433e3c6f8fb4a93378ab7c3e97e7b847d12c9d6dd59b03439b13834acd0e040` |

Objetos Git congelados; tree/blob identifica todo o conteúdo do caminho na baseline:

| Caminho | Objeto Git |
|---|---|
| src | `8e2e925f19f833e0eb217c1c29d588c8793cf813` |
| supabase | `5b28a6a514f8766f38cd57dfe198a93434255e49` |
| package.json | `66b5b733fb2f4fc97b9605b740e1cdead8bf93ce` |
| pnpm-lock.yaml | `060313ecd93b0e70b92d06a56bb97f28a5d24b66` |
| vite.config.ts | `ca232f829992f20a909af2cf69e8cef7a9e5bedd` |

Harness e auxiliares (SHA-256):

| Arquivo | Hash |
|---|---|
| performance-isolated-backend.mjs | `2374748cf8a692c7ee841256bb465b48f688de690cc7ba12198198b4ab559558` |
| performance-baseline.mjs | `e35cc4a4e9e1ad887e954b2c5954f9943f5313c6812d4d13664f58630bf5e10e` |
| performance-browser.ts | `70c6ee9d297d73b7d9a5befcd55eee7b326460e1cf881ab6c022e102df6525f5` |
| performance-contract.mjs | `b09eff9e055f09409c9dd407d2adc2794c09ccb71a906b0d24642a4658c5a808` |
| performance-local-fixture.mjs | `ca6a3fd13f39c8562019856ca945a3e3699dfd23fe8a6b90bc7440547b50db31` |
| performance-diagnostics.mjs | `fe7c9e698534a7575783bb7a7b5419bc22594a00752ed597adea46cf436c5772` |
| performance-seed-diagnostics.mjs | `beefe8451b87f590fbc67b8367f7d6a67374e565aeb3722036ef6c359244db1f` |
| performance-post-ack-proof.mjs | `b0d9168376d791a2c93899b2517da209b462801f0649bb0f5b955ad54a12959b` |
| performance-post-ack-proof.ts | `a5d6c887dcc54a8c8a5a91002844de204365d1efbcfeec0e74d0aa70d7925f72` |
| performance-integrated-contract.mjs | `ed82ef150172c46978c1a86ac721138e14e6cd6952319c5bbee3520c2352c3f1` |

Manifests históricos na worktree `f24-6a0-benchmark/GestaoAgro/test-results/f24-6`: hashes comparados antes do fechamento e reconferidos, sem alterações. Nenhum artefato E1/E2 foi sobrescrito.

| Manifest | SHA-256 |
|---|---|
| f24-6a1-e1-delivery-manifest.json | `d256a0734281245b0f420c14d6710d368388738126f5ff37f34cd6ac83d8a8a5` |
| f24-6a1-e1-patch-manifest-v1.json | `bc75d761e9e89bd8dddf91d35661a3c7b388b47190f4899f8db0cf18b065af0a` |
| f24-6a1-e1-patch-manifest.json | `707e3baaba036c641b8aabaa2ac70c489a55ac05af21417d032ad31388f7aff7` |
| f24-6a1-e2-delivery-manifest.json | `df2f71dd49dc43b100d2e6d2963a0abb222a9cfad2fc0a6427266e0fce8b16e2` |
| f24-6a1-e2-preserved-manifest.json | `fae0a0e8a0628e1efa2102535288c60caadbfee189af290cfb22f7dcc842af5f` |

## 3. Patch e arquivos alterados

| Arquivo | Alteração |
|---|---|
| scripts/codex/performance-contract.mjs | Seleção explícita historical/integrated; default histórico preservado. |
| scripts/codex/performance-integrated-contract.mjs (novo) | Baseline integrada fixa, envelope exclusivo, guards Git, budgets, deadline, readiness, verificação remota e aceite fail-closed. |
| scripts/codex/performance-baseline.mjs | Manifest integrado, observação/limites em execução, verificação local-remota e cleanup após interrupção. |
| scripts/codex/performance-browser.ts | Agenda vazia, identidade/escopo da fila, ACK APPLIED por gesto e snapshots locais para comparação remota. |
| scripts/codex/performance-local-fixture.mjs | Snapshot de revisão inicial e leitura SQL remota de integridade antes de excluir fixtures. |
| scripts/codex/performance-isolated-backend.mjs | Modo exclusivo --integrated-reconnect-1k, smoke + cinco runs sequenciais, readiness do handler e interrupção no primeiro erro. |
| tests/codex/performance-integrated-contract.test.mjs (novo) | Baselines, guards reais Git, restrições, limites, Chromium/IDB após interrupção, bigint e rejeição de evidência incompleta. |
| docs/review/F24_6A1_RECONNECT_1K_CERTIFICATION.md (novo) | Este relatório único. |
| docs/review/evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip + INDEX.json (novos) | Cópias auditáveis e hashes das evidências originais. |
| PROJECT_STATUS, ROADMAP, ACTIVE_PHASE_PLAN, CURRENT_PHASE_HANDOFF, OPEN_REVIEW_ITEMS | Snapshots vigentes reconciliados com a certificação; histórico preservado. |
| .github/workflows/antigravity-validate.yml | Provisionamento do Chromium existente no Playwright para o teste real de cleanup. |

Diff do harness observado na execução certificada (snapshot histórico):

```text
59	10	scripts/codex/performance-baseline.mjs
20	2	scripts/codex/performance-browser.ts
2	1	scripts/codex/performance-contract.mjs
56	7	scripts/codex/performance-isolated-backend.mjs
8	1	scripts/codex/performance-local-fixture.mjs
```

[Patch completo, incluindo arquivos novos](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-1k-harness.patch`).. Nenhuma mudança em src, schema, migrations, RLS, RPCs, dependências ou lockfile.

## 4. Ambiente isolado e limites

Projeto exclusivo `f24-6a0b-05f15053`, portas 55320/55321/55322/55323/55324/55325/55327/55329/55383. 60 migrations canônicas copiadas e histórico exatamente alinhado; hashes por migration no manifest de execução. Schema, inventário RLS, privilégios, retenção/cron, Auth, PostgREST e sync-batch verificados. Validador funcional terminou com exit 0, incluindo owner, papéis, outsider, replay idempotente e sucesso parcial.

Recursos no preflight: host livre 1467,70MiB; host total 16088,05MiB; Docker total 7791,14MiB. Disponibilidade das portas confirmada antes do start. Disco livre observado no preflight: cerca de 40GiB. Nenhum benchmark/build/teste pesado concorrente foi identificado no inventário dirigido de processos antes da série.

| Limite | Aplicação observada |
|---|---|
| Workload 240s | Deadline Node independente fecha a página; guards no browser e checagem final. |
| Child 300s | Timeout do processo filho cobre preparação, workload e cleanup; todos retornaram exit 0, sem signal. |
| 4.000 requests | Contador HTTP do backend no workload; interrupção ao ultrapassar o limite. |
| 600MiB recebidos | Contador de bytes dos corpos HTTP do backend, com interrupção e checagem final. |
| Heap referência 512MiB | JSHeapUsedSize via CDP aproximadamente a cada 250ms, mais guards no browser e checagem final. |

Tempo, requests, pulls, bytes e heap apresentados abaixo são do workload medido. Preparação/seed e cleanup têm tempos separados. Bytes são corpos HTTP observados, sem headers/overhead físico de transporte; heap é amostrado no Chromium, não RSS total do host ou backend. Esses limites e observadores permaneceram iguais nos cinco runs.

## 5. Smoke e cinco runs

Smoke: 10/10 ACKs, 1,20s; 36 requests, 26 pulls, 28766 bytes recebidos, heap máximo observado 13,08MiB. Convergência 5/5, backlog=0, obrigações=0, retries=0, erros=0, cleanup IDB/fazendas/usuário completo.

| Run | Workload (s) | ACKs | Requests | Pulls REST | Bytes recebidos | Heap observado (MiB) | Retry/erro/timeout | Integridade + cleanup |
|---|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 149,44 | 1000 | 3006 | 2006 | 2876384 | 53,06 | 0/0/0 | PASS |
| 2 | 145,10 | 1000 | 3006 | 2006 | 2876372 | 55,21 | 0/0/0 | PASS |
| 3 | 146,46 | 1000 | 3006 | 2006 | 2876333 | 53,17 | 0/0/0 | PASS |
| 4 | 147,39 | 1000 | 3006 | 2006 | 2876318 | 53,08 | 0/0/0 | PASS |
| 5 | 146,33 | 1000 | 3006 | 2006 | 2876315 | 55,30 | 0/0/0 | PASS |

Latências e custos observados:

| Run | ACK limite superior (s) | Headers HTTP mediana (ms) | Corpo HTTP mediana (ms) | CPU TaskDuration (s) | Seed/preparação (s) | Cleanup (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 147,33 | 63,47 | 65,34 | 28,55 | 11,74 | 372,93 |
| 2 | 143,12 | 63,05 | 64,92 | 28,54 | 11,10 | 412,45 |
| 3 | 144,30 | 64,56 | 66,48 | 28,54 | 11,34 | 295,14 |
| 4 | 145,36 | 63,87 | 65,93 | 28,84 | 11,43 | 349,34 |
| 5 | 143,96 | 63,34 | 65,25 | 28,96 | 11,20 | 399,98 |

ACK limite superior inclui processamento do gesto, instalação local e refresh inline. Request→headers/body é medido pelo observador do harness e inclui gateway, Edge, banco, transporte local e scheduling. Não representa latência física de rede isolada. As medianas HTTP descrevem as 1.000 respostas sync-batch dentro de cada run; não são amostras independentes de capacidade.

Estatística descritiva dos cinco workloads completos: mediana **146,46s**; mínimo 145,10s; máximo 149,44s; amplitude 4,33s; desvio absoluto mediano 0,93s. n=5; p95/p99 não estimados. Sem comparação A/B, ganho percentual ou inferência de SLO.

## 6. Falhas preservadas e correções

1. Primeira preparação: `FUNCTIONAL_CERTIFICATION_FAILED`, sync-batch autenticado retornou 502. [Artefato original](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `f24-6a0b-6cfb1118/certification.json`).. Nenhum smoke/run 1k foi executado. Cleanup e compartilhado preservados.
   FATO: o guard aceitava 401 do gateway sem provar carregamento do handler. A reprodução diagnóstica com as mesmas fontes passou no validador funcional após a inicialização. Correção: exigir 401 com a resposta específica do handler usando JWT anon válido. Não houve mudança de autenticação, RLS ou tempo máximo de readiness. INFERÊNCIA: prontidão prematura contribuiu para o 502; a causa interna exata do upstream original não foi capturada.

2. Segundo ambiente: smoke chegou a 10 DONE/APPLIED, fila=0, operações=0, sem erro/reenvio HTTP, mas o verificador adicionando revisão falhou com `REMOTE_CONVERGENCE_FAILED`. [Artefato original](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `f24-6a0b-ecc5e21c/certification.json`).. Cleanup completo; nenhum run 1k executado.
   FATO: migration define revision como bigint; o parser pg int8 devolve string. O verificador calculava "1" + 1 = "11" e comparava string SQL com número do browser. Corrigida apenas a normalização segura no harness; testes rejeitam revisão incorreta/fora de safe integer, duplicidade, fazenda divergente e snapshot local stale. Produto e migrations preservados.

Após as correções do harness, fontes novamente congeladas, smoke refeito e cinco runs novos executados. Todos os runs de 1k pertencem ao último manifest; não houve run de 1k falho repetido ou reaproveitamento de amostras entre manifests.

## 7. Isolamento, convergência e cleanup

- Em cada run: exatamente 1.000 DONE/APPLIED, uma operação por gesto, nenhum reenvio; backlog=0 e obrigações=0.
- IDs e fazenda_id comparados contra fixture congelada. SQL remoto e estado Dexie comparados por id, fazenda, observações, revision, client_op_id e client_tx_id; revisão remota avançou exatamente uma vez, sem IDs de operação/transação duplicados.
- Duas fazendas com 500 registros cada e nenhum animal extra/faltante; agenda local e remota vazias. RLS por papel/outsider e replay exercitados pelo validador funcional no backend próprio.
- Cada run excluiu e verificou IndexedDB, fazendas da fixture e usuário Auth; contexto e processo encerrados normalmente.
- Final: cleanup_verified=true; preexisting_resources_unchanged=true; shared_schema_history_unchanged=true; stop_exit=0. Nenhum container/volume/rede com o identificador do projeto permaneceu. Os dois ambientes anteriores também foram removidos e verificados.

## 8. Validações e Git

Validações executadas:

- `pnpm install --frozen-lockfile`: exit 0, lockfile preservado, sem dependência nova.
- `pnpm test -- tests/codex/performance-contract.test.mjs tests/codex/performance-integrated-contract.test.mjs tests/codex/performance-diagnostics.test.mjs tests/codex/performance-seed-diagnostics.test.mjs tests/codex/performance-ab-equivalence.test.mjs`: **5 arquivos / 19 testes PASS** após a última correção.
- ESLint direcionado aos sete arquivos de código/teste alterados: exit 0.
- `node --check` do executor e provisionador: exit 0.
- `validate-supabase-baseline-functional.mjs` no backend exclusivo final: exit 0.
- `node scripts/codex/performance-isolated-backend.mjs --integrated-reconnect-1k`: exit 0, resultado CERTIFIED.
- Auditoria final independente de aceite, mesmos hashes, mesmo modo/limites, produto congelado e cleanup: PASS.
- `git diff --check`: sem erros observado após o patch; reconferido no fechamento.
- `pnpm run gates:docs`: PASS para headers/baselines, continuidade e contrato de governança ativos.

Não executados: build, regressão global, E2E geral, 10k, A/B, operações remotas. Motivo: patch exclusivamente no harness, testes direcionados e fluxo real Chromium/backend certificados; sem ampliação de escopo.

Estado Git da certificação: cinco arquivos tracked modificados, contrato/teste/relatório novos e nenhum staged; HEAD na baseline adotada. Publicação administrativa: um único commit na branch `codex/f24-6a1-reconnect-certification`, destinado a um único PR contra a main. O pacote inclui cópias auditáveis das evidências, os cinco snapshots ativos reconciliados e instalação de Chromium no CI para o teste de cleanup já existente. Nenhum arquivo de produto, migration, RLS, Edge, dependência ou lockfile alterado. Os originais em test-results e as alterações concorrentes do checkout original foram preservados. Merge/deploy não executados.

Gate técnico do patch: **READY** após inspeção de tracked/staged/untracked, testes direcionados, validação real e auditoria final. Gates documentais PASS. Não autoriza merge/deploy.

## 9. Riscos residuais e pendências

1. Certificação local deste workload e baseline; sem extrapolação para produção, 10k, dados reais, multi-dispositivo ou outras operações.
2. Heap amostrado não garante captura de picos inferiores a 250ms nem mede memória nativa/host/backend. n=5 não sustenta percentis de cauda ou SLO.
3. Causa interna do primeiro 502 permanece não capturada; falso positivo de readiness foi removido e a série final validou handler, Auth, RLS e sync. A publicação administrativa não amplia o envelope nem comprova produção ou capacidade geral.

Nenhuma pendência de execução para esta certificação. Integração administrativa depende do merge autorizado do PR. Após esse merge, `F24.6A1 = CLOSED / INTEGRATED` no envelope descrito, sem exigir outro relatório, benchmark ou fase documental. Não foi aberta nova fase nem ampliado escopo para F24.6A2.

Evidências:

[Manifest principal e evidências por execução](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `f24-6a0b-05f15053/certification.json`)..

- Smoke: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791834368711.json`)..
- Run 1: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791834383376.json`)..
- Run 2: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791834552935.json`)..
- Run 3: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791834717428.json`)..
- Run 4: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791834882925.json`)..
- Run 5: [artefato](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) (proveniência local: `reconnect-warm-1791835051435.json`)..

## Publicação administrativa — 13/10/2026

A série e os artifacts não foram reexecutados nem sobrescritos. [Pacote auditável](./evidence/f24-6a1-reconnect-1k/ARTIFACTS.zip) e [índice SHA-256](./evidence/f24-6a1-reconnect-1k/INDEX.json) contêm 22 cópias byte a byte: manifest final, seis runs válidos, smoke anterior falho, duas preparações, diagnósticos, sete manifests históricos e snapshots originais do relatório/patch. O índice lista nomes internos, tamanho e SHA-256 de cada entrada; o SHA-256 do ZIP também está registrado.

O snapshot original dentro do ZIP preserva paths locais como metadados de proveniência. Para reproduzir a auditoria, extraia o ZIP e valide os hashes do INDEX.json; os manifests principais estão em `final/certification.json`, `preparation/first-certification.json` e `preparation/second-certification.json`; os resultados individuais estão em `runs/`. A revisão administrativa confirma as evidências existentes, sem novo benchmark. Nesta publicação: testes direcionados 5 arquivos/19 casos PASS (incluindo Chromium real/IDB), lint direcionado PASS e gates documentais PASS; as fontes do harness continuam com os mesmos hashes da execução certificada.
