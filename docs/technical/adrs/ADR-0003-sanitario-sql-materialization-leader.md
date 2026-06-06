# ADR-0003: SQL como Motor Lider da Agenda Sanitaria

> **Status:** Accepted
> **Data:** 2026-04-27
> **Contexto:** Saneamento sanitario P0-P3
> **Autores:** Codex + revisao tecnica

## Contexto

A auditoria P0 identificou risco de divergencia entre materializacao sanitaria em TypeScript e SQL/Supabase. O sistema e offline-first, usa Two Rails e precisa manter agenda como estado operacional mutavel e eventos como fatos append-only.

## Decisao

SQL/Supabase permanece como motor lider atual de materializacao e recompute da agenda sanitaria, por `sanitario_recompute_agenda_core`.

TypeScript nao e motor alternativo silencioso de materializacao. Ele mantem contratos de dominio, adapters, suporte offline/local, fixtures e golden/parity tests que protegem o contrato consumido pelo SQL.

### Complemento 2026-06-06 — Agenda Sanitária v2

A Fase 11.5 introduziu contratos TypeScript puros para redesenhar a Agenda Sanitária v2:

```txt
Regra/produto/fonte tecnica
-> janela sanitaria
-> elegibilidade individual
-> demanda agrupada
-> preview operacional
-> agenda_intent
-> event_execution_intent
-> agenda_closure_intent
```

Esses contratos ainda não substituem a persistência atual, não alteram schema, não criam migration, não alteram RLS, não alteram sync-batch e não tornam Supabase/Dexie persistência v2 concluída.

Direção arquitetural:

* evitar RPC-first como padrão obrigatório para a Agenda v2;
* tratar queue/operação local como direção futura para persistência offline-first, não como fato implementado pela 11.5;
* auditar fluxo legado de agenda e `status='concluido'` antes de qualquer migration, enum, constraint ou reset;
* não aplicar constraint de `source_evento_id` antes de distinguir fechamento administrativo, execução com evento, cancelamento e dispensa;
* manter SQL atual como liderança operacional vigente até decisão/migration explícita.

## Alternativas consideradas

- Lideranca TS: descartada porque o fechamento transacional, constraints e recompute operacional estao no banco.
- Lideranca hibrida sem contrato: descartada pelo risco de agenda duplicada, ausente ou divergente.

## Consequencias

- Mudancas de materializacao precisam considerar SQL como fonte operacional.
- TS deve continuar protegendo calendario, dedup, payload e fixtures por testes de contrato.
- Refatoracoes estruturais nao podem mudar o contrato sem golden/parity tests.
- Contratos puros da Agenda v2 devem ser tratados como fronteira de domínio até existir plano de persistência validado.
- Persistência offline-first futura deve validar idempotência real, replay, rollback e sucesso parcial antes de substituir o caminho operacional vigente.

## Evidencias e referencias

- `supabase/migrations/**`: `sanitario_recompute_agenda_core`
- `src/lib/sanitario/__tests__/golden/sanitario_engine_parity.golden.test.ts`
- `docs/ARCHITECTURE.md`
- `src/pages/Registrar/SANITARY_BOUNDARY.md`

## Plano de rollout

- Manter golden/parity tests antes de qualquer nova mudanca semantica.
- Documentar novas divergencias como contrato ou corrigir adapter antes de refatorar pastas.
