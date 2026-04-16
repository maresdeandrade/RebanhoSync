---
name: migrations-rls-contracts
description: Use when the task is about migrations SQL, schema, FKs compostas, enums, views, triggers append-only, RLS, RBAC, RPCs SECURITY DEFINER, blocked tables, contratos versionados, catálogo global vs tenant-scoped, ou mudanças estruturais que exigem alinhar banco, sync e docs normativos.
---

# Migrations — Schema, RLS e Contratos

## Missão

Orientar mudanças estruturais no banco e nos contratos normativos:
- migrations SQL
- schema lógico
- FKs compostas com `fazenda_id`
- enums e views
- triggers append-only
- RLS / RBAC
- RPCs `SECURITY DEFINER`
- blocked tables
- contratos versionados do sync
- fronteira entre catálogo global e tabela tenant-scoped
- decisão de quando abrir ADR

Esta skill cobre a camada **estrutural e normativa**.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `supabase/migrations/**`
- `docs/DB.md`
- `docs/RLS.md`
- `docs/CONTRACTS.md`
- `supabase/functions/sync-batch/**` se houver impacto contratual
- novas tabelas
- alteração de colunas / enums / constraints
- mudança de FK
- triggers append-only
- policies RLS
- RPCs privilegiadas
- tabela global vs tenant-scoped
- contrato canônico de payload

Tracks prováveis:
- `infra.db`
- `infra.rls`
- `infra.contracts`
- qualquer capability que exija mudança estrutural

---

## Quando NÃO usar

Não use esta skill para:
- refino local de UI
- ajustes de domínio que não alteram schema/contrato
- simples leitura/projeção em client sem impacto estrutural

Nesses casos, usar a skill do domínio correspondente.

---

## Ler primeiro

1. `docs/DB.md`
2. `docs/RLS.md`
3. `docs/CONTRACTS.md`

Ler só se necessário:
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CURRENT_STATE.md`

Arquivos-alvo mais comuns:
- `supabase/migrations/**`
- `supabase/functions/sync-batch/**`
- `docs/DB.md`
- `docs/RLS.md`
- `docs/CONTRACTS.md`

---

## Modelo mental obrigatório

Separar sempre:

### A. Tabela tenant-scoped
- carrega `fazenda_id`
- isolada por RLS
- pode exigir FK composta

### B. Tabela global
- exceção explícita
- sem `fazenda_id`
- precisa justificativa arquitetural clara
- geralmente leitura compartilhada / seed / catálogo

### C. Estado mutável vs fato append-only
- estado atual: update permitido
- evento/fato: append-only com trigger e correção por contra-lançamento quando aplicável

### D. Contrato técnico
- shape aceito no cliente
- validação autoritativa no servidor
- reason codes
- compatibilidade offline

---

## Decisão rápida

### Caso A — nova tabela
Perguntar:
1. É tenant-scoped ou global?
2. Precisa de `fazenda_id`?
3. Precisa de RLS?
4. Precisa de FK composta?
5. É estado mutável ou histórico append-only?

### Caso B — nova relação
Se for relação interna multi-tenant:
- presumir FK composta com `fazenda_id`
- só abrir exceção se houver motivo claro e documentado

### Caso C — nova operação privilegiada
Se a operação não é segura/ergonômica via RLS simples:
- avaliar RPC `SECURITY DEFINER`
- com validação explícita
- `search_path = public`

### Caso D — novo campo/contrato em payload
Separar:
- schema TS central
- validação local
- validação autoritativa no servidor
- docs normativos
- testes

---

## Invariantes obrigatórias

- `fazenda_id` continua sendo fronteira de isolamento quando aplicável
- FK composta com `fazenda_id` quando aplicável
- tabelas de eventos/fatos continuam append-only
- `user_fazendas` não ganha escrita direta
- `SECURITY DEFINER` exige validação explícita e `search_path = public`
- policies não devem abrir bypass cross-tenant
- contrato versionado precisa ser validado localmente e no servidor
- catálogo global não deve ser criado por conveniência sem justificativa real
- mudanças estruturais relevantes exigem atualização normativa correspondente

---

## Anti-padrões

- criar FK simples onde a relação é multi-tenant
- criar tabela tenant-scoped sem `fazenda_id`
- usar label derivado como coluna persistida quando deveria ser projeção
- editar eventos históricos via update de negócio
- adicionar policy recursiva/ambígua que consulta a própria tabela de forma insegura
- criar RPC privilegiada sem safeguards explícitos
- mexer no contrato de sync sem alinhar cliente/servidor/docs/testes

---

## Checklist antes de alterar

1. A entidade é global ou tenant-scoped?
2. Precisa de `fazenda_id`?
3. Precisa de RLS?
4. Precisa de FK composta?
5. É estado mutável ou evento append-only?
6. Há impacto em cliente/offline/sync?
7. Precisa atualizar docs normativos?
8. Precisa abrir ADR?

---

## Forma de entrega

Retornar:
- migration mínima
- justificativa da modelagem
- impacto em RLS/FKs/views/contrato
- até 3 riscos
- docs que precisam ser atualizados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar schema/contrato:
- revisar alinhamento cliente-servidor
- revisar tests SQL/TS quando aplicável
- revisar fluxo offline/sync afetado

---

## Atualização documental obrigatória

Quando houver impacto estrutural relevante, revisar:
- `docs/DB.md`
- `docs/RLS.md`
- `docs/CONTRACTS.md`

Docs derivados:
- só atualizar se a mudança alterar estado funcional real

---

## Quando abrir ADR

Abrir ADR se a mudança alterar:
- contrato do sync
- ordering / deduplicação / status codes
- modelo canônico de dados
- invariantes de RLS / RBAC / RPC
- arquitetura offline-first / Two Rails
- regra normativa que passa a orientar o produto