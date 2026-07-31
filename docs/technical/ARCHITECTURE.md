# Arquitetura — RebanhoSync

Atualizado em: 2026-07-30

## Visão geral

RebanhoSync é offline-first: operações válidas nascem localmente, são persistidas em Dexie quando aplicável e usam a fila compartilhada para sincronização com Supabase/Postgres. O servidor é autoritativo para autenticação, autorização, RLS, transições, constraints e conflitos.

```txt
UI
→ domínio local
→ Dexie + queue_gestures/queue_ops
→ sync-batch
→ RPCs/transações Postgres
→ resultado por operação
→ worker/reconcile
→ pull/merge não destrutivo
→ read models locais
```

## Invariantes

- `fazenda_id` é a fronteira tenant.
- RLS e validação server-side são barreiras reais; UI e feature flag local não autorizam escrita.
- Agenda é intenção/tarefa futura.
- Evento é fato histórico executado.
- Closure administrativa não é execução.
- `state_*` e Conformidade são read models.
- Protocolo é regra/configuração.
- Tags, sinais, insights e status de sync são auxiliares.
- Decisões críticas exigem fonte factual e técnica explícita.
- Eventos e relações factuais são append-only quando o contrato assim define.

## Camadas

### UI

Captura intenção, apresenta estado e feedback. Não concentra regra de negócio crítica nem funciona como fronteira de autorização.

### Domínio local

Normaliza payloads, aplica regras puras, produz identidades estáveis e impede criação de operações inválidas antes do enqueue.

### Offline/Dexie

Mantém estado local, filas compartilhadas, cursores e manifests de cutover. Retry e reconcile não devem apagar fatos ou mascarar falhas.

### Sync

`sync-batch` autentica o JWT, valida membership, papel, gate, limites e contrato. O worker interpreta resultados por operação e reconcilia sem rollback destrutivo de fatos aceitos.

### Supabase/Postgres

RLS, FKs compostas, constraints e funções transacionais revalidam tenant, identidade, revisão, estado e idempotência. `service_role` existe apenas server-side.

### Read models

Otimizam leitura atual. Não substituem evento, evidência documental ou fonte técnica.

## Sync Sanitário v2 implementado

- migration expand com `revision`, `expected_revision` e ledger de idempotência;
- `client_op_id`, `client_tx_id` e `domain_op_id`;
- vínculo Evento → Agenda Sanitária v2;
- relação append-only Evento–Animal;
- gate remoto autoritativo fail-closed;
- comandos `create_agenda`, `replace_agenda_animals`, `apply_factual_core` e `close_agenda`;
- `sync-batch` v19;
- worker com `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- Dexie v28 com `event_eventos_animais`;
- manifesto de cutover `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- pull/reconcile não destrutivo.

## Estado de ativação

- staging: `zqloazqzhwauamcejmuz`;
- produção: não alterada;
- gate sanitário remoto: desligado;
- feature flag local: `false`;
- rollout: não autorizado.

A arquitetura está implementada sob gate, mas o Sync Sanitário v2 e a Fase 12 não estão concluídos. O próximo incremento é o item 3.8, descrito no [plano ativo](../review/ACTIVE_PHASE_PLAN.md).

## Risco externo

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` bloqueia o rollout: o PostgreSQL gera imediatamente o conflito esperado `SQLSTATE 40001`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout. Não há evidência atual de defeito no SQL ou na regra de domínio.

## Critério de aceite arquitetural

Uma alteração deve:

1. preservar offline-first e a fila compartilhada;
2. manter RLS, tenant e `fazenda_id`;
3. não criar fonte paralela de verdade;
4. manter Agenda, Evento, closure, read models e Protocolo separados;
5. ser idempotente, reconciliável e testável;
6. manter gates fail-closed até evidência de rollout;
7. declarar limitações e riscos sem inferir causalidade.
