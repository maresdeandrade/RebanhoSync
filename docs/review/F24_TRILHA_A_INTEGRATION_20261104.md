# RebanhoSync — F24 | Integração Consolidada da Trilha A + A05/B04-B

## Objetivo

Integrar, em uma terceira worktree isolada, os patches estabilizados da Trilha A e o desenvolvimento de cancelamento seguro de Agendas por óbito A05/B04-B.

Produzir um candidato reproduzível para o rehearsal B2 das 74 migrations, sem integração remota ou alterações nas worktrees de origem.

## Baseline

- Última `origin/main` confirmada: `4389f2e709643e521bfea0373876cef1ff69da2b`.
- Trilha A: `codex/f24-ci-full-automation`, mesmo HEAD, seis testes modificados e relatório untracked.
- Relatório A: `docs/review/F24_TRILHA_A_INTEGRATION_20261104.md`.
- A05: `codex/a05-b04-obito-cancel`, HEAD anteriormente observado `910af3ee`, 18 arquivos modificados e 8 untracked.
- A05 reportou duas migrations novas, posteriores às 72 canônicas.
- Trilha A: 104 testes distintos aprovados em 12 arquivos; FULL pendente.
- A05: 92 testes focados e 11/11 controles HTTP/Auth/Edge/RPC/PostgreSQL reportados.

Confirmar o estado efetivo antes de alterar. Relatórios não substituem diff, hashes e resultados observados.

## Execução

### 1. Preservação

- Inspecionar branch, HEAD, worktree, staged, unstaged e untracked de A, A05 e B2.
- Ler AGENTS.md e instruções locais.
- Inventariar arquivos e hashes.
- Criar worktree exclusiva a partir da baseline confirmada.
- Preservar integralmente os três trabalhos originais.

### 2. Integração

- Transportar todos os patches necessários da Trilha A, incluindo seu relatório.
- Incorporar a implementação A05, incluindo arquivos untracked, testes, Edge e duas migrations.
- Reconciliar A05, que parte de HEAD anterior, com a main atual.
- Não sobrescrever arquivos inteiros sem examinar diferenças.
- Resolver o conflito em `sanitaryProgressiveV3.test.ts`, preservando a fixture ambiental A e os cenários de óbito A05.

Revisar especialmente pull.ts, syncWorker.ts, contratos de fila, recibos, execução/dispensa e Edge.

### 3. Compatibilidade pré-migration

Reavaliar sobre o candidato integrado a falha de pull que consulta tabelas V3 ausentes mesmo com push OFF.

Determinar:
- condições reais de acionamento;
- comportamento diante de PGRST205;
- proteção de dados e operações pendentes;
- compatibilidade com o backend de 65 migrations;
- sequência segura de implantação do frontend e backend.

Não converter tabela ausente em resultado vazio nem concluir reconciliação fictícia.

Se houver correção local mínima comprovada, implementá-la e testá-la. Caso dependa de decisão de rollout, preservar o bloqueador e registrar a condição para implantação.

### 4. Contratos A05

Verificar preservação de:
- óbito factual;
- cancelamento condicional;
- dispensa individual em Agenda coletiva;
- execução × óbito nas duas ordens;
- locks e precondições atômicas;
- replay, idempotência e recibos;
- proteção de pull pré-ACK;
- falha parcial, farm-switch e isolamento por fazenda.

Não reabrir a execução neonatal V3 nem modificar guards para satisfazer testes.

### 5. Migrations

Confirmar exatamente as 72 migrations canônicas e as duas novas de A05.

Produzir manifest com:
- 74 versões ordenadas;
- hashes dos arquivos;
- dependências;
- identidade do candidato integrado;
- mudanças de funções, triggers, recibos, grants e RLS.

Não executar migrations neste incremento.

### 6. Validação proporcional

Executar testes focados de:
- patches A;
- cenários A05;
- teste progressivo combinado;
- pull e reconciliação;
- concorrência e retry;
- envelopes e recibos.

Verificar lint, tipos pertinentes e diff checks.

Não repetir FULL nesta etapa. Manter os dois timeouts históricos classificados como inconclusivos.

### 7. Handoff B2

Entregar snapshot reproduzível do candidato integrado, incluindo alterações tracked e untracked, sem depender de worktrees que continuem sendo editadas.

Preparar o B2 para:
- instalação limpa 0→74;
- upgrade 65→74 com fixtures V2;
- complemento 72→74.

O rehearsal deverá utilizar somente o snapshot integrado, com autorização específica para provisionamento local descartável.

## Restrições

- Sem commit, push, merge, deploy ou migration remota.
- Não modificar as worktrees A, A05 ou B2.
- Não executar reset/cleanup sobre containers compartilhados.
- Não refatorar áreas não relacionadas.
- Não reabrir C05/C06 ou P0 concluídos.
- Não declarar FULL, F24.7 ou F24.8 aprovados.

## Critérios de aceite

1. Candidato integrado e isolado.
2. Patches A e A05 preservados.
3. Conflitos semânticos reconciliados ou classificados.
4. Testes afetados aprovados com evidências.
5. Contratos críticos preservados.
6. Bloqueador pré-migration resolvido ou explicitamente transferido como impedimento de rollout.
7. Manifest completo das 74 migrations.
8. Snapshot reproduzível entregue ao B2.

## Entrega

Apresentar baseline, diff consolidado, correções, testes, bloqueadores, identidade do snapshot, manifest das 74 migrations e veredito `READY_FOR_B2_REHEARSAL` ou `BLOCKED`.

Não iniciar o rehearsal nesta execução.