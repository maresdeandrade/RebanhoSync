# Análise de Eventos: Sanitário

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** `DB.md`, `CONTRACTS.md`, Migrations (`0001`, `0017`)
> **Última Atualização:** 2026-02-15

Análise técnica do módulo sanitário (Vacinação, Tratamentos).

---

## 1. Escopo e Referências

Cobre tabelas `eventos_sanitario`, `protocolos_sanitarios`, `protocolos_sanitarios_itens` e `agenda_itens`.
Normativos Relacionados:

- [**DB.md**](../DB.md) (Schema)
- [**EVENTOS_AGENDA_SPEC.md**](../EVENTOS_AGENDA_SPEC.md) (Regras de Eventos)

## 2. Estado Atual (Implementado)

- **Tabelas:**
  - `eventos_sanitario`: Detalhe 1:1 com `eventos`.
  - `protocolos_sanitarios`: Cabeçalho de templates.
  - `protocolos_sanitarios_itens`: Itens de templates.
- **UI:** Formulário básico em `/registrar` para "Sanitário" (Vacina, Vermífugo, Medicamento).
- **Lógica:**
  - Sem validação de estoque (não existe estoque).
  - Campos de texto livre para `produto`.

## 3. Inventário Técnico

### 3.1 Tabelas e Campos Críticos

| Tabela              | Campo          | Tipo    | Origem                | Obs                                      |
| :------------------ | :------------- | :------ | :-------------------- | :--------------------------------------- |
| `eventos_sanitario` | `tipo`         | Enum    | `sanitario_tipo_enum` | vacinacao, vermifugacao, medicamento     |
| `eventos_sanitario` | `produto`      | Text    | Input Usuário         | **Risco:** Texto livre, sem padronização |
| `eventos_sanitario` | `dose`         | Numeric | Input Usuário         | Unidade em outro campo texto             |
| `eventos_sanitario` | `lote_produto` | Text    | Input Usuário         | Opcional                                 |

### 3.2 Gaps Identificados

- **TD-011** (Integridade): Texto livre em `produto` impede relatórios precisos.
- **TD-012** (Features): Falta catálogo de produtos veterinários.
- **TD-013** (Compliance): Sem registros de `carencia` (carne/leite).

## 4. Propostas de Evolução

### 4.1 Catálogo de Produtos (Fase 2)

Criar tabela `produtos_veterinarios` para normalizar nomes, princípios ativos e carências.
Ver **E-020** em `TECH_DEBT.md`.

### 4.2 Controle de Estoque (Fase 3)

Tabela de `estoque` (lotes, validade, quantidade) para baixa automática.

## 5. Veja Também

- [**TECH_DEBT.md**](../TECH_DEBT.md) (Itens TD-011, TD-012, TD-013)
- [**ROADMAP.md**](../ROADMAP.md) (Planejamento de Catálogos)
