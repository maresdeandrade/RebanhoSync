# Esquema de Classificação de Animais

Este documento detalha o esquema de classificação de animais utilizado no sistema, estruturado em duas dimensões principais: **Categoria Zootécnica** (o que o animal é) e **Status Reprodutivo** (em que fase reprodutiva está).

## 1. Dimensões de Classificação

O sistema adota uma abordagem de duas dimensões independentes para classificar animais, evitando a complexidade de categorias combinadas ("Vaca Prenha") e permitindo maior flexibilidade.

### Dimensão A: Categoria Zootécnica
Define o estágio de desenvolvimento do animal baseado em sexo, idade e papel na fazenda.
- **Entidade:** `CategoriaZootecnica` (tabela `state_categorias_zootecnicas`).
- **Atributos:** Sexo, Idade Mínima/Máxima, Ativa, Ordem, Critérios Especiais (Payload).
- **Exemplos:** Bezerro, Novilha, Vaca, Garrote, Boi, Touro.

### Dimensão B: Status Reprodutivo
Define o estado reprodutivo atual de fêmeas, derivado dinamicamente do histórico de eventos.
- **Entidade:** Calculado em tempo de execução (frontend/offline) a partir de `event_eventos` e `event_eventos_reproducao`.
- **Valores:** VAZIA, SERVIDA, PRENHA, PARIDA, LACTANTE, REPETIDORA, DESMAME_PENDENTE.

---

## 2. Categoria Zootécnica (`CategoriaZootecnica`)

A classificação zootécnica é determinada pela função `classificarAnimal` (`@/src/lib/domain/categorias.ts`).

### 2.1. Estrutura de Dados
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID` | Identificador único. |
| `nome` | `string` | Nome descritivo (ex: "Bezerro"). |
| `sexo` | `Enum` | 'M', 'F' ou null (se `aplica_ambos`). |
| `idade_min/max` | `int` | Intervalo de idade em dias. |
| `ativa` | `bool` | Se a categoria é considerada na classificação. |
| `payload.order` | `int` | Prioridade de classificação (menor número = maior prioridade). Default: 9999. |
| `payload.criteria` | `JSON` | Critérios adicionais (ex: `papel_macho`). |

### 2.2. Lógica de Classificação Determinística
Para evitar ambiguidade (First Match instável), as categorias são **ordenadas** antes da verificação, seguindo a precedência:
1.  **Status:** Ativas primeiro.
2.  **Ordem:** `payload.order` ascendente.
3.  **Idade Mínima:** Menores idades primeiro.
4.  **Especificidade:** Categorias específicas (`aplica_ambos=false`) antes de genéricas.
5.  **Nome:** Alfabética.

O animal é classificado na **primeira categoria** da lista ordenada que satisfaça:
-   Sexo compatível.
-   Idade dentro do intervalo.
-   Status ativo.
-   Critérios especiais (se definidos).

### 2.3. Categorias Padrão
| Ordem | Nome | Sexo | Idade (Dias) | Critérios Adicionais |
| :--- | :--- | :--- | :--- | :--- |
| 10 | **Bezerro(a)** | Ambos | 0 a 240 | - |
| 20 | **Garrote** | Macho | 241 a 730 | - |
| 30 | **Novilha** | Fêmea | 241 a 900 | - |
| 40 | **Touro** | Macho | > 731 | `papel_macho`='reprodutor' E `habilitado_monta`=true |
| 50 | **Boi** | Macho | > 731 | - (Fallback para machos adultos) |
| 60 | **Vaca** | Fêmea | > 901 | - |

---

## 3. Status Reprodutivo

O status reprodutivo é calculado pela função `calcularStatusReprodutivo` (`@/src/lib/domain/reproducao.ts`).

### 3.1. Regras de Cálculo
O cálculo processa os eventos reprodutivos do animal em ordem cronológica inversa (mais recente primeiro).

| Status | Condição (Precedência Alta para Baixa) |
| :--- | :--- |
| **PARIDA** | Último parto ocorreu há ≤ 45 dias (Puerpério). |
| **DESMAME_PENDENTE** | Existe item na Agenda de desmame pendente/agendado (ainda não implementado totalmente). |
| **LACTANTE** | Último parto há ≤ 210 dias (e não caiu nas regras anteriores). |
| **PRENHA** | Último diagnóstico reprodutivo é POSITIVO. |
| **SERVIDA** | Último serviço (IA/Cobertura) é mais recente que último diagnóstico/parto. |
| **REPETIDORA** | 2 ou mais diagnósticos negativos consecutivos (ou serviços falhos) após o último parto. |
| **VAZIA** | Nenhuma das anteriores (Default para fêmeas adultas sem atividade recente). |

> **Nota:** Machos sempre têm status `VAZIA` (ou null/ignorado na UI).

---

## 4. Interface de Usuário (UI)

-   **Listagem de Animais:** Exibe dois "Badges" distintos:
    -   Badge de Categoria (ex: "Vaca").
    -   Badge de Status Reprodutivo (ex: "Prenha", "Parida").
-   **Filtros:**
    -   Filtro independente para Categoria Zootécnica.
    -   Filtro independente para Status Reprodutivo.
-   **Gestão de Categorias:**
    -   Permite visualizar e editar a ordem (`payload.order`) e critérios das categorias.
    -   Exibe categorias ordenadas conforme a lógica de classificação.
