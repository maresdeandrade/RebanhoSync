# Análise de Eventos: Pesagem

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** `DB.md`, `src/pages/Registrar.tsx`
> **Última Atualização:** 2026-02-15

Análise técnica do módulo de pesagem.

---

## 1. Escopo e Referências

Cobre tabela `eventos_pesagem` e fluxo de registro de peso em lote.
Normativos Relacionados:

- [**DB.md**](../DB.md)

## 2. Estado Atual (Implementado)

- **Tabelas:**
  - `eventos_pesagem`: Detalhe 1:1 com `eventos`.
- **UI:** Formulário `/registrar` permite digitação rápida de peso para múltiplos animais.
- **Lógica:**
  - Validação `peso > 0` existe no DB (Check Constraint).
  - Frontend apenas converte string para number.

## 3. Inventário Técnico

### 3.1 Tabelas e Campos Críticos

| Tabela            | Campo       | Tipo          | Regra                 | Obs                    |
| :---------------- | :---------- | :------------ | :-------------------- | :--------------------- |
| `eventos_pesagem` | `peso_kg`   | Numeric(10,2) | `CHECK (peso_kg > 0)` | Obrigatório            |
| `eventos`         | `animal_id` | UUID          | FK                    | Obrigatório p/ pesagem |

### 3.2 Gaps Identificados

- **TD-014** (UX/Validação): Frontend permite enviar peso 0 ou vazio, causando erro de banco genérico.
- **TD-015** (Performance): Dashboard calcula GMD (Ganho Médio Diário) em memória, pesado para muitos eventos.
- **TD-016** (UX): Não mostra histórico recente de peso na tela de registro (dificulta validar erro de digitação).

## 4. Propostas de Evolução

### 4.1 Validação Frontend

Melhorar `Registrar.tsx` para bloquear envio se `peso <= 0` ou `NaN`.

### 4.2 Ganho de Peso Calculado

Persistir `gmd_calculado` no evento ou materializar view para relatórios.

## 5. Veja Também

- [**TECH_DEBT.md**](../TECH_DEBT.md) (Itens TD-014, TD-015, TD-016)
