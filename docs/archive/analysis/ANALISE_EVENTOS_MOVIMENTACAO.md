# Análise de Eventos: Movimentação (Troca de Lote)

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** `DB.md`, `src/pages/Registrar.tsx`, `sync-batch`
> **Última Atualização:** 2026-02-15

Análise técnica do módulo de movimentação de animais entre lotes.

---

## 1. Escopo e Referências

Cobre tabela `eventos_movimentacao` e lógica de atualização de `animais.lote_id`.
Normativos Relacionados:

- [**EVENTOS_AGENDA_SPEC.md**](../EVENTOS_AGENDA_SPEC.md) (Regra Anti-Teleport)

## 2. Estado Atual (Implementado)

- **Tabelas:**
  - `eventos_movimentacao`: Detalhe 1:1 com `eventos`.
- **UI:** Fluxo de "Troca de Lote" em `/registrar`.
- **Lógica:**
  - **Anti-Teleport:** Implementado no `sync-batch` (Edge Function).
  - **Two Rails:** Atualiza `animais.lote_id` (State Rail) e insere `eventos_movimentacao` (Event Rail) na mesma transação.

## 3. Inventário Técnico

### 3.1 Tabelas e Campos Críticos

| Tabela                 | Campo          | Tipo | Regra    | Obs                  |
| :--------------------- | :------------- | :--- | :------- | :------------------- |
| `eventos_movimentacao` | `from_lote_id` | UUID | Nullable | Origem do movimento  |
| `eventos_movimentacao` | `to_lote_id`   | UUID | Nullable | Destino do movimento |

### 3.2 Gaps Identificados

- **TD-008** (Integridade): `sync-batch` deve validar se `from_lote_id != to_lote_id` (evitar movimento nulo).
- **TD-018** (UX): UI permite selecionar `to_lote_id` igual ao atual sem aviso claro (embora backend possa rejeitar ou ignorar).
- **TD-019** (Dados): Faltam FKs explícitas de `from_lote_id` e `to_lote_id` para tabela `lotes` (integridade relacional fraca no DB).

## 4. Propostas de Evolução

### 4.1 Validação Backend

Reforçar `sync-batch` para rejeitar movimentos onde origem == destino.

### 4.2 Histórico de Pastos

No futuro, rastrear também `from_pasto_id` e `to_pasto_id` (atualmente inferido via lote).

## 5. Veja Também

- [**TECH_DEBT.md**](../TECH_DEBT.md) (Itens TD-008, TD-019)
