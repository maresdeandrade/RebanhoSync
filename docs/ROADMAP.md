# ROADMAP - Funcionalidades Planejadas

> **Status:** Derivado (Planejamento)
> **Fonte de Verdade:** Visão de Produto e `00_MANIFESTO.md`
> **Última Atualização:** 2026-02-15

Este documento registra funcionalidades, melhorias e expansões planejadas para o projeto RebanhoSync.

---

## Status Legend

| Símbolo | Significado            |
| ------- | ---------------------- |
| ✅      | Implementado           |
| 🔄      | Em desenvolvimento     |
| ⏳      | Planejado              |
| ❌      | Despriorizado/Removido |

---

## Fase 1 - Core Melhorias (Alta Prioridade)

### 1.1 Campos Adicionais em Animais

| Campo            | Tipo    | Prioridade | Status | Dependências      |
| ---------------- | ------- | ---------- | ------ | ----------------- |
| `origem`         | enum    | Alta       | ⏳     | Migration         |
| `numero_brinco`  | text    | Alta       | ⏳     | Migration         |
| `raca`           | text    | Média      | ⏳     | Migration         |
| `pelagem`        | text    | Média      | ⏳     | Migration         |
| `data_castracao` | date    | Baixa      | ⏳     | -                 |
| `condicao_corpo` | enum    | Baixa      | ⏳     | -                 |
| `peso_entrada`   | numeric | Baixa      | ⏳     | -                 |
| `sis_bov_id`     | text    | Baixa      | ⏳     | Pós-MVP           |
| `em_sociedade`   | boolean | Média      | ⏳     | Tabela sociedade  |
| `sociedade_id`   | uuid    | Média      | ⏳     | Tabela sociedade  |
| `tipo_dono`      | enum    | Média      | ⏳     | Tabela sociedade  |
| `categoria_id`   | uuid    | Média      | ⏳     | Tabela categorias |

### 1.2 Campos Adicionais em Pastos

| Campo                        | Tipo  | Prioridade | Status | Dependências          |
| ---------------------------- | ----- | ---------- | ------ | --------------------- |
| `tipo_pasto`                 | enum  | Alta       | ⏳     | Migration             |
| `data_ultimo_rotacionamento` | date  | Média      | ⏳     | -                     |
| `coordenadas`                | jsonb | Baixa      | ⏳     | Pós-MVP (geofeatures) |

### 1.3 Melhorias de UI - Quick Wins (Fase 0)

#### Animais

| Campo             | Ação UI                                  | Prioridade | Status |
| ----------------- | ---------------------------------------- | ---------- | ------ |
| `data_nascimento` | Exibir no detalhe, solicitar no cadastro | Alta       | ⏳     |
| `data_entrada`    | Exibir no detalhe, solicitar no cadastro | Alta       | ⏳     |
| `pai_id`          | Mostrar como opcional/avançado           | Alta       | ⏳     |
| `mae_id`          | Mostrar como opcional/avançado           | Alta       | ⏳     |
| `nome`            | Esconder em "mais detalhes"              | Baixa      | ⏳     |
| `rfid`            | Esconder em "mais detalhes"              | Baixa      | ⏳     |

#### Pastos

| Campo           | Ação UI                             | Prioridade | Status |
| --------------- | ----------------------------------- | ---------- | ------ |
| `capacidade_ua` | Exibir no card e formulário         | Alta       | ⏳     |
| `benfeitorias`  | Editor simples (JSON guiado por UI) | Média      | ⏳     |

#### Lotes

| Campo      | Ação UI                          | Prioridade | Status |
| ---------- | -------------------------------- | ---------- | ------ |
| `status`   | Exibir badge de status           | Média      | ⏳     |
| `pasto_id` | Mostrar nome do pasto vinculado  | Alta       | ⏳     |
| `touro_id` | Mostrar nome do touro reprodutor | Média      | ⏳     |

---

## Fase 2 - Novos Módulos (Média Prioridade)

### 2.1 Sistema de Sociedade de Animais

#### Descrição

Sistema para gerenciar animais de terceiros criados na fazenda em regime de sociedade.

#### Estrutura Planejada

```sql
-- Tabela: animais_sociedade
create table if not exists public.animais_sociedade (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,
  animal_id uuid not null,
  contraparte_id uuid not null,
  percentual numeric(5,2) null,
  inicio date not null default current_date,
  fim date null,
  payload jsonb not null default '{}'::jsonb,
  -- sync metadata
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create unique index if not exists uq_animais_sociedade_ativa
  on public.animais_sociedade (fazenda_id, animal_id)
  where deleted_at is null and fim is null;
```

#### RLS Planejado

```sql
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

#### Impacto no Offline-First

| Store Dexie               | Mapeamento          | Sync Mode |
| ------------------------- | ------------------- | --------- |
| `state_animais_sociedade` | `animais_sociedade` | state     |

### 2.2 Categorias Zootécnicas

#### Descrição

Sistema de categorização automática de animais por idade e sexo (sem peso).

#### Estrutura Planejada

```sql
-- Tabela: categorias_zootecnicas
create table if not exists public.categorias_zootecnicas (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,
  nome text not null,
  sexo public.sexo_enum null,
  aplica_ambos boolean not null default false,
  idade_min_dias int null,
  idade_max_dias int null,
  ativa boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  -- sync metadata
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

#### Lógica de Classificação

```typescript
function classificarAnimal(
  animal: Animal,
  categorias: CategoriaZootecnica[],
): CategoriaZootecnica | null {
  const idadeDias = diferencaDias(new Date(), animal.data_nascimento);

  return (
    categorias.find((cat) => {
      const sexoMatch =
        cat.sexo === animal.sexo || (cat.aplica_ambos && cat.sexo === null);
      const idadeMatch =
        idadeDias >= (cat.idade_min_dias || 0) &&
        idadeDias <= (cat.idade_max_dias || 99999);
      return sexoMatch && idadeMatch && cat.ativa;
    }) || null
  );
}
```

### 2.3 Infraestrutura de Pastos (Benfeitorias Expandidas)

#### Estrutura JSON Proposta

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
    "estado": "otimo|bom|regular|ruim"
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

---

## Fase 3 - Pós-MVP (Baixa Prioridade)

### 3.1 Genealogia Completa (N:M)

| Item                 | Descrição                          | Esforço |
| -------------------- | ---------------------------------- | ------- |
| `animais_parentesco` | Tabela N:M para genealogy completa | Alto    |

### 3.2 Histórico de Pastagem

| Item                       | Descrição                                     | Esforço |
| -------------------------- | --------------------------------------------- | ------- |
| `animais_pastos_historico` | Tabela histórica de movimentação entre pastos | Alto    |

### 3.3 Catálogos

| Item                  | Descrição                         | Esforço |
| --------------------- | --------------------------------- | ------- |
| `racas`               | Catálogo de raças bovinas         | Médio   |
| `produtos_sanitarios` | Catálogo de produtos veterinários | Médio   |

### 3.4 Rastreabilidade Premium

| Item              | Descrição                   | Prioridade |
| ----------------- | --------------------------- | ---------- |
| `sis_bov_id`      | Integração Sisbov           | Baixa      |
| `registro_ababc`  | Registro ABCZ               | Baixa      |
| `registro_sisbov` | Registro para abate premium | Baixa      |

---

## Fase 4 - Eventos Sanitários Expandidos (Pós-MVP)

### 4.1 Tabela de Produtos Veterinários

| Campo                    | Tipo | Descrição                       |
| ------------------------ | ---- | ------------------------------- |
| `id`                     | uuid | PK                              |
| `nome`                   | text | Nome do produto                 |
| `principio_ativo`        | text | Substância ativa                |
| `fabricante`             | text | Laboratório                     |
| `registro_mapa`          | text | Registro MAPA                   |
| `categoria`              | enum | biológico, farmacêutico, manejo |
| `via_administracao`      | enum | SC, IM, Oral, Tópica            |
| `periodo_carencia_carne` | int  | Dias                            |
| `periodo_carencia_leite` | int  | Dias                            |

### 4.2 Controle de Estoque

| Campo          | Tipo    | Descrição             |
| -------------- | ------- | --------------------- |
| `id`           | uuid    | PK                    |
| `fazenda_id`   | uuid    | FK                    |
| `produto_id`   | uuid    | FK para produtos      |
| `lote_produto` | text    | Lote do produto       |
| `quantidade`   | numeric | Quantidade em estoque |
| `validade`     | date    | Data de validade      |

### 4.3 Melhorias em Eventos Sanitários

| Campo                   | Prioridade | Descrição                              |
| ----------------------- | ---------- | -------------------------------------- |
| `fabricante`            | Média      | Já existe, melhorar UI                 |
| `lote_produto`          | Alta       | Adicionar campo                        |
| `data_validade`         | Alta       | Adicionar campo                        |
| `dose`                  | Alta       | Já existe, melhorar UI                 |
| `via_administracao`     | Média      | Converter para enum                    |
| `local_aplicacao`       | Média      | Converter para enum                    |
| `responsaveis`          | Média      | Já existe, melhorar UI                 |
| `nota_fiscal`           | Alta       | Novo campo para rastreabilidade        |
| `temperatura`           | Média      | Registrar temperatura de armazenamento |
| `crmv_responsavel`      | Baixa      | CRMV do profissional                   |
| `certificado_aplicador` | Baixa      | Certificado de quem aplicou            |

---

## Fase 5 - Relatórios e Dashboards

### 5.1 Relatórios Planejados

| Relatório             | Descrição                            | Prioridade |
| --------------------- | ------------------------------------ | ---------- |
| Inventário por pasto  | Lista de benfeitorias e condições    | Média      |
| Capacidade x Ocupação | UA disponíveis vs UA ocupados        | Média      |
| Manutenção Preventiva | Benfeitorias com estado regular/ruim | Baixa      |
| Status Vacinal        | Visão consolidada do rebanho         | Alta       |
| Consumo de Produtos   | Produtos utilizados por período/lote | Média      |
| Desempenho por Lote   | Ganho de peso, conversão             | Alta       |
| Reprodução            | Taxa de concepção, natalidade        | Média      |

### 5.2 Dashboards Planejados

| Dashboard  | Métricas                          | Prioridade |
| ---------- | --------------------------------- | ---------- |
| Sanitário  | Vacinações Pendentes, Vencimentos | Alta       |
| Rebanho    | Total por Status, Sexo, Lote      | Alta       |
| Agenda     | Tarefas do Dia, Semana            | Média      |
| Financeiro | Compras, Vendas por Período       | Baixa      |

---

## Fase 6 - Integrações

### 6.1 Integração GTA

| Funcionalidade        | Prioridade | Descrição                     |
| --------------------- | ---------- | ----------------------------- |
| Geração de GTA        | Alta       | Integração com sistema de GTA |
| Exportação de Eventos | Média      | Dados para GTA                |

### 6.2 Integração Sisbov

| Funcionalidade | Prioridade | Descrição                         |
| -------------- | ---------- | --------------------------------- |
| Sync Sisbov    | Baixa      | Sincronização com sistema oficial |
| QR Code/Brinco | Média      | Consulta por QR code              |

---

## Veja Também

- [**TECH_DEBT.md**](./TECH_DEBT.md) - Dívidas técnicas e obstáculos.
- [**00_MANIFESTO.md**](./00_MANIFESTO.md) - Visão de longo prazo.
