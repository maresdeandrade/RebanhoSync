# Events — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/events/**
```

Use este arquivo para criação, validação, composição, snapshots, correção, leitura e contratos de eventos históricos.

Evento é fato executado. Não confundir com agenda, protocolo, tag, sinal ou read model.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.
5. `docs/technical/OFFLINE_SYNC.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| Agenda | `src/lib/agenda/AGENTS.md` |
| Sanitário | `src/lib/sanitario/AGENTS.md`, `docs/domain/SANITARIO.md` |
| Reprodução | `src/lib/reproduction/AGENTS.md`, `docs/domain/REPRODUCAO.md` |
| Offline/sync | `src/lib/offline/AGENTS.md` |
| RLS/migration/RPC | `docs/technical/SUPABASE_RLS.md` |
| Custo/snapshot econômico | `docs/finance/COSTING_CONTRACT.md`, `docs/finance/ECONOMIC_SNAPSHOTS.md` |

---

## Modelo mental obrigatório

```txt
Evento = fato histórico executado.
Agenda = intenção/tarefa futura.
Protocolo = regra/configuração.
state_* = projeção atual/read model.
Snapshot = fotografia técnica/econômica no momento do fato.
Correção = novo fato/correção auditável, não edição destrutiva.
```

Eventos são a fonte primária para histórico e KPI histórico.

---

## Foco deste diretório

- Contratos de evento.
- Builders de payload.
- Snapshots técnicos e econômicos.
- Correções auditáveis.
- Validação de detail tables.
- Integração com gestos offline.
- Consistência entre evento base e detalhes.
- Regras append-only.
- Preparação de dados para read models.

---

## Invariantes obrigatórias

- Preservar append-only.
- Não apagar ou sobrescrever fato histórico sem correção auditável.
- Não criar evento a partir de protocolo isolado.
- Não criar evento a partir de agenda sem fluxo explícito de execução.
- Não usar `state_*` como substituto de histórico.
- Não usar tag/sinal como fonte primária.
- Manter vínculo entre evento base e detail table.
- Manter `fazenda_id` e isolamento multi-tenant.
- Manter idempotência por gesto/operação.
- Preservar snapshots quando o domínio exigir.
- Custo ausente não é custo zero.
- Último peso não é automaticamente peso atual confiável.
- Carência sanitária não é liberação comercial.

---

## Checagens antes de alterar

1. O dado representa fato executado ou intenção futura?
2. Existe detail table adequada?
3. O evento precisa de snapshot técnico/econômico?
4. A operação é idempotente?
5. Há risco de duplicar evento em retry/offline?
6. Há correção auditável em vez de edição destrutiva?
7. O evento afeta `state_*`?
8. O evento afeta agenda aberta?
9. O evento afeta estoque, custo, carência ou reprodução?
10. Há risco de quebrar sync-batch?

---

## Evitar

- Transformar agenda concluída em histórico sem evento quando o fluxo exigir fato.
- Persistir label derivado como fonte de verdade.
- Usar ausência de evento como prova operacional absoluta.
- Criar regra crítica dentro de UI ou builder genérico.
- Misturar evento, read model e protocolo na mesma estrutura.
- Recalcular snapshot histórico com dado atual.
- Tratar sucesso local como sucesso remoto.
- Ocultar rejeição remota.

---

## Entrega esperada

- Diff mínimo.
- Tipo de evento/detail table afetado.
- Fonte primária declarada.
- Invariantes tocadas.
- Até 3 riscos.
- Testes focados.
- Impacto em agenda, `state_*`, sync e snapshots.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se tocar sync, Supabase, RPC ou detail table remota:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Quando escalar

- Se tocar fila, gesto, rollback ou retry: consultar `src/lib/offline/AGENTS.md`.
- Se tocar materialização de agenda: consultar `src/lib/agenda/AGENTS.md`.
- Se tocar evento sanitário: consultar `src/lib/sanitario/AGENTS.md`.
- Se tocar evento reprodutivo: consultar `src/lib/reproduction/AGENTS.md`.
- Se tocar schema, FK ou RLS: revisar `supabase/migrations/AGENTS.md`.
- Se alterar semântica append-only: avaliar ADR.