# ANÁLISE DE CAMPOS DO REBANHO - GESTÃO DO REBANHO

## PROPOSTA REFORMULADA

### Objetivo

Melhorar cadastro e gestão do rebanho sem quebrar o MVP, priorizando:
1. Usar campos já existentes no banco nas interfaces
2. Performance (índices de alto impacto)
3. Evoluir schema SOMENTE quando tiver benefício claro

---

## FASE 0 — Quick Wins (Sem Mudanças de Schema)

**Entrega:** Telas passam a usar campos já existentes no banco.

### 0.1 Animais (UI)

| Campo | Status UI | Prioridade | Observações |
|-------|-----------|------------|-------------|
| `data_nascimento` | ❌ → ✅ | **Alta** | Exibir no detalhe, solicitar no cadastro |
| `data_entrada` | ❌ → ✅ | **Alta/Média** | Importante para origem compra |
| `pai_id` | ❌ → ⚠️ | **Alta** | Mostrar como "opcional/avançado" |
| `mae_id` | ❌ → ⚠️ | **Alta** | Mostrar como "opcional/avançado" |
| `nome` | ❌ → ⚠️ | **Baixa** | Esconder em "mais detalhes" |
| `rfid` | ❌ → ⚠️ | **Baixa** | Esconder em "mais detalhes" |

### 0.2 Pastos (UI)

| Campo | Status UI | Prioridade | Observações |
|-------|-----------|------------|-------------|
| `capacidade_ua` | ❌ → ✅ | **Alta** | Exibir |
| `benfeitorias` | ❌ → ⚠️ | **Média** | Editor simples (JSON guiado por UI) |

### 0.3 Lotes (UI)

| Campo | Status UI | Prioridade | Observações |
|-------|-----------|------------|-------------|
| `status` | ❌ → ✅ | **Média** | Exibir badge de status |
| `pasto_id` | ❌ → ✅ | **Alta** | Mostrar nome do pasto vinculado |
| `touro_id` | ❌ → ✅ | **Média** | Mostrar nome do touro reprodutor |

### Critério de Aceite (Fase 0)

- [ ] Cadastro/edição de animal grava e exibe `data_nascimento` e `data_entrada`
- [ ] Cadastro/edição de pasto grava e exibe `capacidade_ua`
- [ ] Cadastro/edição de lote permite selecionar `pasto_id` e exibe `status`

---

## FASE 1 — Performance e Filtros (Índices de Alto Impacto)

**Adicionar índices priorizados para queries reais (lista/filtros/agenda/timeline)**

### 1.1 Índices Prioritários

| Tabela | Campo(s) | Prioridade | Justificativa |
|--------|----------|------------|---------------|
| `animais` | `status` | **Alta** | Filtro por status (vendido/morto/ativo) |
| `animais` | `lote_id` | **Alta** | Contagem por lote, filtros de lista |
| `eventos` | `dominio` | **Alta** | Filtro por tipo de evento |
| `eventos` | `occurred_on` | **Alta** | Queries por período (timeline) |
| `agenda_itens` | `data_prevista` | **Alta** | Ordenação da agenda |
| `agenda_itens` | `status` | **Alta** | Filtro (pendente/concluído) |

**Nota:** `occurred_on` já existe como coluna gerada a partir de `occurred_at`.

### Critério de Aceite (Fase 1)

- [ ] Listas de animais/agenda/timeline respondem bem com volume (5k+ animais, 50k+ eventos)

---

## FASE 2 — Evolução de Schema (Somente o que Gera Valor no MVP)

**Aqui entram novos campos, mas com corte "MVP-friendly"**

### 2.1 Animais: Rastreabilidade e Manejo (Novos Campos)

| Campo | Tipo | Prioridade | Observações |
|-------|------|------------|-------------|
| `origem` | enum | **Alta** | `'nascimento'`, `'compra'`, `'entrada'`, `'doacao'` |
| `numero_brinco` | text | **Alta** | Brinco oficial (identificação física) |
| `raca` | text | **Média** | Raça do animal |
| `pelagem` | text | **Média** | Cor/pelagem |
| `data_castracao` | date | **Baixa** | MVP+ (depois de fluxos completos) |
| `condicao_corpo` | enum | **Baixa** | MVP+ (depois de relatórios) |
| `peso_entrada` | numeric | **Baixa** | MVP+ (depois de fluxos compra) |
| `sis_bov_id` | text | **Baixa** | Pós-MVP (rastreabilidade premium) |
| `em_sociedade` | boolean | **Média** | Se o animal está em regime de sociedade |
| `sociedade_id` | uuid | **Média** | FK para animais_sociedade (compound FK com fazenda_id) |
| `tipo_dono` | enum | **Média** | `'proprio'`, `'socio'` |
| `categoria_id` | uuid | **Média** | FK para categorias_zootecnicas (compound FK com fazenda_id) |

### 2.2 Pastos: Ampliar sem PostGIS

| Campo | Tipo | Prioridade | Observações |
|-------|------|------------|-------------|
| `tipo_pasto` | enum | **Alta** | `'nativo'`, `'cultivado'`, `'rotacionado'` |
| `data_ultimo_rotacionamento` | date | **Média** | Gestão de pastagem |
| `coordenadas` | jsonb | **Baixa** | Pós-MVP (geofeatures depois) |

### 2.3 Sistema de Sociedade de Animais (DDL Completo + RLS)

#### Visão Geral

O sistema de sociedade de animais é comum na pecuária onde:
- Animais de terceiros são criados na fazenda por período definido
- Há divisão de resultados (ganho de peso, bezerros, etc.) ao final do contrato
- O proprietário original permanece como dono, mas a fazenda é responsável pela criação

#### Nova Tabela `animais_sociedade`

##### DDL Completo (MVP)

```sql
-- 1) Tabela (State rail - mutável)
create table if not exists public.animais_sociedade (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  animal_id uuid not null,
  contraparte_id uuid not null,

  percentual numeric(5,2) null,         -- opcional no MVP
  inicio date not null default current_date,
  fim date null,

  payload jsonb not null default '{}'::jsonb,

  -- sync metadata (client-managed)
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,

  -- server-managed
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Anti cross-farm: exigir chave composta de referência
alter table public.animais add constraint animais_id_fazenda_unique unique (id, fazenda_id);
alter table public.contrapartes add constraint contrapartes_id_fazenda_unique unique (id, fazenda_id);

alter table public.animais_sociedade
  add constraint fk_animais_sociedade_animal
  foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id)
  on delete restrict;

alter table public.animais_sociedade
  add constraint fk_animais_sociedade_contraparte
  foreign key (contraparte_id, fazenda_id) references public.contrapartes(id, fazenda_id)
  on delete restrict;

-- 3) 1 sociedade ativa por animal (fim is null) + não deletada
create unique index if not exists uq_animais_sociedade_ativa
  on public.animais_sociedade (fazenda_id, animal_id)
  where deleted_at is null and fim is null;

create index if not exists idx_animais_sociedade_fazenda
  on public.animais_sociedade (fazenda_id) where deleted_at is null;
```

##### RLS para animais_sociedade

```sql
alter table public.animais_sociedade enable row level security;

create policy animais_sociedade_select
on public.animais_sociedade for select
using (public.has_membership(fazenda_id));

create policy animais_sociedade_write
on public.animais_sociedade for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);
```

#### Campos na tabela `animais` (ajustados)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `em_sociedade` | boolean | Se o animal está em regime de sociedade |
| `sociedade_id` | uuid | FK para animais_sociedade |

### 2.4 Categorias Zootécnicas (DDL Ajustado sem Peso)

#### Observação Importante

> "a classificação será automática sem utilização de criterio de peso"

Remova campos de peso da tabela e use apenas idade/sexo para classificação automática.

#### Nova Tabela `categorias_zootecnicas`

##### DDL Ajustado

```sql
create table if not exists public.categorias_zootecnicas (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,

  -- sugestão: sexo como enum existente + "ambos" via NULL + flag
  sexo public.sexo_enum null,          -- M/F ou NULL
  aplica_ambos boolean not null default false,

  idade_min_dias int null,
  idade_max_dias int null,
  -- peso_min_kg / peso_max_kg REMOVIDOS (classificação automática por idade/sexo)

  ativa boolean not null default true,
  payload jsonb not null default '{}'::jsonb,

  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,

  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- para FK composta
alter table public.categorias_zootecnicas
  add constraint categorias_id_fazenda_unique unique (id, fazenda_id);

-- único por nome por fazenda, ignorando deletados
create unique index if not exists uq_categoria_nome_por_fazenda
  on public.categorias_zootecnicas (fazenda_id, lower(nome))
  where deleted_at is null;

-- adicionar categoria_id em animais
alter table public.animais
  add column if not exists categoria_id uuid null;

-- FK composta (anti cross-farm)
alter table public.animais
  add constraint fk_animais_categoria
  foreign key (categoria_id, fazenda_id)
  references public.categorias_zootecnicas(id, fazenda_id)
  on delete set null;
```

##### RLS para categorias_zootecnicas

```sql
alter table public.categorias_zootecnicas enable row level security;

create policy categorias_select
on public.categorias_zootecnicas for select
using (public.has_membership(fazenda_id));

create policy categorias_write
on public.categorias_zootecnicas for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);
```

### 2.5 Classificação Automática de Categorias

#### Observação do Usuário

> "a classificação será automática sem utilização de criterio de peso"

A classificação automática funciona por:
- **Idade**: Comparação de `data_nascimento` com data atual → faixa de dias
- **Sexo**: Campo `sexo` do animal vs `sexo` / `aplica_ambos` da categoria

#### Lógica de Classificação Sugerida

```typescript
function classificarAnimal(animal: Animal, categorias: CategoriaZootecnica[]): CategoriaZootecnica | null {
  const idadeDias = diferencaDias(new Date(), animal.data_nascimento);
  
  return categorias.find(cat => {
    const sexoMatch = cat.sexo === animal.sexo || (cat.aplica_ambos && cat.sexo === null);
    const idadeMatch = idadeDias >= (cat.idade_min_dias || 0) && idadeDias <= (cat.idade_max_dias || 99999);
    return sexoMatch && idadeMatch && cat.ativa;
  }) || null;
}
```

### 2.6 Impacto no Offline-First

#### 2.6.1 Dexie Stores Necessárias

```typescript
// Stores para Dexie.js
const db = new Dexie('GestaoAgro');
db.version(1).stores({
  state_animais: '++id, fazenda_id, identificacao, lote_id, status',
  state_lotes: '++id, fazenda_id, nome',
  state_pastos: '++id, fazenda_id, nome',
  state_animais_sociedade: '++id, fazenda_id, animal_id, contraparte_id',
  state_categorias_zootecnicas: '++id, fazenda_id, nome',
  // ... outras stores existentes
});
```

#### 2.6.2 Atualizações no tableMap.ts

```typescript
// Adicionar mapeamentos
export const tableMap: TableMapping = {
  // ... mapeamentos existentes
  state_animais_sociedade: {
    table: 'animais_sociedade',
    pkey: ['id', 'fazenda_id'] as const,
    syncMode: 'state',
  },
  state_categorias_zootecnicas: {
    table: 'categorias_zootecnicas',
    pkey: ['id', 'fazenda_id'] as const,
    syncMode: 'state',
  },
};
```

#### 2.6.3 Atualizações no pull.ts

```typescript
// Na lista de pull inicial
const INITIAL_PULL_TABLES = [
  // ... tabelas existentes
  'state_animais_sociedade',
  'state_categorias_zootecnicas',
];
```

#### 2.6.4 Impacto nas Interfaces

| Página | Alteração |
|--------|-----------|
| `AnimalDetalhe.tsx` | Mostrar "Proprietário (contraparte)" quando houver sociedade ativa |
| `Animais.tsx` | Filtro/badge "Sociedade" na listagem |
| Admin/config | CRUD de categorias (owner/manager) |
| Cadastro de animais | Campo de seleção de sociedade/contraparte |

### Critério de Aceite (Fase 2)

- [ ] Campos novos aparecem em cadastro/detalhe
- [ ] Entram no offline/sync sem regressão
- [ ] Não quebra fluxo de eventos append-only
- [ ] Sistema de sociedade permite registro de entrada/saída de animais de terceiros
- [ ] Categorias zootécnicas permitem categorização automática por idade/sexo (sem peso)
- [ ] society_id e categoria_id usam FK composta (anti cross-farm)
- [ ] RLS permite leitura por todos os membros, escrita apenas por owner/manager

### 2.7 Infraestrutura e Benfeitorias de Pastos

#### Visão Geral

A gestão de infraestrutura pecuária é essencial para planejamento de capacidade, manutenção e investimentos. O campo `benfeitorias` na tabela `pastos` já existe como JSONB, mas deve ser expandido com estrutura padronizada para permitir:

- Inventário de benfeitorias por pasto
- Cálculo de capacidade de suporte
- Planejamento de manutenção
- Histórico de benfeitorias

#### Estrutura Proposta

##### Campo `benfeitorias` (JSONB)

O campo existente `benfeitorias` na tabela `pastos` deve ser padronizado com a seguinte estrutura JSON:

```json
{
  "cochos": {
    "quantidade": 0,
    "tipo": "cimentado|madeira|plastico",
    "comprimento_metros": 0,
    "capacidade_cabecas": 0
  },
  "bebedouros": {
    "quantidade": 0,
    "tipo": "automatico|chupeta|tanque",
    "vazao_litros_hora": 0,
    "capacidade_litros": 0
  },
  "saleiros": {
    "quantidade": 0,
    "tipo": "coberto|aberto",
    "capacidade_sacos": 0
  },
  "cerca_perimetro": {
    "comprimento_metros": 0,
    "tipo": "arame_liso|arame_farpado|eletrica",
    "estado": "otimo|bom|regular|ruim",
    "ano_construcao": null,
    "ano_ultima_reforma": null
  },
  "acesso": {
    "tipo": "chefeado|terra|asfalto",
    "distancia_sede_metros": 0
  },
  "energia_eletrica": {
    "disponivel": true,
    "distancia_medidor_metros": 0
  },
  "galpao_cobertura": {
    "area_metros_quadrados": 0,
    "tipo": "palha|zinc|telha|concreto",
    "estado": "otimo|bom|regular|ruim",
    "ano_construcao": null
  },
  "curral": {
    "area_metros_quadrados": 0,
    "capacidade_cabecas": 0,
    "tipo": "madeira|concreto|metal",
    "balanca": true,
    "brete": true
  }
}
```

##### Campos Adicionais na Tabela `pastos`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo_pasto` | enum | `'nativo'`, `'cultivado'`, `'rotacionado'` |
| `data_ultimo_rotacionamento` | date | Último rodízio de pastagem |
| `area_util_ha` | numeric(12,2) | Área utilizável (descontada benfeitorias) |
| `coordenadas` | jsonb | `{ "lat": 0.0, "lng": 0.0 }` |

##### DDL Sugerido (Fase 2)

```sql
-- Adicionar campos à tabela pastos
alter table public.pastos
  add column if not exists tipo_pasto text null,
  add column if not exists data_ultimo_rotacionamento date null,
  add column if not exists area_util_ha numeric(12,2) null,
  add column if not exists coordenadas jsonb null;

-- Índices para pastos
create index if not exists idx_pastos_tipo
  on public.pastos (tipo_pasto) where tipo_pasto is not null;

create index if not exists idx_pastos_area
  on public.pastos (area_ha) where area_ha is not null;
```

##### UI Sugerida

###### Editor de Benfeitorias (JSON Guiado)

```typescript
interface BenfeitoriasForm {
  cocos: {
    quantidade: number;
    tipo: 'cimentado' | 'madeira' | 'plastico';
    comprimentoMetros: number;
    capacidadeCabecas: number;
  };
  bebedouros: {
    quantidade: number;
    tipo: 'automatico' | 'chupeta' | 'tanque';
    vazaoLitrosHora: number;
    capacidadeLitros: number;
  };
  saleiros: {
    quantidade: number;
    tipo: 'coberto' | 'aberto';
    capacidadeSacos: number;
  };
  cercaPerimetro: {
    comprimentoMetros: number;
    tipo: 'arame_liso' | 'arame_farpado' | 'eletrica';
    estado: 'otimo' | 'bom' | 'regular' | 'ruim';
    anoConstrucao?: number;
    anoUltimaReforma?: number;
  };
  acesso: {
    tipo: 'chefeado' | 'terra' | 'asfalto';
    distanciaSedeMetros: number;
  };
  energiaEletrica: {
    disponivel: boolean;
    distanciaMedidorMetros: number;
  };
  galpaoCobertura?: {
    areaMetrosQuadrados: number;
    tipo: 'palha' | 'zinc' | 'telha' | 'concreto';
    estado: 'otimo' | 'bom' | 'regular' | 'ruim';
    anoConstrucao?: number;
  };
  curral?: {
    areaMetrosQuadrados: number;
    capacidadeCabecas: number;
    tipo: 'madeira' | 'concreto' | 'metal';
    balanca: boolean;
    brete: boolean;
  };
}
```

##### Cálculo de Capacidade

A capacidade do pasto deve considerar:

```typescript
function calcularCapacidadePasto(pasto: Pasto): {
  capacidadeUA: number;
  recomendacaoAnimal: string;
  observacoes: string[];
} {
  const observacoes: string[] = [];
  
  // Área base: 1 UA = 450kg = ~0,5 ha (ajustar por sistema)
  const areaUA = pasto.tipo_pasto === 'nativo' ? 1.0 : 0.5;
  const capacidadeArea = (pasto.area_ha || 0) / areaUA;
  
  // Capacidade por água
  const agua = pasto.bebedouros;
  const capacidadeAgua = agua && agua.quantidade > 0 
    ? agua.capacidadeLitros / 50  // 50L UA/dia
    : Infinity;
  
  // Capacidade por cocho
  const cocho = pasto.cocos;
  const capacidadeCocho = cocho && cocho.quantidade > 0
    ? cocho.capacidadeCabecas
    : Infinity;
  
  const capacidadeUA = Math.min(capacidadeArea, capacidadeAgua, capacidadeCocho);
  
  if (capacidadeArea < capacidadeAgua) {
    observacoes.push('Área é limitante');
  }
  if (capacidadeAgua < capacidadeArea) {
    observacoes.push('Água é limitante');
  }
  
  return {
    capacidadeUA: Math.floor(capacidadeUA),
    recomendacaoAnimal: `Até ${Math.floor(capacidadeUA)} UA`,
    observacoes
  };
}
```

##### Relatórios Possíveis

| Relatório | Descrição |
|-----------|-----------|
| Inventário por pasto | Lista de benfeitorias e condições |
| Capacidade x Ocupação | UA disponíveis vs UA ocupados |
| Manutenção Preventiva | Benfeitorias com estado regular/ruim |
| Investimentos | Custo estimado para benfeitorias |

##### Prioridade na Fase 2

| Item | Prioridade | Observações |
|------|------------|-------------|
| Editor JSON guiado | **Alta** | UI para preenchimento |
| Campos tipo_pasto, data_ultimo_rotacionamento | **Alta** | Gestão de pastagem |
| Cálculo de capacidade | **Média** | Otimização de lotação |
| Coordenadas | **Baixa** | Geofeatures (pós-MVP) |

---

## FASE 3 — Pós-MVP (Normalização e Histórico Completo)

**Itens mais caros (boa arquitetura, mas depois):**

| Item | Prioridade | Observações |
|------|------------|-------------|
| Genealogia completa (N:M) | **Baixa** | Tabela `animais_parentesco` |
| Histórico de pastagem | **Baixa** | Tabela `animais_pastos_historico` |
| Categorias zootécnicas | **Baixa** | Tabela `categorias_zootecnicas` |
| Catálogo de raças | **Baixa** | Tabela `racas` |
| Catálogo de produtos | **Baixa** | Tabela `produtos_sanitarios` |

### Critério de Aceite (Fase 3)

- [ ] Consultas de auditoria possíveis (onde animal esteve, pedigree)

---

## PLANO DE EXECUÇÃO (PRÁTICO)

| Fase | Entrega | Risco | Esforço |
|------|---------|-------|---------|
| **0** (UI) | Expor campos existentes | Baixo | Médio |
| **1** (DB) | Índices de performance | Baixo | Baixo |
| **2** (DB+UI) | Novos campos + Sociedade + Categorias | Médio | Alto |
| **3** (DB) | Novas tabelas históricas | Alto | Alto |

---

## ANÁLISE TÉCNICA EXISTENTE

### 2.1 Tabela `animais` - Documentação Completa dos Campos

A tabela `animais` é o núcleo do sistema de gestão pecuária, armazenando informações individuais de cada animal da propriedade.

```sql
-- Estrutura conforme migration 0001_init.sql
create table if not exists public.animais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  identificacao text not null,
  rfid text null,
  nome text null,

  sexo public.sexo_enum not null,
  status public.animal_status_enum not null default 'ativo',

  data_nascimento date null,
  data_entrada date null,
  data_saida date null,

  lote_id uuid null,

  pai_id uuid null,
  mae_id uuid null,

  papel_macho public.papel_macho_enum null,
  habilitado_monta boolean not null default false,

  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema (Two Rails)
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  -- campos de auditoria
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_femea_sem_atributos_macho
    check (
      sexo = 'M'
      or (habilitado_monta = false and papel_macho is null)
    )
);
```

#### Documentação dos Campos de Negócio

| Campo | Tipo | Obrigatório | Valor Default | Status UI | Descrição |
|-------|------|-------------|---------------|-----------|-----------|
| `id` | uuid | Sim | gen_random_uuid() | ✅ | Identificador único do animal |
| `fazenda_id` | uuid | Sim | - | ✅ | FK para a fazenda proprietária |
| `identificacao` | text | Sim | - | ✅ | Brinco/nome de identificação (único por fazenda) |
| `rfid` | text | Null | null | ❌ | Código de identificação por radiofreqüência |
| `nome` | text | Null | null | ❌ | Nome popular do animal |
| `sexo` | sexo_enum | Sim | - | ✅ | 'M' (macho) ou 'F' (fêmea) |
| `status` | animal_status_enum | Sim | 'ativo' | ✅ | 'ativo', 'vendido', 'morto' |
| `data_nascimento` | date | Null | null | ❌ | Data de nascimento |
| `data_entrada` | date | Null | null | ❌ | Data de entrada na fazenda (compra/doação) |
| `data_saida` | date | Null | null | ❌ | Data de saída (venda/morte) |
| `lote_id` | uuid | Null | null | ✅ | FK para o lote atual do animal |
| `pai_id` | uuid | Null | null | ❌ | FK para o pai (animal macho) |
| `mae_id` | uuid | Null | null | ❌ | FK para a mãe (animal fêmea) |
| `papel_macho` | papel_macho_enum | Null | null | ❌ | 'reprodutor' ou 'rufiao' (apenas para machos) |
| `habilitado_monta` | boolean | Sim | false | ❌ | Se o macho está habilitado para reprodução |
| `observacoes` | text | Null | null | ⚠️ | Notas e observações diversas |
| `payload` | jsonb | Sim | '{}' | ❌ | Campo flexível para dados adicionais |

#### Constraints e Restrições

| Constraint | Tipo | Descrição |
|------------|------|-----------|
| `pk_animais` | Primary Key | `id` |
| `fk_animais_fazenda` | Foreign Key | `fazenda_id` → `fazendas(id)` |
| `fk_animais_lote` | Foreign Key | `lote_id` → `lotes(id)` (composta com fazenda_id) |
| `fk_animais_pai` | Foreign Key | `pai_id` → `animais(id)` (composta com fazenda_id) |
| `fk_animais_mae` | Foreign Key | `mae_id` → `animais(id)` (composta com fazenda_id) |
| `ck_femea_sem_atributos_macho` | Check | Fêmeas não podem ter `papel_macho` ou `habilitado_monta` |

#### Índices Existentes

| Índice | Colunas | Tipo | Status |
|--------|---------|------|--------|
| `ux_animais_id_fazenda` | `(id, fazenda_id)` | Unique | ✅ |
| `ix_animais_identificacao` | `(fazenda_id, identificacao)` | Unique (partial) | ✅ |
| `ix_animais_status` | `(fazenda_id, status)` | Index | ❌ Precisa criar |
| `ix_animais_lote_id` | `(fazenda_id, lote_id)` | Index | ❌ Precisa criar |

---

### 2.2 Tabela `lotes` - Agrupamentos

A tabela `lotes` permite agrupar animais por categoria, fase de criação ou finalidade produtiva.

```sql
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  status public.lote_status_enum not null default 'ativo',

  pasto_id uuid null,
  touro_id uuid null,

  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema (Two Rails)
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### Documentação dos Campos

| Campo | Tipo | Obrigatório | Status UI | Descrição |
|-------|------|-------------|-----------|-----------|
| `id` | uuid | Sim | ✅ | Identificador único do lote |
| `fazenda_id` | uuid | Sim | ✅ | FK para a fazenda |
| `nome` | text | Sim | ✅ | Nome descritivo do lote |
| `status` | lote_status_enum | Sim | ❌ | 'ativo' ou 'inativo' |
| `pasto_id` | uuid | Null | ❌ | FK para o pasto onde o lote está |
| `touro_id` | uuid | Null | ❌ | FK para o touro reprodutor do lote |
| `observacoes` | text | Null | ❌ | Observações do lote |
| `payload` | jsonb | Sim | ❌ | Campo flexível |

#### Foreign Keys

| FK | Colunas | Referência | Descrição |
|----|---------|------------|-----------|
| `fk_lotes_pasto` | `(pasto_id, fazenda_id)` | `pastos(id, fazenda_id)` | Lote pertence a um pasto |
| `fk_lotes_touro` | `(touro_id, fazenda_id)` | `animais(id, fazenda_id)` | Touro reprodutor do lote |

---

### 2.3 Tabela `pastos` - Áreas de Pastagem

A tabela `pastos` gerencia as áreas de pastagem da propriedade.

```sql
create table if not exists public.pastos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  area_ha numeric(12,2) null,
  capacidade_ua numeric(12,2) null,
  benfeitorias jsonb not null default '{}'::jsonb,
  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### Documentação dos Campos

| Campo | Tipo | Obrigatório | Status UI | Descrição |
|-------|------|-------------|-----------|-----------|
| `id` | uuid | Sim | ✅ | Identificador único do pasto |
| `fazenda_id` | uuid | Sim | ✅ | FK para a fazenda |
| `nome` | text | Sim | ✅ | Nome do pasto |
| `area_ha` | numeric(12,2) | Null | ✅ | Área em hectares |
| `capacidade_ua` | numeric(12,2) | Null | ❌ | Capacidade em unidades animal |
| `benfeitorias` | jsonb | Sim | ❌ | Estruturas presentes (cochos, bebedouros, etc.) |
| `observacoes` | text | Null | ❌ | Observações gerais |
| `payload` | jsonb | Sim | ❌ | Campo flexível |

---

### 2.4 Tabela `eventos` - Registro Base de Eventos

A tabela `eventos` é a estrutura central de rastreabilidade, armazenando todos os eventos do sistema em formato append-only (imutável após criação).

```sql
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  dominio public.dominio_enum not null,

  occurred_at timestamptz not null,
  occurred_on date generated always as ((occurred_at at time zone 'UTC')::date) stored,

  animal_id uuid null,
  lote_id uuid null,

  source_task_id uuid null,
  source_tx_id uuid null,
  source_client_op_id uuid null,

  corrige_evento_id uuid null,

  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### Documentação dos Campos

| Campo | Tipo | Obrigatório | Status UI | Descrição |
|-------|------|-------------|-----------|-----------|
| `id` | uuid | Sim | ✅ | Identificador único do evento |
| `fazenda_id` | uuid | Sim | ✅ | FK para a fazenda |
| `dominio` | dominio_enum | Sim | ✅ | Categoria: sanitario, pesagem, nutricao, movimentacao, reproducao, financeiro |
| `occurred_at` | timestamptz | Sim | ✅ | Data/hora que o evento ocorreu |
| `occurred_on` | date | Gerado | ✅ | Data extraída do occurred_at (UTC) |
| `animal_id` | uuid | Null | ✅ | FK para o animal (opcional se for evento de lote) |
| `lote_id` | uuid | Null | ✅ | FK para o lote (opcional se for evento de animal) |
| `source_task_id` | uuid | Null | ⚠️ | Referência para tarefa da agenda |
| `corrige_evento_id` | uuid | Null | ❌ | FK para evento corrigido (correção de erro) |
| `observacoes` | text | Null | ⚠️ | Descrição do evento |
| `payload` | jsonb | Sim | ✅ | Dados específicos do evento |

#### Índices Existentes

| Índice | Colunas | Status | Descrição |
|--------|---------|--------|-----------|
| `ux_eventos_id_fazenda` | `(id, fazenda_id)` | ✅ | Unique |
| `ix_eventos_occurred_at` | `(fazenda_id, occurred_at)` | ✅ | Para ordenação temporal |
| `ix_eventos_animal` | `(fazenda_id, animal_id)` | ✅ | Para queries por animal |
| `ix_eventos_dominio` | `(fazenda_id, dominio)` | ❌ Precisa criar | Para filtros por tipo |
| `ix_eventos_occurred_on` | `(fazenda_id, occurred_on)` | ❌ Precisa criar | Para queries por período |

---

### 2.5 Tabela `eventos_sanitario` - Eventos Sanitários

Detalhamento de eventos de manejo sanitário (vacinações, vermifugações, medicamentos).

```sql
create table if not exists public.eventos_sanitario (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_sanitario_evento_fazenda 
    foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
```

---

### 2.6 Tabela `eventos_pesagem` - Registros de Peso

Detalhamento de eventos de pesagem.

```sql
create table if not exists public.eventos_pesagem (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  peso_kg numeric(10,2) not null check (peso_kg > 0),
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_pesagem_evento_fazenda 
    foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
```

---

### 2.7 Tabela `eventos_movimentacao` - Transferências

Detalhamento de eventos de movimentação entre lotes ou pastos.

```sql
create table if not exists public.eventos_movimentacao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  from_lote_id uuid null,
  to_lote_id uuid null,
  from_pasto_id uuid null,
  to_pasto_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_mov_evento_fazenda 
    foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
```

---

### 2.8 Tabela `eventos_reproducao` - Reprodução

Detalhamento de eventos reprodutivos.

```sql
create table if not exists public.eventos_reproducao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.repro_tipo_enum not null,
  macho_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_repro_evento_fazenda 
    foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
```

---

### 2.9 Tabela `eventos_financeiro` - Compras e Vendas

Detalhamento de eventos financeiros.

```sql
create table if not exists public.eventos_financeiro (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.financeiro_tipo_enum not null,
  valor_total numeric(14,2) not null,
  contraparte_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_fin_evento_fazenda 
    foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
```

---

### 2.10 Tabela `agenda_itens` - Tarefas Agendadas

Gerenciamento de tarefas e lembretes de manejo.

```sql
create table if not exists public.agenda_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  dominio public.dominio_enum not null,
  tipo text not null,
  status public.agenda_status_enum not null default 'agendado',
  data_prevista date not null,

  animal_id uuid null,
  lote_id uuid null,

  dedup_key text null,
  source_kind public.agenda_source_kind_enum not null default 'manual',
  source_ref jsonb null,

  source_client_op_id uuid null,
  source_tx_id uuid null,
  source_evento_id uuid null,

  protocol_item_version_id uuid null,
  interval_days_applied int null,

  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_agenda_alvo
    check (animal_id is not null or lote_id is not null),

  constraint ck_agenda_dedup_automatico
    check (source_kind = 'manual' or dedup_key is not null)
);
```

#### Índices Existentes

| Índice | Colunas | Status | Descrição |
|--------|---------|--------|-----------|
| `ux_agenda_dedup_active` | `(fazenda_id, dedup_key)` | ✅ | Unique (partial) |
| `ix_agenda_data_prevista` | `(fazenda_id, data_prevista)` | ❌ Precisa criar | Para ordenação da agenda |
| `ix_agenda_status` | `(fazenda_id, status)` | ❌ Precisa criar | Para filtros por status |

---

### 2.11 Tabela `protocolos_sanitarios` - Templates de Manejo

Templates de protocolos sanitários para padronização de manejos.

```sql
create table if not exists public.protocolos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  descricao text null,
  ativo boolean not null default true,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

### 2.12 Tabela `protocolos_sanitarios_itens` - Itens dos Protocolos

Itens individuais que compõem um protocolo sanitário.

```sql
create table if not exists public.protocolos_sanitarios_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  protocolo_id uuid not null,
  protocol_item_id uuid not null,
  version int not null check (version > 0),

  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  intervalo_dias int not null check (intervalo_dias > 0),
  dose_num int null check (dose_num is null or dose_num > 0),
  gera_agenda boolean not null default true,

  dedup_template text null,
  payload jsonb not null default '{}'::jsonb,

  -- campos de sistema
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_proto_item_protocolo
    foreign key (protocolo_id, fazenda_id)
    references public.protocolos_sanitarios(id, fazenda_id)
    deferrable initially deferred
);
```

---

## 3. MAPEAMENTO DE RELACIONAMENTOS

### 3.1 Diagrama de Entidades e Relacionamentos

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   FAZENDAS    │──────▶│    ANIMAIS    │◀──────│     LOTES     │
│   (tenant)    │       │  (cadastro)   │       │ (agrupamentos)│
└───────────────┘       └───────────────┘       └───────────────┘
       │                       │                       │
       │                       │                       │
       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    PASTOS     │       │   EVENTOS     │       │   AGENDA      │
│ (pastagens)   │       │  (registro)   │       │  (tarefas)    │
└───────────────┘       └───────────────┘       └───────────────┘
                               │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
     ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
     │EVENTOS_       │ │EVENTOS_       │ │EVENTOS_       │
     │SANITARIO      │ │PESAGEM        │ │MOVIMENTACAO   │
     └───────────────┘ └───────────────┘ └───────────────┘
             │                │                │
             └────────────────┼────────────────┘
                              │
                              ▼
     ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
     │EVENTOS_       │ │EVENTOS_       │ │EVENTOS_       │
     │REPRODUCAO     │ │FINANCEIRO     │ │NUTRICAO       │
     └───────────────┘ └───────────────┘ └───────────────┘
```

### 3.2 Matriz de Foreign Keys

| Tabela Origem | Campo(s) FK | Tabela Referência | Cardinalidade | Descrição |
|---------------|-------------|-------------------|---------------|-----------|
| `animais` | `fazenda_id` | `fazendas` | N:1 | Animal pertence a uma fazenda |
| `animais` | `lote_id` | `lotes` | N:1 | Animal está em um lote |
| `animais` | `pai_id` | `animais` | N:1 | Genealogy (pai) |
| `animais` | `mae_id` | `animais` | N:1 | Genealogy (mãe) |
| `lotes` | `fazenda_id` | `fazendas` | N:1 | Lote pertence a uma fazenda |
| `lotes` | `pasto_id` | `pastos` | N:1 | Lote está em um pasto |
| `lotes` | `touro_id` | `animais` | N:1 | Touro reprodutor do lote |
| `pastos` | `fazenda_id` | `fazendas` | N:1 | Pasto pertence a uma fazenda |
| `eventos` | `fazenda_id` | `fazendas` | N:1 | Evento pertence a uma fazenda |
| `eventos` | `animal_id` | `animais` | N:1 | Evento envolve um animal |
| `eventos` | `lote_id` | `lotes` | N:1 | Evento envolve um lote |
| `eventos_*` | `evento_id, fazenda_id` | `eventos` | 1:1 | Detalhes específicos do evento |
| `agenda_itens` | `fazenda_id` | `fazendas` | N:1 | Item pertence a uma fazenda |
| `agenda_itens` | `animal_id` | `animais` | N:1 | Item para um animal |
| `agenda_itens` | `lote_id` | `lotes` | N:1 | Item para um lote |
| `protocolos_sanitarios` | `fazenda_id` | `fazendas` | N:1 | Protocolo pertence a uma fazenda |
| `protocolos_sanitarios_itens` | `protocolo_id` | `protocolos_sanitarios` | N:1 | Item pertence a um protocolo |

---

## 4. MATRIZ DE PERMISSÕES POR PAPEL

### 4.1 Tabela `animais`

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | | | |
| id | ✅ | ✅ | ✅ |
| identificacao | ✅ | ✅ | ✅ |
| rfid | ✅ | ✅ | ✅ |
| nome | ✅ | ✅ | ✅ |
| sexo | ✅ | ✅ | ✅ |
| status | ✅ | ✅ | ✅ |
| data_nascimento | ✅ | ✅ | ✅ |
| data_entrada/saida | ✅ | ✅ | ✅ |
| lote_id | ✅ | ✅ | ✅ |
| pai_id, mae_id | ✅ | ✅ | ✅ |
| papel_macho | ✅ | ✅ | ✅ |
| habilitado_monta | ✅ | ✅ | ✅ |
| **Edição** | | | |
| identificacao | ✅ | ✅ | ❌ |
| dados básicos | ✅ | ✅ | ❌ |
| status | ✅ | ✅ | ✅* |
| lote_id | ✅ | ✅ | ✅* |
| **Criação** | ✅ | ✅ | ❌ |
| **Exclusão** | ✅ | ❌ | ❌ |

* Cowboy pode alterar status e lote através de eventos

### 4.2 Tabela `eventos` (e sub-tabelas)

| Domínio | Owner | Manager | Cowboy |
|---------|-------|---------|--------|
| Sanitário | ✅ | ✅ | ✅* |
| Pesagem | ✅ | ✅ | ✅* |
| Movimentação | ✅ | ✅ | ✅* |
| Reprodução | ✅ | ✅ | ✅* |
| Financeiro | ✅ | ✅ | ❌ |
| Nutrição | ✅ | ✅ | ❌ |

* Cowboy pode registrar, mas não pode excluir/corrigir

### 4.3 Tabela `agenda_itens`

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | ✅ | ✅ | ✅ |
| **Criação** | ✅ | ✅ | ❌ |
| **Edição (status)** | ✅ | ✅ | ✅ |
| **Edição (dados)** | ✅ | ✅ | ❌ |
| **Exclusão** | ✅ | ✅ | ❌ |

---

## 5. CAMPOS UTILIZADOS NAS INTERFACES

### 5.1 [`src/pages/Animais.tsx`](../src/pages/Animais.tsx) - Lista de Animais

| Campo do Banco | Usado na UI | Exibido/Editado | Status |
|----------------|-------------|-----------------|--------|
| `identificacao` | ✅ | Exibido | ✅ |
| `lote_id` | ✅ | Exibido | ✅ |
| `sexo` | ✅ | Exibido | ✅ |
| `status` | ✅ | Exibido | ✅ |
| `id` | ✅ | Link | ✅ |
| `rfid` | ❌ | - | ❌ |
| `nome` | ❌ | - | ❌ |
| `data_nascimento` | ❌ | - | ❌ |
| `pai_id` | ❌ | - | ❌ |
| `mae_id` | ❌ | - | ❌ |
| `papel_macho` | ❌ | - | ❌ |
| `habilitado_monta` | ❌ | - | ❌ |
| `observacoes` | ❌ | - | ❌ |
| `payload` | ❌ | - | ❌ |

### 5.2 [`src/pages/AnimalDetalhe.tsx`](../src/pages/AnimalDetalhe.tsx) - Detalhes do Animal

| Campo do Banco | Usado na UI | Exibido/Editado | Status |
|----------------|-------------|-----------------|--------|
| `identificacao` | ✅ | Exibido | ✅ |
| `sexo` | ✅ | Exibido | ✅ |
| `lote_id` | ✅ | Exibido | ✅ |
| `status` | ✅ | Exibido | ✅ |
| `data_nascimento` | ❌ | - | ❌ |
| `data_entrada` | ❌ | - | ❌ |
| **Último peso** | ✅ | Exibido | ✅ |
| **Próxima agenda** | ✅ | Exibido | ✅ |
| **Timeline** | ✅ | Exibido | ✅ |
| `observacoes` | ⚠️ | Exibido (parcial) | ⚠️ |

### 5.3 [`src/pages/AnimalNovo.tsx`](../src/pages/AnimalNovo.tsx) - Cadastro de Animal

| Campo do Banco | Usado na UI | Obrigatório | Status |
|----------------|-------------|-------------|--------|
| `identificacao` | ✅ | ✅ | ✅ |
| `sexo` | ✅ | ✅ | ✅ |
| `lote_id` | ✅ | ❌ | ✅ |
| `nome` | ❌ | - | ❌ |
| `rfid` | ❌ | - | ❌ |
| `data_nascimento` | ❌ | - | ❌ |
| `data_entrada` | ❌ | - | ❌ |
| `pai_id` | ❌ | - | ❌ |
| `mae_id` | ❌ | - | ❌ |
| `papel_macho` | ❌ | - | ❌ |
| `habilitado_monta` | ❌ | - | ❌ |

### 5.4 [`src/pages/Pastos.tsx`](../src/pages/Pastos.tsx) - Lista de Pastos

| Campo do Banco | Usado na UI | Exibido/Editado | Status |
|----------------|-------------|-----------------|--------|
| `id` | ✅ | Link | ✅ |
| `nome` | ✅ | Exibido | ✅ |
| `area_ha` | ✅ | Exibido | ✅ |
| `capacidade_ua` | ❌ | - | ❌ |
| `benfeitorias` | ❌ | - | ❌ |

### 5.5 [`src/pages/Lotes.tsx`](../src/pages/Lotes.tsx) - Lista de Lotes

| Campo do Banco | Usado na UI | Exibido/Editado | Status |
|----------------|-------------|-----------------|--------|
| `id` | ✅ | Link | ✅ |
| `nome` | ✅ | Exibido | ✅ |
| `status` | ❌ | - | ❌ |
| `pasto_id` | ❌ | - | ❌ |
| `touro_id` | ❌ | - | ❌ |

### 5.6 [`src/pages/Agenda.tsx`](../src/pages/Agenda.tsx) - Agenda de Manejo

| Campo do Banco | Usado na UI | Exibido/Editado | Status |
|----------------|-------------|-----------------|--------|
| `tipo` | ✅ | Exibido | ✅ |
| `data_prevista` | ✅ | Exibido | ✅ |
| `status` | ✅ | Exibido | ✅ |
| `dominio` | ⚠️ | Implícito | ⚠️ |
| `animal_id` | ❌ | - | ❌ |
| `lote_id` | ❌ | - | ❌ |

---

## 6. IDENTIFICAÇÃO DE PROBLEMAS

### 6.1 Campos Duplicados/Redundantes

| Campo | Onde Ocorre | Problema | Sugestão |
|-------|------------|----------|----------|
| `client_id` | Todas as tabelas | Duplicado em cada FK | Documentar que é denormalização intencional |
| `fazenda_id` em tabelas 1:1 | `eventos_sanitario`, etc. | Denormalização para performance | Manter, mas documentar estratégia |
| `payload` | Todas as tabelas | Pode incentivar "jailbreaking" do schema | Documentar uso adequado |

### 6.2 Faltas de Índices Críticos

| Tabela | Campo | Status | Prioridade |
|--------|-------|--------|------------|
| `animais` | `status` | ❌ | **Alta** |
| `animais` | `lote_id` | ❌ | **Alta** |
| `eventos` | `dominio` | ❌ | **Alta** |
| `eventos` | `occurred_on` | ❌ | **Alta** |
| `agenda_itens` | `data_prevista` | ❌ | **Alta** |
| `agenda_itens` | `status` | ❌ | **Alta** |

### 2.3 Lacunas de Normalização (Pós-MVP)

> **Nota:** Ver [`docs/ROADMAP.md`](ROADMAP.md) para o plano completo de funcionalidades futuras.

#### Genealogia Completa (N:M)

**Problema:** A tabela `animais` usa auto-referência para `pai_id` e `mae_id`, mas não suporta genealogia completa.

**Solução Pós-MVP:**
```sql
create table if not exists public.animais_parentesco (
  id uuid primary key,
  fazenda_id uuid not null,
  animal_id uuid not null,
  parente_id uuid not null,
  grau_parentesco text not null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema...
);
```

#### Histórico de Pastagem

**Problema:** `lotes.pasto_id` e `animais.lote_id` são referencias diretas, mas não há histórico temporal.

**Solução Pós-MVP:**
```sql
create table if not exists public.animais_pastos_historico (
  id uuid primary key,
  fazenda_id uuid not null,
  animal_id uuid not null,
  pasto_id uuid not null,
  data_entrada date not null,
  data_saida date null,
  payload jsonb not null default '{}'::jsonb,
  -- campos de sistema...
);
```

---

## RESUMO DE MUDANÇAS POR FASE

### Fase 0 - Quick Wins (UI)

| Tabela | Campo | Ação | Esforço |
|--------|-------|------|---------|
| `animais` | `data_nascimento` | Adicionar ao formulário e detalhe | Médio |
| `animais` | `data_entrada` | Adicionar ao formulário e detalhe | Médio |
| `animais` | `pai_id`, `mae_id` | Adicionar como campos opcionais | Médio |
| `pastos` | `capacidade_ua` | Exibir no card e formulário | Baixo |
| `pastos` | `benfeitorias` | Editor JSON simples | Médio |
| `lotes` | `status` | Exibir badge | Baixo |
| `lotes` | `pasto_id` | Adicionar select no formulário | Médio |
| `lotes` | `touro_id` | Adicionar select no formulário | Médio |

### Fase 1 - Performance (Índices)

| Tabela | Campo | SQL | Prioridade | Status |
|--------|-------|-----|------------|--------|
| `animais` | `status` | `CREATE INDEX idx_animais_status ON public.animais(fazenda_id, status) WHERE deleted_at IS NULL` | **Alta** | ✅ Implementado (0018) |
| `animais` | `lote_id` | `CREATE INDEX idx_animais_lote ON public.animais(fazenda_id, lote_id) WHERE deleted_at IS NULL AND lote_id IS NOT NULL` | **Alta** | ✅ Implementado (0018) |
| `animais` | `sexo` | `CREATE INDEX idx_animais_sexo ON public.animais(fazenda_id, sexo) WHERE deleted_at IS NULL` | **Alta** | ✅ Implementado (0018) |
| `eventos` | `dominio` + `occurred_at` | `CREATE INDEX idx_eventos_fazenda_dominio_occurred ON public.eventos(fazenda_id, dominio, occurred_at DESC) WHERE deleted_at IS NULL` | **Alta** | ✅ Implementado (0018) |
| `eventos` | `animal_id` + `occurred_at` | `CREATE INDEX idx_eventos_fazenda_animal_occurred ON public.eventos(fazenda_id, animal_id, occurred_at DESC) WHERE deleted_at IS NULL AND animal_id IS NOT NULL` | **Alta** | ✅ Implementado (0018) |
| `agenda_itens` | `data_prevista` | `CREATE INDEX idx_agenda_fazenda_data ON public.agenda_itens(fazenda_id, data_prevista) WHERE deleted_at IS NULL AND status = 'agendado'` | **Alta** | ✅ Implementado (0018) |
| `agenda_itens` | `status` | `CREATE INDEX idx_agenda_fazenda_status ON public.agenda_itens(fazenda_id, status) WHERE deleted_at IS NULL` | **Alta** | ✅ Implementado (0018) |

### Fase 2 - Evolução de Schema

| Item | Fase | Tipo | Descrição |
|------|------|------|-----------|
| `animais_sociedade` | 2 | Tabela | Regime de sociedade com contrapartes |
| `categorias_zootecnicas` | 2 | Tabela | Categorização automática por idade/sexo |
| RLS animais_sociedade | 2 | Política | owner/manager write, todos read |
| RLS categorias_zootecnicas | 2 | Política | owner/manager write, todos read |
| Dexie stores | 2 | Offline | state_animais_sociedade, state_categorias_zootecnicas |
| tableMap.ts | 2 | Offline | Mapeamentos para sync |
| UI AnimalDetalhe | 2 | Interface | Exibir sociedade ativa |
| UI Admin | 2 | Interface | CRUD de categorias |

#### Campos Adicionais em `animais` (Fase 2)

| Tabela | Campo | Tipo | Prioridade | Observações |
|--------|-------|------|------------|-------------|
| `animais` | `origem` | enum | **Alta** | `'nascimento'`, `'compra'`, `'entrada'`, `'doacao'` |
| `animais` | `numero_brinco` | text | **Alta** | Brinco oficial (identificação física) |
| `animais` | `raca` | text | **Média** | Raça do animal |
| `animais` | `pelagem` | text | **Média** | Cor/pelagem |
| `animais` | `em_sociedade` | boolean | **Média** | Se o animal está em regime de sociedade |
| `animais` | `sociedade_id` | uuid | **Média** | FK para animais_sociedade |
| `animais` | `tipo_dono` | enum | **Média** | `'proprio'`, `'socio'` |
| `animais` | `categoria_id` | uuid | **Média** | FK para categorias_zootecnicas |
| `pastos` | `tipo_pasto` | enum | **Alta** | `'nativo'`, `'cultivado'`, `'rotacionado'` |
| `pastos` | `data_ultimo_rotacionamento` | date | **Média** | Gestão de pastagem |

### Fase 3 - Pós-MVP

| Tabela | Descrição | Esforço |
|--------|-----------|---------|
| `animais_parentesco` | Genealogia N:M | Alto |
| `animais_pastos_historico` | Histórico de pastagem | Alto |
| `racas` | Catálogo de raças | Médio |
| `produtos_sanitarios` | Catálogo de produtos | Médio |

---

## ENUMS DISPONÍVEIS

| Enum | Valores | Descrição |
|------|---------|-----------|
| `sexo_enum` | 'M', 'F' | Sexo do animal |
| `animal_status_enum` | 'ativo', 'vendido', 'morto' | Status do animal |
| `lote_status_enum` | 'ativo', 'inativo' | Status do lote |
| `dominio_enum` | 'sanitario', 'pesagem', 'nutricao', 'movimentacao', 'reproducao', 'financeiro' | Domínio do evento |
| `agenda_status_enum` | 'agendado', 'concluido', 'cancelado' | Status da agenda |
| `sanitario_tipo_enum` | 'vacinacao', 'vermifugacao', 'medicamento' | Tipo sanitário |
| `repro_tipo_enum` | 'cobertura', 'IA', 'diagnostico', 'parto' | Tipo reprodutivo |
| `financeiro_tipo_enum` | 'compra', 'venda' | Tipo financeiro |
| `papel_macho_enum` | 'reprodutor', 'rufiao' | Papel do macho |

---

*Documento atualizado: Fevereiro de 2026*
*Versão: 3.0 - Inclui migração 0018 (índices de performance)*
