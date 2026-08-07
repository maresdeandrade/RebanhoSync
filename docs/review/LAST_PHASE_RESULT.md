# Resultado funcional mais recente — Fase 13

Atualizado em: 2026-08-07
Baseline de entrada do fechamento: `e7b69fc`
Decisão: **Fase 13 encerrada com patch funcional**

## Resultado

A Reprodução Operacional v1 cobre a jornada matriz → cobertura/IA → diagnóstico → estado atual → parto ou aborto → cria, quando houver → próximas ações.

- PRENHA, VAZIA, DPP, parto vigente e perda gestacional são reconstruídos do histórico factual;
- parto preserva mãe, pai quando factual, `birth_event_id`, `fazenda_id`, atomicidade e replay idempotente;
- cada cria recebe seis intenções neonatais canônicas na Agenda Sanitária v2, sem converter Agenda em Evento;
- aborto encerra o episódio afetado, remove a DPP atual e não cria cria ou Agenda;
- correções permanecem append-only;
- `taxonomy_facts` permanece cache derivado e não prevalece sobre o contexto reprodutivo canônico carregado pelas telas.

## Patch final

O adaptador de taxonomia passou a obter DPP e último parto de `rebuildReproductiveProjection`. Quando uma tela fornece contexto reprodutivo, inclusive histórico vazio, esse contexto é autoritativo e um cache antigo não pode reintroduzir prenhez, DPP ou parto na leitura.

Não houve alteração de banco, migration, RLS, RPC, Edge Function, Dexie schema, fila ou sync.

## Validação

- Caminho A: IA → diagnóstico positivo → PRENHA + DPP → parto → cria → seis Agendas v2 → replay sem duplicação → projeção pós-parto;
- Caminho B: cobertura → diagnóstico positivo → aborto → VAZIA → sem DPP, cria ou Agenda → replay sem duplicação;
- 14 testes passaram em 2 arquivos;
- ESLint passou nos 3 arquivos TypeScript alterados;
- build passou uma vez, com warnings preexistentes;
- `git diff --check` passou no fechamento.

A inspeção visual automatizada não foi executada porque `agent-browser` não está instalado no ambiente. A disponibilidade das ações e navegações foi confirmada nas rotas e componentes existentes.

## Próxima fase

Fase 14 — Compra/Venda Operacional. Implantação, piloto e rollout permanecem fora do roadmap imediato de desenvolvimento.

Detalhes no [plano de fechamento](./ACTIVE_PHASE_PLAN.md) e no [handoff atual](./CURRENT_PHASE_HANDOFF.md).
