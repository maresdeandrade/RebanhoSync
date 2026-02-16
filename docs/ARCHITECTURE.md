# Arquitetura do RebanhoSync

> **Status:** Normativo
> **Fonte de Verdade:** Código Fonte (Implementação Two Rails)
> **Última Atualização:** 2026-02-15

Este documento é a **Fonte de Verdade** arquitetural do sistema RebanhoSync. Ele consolida os princípios de Two Rails, Offline-First, Multi-Tenancy e Segurança.

---

## 1. Visão Geral

O **RebanhoSync** é um sistema de gestão pecuária habilitado para **Offline-First**, utilizando sincronização bidirecional entre um banco de dados local (Dexie.js/IndexedDB) e um remoto (Supabase/PostgreSQL).

### Inventário Técnico

Para detalhes de versões, bibliotecas e estrutura de arquivos, consulte os documentos derivados:

- [**STACK.md**](./STACK.md) (Versões de libs e ferramentas)
- [**REPO_MAP.md**](./REPO_MAP.md) (Estrutura de diretórios)

---

## 2. Princípios Arquiteturais: Two Rails

O sistema adota o padrão **Two Rails** para desacoplar o planejamento (Agenda) da execução (Eventos).

### Rail 1 (Agenda) - Mutável

- **Propósito:** Planejamento e intenção futura.
- **Tabela:** `agenda_itens`.
- **Características:**
  - Mutável (Status: `agendado` → `concluido` | `cancelado`).
  - Deduplicação via `dedup_key`.
- **Stores Locais:** `state_agenda_itens`.

### Rail 2 (Eventos) - Append-Only

- **Propósito:** Registro histórico de fatos (Source of Truth).
- **Tabela:** `eventos` + Tabelas Satélites (`eventos_sanitario`, etc).
- **Características:**
  - Imutável (Trigger `prevent_business_update`).
  - Correção via contra-lançamento (`corrige_evento_id`).
- **Stores Locais:** `event_eventos`, `event_eventos_*`.

### Desacoplamento

Não existe FK rígida entre `agenda_itens` e `eventos`. A relação é apenas lógica (`source_evento_id` / `source_task_id`), permitindo criação offline sem dependência de IDs síncronos.

---

## 3. Fluxo de Dados (Offline-First)

### 3.1 Componentes

1.  **Cliente (Dexie.js):**
    - `state_*`: Active Record (estado atual).
    - `event_*`: Log local.
    - `queue_*`: Fila de sincronização (Gestures/Ops).

2.  **Motor de Sync (`syncWorker`):**
    - Processa fila `queue_gestures`.
    - Envia batches para `sync-batch`.
    - Trata rollback local em caso de `REJECTED`.

3.  **Server (`sync-batch`):**
    - Gateway transacional autoritativo.
    - Força `fazenda_id` (Tenant Isolation).
    - Valida regras de negócio (Anti-Teleport).

### 3.2 Fluxo de Execução

1.  **Offline Write:** UI grava `state` e `queue` atomicamente. Update imediato (Optimistic UI).
2.  **Sync:** Worker envia batch.
3.  **Enforcement:** Servidor valida Auth, Tenant e Regras.
4.  **Response:** `APPLIED`, `APPLIED_ALTERED` ou `REJECTED`.

---

## 4. Multi-tenancy

O sistema é isolado logicamente por `fazenda_id` em todas as tabelas.

- **Dados:** Toda tabela tem `fazenda_id` com FK.
- **Acesso:** Tabela `user_fazendas` controla membership.
- **Segurança:** RLS (`has_membership`) e Sync Function garantem isolamento.

---

## 5. Segurança (Defense in Depth)

- **RLS:** Políticas de banco bloqueiam acesso indevido via API direta.
- **RBAC:** Roles `Owner`, `Manager`, `Cowboy` definem permissões (ver [RLS.md](./RLS.md)).
- **Sync Batch:** Atua como firewall, validando JWT e impondo Tenant Context.
- **RPCs:** Operações críticas (`admin_*`) usam `SECURITY DEFINER`.

---

## 6. Módulos de Domínio

Os módulos encapsulam a lógica de negócio específica:

- **Sanitário:** Gestão de vacinas e medicamentos.
- **Reprodução:** Ciclo reprodutivo, Status Computation e Episode Linking.
- **Eventos:** Abstração de gestos para todos os domínios.

---

## 7. Invariantes do Sistema

1.  **Fazenda Mandatória:** Todo dado pertence a uma fazenda.
2.  **Imutabilidade de Eventos:** Histórico não é alterado.
3.  **Servidor Autoritativo:** Rollback local em conflito.
4.  **Anti-Teleporte:** Animal não muda de lugar sem evento de movimentação.

---

## 8. Roteamento

Para a lista completa de rotas e proteções, consulte:

- [**ROUTES.md**](./ROUTES.md)

---

## 9. Manutenção e Gaps

Pontos de atenção técnica:

1.  **Limpeza de Queue:** Necessário job para limpar `queue_rejections`.
2.  **Sync Background:** Implementar Background Sync API.
3.  **Testes:** Expandir cobertura E2E conforme [E2E_MVP.md](./E2E_MVP.md).

---

## Veja Também

- [**DB.md**](./DB.md) - Esquema do banco de dados.
- [**RLS.md**](./RLS.md) - Modelo de segurança e permissões.
- [**CONTRACTS.md**](./CONTRACTS.md) - Contratos de API e Sincronização.
- [**OFFLINE.md**](./OFFLINE.md) - Detalhes da implementação Dexie.
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md) - Regras de negócio de Eventos/Agenda.
- [**E2E_MVP.md**](./E2E_MVP.md) - Roteiro de testes.
- **Derivados:** [STACK.md](./STACK.md), [REPO_MAP.md](./REPO_MAP.md), [ROUTES.md](./ROUTES.md).
