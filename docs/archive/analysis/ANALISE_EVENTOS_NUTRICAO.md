# Análise de Eventos: Nutrição

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** `DB.md`, Migrations
> **Última Atualização:** 2026-02-15

Análise técnica do módulo de nutrição (Suplementação, Ração).

---

## 1. Escopo e Referências

Cobre tabela `eventos_nutricao`.
Normativos Relacionados:

- [**DB.md**](../DB.md)

## 2. Estado Atual (Implementado)

- **Tabelas:**
  - `eventos_nutricao`: Existe no schema.
- **UI:** **INEXISTENTE**. Não há formulário para criar eventos de nutrição.
- **Lógica:**
  - Tabela existe, mas não é alimentada pelo App.

## 3. Inventário Técnico

### 3.1 Tabelas e Campos Críticos

| Tabela             | Campo            | Tipo    | Regra    | Obs                     |
| :----------------- | :--------------- | :------ | :------- | :---------------------- |
| `eventos_nutricao` | `alimento_nome`  | Text    | Nullable | Deveria ser Obrigatório |
| `eventos_nutricao` | `quantidade_kg`  | Numeric | Nullable | Deveria ser Obrigatório |
| `eventos_nutricao` | `custo_estimado` | Numeric | -        | Não existe              |

### 3.2 Gaps Identificados

- **TD-006** (Crítico): Tabela existe mas funcionalidade é inacessível (Sem UI).
- **TD-017** (Integridade): Campos críticos (`alimento`, `quantidade`) são nullable no banco.

## 4. Propostas de Evolução

### 4.1 Implementação UI (Fase 1)

Criar aba "Nutrição" em `/registrar` permitindo selecionar Lote e informar Alimento/Qtd por cabeça.

### 4.2 Estoque Nutricional (Fase 3)

Integrar com controle de estoque de insumos (Sal, Ração, Silagem).

## 5. Veja Também

- [**TECH_DEBT.md**](../TECH_DEBT.md) (Item TD-006)
