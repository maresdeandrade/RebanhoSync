# Agenda — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/agenda/**
```

Use este arquivo para regras, helpers, materialização, filtros, seleção, deduplicação e leitura operacional da agenda.

Não usar este escopo para registrar fatos históricos. Agenda é intenção/tarefa futura.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.
5. `docs/domain/TAGS_SIGNALS_CONTRACT.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| UI de agenda | `src/pages/Agenda/AGENTS.md` |
| Sanitário | `src/lib/sanitario/AGENTS.md`, `docs/domain/SANITARIO.md` |
| Offline/sync | `src/lib/offline/AGENTS.md`, `docs/technical/OFFLINE_SYNC.md` |
| RLS/migration/RPC | `docs/technical/SUPABASE_RLS.md` |
| UX/copy | `docs/ux/COPY_GUIDELINES.md`, `docs/ux/EMPTY_PARTIAL_BLOCKED_STATES.md` |

---

## Modelo mental obrigatório

```txt
Agenda = intenção/tarefa futura ou pendência.
Evento = fato histórico executado.
state_* = estado atual/read model.
Protocolo = regra/configuração.
Sinal = auxiliar de UX/consulta.
```

Agenda não é histórico.

Agenda pode indicar:

- pendência aberta;
- vencimento hoje;
- atraso;
- tarefa futura;
- necessidade operacional planejada.

Agenda não prova:

- execução;
- conformidade;
- carência;
- venda;
- abate;
- KPI histórico.

---

## Foco deste diretório

- Seleção de itens de agenda.
- Filtros e agrupamentos.
- Cálculo de vencimento/atraso.
- Deduplicação operacional.
- Materialização de pendências.
- Helpers puros de agenda.
- Contratos entre protocolo, agenda e evento.
- Preparação de dados para UI/read-only.

---

## Invariantes obrigatórias

- Não tratar item de agenda como evento executado.
- Não usar agenda como fonte de KPI histórico.
- Não usar ausência de agenda como prova de conformidade.
- Não transformar protocolo em execução.
- Não concluir agenda como fato histórico sem fluxo/evento correspondente quando aplicável.
- Não inferir carência, venda, abate ou aptidão operacional a partir de agenda.
- Preservar idempotência de materialização.
- Preservar deduplicação canônica quando existente.
- Preservar explicabilidade da origem da agenda.
- Não criar fonte paralela de verdade.

---

## Checagens antes de alterar

1. A mudança cria, seleciona, filtra ou conclui agenda?
2. A agenda está sendo usada como intenção ou como fato?
3. Existe evento correspondente quando o fluxo exige histórico?
4. A materialização é idempotente?
5. A deduplicação permanece estável?
6. Há risco de duplicar pendências em retry/offline?
7. Há risco de confundir pendência sanitária com carência?
8. A origem da agenda continua rastreável?
9. A mudança deveria estar em `src/lib/sanitario/**`, `src/lib/reproduction/**` ou `src/lib/events/**`?

---

## Evitar

- Criar regra de domínio forte dentro de helper genérico de agenda.
- Usar agenda como histórico.
- Usar agenda para KPI mensal/histórico.
- Usar status visual como regra.
- Deduplicar com chave instável.
- Concluir agenda automaticamente sem evento ou confirmação quando o fluxo exigir registro.
- Misturar UI, domínio e sync no mesmo patch.
- Calcular liberação sanitária ou comercial pela agenda.

---

## Entrega esperada

- Diff mínimo.
- Regra alterada em uma frase.
- Fonte primária declarada quando houver integração com evento/protocolo.
- Até 3 riscos.
- Testes focados.
- Impacto em agenda/evento descrito de forma explícita.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Quando alterar materialização, deduplicação ou integração com sync:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Quando escalar

- Se tocar histórico executado: consultar `src/lib/events/AGENTS.md`.
- Se tocar sync/offline/retry: consultar `src/lib/offline/AGENTS.md`.
- Se tocar agenda sanitária: consultar `src/lib/sanitario/AGENTS.md`.
- Se tocar agenda reprodutiva: consultar `src/lib/reproduction/AGENTS.md`.
- Se alterar contrato de agenda/evento: avaliar ADR.