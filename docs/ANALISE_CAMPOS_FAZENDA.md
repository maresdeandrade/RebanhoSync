# ANÁLISE COMPLETA DOS CAMPOS DE FAZENDAS - REBANHOSYNC

## 1. RESUMO EXECUTIVO

A análise identificou **7 campos principais** na tabela `fazendas`, sendo **2 campos obrigatórios** (`id` e `nome`) e **5 campos opcionais** (`codigo`, `municipio`, `timezone`, `metadata`, `created_by`). O sistema atual representa um **estado mínimo viável (MVP)** focado em identificação básica da propriedade, sem campos específicos de pecuária ou gestão rural.

A estrutura atual prioriza:
- **Identificação básica**: nome e código da fazenda
- **Localização simplificada**: município e timezone
- **Flexibilidade via metadata**: campo JSONB para extensões futuras
- **Rastreabilidade**: campos de auditoria e soft delete

### Principais Achados

| Métrica | Valor |
|---------|-------|
| Campos na tabela `fazendas` | 7 (+ 8 campos de sistema) |
| Campos obrigatórios | 2 (id, nome) |
| Campos opcionais | 5 |
| Tabelas relacionadas | 3 (fazendas, user_fazendas, farm_invites) |
| Papéis disponíveis | 3 (owner, manager, cowboy) |

---

## 2. CAMPOS ATUAIS - FAZENDAS

### 2.1 Tabela `fazendas`

A tabela `fazendas` é a tabela raiz de tenant do sistema, responsável por isolar dados por propriedade rural. Todos os campos de negócio são opcionais, exceto `id` e `nome`.

```sql
-- Estrutura conforme migration 0001_init.sql
create table if not exists public.fazendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text null,
  municipio text null,
  timezone text not null default 'America/Sao_Paulo',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id),
  -- campos de sistema (Two Rails)
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  -- campos de auditoria
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### Documentação dos Campos de Negócio

| Campo | Tipo | Obrigatório | Visibilidade por Papel | Edição por Papel | Descrição Técnica | Status |
|-------|------|-------------|----------------------|-----------------|-------------------|--------|
| `id` | uuid | Sim | owner/manager/cowboy | Nenhuma | UUID gerado automaticamente pelo PostgreSQL via `gen_random_uuid()`. Identificador único da fazenda. | Ativo |
| `nome` | text | Sim | owner/manager/cowboy | owner/manager | Nome fantasia ou razão social da propriedade. Usado para identificação em toda a aplicação. | Ativo |
| `codigo` | text | Não | owner/manager/cowboy | owner/manager | Código interno para identificação rápida (ex: FSC-001). Pode ser usado para integrações. | Ativo |
| `municipio` | text | Não | owner/manager/cowboy | owner/manager | Nome do município onde a fazenda está localizada. Informação geográfica básica. | Ativo |
| `timezone` | text | Sim | owner/manager/cowboy | owner/manager | Fuso horário da propriedade (default: 'America/Sao_Paulo'). Usado para agendamentos e eventos. | Ativo |
| `metadata` | jsonb | Sim | owner/manager/cowboy | owner/manager | Campo flexível para armazenar dados estruturados adicionais. Inicializado como objeto vazio. | Ativo |
| `created_by` | uuid | Não | owner/manager | owner | Referência ao usuário que criou a fazenda. FK para `auth.users(id)`. | Ativo |

#### Campos de Sistema (Two Rails)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `client_id` | text | Identifica o dispositivo/origem da operação |
| `client_op_id` | uuid | UUID único para idempotência da operação |
| `client_tx_id` | uuid | Agrupa operações em transações |
| `client_recorded_at` | timestamptz | Timestamp de quando o cliente registrou a operação |
| `server_received_at` | timestamptz | Timestamp de quando o servidor recebeu |
| `deleted_at` | timestamptz | Soft delete - indica que o registro foi excluído |
| `created_at` | timestamptz | Timestamp de criação do registro |
| `updated_at` | timestamptz | Timestamp da última atualização |

---

### 2.2 Tabela `user_fazendas` (Membership)

A tabela de membership estabelece a relação muitos-para-muitos entre usuários e fazendas, definindo o papel de cada usuário na propriedade.

```sql
-- Estrutura conforme migration 0001_init.sql
create table if not exists public.user_fazendas (
  user_id uuid not null references auth.users(id) on delete cascade,
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  role public.farm_role_enum not null,
  is_primary boolean not null default false,
  invited_by uuid null references auth.users(id),
  accepted_at timestamptz null,
  -- campos de sistema (Two Rails)
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fazenda_id)
);
```

#### Documentação dos Campos

| Campo | Tipo | Obrigatório | Visibilidade por Papel | Edição por Papel | Descrição Técnica | Status |
|-------|------|-------------|----------------------|-----------------|-------------------|--------|
| `user_id` | uuid | Sim | owner/manager | owner | FK para `auth.users(id)`. Identifica o usuário membro. | Ativo |
| `fazenda_id` | uuid | Sim | owner/manager | owner | FK para `fazendas(id)`. Identifica a fazenda. | Ativo |
| `role` | farm_role_enum | Sim | owner/manager/cowboy | owner | Papel do usuário: 'owner', 'manager' ou 'cowboy'. | Ativo |
| `is_primary` | boolean | Sim | owner/manager | owner | Indica se é o membro principal/proprietário. | Ativo |
| `invited_by` | uuid | Não | owner/manager | sistema | FK para o usuário que enviou o convite. | Ativo |
| `accepted_at` | timestamptz | Não | owner/manager/cowboy | sistema | Timestamp de aceite do convite. | Ativo |
| `deleted_at` | timestamptz | Não | owner/manager | owner | Soft delete - membership inativo. | Ativo |

#### Constraints e Índices

- **Primary Key Composta**: `(user_id, fazenda_id)` - um usuário pode ser membro de várias fazendas
- **Índice Único**: `(fazenda_id, user_id)` onde `deleted_at IS NULL` - garante membership ativo por fazenda
- **FK com CASCADE**: Exclusão em cascata para `auth.users` e `fazendas`

---

### 2.3 Tabela `farm_invites`

O sistema de convites permite convidar novos membros para a fazenda via email ou telefone, gerando tokens únicos com expiração.

```sql
-- Estrutura conforme migration 0006_invite_system.sql
create table if not exists public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  email text null,
  phone text null,
  role public.farm_role_enum not null default 'cowboy',
  status text not null default 'pending',
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
```

#### Documentação dos Campos

| Campo | Tipo | Obrigatório | Visibilidade por Papel | Edição por Papel | Descrição Técnica | Status |
|-------|------|-------------|----------------------|-----------------|-------------------|--------|
| `id` | uuid | Sim | owner/manager | sistema | UUID único do convite. | Ativo |
| `fazenda_id` | uuid | Sim | owner/manager | owner | FK para a fazenda que está convidando. | Ativo |
| `invited_by` | uuid | Sim | owner/manager | sistema | FK para o usuário que criou o convite. | Ativo |
| `email` | text | Não | owner/manager | owner | Email do convidado (opcional se phone informado). | Ativo |
| `phone` | text | Não | owner/manager | owner | Telefone do convidado (opcional se email informado). | Ativo |
| `role` | farm_role_enum | Sim | owner/manager | owner | Papel atribuído ao convidado. | Ativo |
| `status` | text | Sim | owner/manager | sistema | Status: 'pending', 'accepted', 'expired', 'cancelled'. | Ativo |
| `token` | text | Sim | owner/manager | sistema | Token único para aceite do convite. | Ativo |
| `expires_at` | timestamptz | Sim | owner/manager | sistema | Data/hora de expiração (default: +7 dias). | Ativo |

---

## 3. MATRIZ DE PERMISSÕES POR PAPEL

A matriz a seguir consolida as permissões de visibilidade e edição para cada campo das tabelas relacionadas a fazendas.

### 3.1 Tabela `fazendas`

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | | | |
| id | ✅ | ✅ | ✅ |
| nome | ✅ | ✅ | ✅ |
| codigo | ✅ | ✅ | ✅ |
| municipio | ✅ | ✅ | ✅ |
| timezone | ✅ | ✅ | ✅ |
| metadata | ✅ | ✅ | ✅ |
| created_by | ✅ | ✅ | ✅ |
| **Edição** | | | |
| nome | ✅ | ✅ | ❌ |
| codigo | ✅ | ✅ | ❌ |
| municipio | ✅ | ✅ | ❌ |
| timezone | ✅ | ✅ | ❌ |
| metadata | ✅ | ✅ | ❌ |
| **Exclusão** | | | |
| Soft delete | ✅ | ❌ | ❌ |

### 3.2 Tabela `user_fazendas` (Membership)

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | | | |
| user_id (próprio) | ✅ | ✅ | ✅ |
| user_id (outros) | ✅ | ✅ | ✅* |
| fazenda_id | ✅ | ✅ | ✅ |
| role | ✅ | ✅ | ✅* |
| is_primary | ✅ | ✅ | ❌ |
| invited_by | ✅ | ✅ | ✅* |
| accepted_at | ✅ | ✅ | ✅* |
| **Edição** | | | |
| role (próprio) | ❌ | ❌ | ❌ |
| role (outros) | ✅ | ❌ | ❌ |
| is_primary | ✅ | ❌ | ❌ |
| **Gestão de Membros** | | | |
| Adicionar membro | ✅ | ✅ | ❌ |
| Remover membro | ✅ | ❌ | ❌ |
| Alterar role | ✅ | ❌ | ❌ |

* Cowboy pode ver informações de outros membros na página de equipe

### 3.3 Tabela `farm_invites`

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | | | |
| Todos os convites | ✅ | ✅ | ❌ |
| Convites pendentes | ✅ | ✅ | ❌ |
| **Edição** | | | |
| Criar convite | ✅ | ✅ | ❌ |
| Cancelar convite | ✅ | ✅ | ❌ |
| Reenviar convite | ✅ | ✅ | ❌ |

### 3.4 Resumo Consolidado de Permissões

| Operação | Owner | Manager | Cowboy |
|----------|-------|---------|--------|
| Criar fazenda | ✅ | ❌ | ❌ |
| Editar dados da fazenda | ✅ | ✅ | ❌ |
| Excluir fazenda (soft delete) | ✅ | ❌ | ❌ |
| Visualizar membros | ✅ | ✅ | ✅ |
| Adicionar membro | ✅ | ✅ | ❌ |
| Remover membro | ✅ | ❌ | ❌ |
| Alterar role de membro | ✅ | ❌ | ❌ |
| Criar/editar animais | ✅ | ✅ | ✅ |
| Criar/editar lotes | ✅ | ✅ | ❌ |
| Criar/editar pastos | ✅ | ✅ | ❌ |
| Criar protocolos | ✅ | ✅ | ❌ |
| Registrar eventos | ✅ | ✅ | ✅ |
| Concluir agenda | ✅ | ✅ | ✅ |

---

## 4. ANÁLISE CRÍTICA - ESTADO ATUAL

### 4.1 Pontos Fortes

O sistema atual apresenta fundamentos sólidos para uma aplicação de gestão rural:

1. **Sistema Escalável de Papéis**
   - three papéis bem definidos (owner, manager, cowboy)
   - Hierarquia clara de permissões
   - Princípio do menor privilégio aplicado

2. **Row Level Security (RLS) Implementado**
   - Políticas robustas de isolamento por fazenda
   - Verificação via função `has_membership()`
   - Acesso negado automaticamente para não-membros

3. **Soft Delete para Auditoria**
   - Campo `deleted_at` preserva histórico
   - Membership pode ser "ressuscitado"
   - Rastreabilidade completa de operações

4. **Sistema de Convites Robusto**
   - Tokens únicos com expiração
   - Suporte a email e telefone
   - Validação por RPCs security definer

5. **Arquitetura Two Rails**
   - Campos de idempotência (`client_op_id`)
   - Rastreamento de origem (`client_id`)
   - Sincronização offline-first suportada

6. **Flexibilidade via metadata**
   - Campo JSONB para extensões futuras
   - Não requer migração para novos dados

### 4.2 Lacunas Identificadas

Apesar dos fundamentos sólidos, o estado atual apresenta limitações significativas para gestão pecuária:

1. **Localização Geográfica Incompleta**
   - ❌ Falta CEP
   - ❌ Falta estado (UF)

2. **Dimensionamento e Área**
   - ❌ Sem campo de área total em hectares

3. **Tipo de Produção Pecuária**
   - ❌ Sem identificação de tipo (corte/leite/mista)
   - ❌ Sem sistema de manejo (confinamento/semi/pastagem)

4. **Infraestrutura**
   - ❌ Sem número de currais
   - ❌ Sem área de depósito de insumos
   - ❌ Sem existência de embarque
   - ❌ Sem capacidade de reservatório de água

---

## 5. PROPOSTA DE EXPANSÃO PARA PECUÁRIA

### 5.1 Categoria: Identificação e Localização

Adicionar campos para geolocalização precisa e endereço completo.

| Campo | Tipo | Obrigatório | Sugestão de Valor Default | Descrição |
|-------|------|-------------|---------------------------|-----------|
| `cep` | text | Não | null | Código de postcode brasileiro |
| `estado` | text (2) | Não | null | Sigla do estado (UF) |

### 5.2 Categoria: Área e Dimensionamento

Adicionar campos para gestão territorial da propriedade.

| Campo | Tipo | Obrigatório | Sugestão de Valor Default | Descrição |
|-------|------|-------------|---------------------------|-----------|
| `area_total_ha` | numeric(12,2) | Não | null | Área total em hectares |

### 5.3 Categoria: Produção Pecuária

Adicionar campos para identificação do tipo de criação.

| Campo | Tipo | Obrigatório | Sugestão de Valor Default | Descrição |
|-------|------|-------------|---------------------------|-----------|
| `tipo_producao` | enum | Não | null | Tipo: 'corte', 'leite', 'mista' |
| `sistema_manejo` | enum | Não | null | Sistema: 'confinamento', 'semi', 'pastagem' |

### 5.4 Categoria: Estrutura e Infraestrutura

Adicionar campos para gestão de benfeitorias.

| Campo | Tipo | Obrigatório | Sugestão de Valor Default | Descrição |
|-------|------|-------------|---------------------------|-----------|
| `num_currais` | int | Não | 0 | Número de currais |
| `num_cochos` | int | Não | 0 | Número de cochos |
| `existe_embarque` | boolean | false | Boolean | Possui área de embarque? |
| `capacidade_reservatorio_l` | numeric(10,2) | Não | null | Capacidade em litros |
| `tipo_reservatorio` | enum | Não | null | Tipo: 'açude', 'mina', 'cisterna', 'poço' |
| `benfeitorias` | jsonb | Não | {} | JSON para benfeitorias extras |

---

## 6. PROPOSTA POR ESCALA DE PROPRIEDADE

### 6.1 Pequenas Propriedades (< 100 ha)

**Perfil**: Gestão familiar, foco em subsistência ou produção limitada.

#### Campos Essenciais Recomendados

| Categoria | Campos | Prioridade |
|-----------|--------|------------|
| **Identificação** | nome, municipio | Obrigatório |
| **Localização** | estado, cep | Alta |
| **Área** | area_total_ha | Alta |
| **Produção** | tipo_producao, sistema_manejo | Alta |
| **Infraestrutura** | benfeitorias | Baixa |

#### Justificativa

Pequenas propriedades raramente possuem documentação formal completa. O foco deve ser em:
- Identificação básica para emissão de GTAs
- Área total para cálculo de lotação
- Tipo de produção para relatórios simplificados

### 6.2 Médias Propriedades (100-500 ha)

**Perfil**: Gestão profissionalizada, múltiplas atividades, possível integração lavoura-pecuária.

#### Campos Essenciais Recomendados

| Categoria | Campos | Prioridade |
|-----------|--------|------------|
| **Identificação** | nome, codigo, municipio | Obrigatório |
| **Localização** | estado, cep | Alta |
| **Área** | area_total_ha | Alta |
| **Produção** | tipo_producao | Alta |
| **Infraestrutura** | num_currais | benfeitorias | Média |

#### Justificativa

Médias propriedades geralmente:
- Possuem documentação mais completa
- Requerem gestão de múltiplos pastos/currais
- Precisam de registro Sisbov para abate premium
- Requerem comunicação formal (email)

### 6.3 Grandes Propriedades (> 500 ha)

**Perfil**: Gestão empresarial, múltiplos funcionários, alta tecnologia.

#### Campos Essenciais Recomendados

| Categoria | Campos | Prioridade |
|-----------|--------|------------|
| **Identificação** | Todos | Obrigatório |
| **Localização** | Todos + coordenadas | Alta |
| **Área** | Todos os campos de área | Alta |
| **Produção** | Todos os campos de produção | Alta |
| **Infraestrutura** | Todos os campos de infraestrutura | Alta |

#### Justificativa

Grandes propriedades requerem:
- Documentação completa para auditorias
- Infraestrutura detalhada para planejamento

---

## 7. PRIORIZAÇÃO DE IMPLEMENTAÇÃO

### Fase 1 - Essencial (Impacto Alto, Viabilidade Alta)

**Objetivo**: Preencher lacunas críticas para operação básica pecuária.

| Categoria | Campos | Viabilidade | Impacto | Esforço |
|-----------|--------|-------------|---------|---------|
| Localização | `estado`, `cep` | Alta | Alto | Baixo |
| Área | `area_total_ha` | Alta | Alto | Baixo |
| Produção | `tipo_producao`, `sistema_manejo` | Alta | Alto | Baixo |

**Total de campos**: 5-6 campos

**Critérios de decisão**:
- ✅ Não requer validação complexa
- ✅ Não requer mudanças no RLS
- ✅ Não requer mudanças no frontend ( campos opcionais)
- ✅ Alto valor para gestão

---

## 08. RECOMENDAÇÕES TÉCNICAS

### 08.1 Migração de Dados

Para adicionar novos campos sem quebrar a estrutura atual, seguir estas orientações:

#### Abordagem Recomendada: Migration Incremental

```sql
-- Migration exemplo: Adicionar campos de localização
ALTER TABLE public.fazendas
ADD COLUMN IF NOT EXISTS estado text(2) NULL,

-- Criar índices para campos frequentemente consultados
CREATE INDEX IF NOT EXISTS ix_fazendas_estado ON public.fazendas(estado);
CREATE INDEX IF NOT EXISTS ix_fazendas_area_total ON public.fazendas(area_total_ha);

#### Checklist de Migração

1. ✅ Adicionar colunas como NULL inicialmente
2. ✅ Criar índices após migração de dados
3. ✅ Adicionar constraints de validação progressivamente
4. ✅ Documentar mudanças no schema
5. ✅ Atualizar tipos TypeScript no frontend
6. ✅ Testar RLS com novos campos
7. ✅ Criar migração de dados existentes (se aplicável)

### 08.2 Validações e Constraints

#### Constraints Obrigatórias (ao adicionar colunas)

```sql
-- Validação de estado (UF)
ALTER TABLE public.fazendas
ADD CONSTRAINT ck_fazendas_estado
CHECK (estado IS NULL OR estado IN (
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ',
  'RN','RS','RO','RR','SC','SP','SE','TO'
));

-- Validação de área positiva
ALTER TABLE public.fazendas
ADD CONSTRAINT ck_fazendas_area_positiva
CHECK (area_total_ha IS NULL OR area_total_ha > 0);

```

#### Sugestões de Validação no Frontend

```typescript
// Tipos TypeScript para validação
interface FazendoDados {
  estado?: 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' |
               'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' |
               'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';
  area_total_ha?: number;  // > 0
}
```

## 09. REFERÊNCIAS

### Arquivos Analisados

| Arquivo | Descrição | Relevância |
|---------|-----------|------------|
| [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) | Schema inicial do banco de dados | Definição da tabela `fazendas` e `user_fazendas` |
| [`src/pages/CriarFazenda.tsx`](../src/pages/CriarFazenda.tsx) | Página de criação de fazendas | Campos utilizados no formulário |
| [`src/pages/Membros.tsx`](../src/pages/Membros.tsx) | Página de gestão de membros | Relacionamento user_fazendas |
| [`src/hooks/useAuth.tsx`](../src/hooks/useAuth.tsx) | Hook de autenticação | Sistema de papéis e activeFarmId |
| [`src/hooks/useCurrentRole.ts`](../src/hooks/useCurrentRole.ts) | Hook de papel atual | Determinação de role por fazenda |
| [`src/components/members/InviteMemberDialog.tsx`](../src/components/members/InviteMemberDialog.tsx) | Dialog de convites | Sistema de farm_invites |
| [`docs/RLS.md`](RLS.md) | Documentação de RLS | Matriz de permissões completa |

### Documentação Relacionada

- [`docs/DB.md`](DB.md) - Documentação do banco de dados
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) - Arquitetura do sistema
- [`docs/CONTRACTS.md`](CONTRACTS.md) - Contratos e tipos TypeScript

---

## APÊNDICE A: DADOS DE REFERÊNCIA IBGE

### Lista de UFs Brasileiras

| UF | Nome | Região |
|----|------|--------|
| AC | Acre | Norte |
| AL | Alagoas | Nordeste |
| AP | Amapá | Norte |
| AM | Amazonas | Norte |
| BA | Bahia | Nordeste |
| CE | Ceará | Nordeste |
| DF | Distrito Federal | Centro-Oeste |
| ES | Espírito Santo | Sudeste |
| GO | Goiás | Centro-Oeste |
| MA | Maranhão | Nordeste |
| MT | Mato Grosso | Centro-Oeste |
| MS | Mato Grosso do Sul | Centro-Oeste |
| MG | Minas Gerais | Sudeste |
| PA | Pará | Norte |
| PB | Paraíba | Nordeste |
| PR | Paraná | Sul |
| PE | Pernambuco | Nordeste |
| PI | Piauí | Nordeste |
| RJ | Rio de Janeiro | Sudeste |
| RN | Rio Grande do Norte | Nordeste |
| RS | Rio Grande do Sul | Sul |
| RO | Rondônia | Norte |
| RR | Roraima | Norte |
| SC | Santa Catarina | Sul |
| SP | São Paulo | Sudeste |
| SE | Sergipe | Nordeste |
| TO | Tocantins | Norte |

---

*Documento gerado em: Fevereiro de 2025*
*Versão: 1.0*
*Autor: Análise Técnica RebanhoSync*

---

## 11. MIGRAÇÕES ADICIONAIS - CAMPOS DE PRODUÇÃO

### 11.1 Migração 0016: `add_farm_location_area_production`

Esta migração adicionou **5 novos campos** à tabela `fazendas`, implementando a **Fase 1** da proposta de expansão para pecuária.

#### 11.1.1 Novos Campos Adicionados

| Campo | Tipo | Obrigatório | Nullable | Constraint | Descrição |
|-------|------|-------------|----------|------------|-----------|
| `estado` | `estado_uf_enum` | Não | Sim | NULL | Sigla da UF brasileira (ex: SP, MG, GO) |
| `cep` | `text` | Não | Sim | `ck_fazendas_cep_formato` | CEP no formato XXXXX-XXX |
| `area_total_ha` | `numeric(12,2)` | Não | Sim | `ck_fazendas_area_positiva` | Área total em hectares (> 0) |
| `tipo_producao` | `tipo_producao_enum` | Não | Sim | NULL | Tipo: corte, leite ou mista |
| `sistema_manejo` | `sistema_manejo_enum` | Não | Sim | NULL | Sistema: confinamento, semi_confinamento ou pastagem |

#### 11.1.2 Novos Tipos ENUM

```sql
-- ENUM para estados brasileiros
CREATE TYPE public.estado_uf_enum AS ENUM (
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ',
  'RN','RS','RO','RR','SC','SP','SE','TO'
);

-- ENUM para tipo de produção
CREATE TYPE public.tipo_producao_enum AS ENUM ('corte', 'leite', 'mista');

-- ENUM para sistema de manejo
CREATE TYPE public.sistema_manejo_enum AS ENUM (
  'confinamento', 'semi_confinamento', 'pastagem'
);
```

#### 11.1.3 Constraints de Validação

| Nome | Expressão | Descrição |
|------|-----------|-----------|
| `ck_fazendas_cep_formato` | `CHECK (cep IS NULL OR cep ~ '^\d{5}-\d{3}
)` | Garante formato válido de CEP brasileiro |
| `ck_fazendas_area_positiva` | `CHECK (area_total_ha IS NULL OR area_total_ha > 0)` | Garante área positiva ou NULL |

#### 11.1.4 Índices de Performance

| Nome | Coluna(s) | Condição | Uso |
|------|-----------|----------|-----|
| `ix_fazendas_estado` | `estado` | `WHERE estado IS NOT NULL` | Filtros geográficos |
| `ix_fazendas_area_total` | `area_total_ha` | `WHERE area_total_ha IS NOT NULL` | Ordenação por tamanho |
| `ix_fazendas_tipo_producao` | `tipo_producao` | `WHERE tipo_producao IS NOT NULL` | Filtros por produção |

### 11.2 Migração 0017: `update_create_fazenda_rpc`

Esta migração atualizou a RPC `create_fazenda` para incluir os novos parâmetros de produção pecuária.

#### 11.2.1 Novos Parâmetros da RPC

A procedure `create_fazenda` agora aceita **8 parâmetros**:

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `_nome` | text | ✅ Sim | Nome da fazenda |
| `_codigo` | text | ❌ Não | Código identificador |
| `_municipio` | text | ❌ Não | Município |
| `_estado` | estado_uf_enum | ❌ Não | Estado (UF) |
| `_cep` | text | ❌ Não | CEP |
| `_area_total_ha` | numeric | ❌ Não | Área total em hectares |
| `_tipo_producao` | tipo_producao_enum | ❌ Não | Tipo de produção |
| `_sistema_manejo` | sistema_manejo_enum | ❌ Não | Sistema de manejo |

#### 11.2.2 Validações

A RPC confia nas constraints da migração 0016:
- ✅ Validação de formato CEP via `ck_fazendas_cep_formato`
- ✅ Validação de área positiva via `ck_fazendas_area_positiva`

#### 11.2.3 Grant

```sql
GRANT EXECUTE ON FUNCTION public.create_fazenda(
  text, text, text, estado_uf_enum, text, numeric, 
  tipo_producao_enum, sistema_manejo_enum
) TO authenticated;
```

## Status de Implementação das Propostas

| Categoria | Campo | Status | Migração |
|-----------|-------|--------|----------|
| **Localização** | `estado` | ✅ Implementado | 0016 |
| **Localização** | `cep` | ✅ Implementado | 0016 |
| **Área** | `area_total_ha` | ✅ Implementado | 0016 |
| **Produção** | `tipo_producao` | ✅ Implementado | 0016 |
| **Produção** | `sistema_manejo` | ✅ Implementado | 0016 |
| **Índices** | `idx_animais_status` | ✅ Implementado | 0018 |
| **Índices** | `idx_animais_lote` | ✅ Implementado | 0018 |
| **Índices** | `idx_animais_sexo` | ✅ Implementado | 0018 |
| **Índices** | `idx_eventos_fazenda_dominio_occurred` | ✅ Implementado | 0018 |
| **Índices** | `idx_eventos_fazenda_animal_occurred` | ✅ Implementado | 0018 |
| **Índices** | `idx_agenda_fazenda_data` | ✅ Implementado | 0018 |
| **Índices** | `idx_agenda_fazenda_status` | ✅ Implementado | 0018 |
| **Infraestrutura** | `num_currais` | ❌ Pendente | ROADMAP |
| **Infraestrutura** | `benfeitorias` | ❌ Pendente | ROADMAP |
| **Contato** | `telefone` | ❌ Pendente | ROADMAP |
| **Contato** | `email` | ❌ Pendente | ROADMAP |
| **Rastreabilidade** | `cnpj` | ❌ Pendente | ROADMAP |
| **Rastreabilidade** | `registro_sisbov` | ❌ Pendente | ROADMAP |

### 11.4 Atualização da Matriz de Permissões

Com os novos campos, a matriz de permissões é atualizada:

| Campo/Permissão | Owner | Manager | Cowboy |
|-----------------|-------|---------|--------|
| **Visualização** | | | |
| estado | ✅ | ✅ | ✅ |
| cep | ✅ | ✅ | ✅ |
| area_total_ha | ✅ | ✅ | ✅ |
| tipo_producao | ✅ | ✅ | ✅ |
| sistema_manejo | ✅ | ✅ | ✅ |
| **Edição** | | | |
| estado | ✅ | ✅ | ❌ |
| cep | ✅ | ✅ | ❌ |
| area_total_ha | ✅ | ✅ | ❌ |
| tipo_producao | ✅ | ✅ | ❌ |
| sistema_manejo | ✅ | ✅ | ❌ |

### 11.5 Resumo: Evolução da Tabela Fazendas

| Fase | Campos | Total | Data |
|------|--------|-------|------|
| **Inicial** | id, nome, codigo, municipio, timezone, metadata, created_by | 7 | MVP |
| **Fase 1** | + estado, cep, area_total_ha, tipo_producao, sistema_manejo | 12 | 2026-02-07 |
| **Proposta** | + telefone, email, cnpj, registro_sisbov, registro_abcz, etc. | 17+ | Futuro |

### 11.6 Referências das Novas Migrações

- [`supabase/migrations/0016_add_farm_location_area_production.sql`](supabase/migrations/0016_add_farm_location_area_production.sql)
- [`supabase/migrations/0017_update_create_fazenda_rpc.sql`](supabase/migrations/0017_update_create_fazenda_rpc.sql)
- [`supabase/migrations/0018_add_rebanho_performance_indexes.sql`](supabase/migrations/0018_add_rebanho_performance_indexes.sql)

---

**Nota**: Esta seção foi adicionada em 2026-02-08 para documentar as migrações descobertas após a análise inicial. O documento principal já continha proposta de expansão que foi parcialmente implementada nas migrações 0016 e 0017.

---

*Documento atualizado em: Fevereiro de 2026*
*Versão: 2.0 - Inclui migrações 0016, 0017, 0018*
