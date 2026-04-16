---
name: sync-offline-rollback
description: Use when the task is about Dexie, offline-first, gestures, queue_gestures, queue_ops, queue_rejections, rollback, before_snapshot, tableMap, pull, syncWorker, retry, idempotência, reason codes, telemetry de sync, ou alinhamento cliente-servidor do fluxo de sincronização.
---

# Sync — Offline, Rollback e Idempotência

## Missão

Orientar mudanças e decisões na espinha dorsal offline-first do produto:
- criação e aplicação de gestures
- `queue_gestures`, `queue_ops`, `queue_rejections`
- optimistic apply
- rollback por `before_snapshot`
- `tableMap`
- pull seletivo
- `syncWorker`
- retry
- reason codes e compatibilidade cliente-servidor
- telemetria de sync
- coerência entre Dexie, payload local e `sync-batch`

Esta skill cobre o **núcleo de sincronização e consistência offline**.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/lib/offline/**`
- `src/lib/telemetry/**`
- `src/lib/events/**` se tocar envelope do gesto
- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/rejections.ts`
- alinhamento com `supabase/functions/sync-batch/**`
- Dexie schema
- filas locais
- upload/flush de métricas
- rollback local após `REJECTED`

Tracks prováveis:
- `infra.sync`
- `infra.observabilidade`
- qualquer capability afetada por sync/offline

---

## Quando NÃO usar

Não use esta skill para:
- ajuste local de UI sem impacto em store/sync
- regra sanitária/reprodutiva/movimentação puramente de domínio
- migrations/RLS estruturais sem impacto no offline

Nesses casos, usar:
- skills de domínio específicas
- `migrations-rls-contracts`

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/OFFLINE.md`
3. `docs/CONTRACTS.md`

Ler só se necessário:
- `docs/ARCHITECTURE.md`
- `docs/DB.md`
- `docs/RLS.md`

Arquivos-alvo mais comuns:
- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/rejections.ts`
- `src/lib/telemetry/**`
- `supabase/functions/sync-batch/**`

Evitar abrir por padrão:
- docs derivados
- pages/componentes sem necessidade explícita
- histórico antigo do projeto

---

## Modelo mental obrigatório

O fluxo offline-first tem 4 blocos:

### A. Gesto / transação local
- UI cria um gesto
- gera `client_tx_id`
- enfileira ops em `queue_*`

### B. Aplicação otimista
- estado local é atualizado antes da confirmação do servidor
- `before_snapshot` é capturado para permitir rollback determinístico

### C. Sincronização
- worker envia lote ao `sync-batch`
- servidor responde por op com:
  - `APPLIED`
  - `APPLIED_ALTERED`
  - `REJECTED`

### D. Recuperação
- em `REJECTED`, cliente restaura `before_snapshot`
- em falha de rede, retry respeita idempotência
- pull seletivo reflete efeitos server-side/triggers

---

## Metadata obrigatória

Toda escrita sincronizável deve respeitar:

- `fazenda_id`
- `client_id`
- `client_op_id`
- `client_tx_id`
- `client_recorded_at`

Regra:
- não enviar `created_at` / `updated_at` como campos de payload de escrita

---

## Decisão rápida

### Caso A — mudança só no estado local
Verificar se:
- é projeção efêmera de UI
- ou precisa entrar na fila e sincronizar

Não empurrar para `queue_ops` algo que não pertence ao modelo sincronizável.

### Caso B — nova entidade/tabela sincronizada
Verificar se precisa:
- store Dexie
- `tableMap`
- lógica de apply local
- pull
- rollback
- suporte no `sync-batch`

### Caso C — novo reason code / validação
Separar:
- validação local defensiva
- validação autoritativa no servidor
- tratamento do rollback local

### Caso D — upload de métricas/telemetria
Separar:
- buffer local append-only
- cursor de envio
- upload remoto idempotente
- não misturar métricas com fila transacional de domínio

---

## Invariantes obrigatórias

- rollback deve restaurar exatamente o `before_snapshot`
- ordem reversa de rollback deve continuar segura
- retry não pode quebrar idempotência
- `tableMap` continua sendo fronteira entre nome remoto e store local
- não misturar `state_*`, `event_*`, `queue_*` e `catalog_*`
- pull seletivo não pode ser perdido ao tocar entidades sensíveis
- telemetria não pode quebrar o fluxo principal de sync
- cliente e servidor não podem divergir sobre payload versionado e reason codes

---

## Anti-padrões

- aplicar update local sem snapshot restaurável quando a operação exige rollback
- criar store/tabela sincronizável sem atualizar `tableMap` e reconciliação associada
- mudar order de ops sem revisar implicações no servidor
- aceitar shape inválido localmente e “deixar o servidor resolver”
- duplicar lógica de sync em páginas/componentes
- usar evento/queue para dado que deveria ser cache efêmero
- acoplar flush de telemetria ao sucesso de fluxos críticos de domínio

---

## Checklist antes de alterar

1. A mudança afeta store, queue, apply local, pull, rollback, ou servidor?
2. Existe novo shape sincronizável?
3. Precisa de `tableMap`?
4. O rollback ainda recompõe o estado com fidelidade?
5. Há impacto em retry e idempotência?
6. Há impacto em reason codes e UX de erro?

---

## Forma de entrega

Retornar:
- diff mínimo
- parte do pipeline afetada
- invariantes preservadas
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar sync/rollback:
- testar cenário `APPLIED`
- testar cenário `REJECTED`
- testar retry/falha de rede quando aplicável

---

## Escalonamento

Escalar para `migrations-rls-contracts` quando tocar:
- schema
- RLS
- constraints
- views
- blocked tables

Escalar para skill de domínio quando a mudança for principalmente de regra sanitária/reprodutiva/movimentação, e não da infraestrutura offline