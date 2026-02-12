# Runbook de Rollback Operacional - Fase 4

Data: 2026-02-11  
Escopo: rollout controlado das regras estritas de eventos por fazenda.

Referencia operacional complementar:

1. `docs/CHECKLIST_GO_LIVE_FASE4_EXECUTAVEL.md`
2. `docs/sql/FASE4_GO_LIVE_QUERIES.sql`

## 1. Objetivo

Restaurar estabilidade operacional quando houver aumento relevante de falhas de sync apos ativacao das regras estritas.

## 2. Quando acionar rollback

Acionar rollback se qualquer uma das condicoes ocorrer no piloto:

1. Taxa de sucesso de sync menor que 99% por mais de 30 minutos.
2. Aumento abrupto de rejeicoes em `ANTI_TELEPORTE` ou regras de dominio.
3. Backlog de gestos (`PENDING` + `SYNCING`) crescendo continuamente.
4. Qualquer indicio de erro de isolamento entre fazendas.

## 3. Niveis de rollback

## Nivel 1 - Parcial (fazenda piloto)

Desliga somente as regras estritas na fazenda impactada.

```sql
update public.fazendas
set metadata =
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{eventos_rollout}',
    jsonb_build_object(
      'strict_rules_enabled', false,
      'strict_anti_teleporte', false
    ),
    true
  ),
  updated_at = now()
where id = '<FAZENDA_ID>';
```

## Nivel 2 - Geral (todas as fazendas)

Desliga regras estritas em todo o rollout.

```sql
update public.fazendas
set metadata =
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{eventos_rollout}',
    jsonb_build_object(
      'strict_rules_enabled', false,
      'strict_anti_teleporte', false
    ),
    true
  ),
  updated_at = now()
where deleted_at is null;
```

## Nivel 3 - Reativacao gradual

Reativar por lotes, primeiro `strict_rules_enabled=true` e depois `strict_anti_teleporte=true`.

```sql
update public.fazendas
set metadata =
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{eventos_rollout}',
    jsonb_build_object(
      'strict_rules_enabled', true,
      'strict_anti_teleporte', true
    ),
    true
  ),
  updated_at = now()
where id in ('<FAZENDA_1>', '<FAZENDA_2>');
```

## 4. Verificacao pos-rollback

Validar que as flags estao persistidas:

```sql
select
  id,
  nome,
  metadata -> 'eventos_rollout' as eventos_rollout
from public.fazendas
where deleted_at is null
order by updated_at desc
limit 50;
```

Checklist operacional:

1. Dashboard: taxa de sucesso volta para >= 99%.
2. Dashboard: backlog estabiliza e comeca a cair.
3. Reconciliacao: queda de novas rejeicoes por regra.
4. Sem novos incidentes de isolamento de tenant.

## 5. Comunicacao

1. Registrar horario de ativacao/rollback e fazendas impactadas.
2. Informar equipe de produto e operacao sobre escopo do rollback.
3. Abrir post-mortem com causa raiz e plano de reativacao controlada.

## 6. Responsaveis

1. Execucao SQL e monitoracao: responsavel de operacao.
2. Validacao funcional no app: responsavel de produto/QA.
3. Correcao de codigo: responsavel tecnico do modulo de eventos.
