# Roadmap do Produto (Governed)

> **Status:** Derivado (Planejamento)
> **Fonte de Verdade:** `00_MANIFESTO.md`, `TECH_DEBT.md` (OPEN), `IMPLEMENTATION_STATUS.md`, `E2E_MVP.md`
> **Última Atualização:** 2026-02-16
> **Baseline Commit:** 4c46c5c

Este roadmap define as etapas para estabilização e lançamento do RebanhoSync, priorizando a resolução de dívidas técnicas **OPEN** críticas e a conformidade com o Manifesto do Produto.

---

## 1. Princípios de Execução

1.  **Integridade Primeiro:** Nenhuma feature nova é iniciada enquanto houver Gaps P0 (Críticos) de integridade ou segurança.
2.  **Offline-First:** Funcionalidades só são consideradas "Prontas" se funcionarem 100% sem internet.
3.  **Qualidade E2E:** Cada milestone exige aprovação nos fluxos definidos em `E2E_MVP.md`.
4.  **Evidência Obrigatória:** Cada claim deve ter evidência verificável (path de arquivo/migration).

---

## 2. Milestones (6 Semanas)

### M0: Estabilização Crítica (Semanas 1-2)

**Objetivo:** Resolver P0 bloqueantes e garantir integridade básica.

- **Scope (Tech Debt P0 - OPEN):**
  - `TD-001`: Implementar limpeza automática de `queue_rejections` (evitar estouro de storage).
    - **Fluxo E2E:** Offline→Online→Sync (Fluxo 2)
  - `TD-006`: Implementar UI de Nutrição (feature existente no backend, inacessível no app).
    - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)
  - `TD-008`: Bloquear movimentação para mesmo lote (Anti-Teleport Frontend).
    - **Fluxo E2E:** Anti-Teleporte (Fluxo 3)

- **Semana 1:**
  - [ ] TD-001: Rotina de limpeza de rejections (Job no syncWorker + UI em Reconciliacao.tsx)
  - [ ] TD-008: Validação frontend em Registrar.tsx (desabilitar lote origem no Select destino)

- **Semana 2:**
  - [ ] TD-006: Criar NutricaoForm component + integração em Registrar.tsx
  - [ ] Testar Fluxo 2 (Sync interrompido) com queue cleanup
  - [ ] Testar Fluxo 3 (Anti-Teleporte) com validação frontend

* **Dependencies:**
  - Nenhuma externa. Apenas refatoração interna.

- **Critérios de Aceite:**
  - [ ] Fluxos **Autenticação e Fazenda**, **RBAC**, **Offline→Online→Sync** e **Anti-Teleporte** (`E2E_MVP.md`) aprovados.
  - [ ] Sync interrompido (Fluxo 2):
    - Após kill do app, `queue_gestures` e `client_tx_id` permanecem em Dexie.
    - Gesto termina em `DONE` ou `REJECTED` com registro em `queue_rejections`.
    - `state_*` consistente após pull (sem duplicação/falta de registros).
    - Rejections antigas (>7 dias) são limpas automaticamente.
  - [ ] Todas as tabelas do MVP possuem interfaces de escrita funcionais (`/registrar`).
  - [ ] Movimentação com origem==destino bloqueada no frontend.

### M1: Consistência Operacional (Semanas 3-4)

**Objetivo:** Refinar a validade dos dados e a usabilidade para evitar erros de operação.

- **Scope (Tech Debt P1 - OPEN):**
  - `TD-014`: Bloquear entrada de peso inválido/vazio (Validação Frontend).
    - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)
  - `TD-003`: Restringir `DELETE` de animais apenas para Owners (Segurança).
    - **Fluxo E2E:** RBAC (Fluxo 1)
  - `TD-019`: Adicionar FKs faltantes em `eventos_movimentacao` (Integridade Referencial).
    - **Fluxo E2E:** Anti-Teleporte (Fluxo 3)
  - `TD-020`: Adicionar FK faltante em `eventos_reproducao.macho_id` (Integridade Referencial).
    - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)

- **Semana 3:**
  - [ ] TD-014: Validação de peso > 0 em Registrar.tsx (PesagemForm)
  - [ ] TD-003: Migration RLS para restringir DELETE de animais (owner/manager only)
  - [ ] Testar Fluxo 1 (RBAC) com restrição de DELETE

- **Semana 4:**
  - [ ] TD-019: Migration para criar FKs (from_lote_id, to_lote_id → lotes.id)
  - [ ] TD-020: Migration para criar FK (macho_id → animais.id)
  - [ ] Testar Fluxo 3 (Anti-Teleporte) com FK constraints
  - [ ] Testar Fluxo 6 (Hardening) com todas validações

* **Dependencies:**
  - M0 concluído.

- **Critérios de Aceite:**
  - [ ] Fluxos **Deduplicação de Agenda**, **Setup de Fazenda** e **Hardening de Eventos** (`E2E_MVP.md`) aprovados.
  - [ ] Impossível inserir eventos com IDs inválidos (Foreign Key violada).
  - [ ] Cowboy não consegue deletar animais.
  - [ ] Pesagem com peso <= 0 bloqueada antes do envio.

### M2: Performance e Hardening Final (Semanas 5-6)

**Objetivo:** Otimizar performance e fechar todos os fluxos E2E.

- **Scope (Tech Debt P2 - OPEN + P1 Opcional):**
  - `TD-004`: Índices de performance completos para escala.
    - **Fluxo E2E:** Operacional (Fluxo 7)
  - `TD-015`: Otimizar cálculo de GMD (View ou Materialização).
    - **Fluxo E2E:** Operacional (Fluxo 7)
  - `TD-011`: _(Opcional - Nice to Have)_ Criar catálogo básico de Produtos Veterinários.
    - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)

- **Semana 5:**
  - [ ] TD-004: Migration para criar índices compostos otimizados
    - [ ] `idx_eventos_fazenda_occurred` on `(fazenda_id, occurred_at)`
    - [ ] `idx_eventos_animal_occurred` on `(animal_id, occurred_at)`
    - [ ] `idx_eventos_fazenda_dominio` on `(fazenda_id, dominio)`
  - [ ] Medir performance com dataset de teste (5000 animais)
  - [ ] Validar via `EXPLAIN ANALYZE` em queries do Dashboard

- **Semana 6:**
  - [ ] TD-015: Criar view materializada `vw_gmd_dashboard` ou campo calculado
  - [ ] Atualizar Dashboard.tsx para usar view otimizada
  - [ ] Testar Fluxo 7 (Operacional) completo
  - [ ] _(Se tempo permitir)_ TD-011: Criar tabela `produtos_veterinarios` e migrar UI

- **Dependencies:**
  - M0 e M1 concluídos.
- **Critérios de Aceite:**
  - [ ] Fluxo **Operacional** (`E2E_MVP.md`) aprovado.
  - [ ] Todo o roteiro `E2E_MVP.md` aprovado com sucesso.
  - [ ] Performance validada (TD-004, TD-015):
    - Dataset de teste documentado (ex: 5000 animais, histórico representativo).
    - Medição com `performance.now()` reportada no PR de implementação.
    - `EXPLAIN ANALYZE` valida uso de índices em queries do Dashboard.
    - Dashboard carrega em < 2s com 5000 animais.

---

## 3. Backlog de Futuro (Uncommitted)

Épicos identificados para pós-V1, dependentes de feedback de uso real.

- **E-020: Gestão Avançada de Catálogos** (Expansão do TD-011 para gestão de estoque).
- **E-021: Nutrição de Precisão** (Custos por cabeça, dietas complexas).
- **E-022: Genealogia Automática** (Árvore genealógica visual, cálculo de consanguinidade).
- **E-023: Painel de Resolução de Conflitos** (UI para tratar `REJECTED` complexos).
- **E-024: Integração Externa** (Balanças Bluetooth, leitores RFID).

---

## 4. Riscos & Mitigações

- **Risco:** Armazenamento local (IndexedDB) exceder cota em dispositivos antigos.
  - _Mitigação:_ Implementar política de retenção (TD-001) e compactação de logs antigos.
- **Risco:** Conflitos de edição simultânea em Agenda.
  - _Mitigação:_ Reforçar logica de `dedup_key` e last-write-wins para status de tarefas.
- **Risco:** Integridade de dados migrados (legado).
  - _Mitigação:_ Scripts de validação pós-migração e bloqueio de novos dados inconsistentes.

---

> **Nota:** Este roadmap é dinâmico. A prioridade é sempre **estabilizar o MVP** conforme o Manifesto, antes de expandir funcionalidades.
