# RebanhoSync — instruções para agentes

Projeto: app agropecuário offline-first em beta interno. MVP operacional. Prioridade atual: consolidação SLC com patches pequenos, locais e revisáveis.

## Leitura inicial

Antes de agir, leia apenas o necessário.

Para tarefa geral:
1. README.md
2. docs/CURRENT_STATE.md
3. docs/PROCESS.md
4. docs/AGENT_CONTEXT.md

Para tarefa localizada:
- primeiro procure AGENTS.md no diretório afetado;
- use docs locais e skills específicas;
- não abra docs/archive/** salvo pedido explícito.

Fonte de verdade em conflito:
1. código + migrations ativas;
2. docs/CURRENT_STATE.md;
3. docs normativos;
4. docs derivados;
5. histórico.

## Regras absolutas

- Não colocar regra de negócio forte em componente React.
- Não usar UI como única fronteira de autorização.
- Não expor service_role no client.
- Não alterar migrations, seed, RLS, policies ou RPCs sem tarefa explícita.
- Preservar fazenda_id como fronteira de isolamento.
- Preservar compatibilidade com dados legados.
- Preferir mudanças pequenas, reversíveis e testáveis.
- Não refatorar por conveniência.

## Invariantes do domínio

- Agenda = intenção/tarefa futura mutável.
- Evento = fato histórico append-only.
- state_* = estado atual/read model.
- Protocolo = regra/configuração, não execução.
- Tags, sinais e insights = auxiliares; nunca fonte primária nem regra crítica.
- Registrar/Executar geram evento.
- Encerrar/Cancelar atuam na agenda.
- Aplicar protocolo materializa/recalcula agenda e não gera evento diretamente.
- Correção histórica ocorre por contra-lançamento, não update destrutivo.
- Idempotência operacional: 1 ação → 1 createGesture.
- Offline-first: preservar gestures, rollback determinístico, metadata de sync, retries e fila.
- Sanitário: base oficial, overlay por fazenda e protocolo operacional não devem virar fonte misturada.
- Reprodução: preservar linking determinístico parto → pós-parto → cria.

Pipeline preferida em hotspots:
Normalize → Select/Policy → Payload → Plan → Effects → Reconcile.

## Escopo e edição segura

Antes de editar:
- declare escopo permitido/proibido;
- liste arquivos prováveis;
- rode git status --short --untracked-files=all;
- use repository-context-retrieval se o ponto de intervenção não estiver claro.

Durante:
- atacar no máximo 1 capability principal;
- manter diff mínimo;
- não editar docs derivados sem mudança funcional real;
- se algo não for encontrado, registrar locais inspecionados;
- se comando for inferido, sinalizar antes de usar.

Áreas críticas:
- src/lib/offline/**
- src/lib/sanitario/**
- src/lib/reproduction/**
- src/lib/animals/**
- src/lib/events/**
- src/pages/Registrar/**
- src/pages/Agenda/**
- src/pages/ProtocolosSanitarios/**
- supabase/functions/sync-batch/**
- supabase/migrations/**

Para áreas críticas:
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"

## Validação

Comandos reais:
pnpm run lint
pnpm test
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:hotspots
pnpm run test:smoke
pnpm run quality:gate
pnpm run test:e2e
pnpm run gates
pnpm run audit:data

Scripts Codex:
powershell -File scripts/codex/bootstrap.ps1
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
powershell -File scripts/codex/prepare-pr.ps1
node scripts/codex/validate-supabase-baseline-functional.mjs

Não assumir script typecheck se não existir no package.json.

## Graphify

Se graphify-out/ existir:
- use graphify-out/GRAPH_REPORT.md antes de investigações amplas;
- para relação entre módulos, prefira graphify query/path/explain;
- para patch focal em arquivo já conhecido, não é obrigatório abrir Graphify antes;
- após mudança estrutural relevante, rode graphify update . se disponível.

## Resposta final

Formato:
1. resumo executivo;
2. arquivos criados/alterados;
3. conteúdo principal;
4. impacto em Supabase/RLS/migrations, se houver;
5. validações executadas;
6. escopo confirmado;
7. riscos/pendências, no máximo 3.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
