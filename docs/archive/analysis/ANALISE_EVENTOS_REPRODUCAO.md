# Análise de Eventos: Reprodução

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** `DB.md`, Migrations
> **Última Atualização:** 2026-02-15

Análise técnica do módulo de reprodução (Cobertura, Diagnóstico, Parto).

---

## 1. Escopo e Referências

Cobre tabela `eventos_reproducao`.
Normativos Relacionados:

- [**DB.md**](../DB.md)

## 2. Estado Atual (Implementado)

- **Tabelas:**
  - `eventos_reproducao`: Existe no schema.
- **UI:** **INEXISTENTE**. Não há formulário para registro de eventos reprodutivos.
- **Lógica:**
  - Enum `repro_tipo_enum` existe (`cobertura`, `IA`, `diagnostico`, `parto`).
  - Sem validação de lógica reprodutiva (ex: intervalo entre partos, gestação).

## 3. Inventário Técnico

### 3.1 Tabelas e Campos Críticos

| Tabela               | Campo                 | Tipo | Regra             | Obs                              |
| :------------------- | :-------------------- | :--- | :---------------- | :------------------------------- |
| `eventos_reproducao` | `tipo`                | Enum | `repro_tipo_enum` | Obrigatório                      |
| `eventos_reproducao` | `macho_id`            | UUID | Nullable          | Sem FK para `animais` da fazenda |
| `eventos_reproducao` | `diagnostico_prenhez` | Bool | -                 | Inferido via payload             |

### 3.2 Gaps Identificados

- **TD-007** (Crítico): Funcionalidade inacessível (Sem UI).
- **TD-020** (Integridade): `macho_id` não tem Foreign Key para tabela `animais` (permite ID inválido ou de outra fazenda).
- **TD-021** (Lógica): Não há validação de ciclos (ex: registrar parto sem cobertura anterior).

## 4. Propostas de Evolução

### 4.1 Implementação UI (Fase 1)

Criar formulários específicos para:

1.  Inseminação/Monta (Cobertura)
2.  Diagnóstico de Gestação (Toque)
3.  Parto (Nascimento + Vínculo Mãe/Cria)

### 4.2 Genealogia

Automatizar vínculo de `pai_id` e `mae_id` no cadastro do bezerro a partir do evento de parto.

## 5. Veja Também

- [**TECH_DEBT.md**](../TECH_DEBT.md) (Itens TD-007, TD-020)
