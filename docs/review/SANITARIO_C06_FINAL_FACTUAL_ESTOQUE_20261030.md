# C06-FINAL — Execução factual, estoque e recuperação

Snapshot da execução original — Data: 30/10/2026. Decisão: **C06_TECHNICAL_CLOSEOUT_READY / READY_FOR_REVIEW**, restrita a este incremento local. Sem commit, push, merge, deploy, escrita em staging/produção ou ativação operacional. F24.7 completa não certificada.

## Baseline e isolamento

Main remota reconfirmada `d6abd01206e2c6207713c90599a4f31ec94133cb` (#261 integrado); branch `codex/c06-cas-dependencies`, HEAD `b6984307e0daa2029bc2c0e8f17b6ad0bc59307e`, árvore inicial idêntica à main. Os três documentos do CLOSEOUT já alterados foram preservados e receberam somente continuidade do resultado. Outros worktrees intactos.

Projeto final `sanitary-review-5a59ee78`: API 127.0.0.1:55421, DB 127.0.0.1:55422, Vite 127.0.0.1:8181; rede própria sem masquerade e publicações verificadas em loopback pelo adaptador existente. Sequência canônica de migrations copiada pelo harness, sem DDL/RPC/RLS adicional. Auth, Edge, PostgREST, PostgreSQL, ledger, Chromium e IndexedDB reais; quatro usuários e duas fazendas sintéticos. Produto sintético novo `eb4e0f27-a39a-4af7-801b-0c84fdf5e5f3`, declarado executed_fact: não é produto F6 nem autorização prospectiva.

## Resultados observados

Comando: `node tests/codex/sanitario-v2-review.supabase.mjs --c06-final` — exit 0, **4/4 PROVEN**, execução final registrada no JSON. Cada caso contém snapshots antes/depois locais/PostgreSQL, identidades completas, resultados por operação, rejeições, obrigações e lotes.

| Caso | Resultado |
| --- | --- |
| F1 — Consumo positivo | Writer executeSanitaryAgendaV2 produz primary_execution, Evento/detalhe/vínculos e movimento source_evento_id; 100 − 2 = 98, ACK antes de DONE. Segundo contexto Chromium/IndexedDB independente recebe fato, detalhe, movimento e saldo por pull canônico. Usuários B/outsider não leem os dados de A. |
| F2 — Lost ACK | Transporte abortado somente após resposta de commit real. Reload mantém envelopes; replay recupera o recibo factual e encontra o movimento existente, sem segunda baixa. Evento, detalhe, movimento e recibos idênticos antes/depois. |
| F3 — Fato rejeitado | Gate OFF somente na fazenda sintética produz SANITARIO_SYNC_DISABLED; companion segue política terminal, zero fato/detalhe/movimento/recibo factual remoto, saldo100. Dois envelopes REJECTED e auditoria local permanecem; não se afirma fila vazia nem sucesso desse fato. |
| F4 — Falha parcial e recuperação | FOR NO KEY UPDATE segura somente a baixa, permitindo FK do detalhe. Recibo factual confirmado antes de pg_cancel_backend da consulta de movimento: APPLIED + REJECTED/DB_57014. Fato preservado, projeção rejeitada removida, lote reconciliado para100 e envelope REJECTED durável; drain/recuperação automática não reenviam. Retry explícito por ops.retryRejectedOperation envia somente o movimento original, usa ledger do fato, converge para98 e DONE. Obrigação factual preexistente de insumos é mesclada sem perder tabelas. |

### Identidades da execução final

| Caso | Gesture / client_tx_id | Evento / detalhe / movimento lógico | Lote | Saldo remoto final |
| --- | --- | --- | --- | --- |
| F1 | `d6f9dfd8-bef2-4320-9f95-622c0d6df484` | `3aafb5ca-aac4-42de-b711-fe4a6727588a` | `c8a0ea82-9297-4435-ac69-cb5342baa8ce` | 98.000 |
| F2 | `568e60f7-22a6-46fd-8229-8c26bd87816a` | `6dac053a-37e5-4ec8-aad3-5332ab533d49` | `bfdbafb4-d846-43b7-8955-5eb3810b3bb7` | 98.000 |
| F3 | `f17c521d-7ef7-460a-8f3e-0e56b7f268c2` | `f2b9756d-d9cf-4362-8212-dc8ee65c0d4e` | `b8b1ce76-b701-4177-b28f-21ee47f12415` | 100.000 |
| F4 | `772d48cd-8e48-45ab-abd1-4c61e2b63af9` | `cb586463-4216-4dab-b521-9102987c384a` | `a27e483d-6f79-4a50-a300-5858f58341e6` | 98.000 |

O movimento lógico usa o ID do Evento, mas seu client_op_id/domain_op_id são distintos e constam do JSON; não são novos UUIDs no replay. O ledger sanitario_sync_v2_operations guarda os recibos factuais; o movimento usa sua própria linha/identidades e lookup idempotente existentes, sem inventar um segundo recibo sanitário. Final PostgreSQL: **3 Eventos, 3 detalhes, 3 movimentos e 7 recibos sanitários (4 criações de Agenda + 3 fatos)**. Duas operações REJECTED de F3 permanecem locais, obrigações finais0.

## Defeito reproduzido e patch

O consumidor apagava o envelope de consumo terminal após fato APPLIED sem desfazer a projeção local do movimento. F4 RED mostrou estoque remoto0 para esse fato e movimento local1, sem operação recuperável. Unit RED recebeu undefined ao exigir retenção.

Patch restrito a syncWorker: identifica companion consumo_sanitario ligado ao Evento factual APPLIED; mantém REJECTED e identidade, remove somente sua projeção na mesma transação ACK/auditoria/obrigação e preserva Evento/detalhe confirmados. Reutiliza obrigação factual e PullOptions.reconciliation existentes para movimentos/lotes. Nenhuma alteração de writer, schema ou política de outro domínio.

Revisão independente identificou riscos no primeiro patch, corrigidos antes da entrega com RED/GREEN: preservar outro consumo do mesmo lote, evitar dupla reserva em lost ACK já confirmado, coalescer obrigações e suportar ACK concorrente que já removeu a operação da fila. Dentro da transação do pull, reservas vêm de movimentos locais persistidos ainda ausentes do snapshot remoto, da mesma fazenda; não dependem da presença atual na fila. Movimentos remotos são lidos antes dos lotes. Não foram descartadas intenções de outros gestos.

## Validação e limpeza

- Worker completo: **21/21**; controles existentes incluídos, sem repetir matrizes C05/heterogêneo/CAS.
- F1–F4 reais: **4/4** na versão final. Preparações e REDs são separados no JSON; falhas iniciais de bootstrap global, nome único da fixture e lock que bloqueava FK foram corrigidas nos testes, sem relaxar contratos.
- ESLint nos cinco TS/MJS, sintaxe dos três MJS e diff check: exit0.
- TypeScript comparativo por arquivo/código/mensagem/multiplicidade: **232 baseline /232 patch /0 novos**, overlay somente syncWorker; passivo global independente.
- Fallow new-only: exit0, WARN de três duplicações na fixture de teste; nenhum novo achado de complexidade ou código morto. Não houve supressão.
- Gates documentais/audit:agents executados após atualização dos documentos; resultado na entrega.
- Gates e flag locais OFF, browser/Vite/Edge/DB encerrados. Inventário por identidade dos **dez projetos próprios**: zero containers, volumes ou redes. Recursos preexistentes GestaoAgro/animal-v2 e outros worktrees preservados. Credenciais não persistidas; varredura de padrões de segredo do artefato limpa.

## Limites remanescentes

Sem fonte técnica/regra de carência nesta fixture: campos legados carne/leite e término permanecem null nos três detalhes aceitos; não há autorização futura inferida. Commit concorrente entre leituras remotas pode subestimar temporariamente o saldo; o tratamento é conservador e o pull posterior convergente, sem disponibilizar saldo excessivo.

Incremento pronto para revisão/integração em tarefa autorizada; não CLOSED/INTEGRATED ainda. F24.7 completa, PWA cold start/kill/dispositivo e release/rollout mantêm seus critérios próprios. Não iniciar nova unidade C06 automaticamente.

[Artefato sanitizado único](./evidence/SANITARIO_C06_FINAL_FACTUAL_ESTOQUE_20261030.json).

## Revisão independente e preparação seletiva do PR — 30/10/2026

A execução original 4/4 acima permanece histórica, com hashes próprios preservados no JSON. Transporte seletivo para main d6abd012 na branch `codex/c06-final-factual-recovery`, worktree `c06-final-integration/GestaoAgro`; os dez arquivos de origem continuam intactos. Dois findings da revisão exigiram três arquivos adicionais (ops.ts, pull.ts e teste de pull): escopo final13 arquivos.

- HIGH resolvido: retry explícito stock-only agora reserva2 no lote na mesma transação que reinstala movimento/fila, com saldo98 antes de qualquer ACK. Não debita novamente uma projeção já presente. Nova rejeição mantém envelope e reconcilia lote para100, permitindo próximo retry original.
- MEDIUM resolvido: snapshot de reconciliação de movimentos/lotes pagina por id além do limite1000. Erro na segunda página aborta antes do callback/merge; histórico confirmado omitido não volta a reservar saldo.

REDs observados e GREEN de **33 testes focados (21 worker +12 pull)**, incluindo janela préACK, retry→REJECTED→retry,1001 registros e erro2ªpágina. A revisão das correções e extensão de F4 não identificou novo finding concreto.

Revalidação real final apenas **F2/F4,2/2**, comando `node tests/codex/sanitario-v2-review.supabase.mjs --c06-final --c06-final-cases=F2,F4`. Projeto local `sanitary-review-1ec8fe85`, gates/flag OFF e zero containers/volumes/redes dos dois projetos pós-review. F1/F3 reutilizados porque não entram no caminho alterado; C05/heterogêneo/CAS não repetidos. F4 atual: gesto `31d19795-b5dd-4b1f-b00f-f6291e2431d4`, Evento/detalhe/movimento lógico `8ca7f8a9-faed-41f2-96eb-9b25c91b5faa`, lote `c33187b7-dca3-4188-b499-e902d11e6e5f`; snapshots comprovam **retry98 → rejeição100 → retry98 → confirmação98**, preservando identidades e reenviando somente um movimento. Recibo factual permanece único.

TypeScript comparativo dos três arquivos runtime: **232→232, zero novos**. Lint8 TS/MJS, sintaxe3 MJS e diff check aprovados. Fallow exit0, quatro avisos de duplicação somente na fixture (três originais e o ciclo repetido); sem novo achado de complexidade/código morto e sem supressão/refatoração para eliminar avisos. Gates documentais conferidos na preparação final.

Estado: **C06_TECHNICAL_CLOSEOUT_READY**, apto a PR após checks; `C06_TECHNICAL_CLOSED / INTEGRATED` somente com merge confirmado. `F24.7_FULL_CERTIFICATION = NOT_CERTIFIED`. Fontes/carências não comprovadas, PWA/kill/dispositivo, demais RPCs, autorização operacional e rollout mantêm critérios próprios. Nenhuma nova unidade C06, merge, migration remota, ativação ou deploy autorizado.
