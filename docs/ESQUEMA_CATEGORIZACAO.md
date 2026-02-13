# Esquema de Classificação de Categorias Zootécnicas

Este documento detalha o esquema de classificação de animais utilizado no sistema, baseando-se na análise dos arquivos:
- `@/src/pages/Categorias.tsx` (Visualização e Gestão)
- `@/src/lib/domain/categorias.ts` (Lógica de Domínio e Classificação)
- `@/src/pages/CategoriaNova.tsx` (Criação de Novas Categorias)

## 1. Estrutura de Dados (`CategoriaZootecnica`)

A classificação é baseada na entidade `CategoriaZootecnica` (definida em `@/src/lib/offline/types.ts` e utilizada nos arquivos analisados). As colunas principais para classificação são preservadas conforme a implementação atual.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `string` (UUID) | Identificador único da categoria. |
| `fazenda_id` | `string` (UUID) | Vínculo com a fazenda proprietária. |
| `nome` | `string` | Nome descritivo da categoria (ex: "Bezerro", "Vaca"). |
| `sexo` | `SexoEnum` ('M' \| 'F') \| `null` | Restrição de sexo. `null` se `aplica_ambos` for `true`. |
| `aplica_ambos` | `boolean` | Define se a categoria aceita ambos os sexos. |
| `idade_min_dias` | `number` \| `null` | Idade mínima em dias para enquadramento. `null` = 0. |
| `idade_max_dias` | `number` \| `null` | Idade máxima em dias para enquadramento. `null` = Infinito. |
| `ativa` | `boolean` | Status da categoria. Apenas categorias ativas são consideradas na classificação automática. |
| `payload` | `Record<string, unknown>` | Metadados flexíveis (JSON). Usado para critérios específicos (ex: `papel_macho`). |

## 2. Atributos Classificatórios

A classificação de um animal em uma categoria depende da combinação de atributos principais: **Sexo**, **Idade**, **Status** e **Critérios Específicos** (definidos no payload).

### 2.1. Sexo (`sexo` e `aplica_ambos`)

O sistema suporta três variações de classificação por sexo:

1.  **Ambos (Macho e Fêmea):**
    -   `aplica_ambos`: `true`
    -   `sexo`: `null` (ou ignorado)
    -   *Exemplo:* "Bezerro(a)" (0 a 8 meses).

2.  **Apenas Machos:**
    -   `aplica_ambos`: `false`
    -   `sexo`: `'M'`
    -   *Exemplo:* "Garrote", "Touro", "Boi".

3.  **Apenas Fêmeas:**
    -   `aplica_ambos`: `false`
    -   `sexo`: `'F'`
    -   *Exemplo:* "Novilha", "Vaca".

### 2.2. Idade (`idade_min_dias` e `idade_max_dias`)

A idade do animal é calculada em dias (`differenceInDays(hoje, data_nascimento)`).

-   **Mínimo (`idade_min_dias`):** O valor `null` é tratado como `0`.
-   **Máximo (`idade_max_dias`):** O valor `null` é tratado como Infinito (sem limite superior).
-   **Intervalo:** A classificação ocorre se: `min <= idade_dias <= max`.

### 2.3. Status (`ativa`)

-   **Ativa (`true`):** A categoria é utilizada na classificação automática e aparece nas listagens principais.
-   **Inativa (`false`):** A categoria é ignorada na classificação automática. Visualmente diferenciada na listagem (`Badge` variant "secondary").

### 2.4. Critérios Específicos (via `payload`)

Algumas categorias podem exigir condições adicionais definidas no campo `payload.criteria`.

-   **Papel do Macho (`papel_macho`):** Exige que o animal tenha um papel específico (ex: "reprodutor").
-   **Habilitado Monta (`habilitado_monta`):** Exige que o animal esteja habilitado para monta (`true` ou `false`).

## 3. Lógica de Classificação Automática

A função `classificarAnimal(animal, categorias)` em `@/src/lib/domain/categorias.ts` implementa a seguinte lógica sequencial para determinar a categoria de um animal:

1.  **Entrada:** Recebe um objeto `Animal` e uma lista de `CategoriaZootecnica`.
2.  **Pré-requisito:** O animal deve possuir `data_nascimento`.
3.  **Iteração:** Percorre a lista de categorias (a ordem do array é importante, pois retorna a primeira correspondência - *First Match*).
4.  **Critérios de Correspondência (Match):**
    -   **Sexo:** O animal corresponde se a categoria aceita ambos (`aplica_ambos`) OU se o sexo do animal é igual ao `sexo` da categoria.
    -   **Idade:** A idade do animal em dias deve estar dentro do intervalo [min, max] da categoria.
    -   **Status:** A categoria deve estar `ativa`.
    -   **Critérios Especiais (Payload):** Se definidos, o animal deve corresponder aos valores exigidos (ex: `papel_macho`, `habilitado_monta`).
5.  **Resultado:** Retorna a **primeira** categoria que satisfaz todos os critérios, ou `null` se nenhuma corresponder.

## 4. Categorias Padrão (`CATEGORIAS_PADRAO`)

O sistema define um conjunto inicial de categorias para novas fazendas:

| Nome | Sexo | Idade (Dias) | Idade Aprox. | Critérios Adicionais |
| :--- | :--- | :--- | :--- | :--- |
| **Bezerro(a)** | Ambos | 0 a 240 | 0 a 8 meses | - |
| **Garrote** | Macho | 241 a 730 | 8 a 24 meses | - |
| **Novilha** | Fêmea | 241 a 900 | 8 a 30 meses | - |
| **Touro** | Macho | > 731 | > 24 meses | `papel_macho` = 'reprodutor' E `habilitado_monta` = true |
| **Boi** | Macho | > 731 | > 24 meses | - (Categoria padrão para machos adultos) |
| **Vaca** | Fêmea | > 901 | > 30 meses | - |

> **Nota:** A categoria "Touro" é verificada antes de "Boi" devido à ordem de precedência. Animais que não atendem aos critérios de "Touro" caem na categoria "Boi".

## 5. Interface de Usuário (UI)

### Visualização (`Categorias.tsx`)
-   **Listagem:** Cards em grid.
-   **Indicadores:**
    -   **Badge de Status:** "Ativa" (Default) vs "Inativa" (Secondary).
    -   **Sexo:** Exibido como "Ambos", "Machos" ou "Fêmeas".
    -   **Idade:** Exibido como "X a Y dias" ou "X a ∞" (se max for null).

### Criação (`CategoriaNova.tsx`)
-   **Formulário:**
    -   **Nome:** Obrigatório.
    -   **Sexo Aplicável:** Select com opções "Ambos", "Apenas Machos", "Apenas Fêmeas". Mapeia para `aplica_ambos` e `sexo` conforme descrito na seção 2.1.
    -   **Idade Mínima:** Input numérico (dias).
    -   **Idade Máxima:** Input numérico (dias). Opcional (vazio = sem limite).
    -   **Status:** Inicializado fixamente como `ativa: true`.
