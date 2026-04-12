# Modelo de Segurança e RLS

> **Status:** Normativo
> **Fonte de Verdade:** SQL Policies (PostgreSQL)
> **Última Atualização:** 2026-04-07

Este documento define as regras de Row Level Security (RLS) e Controle de Acesso (RBAC).

---

## 1) Princípios e Ameaças Cobertas

### Princípios
1. **Isolamento absoluto por tenant (Tenancy):** dados de uma fazenda são invisíveis para outras.
2. **Least privilege (RBAC):** Cowboy opera; Manager administra recursos; Owner administra o negócio.
3. **Integridade e auditabilidade:** histórico de eventos é **append-only** (não altera fatos passados).

### Vetores principais
- **Cross-tenant access** (ler/escrever em outra fazenda)
- **Privilege escalation** (se promover / manipular membros)
- **Business logic bypass** (alterar evento histórico, “corrigir” no lugar)
- **Abuso de RPC `SECURITY DEFINER`** (injeção / search_path hijack)
- **Referência cruzada** (associar entidade de fazenda A em B)

---

## 2) Tenancy e Invariants de Integridade

### 2.1 Coluna de isolamento
- Tabelas de negócio devem conter **`fazenda_id`** (tenant key).

### 2.2 Policies exigem membership
- Leitura e/ou escrita devem exigir membership do usuário na fazenda-alvo via helper:
  - `has_membership(fazenda_id)` (ver Seção 3)

### 2.3 FKs compostas (anti-cross-reference)
Para impedir referência cruzada entre tenants, FKs internas usam **chave composta** incluindo `fazenda_id` quando aplicável:

```sql
CONSTRAINT fk_animais_lote
  FOREIGN KEY (lote_id, fazenda_id)
  REFERENCES lotes (id, fazenda_id);
Efeito: não existe integridade referencial válida entre registros de fazendas diferentes.
```

---

## 3) Helpers de Segurança (funções base das policies)
### 3.1 public.has_membership(_fazenda_id uuid) -> boolean
Contrato: retorna true se auth.uid() possui membership ativo em user_fazendas para a fazenda.
Uso típico: SELECT, INSERT operacional e “visibilidade” em geral.

### 3.2 public.role_in_fazenda(_fazenda_id uuid) -> farm_role_enum
Contrato: retorna o role do usuário (cowboy, manager, owner) na fazenda.
Uso típico: restringir escrita administrativa (UPDATE/DELETE em estrutura, gerência de membros, etc).
Observação: outras helpers podem existir (ex.: can_create_farm()); quando existirem, devem estar documentadas aqui com o mesmo nível de contrato.

---

## 4) Matriz RBAC (visão consolidada)
Legenda: ✅ permitido | ❌ negado | ⚠️ parcial | — N/A (não se aplica)

Área / Recurso	Cowboy	Manager	Owner	Observações
Leitura (geral)	✅	✅	✅	has_membership(fazenda_id)
Operação (Eventos): inserir	✅	✅	✅	registrar fatos
Operação (Eventos): update/delete	❌	❌	❌	append-only via trigger
Agenda (criar/concluir)	✅	✅	✅	mutável, operacional
Animais (CRUD)	✅	✅	✅	operacional
Estrutura (pastos/lotes)	❌	✅	✅	administração de recursos
Cadastros (protocolos/contrapartes)	❌	✅	✅	administração
Fazenda (metadata)	❌	❌	✅	ex.: nome/cidade
Membros (gerenciar)	❌	⚠️	✅	manager não altera owner
Nota de auditoria (exemplo comum): se existir permissão ampla (ex.: Cowboy podendo DELETE em animais), registrar como “Gap” na seção 9 (com recomendação).

---

## 5) Classes de tabelas e padrões de Policy
### 5.1 Tabelas de Sistema (self-only)
user_profiles, user_settings
ALL: user_id = auth.uid() (isolamento por usuário)

### 5.2 Membership (associação usuário↔fazenda)
user_fazendas
SELECT (members view): user_id = auth.uid() OR has_membership(fazenda_id)
WRITE: sem policy permissiva (escrita exclusiva via RPCs administrativas)
Motivação: impedir manipulação direta da membership via API e forçar regras de negócio (owner/last-owner/proteções) nos RPCs.

### 5.3 Tabelas de Estrutura/Estado (admin de fazenda)
Ex.: pastos, lotes, contrapartes, protocolos_* (padrão)
SELECT: has_membership(fazenda_id)
INSERT/UPDATE/DELETE: role_in_fazenda(fazenda_id) IN ('owner','manager')

### 5.4 Tabelas Operacionais — Eventos (histórico)
Ex.: eventos + eventos_* por domínio (sanitário/pesagem/nutrição/etc.)
SELECT: has_membership(fazenda_id)
INSERT: has_membership(fazenda_id)
UPDATE/DELETE: negado por policy e/ou bloqueado por trigger (Seção 6)

### 5.5 Agenda (planejamento mutável)
Ex.: agenda_itens
SELECT: has_membership(fazenda_id)
INSERT/UPDATE/DELETE: has_membership(fazenda_id) (operacional)

---

## 6) Integridade: Append-Only e Triggers
### 6.1 Regra de imutabilidade
Eventos representam “fatos” e não devem ser alterados após inseridos. O banco aplica isso com trigger(s) do tipo prevent_business_update.

Padrão esperado:
Bloquear UPDATE que altere colunas de negócio (ex.: peso, protocolo, data efetiva)
Permitir apenas campos técnicos (ex.: deleted_at, metadados de sync, etc.)

### 6.2 Correções operacionais
Correção de evento ocorre via:
soft-delete do evento incorreto (deleted_at)
inserção de novo evento (eventualmente com referência corrige_evento_id)
Isso exige suporte consistente no frontend (para não “sumir” correções ou duplicar interpretação do histórico).

---

## 7) RPCs Administrativas (SECURITY DEFINER)
RPCs executam com privilégios elevados para operações que o RLS não cobre com segurança/ergonomia. Requisitos mínimos:
Validar permissões do caller com auth.uid() + role_in_fazenda(...)
Usar parâmetros tipados (PL/pgSQL) — sem SQL dinâmico inseguro
Fixar search_path = public
RPCs típicas (exemplos)
create_fazenda(...)
Cria tenant + cria membership do caller como Owner + atualiza active_fazenda (se aplicável)
admin_set_member_role(fazenda_id, target_user_id, new_role)

Safeguards esperados:
Manager não altera Owner
apenas Owner promove a Owner
proteger “last owner” (não rebaixar último)
admin_remove_member(fazenda_id, target_user_id)
Owner only + “last owner protection” + soft-delete
Se houver create_invite(...) ou similares, documentar regra de permissão e safeguards aqui.

---

## 8) Mitigações mapeadas a vetores
Cross-tenant access
Policies exigem has_membership(fazenda_id)
FKs compostas evitam referência cruzada

Privilege escalation
user_fazendas sem escrita direta

RPCs validam role e aplicam safeguards (owner/last-owner)

Business logic bypass (eventos)
Trigger append-only impede UPDATE/DELETE de fatos

SQL injection via RPC
Parâmetros tipados + search_path fixo + evitar SQL dinâmico

---

## 9) Gaps e Riscos Conhecidos (priorizar e manter atualizado)
Registrar aqui apenas itens verificáveis na implementação atual.

Risco 1 — Criação “viral” de fazendas
Causa provável: regra de can_create_farm() permite que usuários (ex.: Owners) criem fazendas indefinidamente
Impacto: abuso de recursos/spam (não necessariamente vazamento de dados)
Mitigação atual: by design
Recomendação: rate-limit / monitoramento / quotas por usuário (futuro)

Risco 2 — Modelo append-only exige correção por “novo evento”
Causa: imutabilidade forte → correções viram soft-delete + novo evento
Impacto: inconsistência lógica se frontend não tratar corretamente correções/duplicatas
Recomendação: padronizar UX/consulta (ex.: ignorar deleted_at, exibir “evento corrigido por X”, etc.)

Risco 3 (Resolvido — TD-003 CLOSED) — Cowboy com DELETE em animais
Sintoma original: Policy de DELETE não filtrava por role.
Status: RESOLVIDO via migration 20260308230748_rbac_delete_hardening_animais.sql
Solução: policies separadas: animais_insert_update_by_membership (todos os membros) e animais_delete_by_role (somente owner/manager).

Nota — Tabelas globais de catalogo:
`produtos_veterinarios`, `catalogo_protocolos_oficiais`, `catalogo_protocolos_oficiais_itens` e `catalogo_doencas_notificaveis` sao globais (sem fazenda_id), com RLS SELECT para authenticated e sem policy de escrita direta. A camada tenant-scoped correspondente e `fazenda_sanidade_config`.

---

## 10) Checklist para evoluir com segurança (quando adicionar tabelas/fluxos)
Ao criar uma nova tabela tenant:
Incluir fazenda_id (ou justificar por que não).
Habilitar RLS e criar policies mínimas:
SELECT: has_membership(fazenda_id)
WRITE: role adequado (ou membership para operação)
Considerar FK composta (id, fazenda_id) para relações internas.
Se for tabela de “fatos” (eventos), aplicar append-only trigger.
Se precisar de operação privilegiada, criar RPC SECURITY DEFINER com safeguards + search_path=public.

---
## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
- [**OFFLINE.md**](./OFFLINE.md)
