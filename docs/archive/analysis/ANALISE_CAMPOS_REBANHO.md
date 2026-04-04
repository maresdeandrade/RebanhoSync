# Análise de Campos: Rebanho e Gestão

> **Status:** Derivado (Análise/Proposta)
> **Fonte de Verdade:** [`DB.md`](../DB.md), [`00_MANIFESTO.md`](../00_MANIFESTO.md)
> **Última Atualização:** 2026-02-15

Análise detalhada e propostas para evolução do cadastro de Animais, Pastos e Lotes.

---

## 1. Escopo e Objetivo

Melhorar cadastro e gestão do rebanho sem quebrar o MVP, priorizando performance e usabilidade dos campos já existentes.

## 2. Análise de Gaps (Fase 0 - Quick Wins)

_Identificado como Dívida Técnica (UI/UX)._

### 2.1 Campos Existentes no DB mas Ausentes na UI

| Tabela    | Campo             | Status UI | Prioridade | Ação                |
| :-------- | :---------------- | :-------- | :--------- | :------------------ |
| `animais` | `data_nascimento` | ❌        | Alta       | Adicionar no form   |
| `animais` | `data_entrada`    | ❌        | Alta       | Adicionar no form   |
| `pastos`  | `capacidade_ua`   | ❌        | Alta       | Exibir no card      |
| `lotes`   | `status`          | ❌        | Média      | Badge ativo/inativo |

Ver **TD-003** em [`TECH_DEBT.md`](../TECH_DEBT.md).

## 3. Análise de Performance (Fase 1)

_Identificado como Dívida Técnica (DB)._

### 3.1 Índices Faltantes

| Tabela         | Campo           | Justificativa       |
| :------------- | :-------------- | :------------------ |
| `animais`      | `status`        | Filtros de listagem |
| `agenda_itens` | `data_prevista` | Ordenação de agenda |
| `eventos`      | `dominio`       | Filtro por tipo     |

Ver **TD-004** em [`TECH_DEBT.md`](../TECH_DEBT.md).

## 4. Propostas de Evolução (Fase 2 - Roadmap)

### 4.1 Novos Campos (Animais)

Proposta de adição de campos de rastreabilidade.

- `origem` (Enum), `numero_brinco`, `raca`, `pelagem`.
- Status: Planejado no Roadmap.

### 4.2 Sistema de Sociedade

Módulo para gestão de animais de terceiros.

- Nova tabela `animais_sociedade`.
- Regras de RLS específicas (Owner/Manager).
- Detalhes técnicos em [`ROADMAP.md`](../ROADMAP.md).

### 4.3 Categorias Zootécnicas Automáticas

Classificação dinâmica por Idade/Sexo (sem peso).

- Nova tabela `categorias_zootecnicas`.
- Lógica no Frontend/Backend para classificação em tempo real.

### 4.4 Infraestrutura de Pastos

Expansão do campo JSONB `benfeitorias` para inventário estruturado.

- Cochos, Bebedouros, Cercas.
- Cálculo automático de lotação (UA/ha).

## 5. Referências Cruzadas

- **[DB.md](../DB.md)**: Schema oficial.
- **[TECH_DEBT.md](../TECH_DEBT.md)**: Débitos técnicos (UI/Performance).
- **[ROADMAP.md](../ROADMAP.md)**: Especificação funcional das propostas.
