# Arquitetura — RebanhoSync

Atualizado em: 2026-10-20

## Visão geral

RebanhoSync é offline-first: operações válidas nascem localmente, são persistidas em Dexie quando aplicável e usam a fila compartilhada para sincronização com Supabase/Postgres. O servidor é autoritativo para autenticação, autorização, RLS, transições, constraints e conflitos.

> Este resumo não substitui a verificação do código e migrations ativos para versões, objetos e comportamento. Integração e ativação operacional constam em [PROJECT_STATUS.md](../context/PROJECT_STATUS.md).

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
- transporte sanitário v2 pela função Edge `sync-batch` (versão deve ser confirmada no código ativo);
- worker com `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- persistência local Dexie compatível com os stores atuais (versão deve ser confirmada no código ativo);
- manifesto de cutover `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- pull/reconcile não destrutivo.

## Estado de ativação

- implementação do Sync Sanitário v2: status técnico descrito nesta arquitetura; verificar cobertura/versão no código e migrations ativos;
- gate sanitário remoto: desligado;
- feature flag local: `false`;
- recertificação completa, importação real e rollout: não autorizados;
- produção: não provisionada.

Implementação e integração não equivalem a ativação operacional. A fase atual é F24, com F24.6 ativa e F24.6A1 integrada somente no envelope certificado. O [estado do projeto](../context/PROJECT_STATUS.md) e o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) registram limites e próxima proposta.

## Risco externo

`SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026 após PT409, PostgREST 14.18 e E2E remoto stale de `replace_agenda_animals`. Historicamente, `40001` não retornava pelo transporte antes do timeout. Ver [evidência canônica](../context/PROJECT_STATUS.md#recertificação-remota-stale-sanitário-v2--05102026). Gate remoto `OFF`, flag `false`, rollout e importação real não autorizados; outras RPCs não foram recertificadas.

## Critério de aceite arquitetural

Uma alteração deve:

1. preservar offline-first e a fila compartilhada;
2. manter RLS, tenant e `fazenda_id`;
3. não criar fonte paralela de verdade;
4. manter Agenda, Evento, closure, read models e Protocolo separados;
5. ser idempotente, reconciliável e testável;
6. manter gates fail-closed até evidência de rollout;
7. declarar limitações e riscos sem inferir causalidade.
