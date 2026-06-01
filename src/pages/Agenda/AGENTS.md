# Agenda — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

Hotspot de agenda operacional:

```txt
src/pages/Agenda/**
```

Cobre filtros, agrupamentos, navegação, ações de pendência e composição da tela.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `src/pages/AGENTS.md`.
3. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.
4. `docs/domain/TAGS_SIGNALS_CONTRACT.md`.

Ler apenas se necessário:

| Tema | Ler |
|---|---|
| Sanitário | `src/lib/sanitario/AGENTS.md` |
| Offline/sync | `src/lib/offline/AGENTS.md` |
| UX/copy | `docs/ux/COPY_GUIDELINES.md` |
| Estados vazios/bloqueados | `docs/ux/EMPTY_PARTIAL_BLOCKED_STATES.md` |

---

## Regras locais

- Preservar semântica Two Rails.
- Agenda = intenção/tarefa futura mutável.
- Evento = fato histórico executado.
- Não usar agenda como KPI histórico.
- Não concluir agenda como fato sem evento quando o fluxo exigir registro.
- Evitar duplicar regras de prioridade/calendário já existentes em `src/lib/**`.
- Mudanças de UI devem ser locais e revisáveis.
- Agenda vencida indica pendência, não execução.
- Agenda concluída só é histórico se houver evento correspondente quando exigido pelo fluxo.

---

## Não fazer sem tarefa própria

- Reenquadrar modelo de dados da agenda.
- Alterar contrato de integração com registro de eventos.
- Alterar regras de materialização sanitária.
- Criar conclusão automática sem fonte explícita.
- Usar ausência de agenda como prova de conformidade.
- Usar agenda para calcular carência, venda, abate ou KPI histórico.

---

## Checagens antes de alterar

1. A mudança altera filtro, agrupamento, ação ou contrato?
2. A tela está mostrando pendência ou fato executado?
3. Há risco de confundir agenda com histórico?
4. A ação deveria abrir registro, reagendar ou apenas navegar?
5. O estado vazio significa ausência real ou fonte não carregada?

---

## Validação

```bash
pnpm run lint
pnpm test
pnpm run build
```