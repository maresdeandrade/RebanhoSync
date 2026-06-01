# Pages — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

Dispatcher local para telas em:

```txt
src/pages/**
```

Use este arquivo para tarefas de UI, navegação, composição de tela e wiring leve.

Regra global permanece no `AGENTS.md` da raiz.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `src/pages/AGENTS.md`.
5. `AGENTS.md` do hotspot, se existir.

---

## Hotspots

```txt
src/pages/Registrar/AGENTS.md
src/pages/Agenda/AGENTS.md
src/pages/ProtocolosSanitarios/AGENTS.md
```

Entrypoints consolidados:

```txt
src/pages/Registrar/index.tsx
src/pages/Agenda/index.tsx
src/pages/ProtocolosSanitarios/index.tsx
```

---

## Regras locais

- Não misturar regra de negócio forte na UI quando já existir serviço em `src/lib/**`.
- Preservar rotas e entrypoints.
- Evitar refatoração ampla de tela sem tarefa própria.
- Preferir colocalização incremental em `components/`, `helpers/` e `types.ts`.
- UI pode orquestrar fluxo, mas não deve virar fonte primária de regra.
- Não usar tela como fonte de verdade para domínio.
- Não corrigir regra de domínio apenas com bloqueio visual.

---

## Quando escalar

| Situação | Ler |
|---|---|
| Offline/sync | `src/lib/offline/AGENTS.md` |
| Sanitário | `src/lib/sanitario/AGENTS.md` |
| Reprodução | `src/lib/reproduction/AGENTS.md` |
| UX/copy/visual | `docs/ux/UX_PRINCIPLES.md`, `docs/ux/COPY_GUIDELINES.md`, `docs/ux/VISUAL_TOKENS.md` |
| Agenda/eventos | `docs/technical/EVENTS_AGENDA_CONTRACT.md` |
| RLS/multi-tenant | `docs/technical/SUPABASE_RLS.md` |

---

## Validação

Usar validação proporcional ao patch:

```bash
pnpm run lint
pnpm test
pnpm run build
```

Para patch pequeno e localizado, teste específico pode ser usado antes da suíte completa, mas não substitui a validação geral antes de PR/merge.