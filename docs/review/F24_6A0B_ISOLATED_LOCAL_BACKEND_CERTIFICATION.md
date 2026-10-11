# F24.6A0-B — Isolated Local Backend Alignment

Atualizado em: 2026-10-09
Code baseline: `3b3bc96db331c2917167cf8370024332f505d9f7`
Status: `F24_6A0_BACKEND = READY_FOR_P0_BENCHMARKS` no escopo local certificado.

## Git e escopo

Fetch confirmou HEAD e origin/main no baseline acima. Branch
`codex/f24-6a0-benchmark`, worktree
`C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`.
Staged vazio; patch anterior F24.6A0 e worktrees concorrentes preservados.
Somente harness e documentação alterados. Sem alteração funcional, migration
canônica, índice, batching, banco compartilhado, staging, push, merge ou deploy.

## Mecanismo e equivalência

Supabase CLI 2.117.0, `start --workdir` com project_id exclusivo gerado por UUID.
-importado pelo Edge. Hashes das migrations preservados no relatório JSON.
Configuração canônica de Auth/PostgREST mantida; somente identidade/portas,
seed desabilitado e serviços auxiliares excluídos para este escopo.

API 55321, PostgreSQL 55322, Mailpit 55324/55325 e inspector 55383.
Shadow 55320 e portas auxiliares 55323/55327/55329 também reservadas/verificadas.
Projeto compartilhado `GestaoAgro`: API 54321, banco 54322,
Studio 54323, Mailpit 54324/54325; rede `supabase_network_GestaoAgro`;
volumes `supabase_db_GestaoAgro`, `supabase_edge_runtime_GestaoAgro`,
`supabase_storage_GestaoAgro`. Nenhum deles foi alterado por esta execução.

O backend certificado tem PostgreSQL 17.6 e exatamente as 60 versões canônicas,
sem entradas extras ou migration repair. Catálogos consultados diretamente:
RLS/policies, funções/ACL/search_path, coluna `server_received_at` NOT NULL,
trigger ativo, índice de retenção e cron `0 3 * * *` executado por postgres.
Purge SECURITY INVOKER e execução negada a anon/authenticated/service_role.
RPC movement_v1 executável por authenticated, negada a anon/service_role;
funções internas e triggers não executáveis pelos papéis de aplicação.

Validator funcional existente passou em grants/policies, profiles/settings,
owner/manager/cowboy/outsider, FKs compostas cross-tenant, eventos sanitários,
sync-batch real, replay e sucesso parcial. JWT verification permaneceu ativa;
sessões normais Auth alimentaram PostgREST e Edge. Não se presumiu equivalência
de schema ou segurança somente pelo histórico de migrations.

## Evidência pequena e recursos

Primeiro ciclo certificado: projeto `f24-6a0b-45672bf3`.
Relatório: `test-results/f24-6/f24-6a0b-45672bf3/certification.json`.
Artefatos completos do runner, que são a autoridade dos probes:

| Probe | Artefato | Evidência observada |
|---|---|---|
| Pull cold, 10 animais/2 farms/1 run | `pull-cold-1791591599995.json` | 5 expected = 5 received = 5 installed; isolamento; 0 erros/timeouts; cleanup triplo true |
| Reconnect warm, 2 gestos/2 farms/1 run | `reconnect-warm-1791591646276.json` | 2 UPDATEs reais offline; ACK observado; backlog 2→0; convergência e isolamento; 0 erros/timeouts; cleanup triplo true |

Pull: 290,2 ms. Reconnect: ACK upper bound 2.200,7 ms e convergência
3.785,3 ms; 12 requests, 1.300 bytes enviados, 5.750 recebidos.
Uma execução pequena por cenário comprova mecânica, não capacidade, SLA ou
percentis de escala. Seed e cleanup estão fora da duração medida.

Ciclo final com captura dos artefatos no provisionador:
`f24-6a0b-c667c159`, relatório
`test-results/f24-6/f24-6a0b-c667c159/certification.json`.
Pull `pull-cold-1791591784810.json`: 5=5=5, 50,5 ms.
Reconnect `reconnect-warm-1791591797227.json`: dois gestos/UPDATEs,
backlog 2→0, ACK upper bound 226,9 ms, convergência 300,7 ms.
Ambos com isolamento, zero erros/timeouts e três flags de cleanup true.
Mesmos 12 requests/1.300 bytes enviados/5.750 recebidos no reconnect.
Esses ciclos não compõem série comparativa de performance nem demonstram ganho.
Fingerprint de schema isolado idêntica nos dois ciclos:
`52546644a0db79b62a7fb194ef8e933e628eb5b21b1cb8bb0aedfe0f9bdaafb3`.

Criados e removidos somente containers db/auth/kong/inbucket/rest/edge_runtime,
volumes e rede com o sufixo exclusivo de cada tentativa. Fixtures do runner
(farms/usuário Auth/IndexedDB) removidas e verificadas. Fixtures do validator
funcional foram descartadas com o banco exclusivo. `stop --project-id <own-id>
--no-backup`, nunca stop --all ou db reset. Artefatos/config/cópias de fonte
ficaram em test-results ignorado; imagens Docker em cache não foram removidas.

Inventários antes/depois dos containers (ID, nome, estado e portas), volumes e
redes preexistentes idênticos. Histórico, lista de bancos e fingerprint de
tabelas/ACL/funções/policies/colunas/índices/triggers/constraints do compartilhado
idênticos: `bd05cd1544d0d057c47ef4bca06bf7ca0ab52fa12a9f4999ee443a28af12299e`.
Isso verifica os recursos e schema/histórico; não afirma ausência de escritas
de outros clientes em dados compartilhados concorrentes.

Tentativas anteriores preservadas: colisão da porta default do Mailpit,
parsing de configuração e import relativo do contrato de taxonomia, além de
interrupção do processo Windows. Corrigidos exclusivamente no provisionador;
recursos exclusivos removidos, sem repair ou alteração das migrations.

## Reprodução e limites

Executar no worktree dedicado, com Docker ativo e faixa de portas livre:

```powershell
$env:REBANHOSYNC_SUPABASE_CLI = 'C:/apps/supabase/current/supabase.exe'
node scripts/codex/performance-isolated-backend.mjs
```

O caminho do executável é específico deste host; omitir a variável quando
`supabase` resolver diretamente ao CLI. Credenciais capturadas apenas em
memória; arquivo env do Edge vazio. Nenhum segredo em evidências.
`REBANHOSYNC_BENCHMARK_SUPABASE_WORKDIR` seleciona explicitamente o projeto
local para o runner. Cada ciclo cria, certifica e descarta outro ambiente;
não deixa servidor persistente disponível após o retorno.

```ini
MIGRATION_HISTORY = ALIGNED
SCHEMA_CONTRACT = VERIFIED
RLS_CONTRACT = VERIFIED
AUTH_EDGE_POSTGREST = VERIFIED
PULL_SMALL_PROOF = PASS
RECONNECT_SMALL_PROOF = PASS
ISOLATION = VERIFIED
CLEANUP = VERIFIED
SHARED_BACKEND = UNCHANGED_IN_VERIFIED_SCOPE
```

P0 volumoso ainda não executado. Recriar este ambiente com lifecycle próprio
para cada série; não apontar benchmark ao projeto compartilhado. Realtime,
Storage, Studio e dispositivos físicos não certificados por esta execução.
F24.5 permanece CLOSED/INTEGRATED; F24.6 ACTIVE, sem otimização autorizada.

## Arquivos e validação focada

Novo provisionador `scripts/codex/performance-isolated-backend.mjs` e seleção
do workdir em `scripts/codex/performance-local-fixture.mjs`. Este documento,
contrato F24.6A0 e snapshots PROJECT_STATUS, ROADMAP, ACTIVE_PHASE_PLAN,
CURRENT_PHASE_HANDOFF e OPEN_REVIEW_ITEMS reconciliados. Demais arquivos
untracked do harness e alterações prévias foram preservados.

Observado: validator funcional real exit 0; dois ciclos pequenos completos;
node --check, ESLint nos dois módulos, 3/3 testes performance-contract,
gates documentais e git diff --check. Diff de src/supabase/package/lock/config
vazio. Sem build, regressão global ou teste remoto.
