# Sanitário V2 — Revisão e preparação da integração

Atualizado em: 2026-10-23
Baseline revisada: `40e04fa58b45aa1cfc2faf1ecbb4033ec326c21b`
Branch: `codex/worktree-consolidation-20261021`
Recomendação: **READY_FOR_INTEGRATION** sobre a referência de integração identificada abaixo.
Verification gate: **READY WITH CAVEAT**, pela limitação de ambiente explicitada em Validação.

## Decisão e limite da revisão

O patch sanitário está organizado e não apresentou defeito funcional demonstrado no diff revisado. A única correção nesta consolidação é documental: `docs/domain/SANITARIO.md` ainda afirmava que a execução aguardava autorização. O documento agora distingue o bootstrap concluído das notas históricas de preparação. Nenhum runtime, publicador, teste ou byte da migration aplicada foi alterado nesta consolidação.

A revisão cobre o delta local sanitário tracked/untracked contra a baseline acima, e não audita retroativamente os 159 commits anteriores da branch. Não houve operação remota nesta consolidação, fetch, deploy, push, merge, rebase ou bootstrap.

## Base para integração

- `main` local: `f4c90e89a94b4a1b27032411c678569579b13dd1`; está 159 commits atrás da baseline. Foi preservada.
- `origin/main` disponível localmente: `ca81c016a65eb4f0a5df12721b6d5f3d820dda00`, merge do PR #238, com a baseline `40e04fa` como pai.
- `git diff --stat 40e04fa origin/main`: vazio. As árvores são idênticas; as dependências do patch já existem nessa referência.
- Proposta: integrar os dois commits locais auditados, em ordem, sobre `origin/main@ca81c01`, por branch/PR dedicado. Não transportar isoladamente os commits para a `main` local antiga nem incluir implicitamente as 159 alterações prévias.
- As refs foram examinadas localmente, sem atualização remota. Se a base avançar, revisar somente o delta relevante antes da integração. Nenhum comando de integração foi executado.

## Organização dos commits

1. `c2048dd` — runtime e testes focados: dez arquivos.
2. Commit de publicação/migration/evidências/documentação: publicador e preparador existentes, cinco arquivos de teste, migration aplicada, dez evidências JSON, manual atualizado e este relatório. O hash final é obtido em `git log`; não se escreve um hash autorreferente neste arquivo.

## Arquivos auditados

| Arquivo | Classificação |
| --- | --- |
| `docs/domain/SANITARIO.md` | Documentação derivada |
| `scripts/codex/import-sanitario-protocols-v2.mjs` | Publicador/preparador canônico |
| `src/components/sanitario/SanitaryProtocolWindowPanelV2.tsx` | Runtime e testes focados |
| `src/lib/sanitario/agenda/sanitaryContextualPlanningV2.ts` | Runtime e testes focados |
| `src/lib/sanitario/checks/__tests__/sanitaryProtocolPrecheckV2.test.ts` | Runtime e testes focados |
| `src/lib/sanitario/checks/sanitaryProtocolPrecheckV2.ts` | Runtime e testes focados |
| `src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts` | Runtime e testes focados |
| `src/pages/ProtocolosSanitarios/index.tsx` | Runtime e testes focados |
| `tests/codex/sanitario-v2-review.postgres.mjs` | Teste PostgreSQL/preparação |
| `docs/review/evidence/SANITARIO_V2_CLOSURE_BASELINE_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_CLOSURE_CANDIDATES_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_CLOSURE_ELIGIBLE_DELTA_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_CLOSURE_EXECUTION_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_CLOSURE_VERIFICATION_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_CLO_LEP_DECISION_SCOPE_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_EXECUTION_20261022.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_REMOTE_RESULT_20261023.json` | Evidência histórica/recibo — preservada |
| `docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_VALIDATION_20261022.json` | Evidência histórica/recibo — preservada |
| `scripts/codex/prepare-sanitario-closure-v2.mjs` | Publicador/preparador canônico |
| `src/lib/sanitario/agenda/__tests__/sanitaryRabiesManualPlanningV2.test.ts` | Runtime e testes focados |
| `src/lib/sanitario/agenda/sanitaryRabiesRegionalContextV2.ts` | Runtime e testes focados |
| `src/pages/ProtocolosSanitarios/helpers/__tests__/useSanitaryFarmLocationV2.test.tsx` | Runtime e testes focados |
| `src/pages/ProtocolosSanitarios/helpers/useSanitaryFarmLocationV2.ts` | Runtime e testes focados |
| `supabase/migrations/20261022230000_sanitario_manual_catalog_review_v2.sql` | Migration aplicada — imutável |
| `tests/codex/sanitario-v2-closure-preparation.test.mjs` | Teste PostgreSQL/preparação |
| `tests/codex/sanitario-v2-closure-publication.cases.mjs` | Teste PostgreSQL/preparação |
| `tests/codex/sanitario-v2-initial-bootstrap.cases.mjs` | Teste PostgreSQL/preparação |
| `tests/codex/sanitario-v2-manual-review.cases.mjs` | Teste PostgreSQL/preparação |
| `docs/review/SANITARIO_V2_INTEGRATION_REVIEW_20261023.md` | Relatório derivado desta consolidação |

Não há arquivo temporário entre os arquivos selecionados. `supabase/.temp/cli-latest` é a alteração alheia ao escopo: permanece modificada e fora dos commits. Não foram observadas outras edições concorrentes entre o inventário inicial e o staging. Isso não afirma ausência de outro processo de edição aberto.

## Contratos verificados no diff

- Agenda continua intenção futura; elegibilidade não grava Evento, estoque, carência ou histórico. Não há novo writer operacional ou fila paralela.
- Histórico materno positivo exige vínculo mãe-cria, Evento documentado não aproximado anterior ao nascimento e produto/classe/cobertura compatíveis. Ausência de histórico não significa mãe não vacinada; contexto documental exige referência.
- Idades usam meses do calendário conforme a variante. Reforços anuais opt-in de `class_scheme` usam aniversário do calendário, com tratamento de fevereiro; caminhos legados mantêm o comportamento anterior.
- Raiva aprovada no bootstrap continua manual: `no_agenda_auto` preservado. UF e adesão usam a configuração sanitária existente; município vem do cadastro da fazenda. O resolvedor confronta fonte, vigência e município do overlay, não infere foco/perifoco nem obrigação por endereço e não libera automação.
- Ausência de cobertura/localização mantém estado indeterminado e consulta/manual. Respostas tardias de outra fazenda são ignoradas; contexto e seleção são limpos ao trocar fazenda. A leitura auxiliar de município não cria persistência alternativa nem impede a fonte local offline.
- Não foram alterados Dexie, schema operacional, sync-batch, autenticação, policies ou grants. A migration só evolui as duas funções curatoriais existentes, preservando autenticação, bloqueios legais, CAS, cobertura técnica e auditoria.
- O publicador continua com gate explícito, locks, CAS de pais/predecessores, transação, rollback em falha de auditoria e replay pelo recibo. O bootstrap usa auditoria administrativa distinta, sem simular decisão ou sessão humana.
- CattleMaster e Bovigen Lepto 8 incompletos ficam fora do lote; a dose 2 Leptoferm restrita e as cinco aprovações anteriores permanecem preservadas.

## Bootstrap homologado e preservação

Fonte: [resultado remoto](evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_REMOTE_RESULT_20261023.json), execução concluída em `2026-10-23T05:06:51.395Z` (02:06:51 em São Paulo). Nenhuma homologação remota foi repetida.

- Nove famílias `active/approved`, aftosa `retired`, doze itens no bootstrap.
- Sete novas versões, duas fontes e doze coberturas; cinco decisões interativas anteriores e um recibo administrativo.
- Recibo: `sanitary-bootstrap-v2:e798ee50-7bda-4cd8-bebe-6ac5e44e8315`.
- Evidência registra 59 tabelas públicas preservadas, gates OFF, ACLs preservadas e replay idêntico sem alteração de dados/auditoria.
- SHA-256 da migration aplicada: `e04bb97b90cb55734afa0f1be4e661b44858794b155bd84a387bbdee7d851382`.
- SHA-256 do arquivo de resultado remoto: `c1374adc52de7465672c98cc33dc085a95cdc0bbb4d4c82c74680ceccc0f3821`.
- Todas as evidências preexistentes, inclusive planos com estado anterior à execução, foram preservadas byte a byte. Elas são snapshots históricos, não instruções de nova execução.
- Inspeção de todos os arquivos selecionados: nenhum match de chave privada, URI PostgreSQL com credencial, JWT completo ou padrões de segredo de provedor. Nenhum valor de ambiente/credencial foi incorporado ou impresso.

## Validação

Executada nesta consolidação:

- Inventário, branch/HEAD/worktree, diff tracked/staged/untracked e comparação das refs.
- `node scripts/codex/import-sanitario-protocols-v2.mjs --incremental docs/review/evidence/SANITARIO_V2_CLOSURE_ELIGIBLE_DELTA_20261022.json --bootstrap-initial docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json --validate`: passou; validação sem conexão/escrita no banco e fingerprints dos insumos intactos.
- `pnpm run gates:docs`: passou após a correção documental.
- `git diff --check` e `git diff --cached --check`: sem erro.
- Parsing dos dez JSON, inspeção estrutural do catálogo/recibo, busca de padrões de credenciais e conferência do hash da migration: passaram.
- Comparação SHA-256 com o inventário inicial: nenhum arquivo preexistente mudou, exceto a correção documental deliberada.

Resultados anteriores reutilizados, pois não houve alteração relevante de código:

- 167 testes Vitest focados de precheck/janelas/automação/UI/contexto regional/troca de fazenda, lint focado e `build:dev`, registrados em [verificação local](evidence/SANITARIO_V2_CLOSURE_VERIFICATION_20261022.json).
- Cinco testes de preparação e 19 cenários PostgreSQL do bootstrap, incluindo rollback, concorrência e replay, registrados em [validação do bootstrap](evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_VALIDATION_20261022.json).
- Execução remota e replay concluídos no resultado remoto acima.

Não executados: regressão global, novo build, nova homologação/consulta remota, reexecução de bootstrap/migration. Sem mudança de código que justifique repetir essas verificações. O harness completo Supabase Auth/PostgREST descartável não foi executado no trabalho anterior por ausência de alvo descartável explícito; essa limitação permanece declarada, sem invalidar os cenários PostgreSQL e as evidências reais de ACL/dados já observados. Não há afirmação de certificação de dispositivo físico ou de gates ativos.

## Riscos residuais e pendências

1. A integração deve usar uma base que contenha `origin/main@ca81c01`; a `main` local está desatualizada. Avanço posterior das refs exige conferir conflitos no delta pertinente.
2. A suíte completa Auth/PostgREST descartável não integra a evidência disponível; nenhuma permissão/RLS foi alterada pelo patch.
3. Variantes incompletas e futura automação regional de raiva continuam restritas individualmente. Não impedem a integração do escopo homologado.

Não há bloqueador concreto observado para integrar os dois commits auditados sobre a árvore de `origin/main@ca81c01`. A aprovação de catálogo existente não autoriza gate, execução sanitária ou reimplantação.
