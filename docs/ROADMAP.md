# Roadmap do Produto (Governed)

> **Status:** Derivado (Planejamento)
> **Fonte de Verdade:** `00_MANIFESTO.md`, `TECH_DEBT.md`, `E2E_MVP.md`
> **Última Atualização:** 2026-02-15

Este roadmap define as etapas para estabilização e lançamento do RebanhoSync, priorizando a resolução de dívidas técnicas críticas e a conformidade com o Manifesto do Produto.

---

## 1. Princípios de Execução

1.  **Integridade Primeiro:** Nenhuma feature nova é iniciada enquanto houver Gaps P0 (Críticos) de integridade ou segurança.
2.  **Offline-First:** Funcionalidades só são consideradas "Prontas" se funcionarem 100% sem internet.
3.  **Qualidade E2E:** Cada milestone exige aprovação nos fluxos definidos em `E2E_MVP.md`.

---

## 2. Milestones

### M0: Estabilização do Piloto (Foco Atual)

**Objetivo:** Garantir que o app não quebre, não corrompa dados e permita operações básicas de todos os domínios do MVP.

- **Scope (Tech Debt P0/P1):**
  - `TD-001`: Implementar limpeza automática de `queue_rejections` (evitar estouro de storage).
  - `TD-006`: Implementar UI de Nutrição (feature existente no backend, inacessível no app).
  - `TD-007`: Implementar UI de Reprodução (feature existente no backend, inacessível no app).
  - `TD-008`: Bloquear movimentação para mesmo lote (Anti-Teleport Frontend).
  - `TD-014`: Bloquear entrada de peso inválido/vazio (Validação Frontend).
  - `TD-003`: Restringir `DELETE` de animais apenas para Owners (Segurança).

* **Dependencies:**
  - Nenhuma externa. Apenas refatoração interna.

- **Critérios de Aceite:**
  - [ ] Fluxos **Autenticação e Fazenda**, **RBAC**, **Offline→Online→Sync** e **Anti-Teleporte** (`E2E_MVP.md`) aprovados.
  - [ ] Sync interrompido (Fluxo 2):
    - Após kill do app, `queue_gestures` e `client_tx_id` permanecem em Dexie.
    - Gesto termina em `DONE` ou `REJECTED` com registro em `queue_rejections`.
    - `state_*` consistente após pull (sem duplicação/falta de registros).
  - [ ] Todas as tabelas do MVP possuem interfaces de escrita funcionais (`/registrar`).

### M1: Consistência Operacional (Próximo)

**Objetivo:** Refinar a validade dos dados e a usabilidade para evitar erros de operação.

- **Scope (Tech Debt P1/P2):**
  - `TD-011`: Criar catálogo básico de Produtos Veterinários (normalizar inputs de texto livre).
  - `TD-019`: Adicionar FKs faltantes em `eventos_movimentacao` (Integridade Referencial).
  - `TD-020`: Adicionar FK faltante em `eventos_reproducao` (Integridade Referencial).

* **Dependencies:**
  - M0 concluído.

- **Critérios de Aceite:**
  - [ ] Fluxos **Deduplicação de Agenda**, **Setup de Fazenda** e **Hardening de Eventos** (`E2E_MVP.md`) aprovados.
  - [ ] Impossível inserir eventos com IDs inválidos (Foreign Key violada).

### M2: Performance e Hardening Final

**Objetivo:** Otimizar performance e fechar todos os fluxos E2E.

- **Scope (Tech Debt P2 + E2E Coverage):**
  - `TD-004`: Índices de performance completos para escala.
  - `TD-015`: Otimizar cálculo de GMD (View ou Materialização).
- **Dependencies:**
  - M0 e M1 concluídos.
- **Critérios de Aceite:**
  - [ ] Fluxo **Operacional** (`E2E_MVP.md`) aprovado.
  - [ ] Todo o roteiro `E2E_MVP.md` aprovado com sucesso.
  - [ ] Performance validada (TD-004, TD-015):
    - Dataset de teste documentado (ex: 5000 animais, histórico representativo).
    - Medição com `performance.now()` reportada no PR de implementação.
    - `EXPLAIN ANALYZE` valida uso de índices em queries do Dashboard.

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
