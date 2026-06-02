# Execute Phase From Handoff — RebanhoSync

Use este prompt quando uma fase já tiver handoff documentado em `docs/review`.

## Prompt

Você é o arquiteto técnico sênior do RebanhoSync.

Leia primeiro:

- `AGENTS.md`
- `.agents/rules/CORE_RULES.md`
- `.agents/rules/CONTEXT_LOADING.md`
- o handoff informado da fase

Execute a fase descrita no handoff.

Antes de alterar arquivos, entregue diagnóstico:

1. Estado atual.
2. O que já existe.
3. O que falta validar.
4. Riscos reais.
5. Arquivos candidatos.
6. Necessidade ou não de schema/RLS/RPC/migration.
7. Plano mínimo de patch.

Regras:

- patch incremental;
- não ampliar escopo;
- não refazer etapa concluída;
- não mexer fora das áreas listadas no handoff sem justificar;
- preservar offline-first;
- preservar RLS/multi-tenant;
- preservar eventos append-only;
- preservar Agenda ≠ Evento;
- declarar testes e validações.

Ao final, entregar relatório no formato definido no handoff.