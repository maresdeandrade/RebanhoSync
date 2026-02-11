# Análise Técnica de Eventos Sanitários - Sistema GestaoAgro

**Versão:** 1.0  
**Data:** Fevereiro 2025  
**Autor:** Equipe de Arquitetura  
**Base Legal:** Regulamentações MAPA, ANVISA, Bem-estar Animal

---

## 1. Mapeamento do Fluxo de Dados

### 1.1 Diagrama Textual do Fluxo de Eventos Sanitários

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE EVENTOS SANITÁRIOS                            │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────┐
    │   USUÁRIO     │
    │  (Cowboy/     │
    │   Manager)    │
    └───────┬───────┘
            │
            ▼
    ┌───────────────────┐
    │  REGISTRO DE      │
    │  EVENTO SANITÁRIO │◄───────────────────────────────────────┐
    │  (App Mobile/Web) │                                        │
    └─────────┬─────────┘                                        │
              │                                                  │
              ▼                                                  │
    ┌─────────────────────────┐                                 │
    │  VALIDAÇÃO FRONTEND     │                                 │
    │  - Tipo de evento        │                                 │
    │  - Produto/vacina        │                                 │
    │  - Animal/Lote           │                                 │
    │  - Data de aplicação     │                                 │
    └───────────┬─────────────┘                                 │
                │                                                │
                ▼                                                │
    ┌──────────────────────────────────────────────────────────┐│
    │              SUPABASE DATABASE (Schema)                   ││
    │                                                           ││
    │  ┌─────────────────┐    1:1    ┌─────────────────┐       ││
    │  │    eventos      │──────────►│ eventos_sanitario│       ││
    │  │  (append-only)  │           │                 │       ││
    │  └─────────────────┘           └─────────────────┘       ││
    │        │                              │                   ││
    │        │ 1:N                          │                   ││
    │        ▼                              │                   ││
    │  ┌─────────────────┐                  │                   ││
    │  │  agenda_itens   │                  │                   ││
    │  │   (mutável)     │                  │                   ││
    │  └─────────────────┘                  │                   ││
    │        │                              │                   ││
    │        │ 1:N                          │                   ││
    │        ▼                              │                   ││
    │  ┌─────────────────┐                  │                   ││
    │  │protocolos_      │◄─────────────────┘                   ││
    │  │sanitarios       │                                      ││
    │  │  (templates)    │                                      ││
    │  └─────────────────┘                                      ││
    │        │                                                  ││
    │        │ 1:N                                              ││
    │        ▼                                                  ││
    │  ┌─────────────────┐                                      ││
    │  │protocolos_      │                                      ││
    │  │sanitarios_itens │                                      ││
    │  └─────────────────┘                                      ││
    │                                                           ││
    └───────────────────────────────────────────────────────────┘│
              │                                                  │
              ▼                                                  │
    ┌───────────────────────────────────────────────────────────┐
    │                   TRIGGERS & RLS                          │
    │  ┌─────────────────────────────────────────────────────┐  │
    │  │ prevent_business_update() - Bloqueia UPDATE         │  │
    │  │ set_updated_at() - Atualiza timestamp               │  │
    │  │ RLS Policies - Controle de acesso por role          │  │
    │  └─────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────┘
              │
              ▼
    ┌───────────────────────────────────────────────────────────┐
    │                   OFFLINE SYNC                            │
    │  ┌─────────────────────────────────────────────────────┐  │
    │  │ IndexedDB Local → Sync Worker → Supabase Backend    │  │
    │  │ (client_id, client_op_id, client_tx_id)             │  │
    │  └─────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────┘
```

### 1.2 Descrição Detalhada do Fluxo

#### 1.2.1 Etapa de Criação de Protocolo Sanitário

O fluxo inicia com a **definição de protocolos sanitários** pelo Manager/Owner:

1. **Criação do Protocolo**: O Manager cria um template em `protocolos_sanitarios`
2. **Definição de Itens**: Cada protocolo pode ter múltiplos itens em `protocolos_sanitarios_itens`
3. **Geração de Agenda**: Quando o protocolo é ativado, gera `agenda_itens` para animais/lotes
4. **Execução em Campo**: Cowboys executam as tarefas da agenda

#### 1.2.2 Etapa de Registro de Evento

O **registro de evento sanitário** segue o fluxo:

1. **Gesto do Usuário**: Cowboy registra aplicação de vacina/medicamento
2. **Geração de client_op_id**: UUID único criado no frontend para idempotência
3. **Inserção em `eventos`**: Criação do registro base com metadados de sync
4. **Inserção em `eventos_sanitario`**: Criação do detalhe sanitário (1:1)
5. **Validação RLS**: Supabase verifica permissões do usuário
6. **Trigger Append-Only**: Sistema bloqueia futuras edições nas colunas de negócio
7. **Confirmação**: Retorno ao frontend com status da operação

#### 1.2.3 Relacionamentos Entre Tabelas

| Relacionamento | Tipo | Descrição |
|---------------|------|-----------|
| `eventos` → `eventos_sanitario` | 1:1 | Detalhe específico do evento sanitário |
| `protocolos_sanitarios` → `protocolos_sanitarios_itens` | 1:N | Itens que compõem o protocolo |
| `agenda_itens` → `eventos` | 1:N | Agenda pode gerar múltiplos eventos |
| `eventos` → `eventos` (corrige_evento_id) | 1:1 (self-ref) | Correção de eventos anteriores |

---

## 2. Inventário de Colunas e Tabelas

### 2.1 Tabela: `eventos`

**Objetivo**: Registro base para todos os tipos de eventos no sistema (append-only).

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | uuid | NO | PK - Identificador único do evento |
| `fazenda_id` | uuid | NO | FK para isolamento multi-tenant |
| `dominio` | dominio_enum | NO | Categoria: 'sanitario', 'pesagem', 'nutricao', 'movimentacao', 'reproducao', 'financeiro' |
| `occurred_at` | timestamptz | NO | Data/hora em que o evento ocorreu |
| `animal_id` | uuid | YES | FK para animal (opcional se lote_id preenchido) |
| `lote_id` | uuid | YES | FK para lote (opcional se animal_id preenchido) |
| `source_task_id` | uuid | YES | FK para agenda_itens que gerou este evento |
| `corrige_evento_id` | uuid | YES | Self-FK para correção de evento anterior |
| `client_id` | text | NO | Identifica origem (browser:uuid, server) |
| `client_op_id` | uuid | NO | UUID da operação (idempotência) |
| `client_tx_id` | uuid | NO | UUID da transação/gesto do usuário |
| `client_recorded_at` | timestamptz | NO | Timestamp do registro no cliente |
| `server_received_at` | timestamptz | NO | Timestamp do recebimento no servidor |
| `created_at` | timestamptz | NO | Timestamp de criação no banco |
| `updated_at` | timestamptz | NO | Timestamp de última atualização |
| `deleted_at` | timestamptz | YES | Soft delete (NULL = ativo) |

### 2.2 Tabela: `eventos_sanitario`

**Objetivo**: Detalhes específicos de eventos sanitários (vacinação, vermifugação, medicamentos).

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | uuid | NO | PK - Referência ao evento base |
| `fazenda_id` | uuid | NO | FK para isolamento multi-tenant |
| `tipo` | sanitario_tipo_enum | NO | 'vacinacao', 'vermifugacao', 'medicamento' |
| `produto` | text | NO | Nome do produto/vacina/medicamento aplicado |
| `fabricante` | text | YES | Nome do laboratório fabricante |
| `lote_produto` | text | YES | Número do lote do produto |
| `data_validade` | date | YES | Data de validade do produto |
| `dose` | numeric(8,2) | YES | Dose aplicada |
| `unidade_dose` | text | YES | Unidade (ml, IU, comprimido) |
| `via_administracao` | text | YES | Via (subcutânea, intramuscular, oral) |
| `local_aplicacao` | text | YES | Local de aplicação (colo, pescoço) |
| `responsaveis` | text[] | YES | Array de responsáveis pela aplicação |
| `observacoes` | text | YES | Observações adicionais |
| `client_id` | text | NO | Identifica origem |
| `client_op_id` | uuid | NO | UUID da operação (idempotência) |
| `client_tx_id` | uuid | NO | UUID da transação/gesto |
| `client_recorded_at` | timestamptz | NO | Timestamp do registro no cliente |
| `server_received_at` | timestamptz | NO | Timestamp do recebimento |
| `created_at` | timestamptz | NO | Timestamp de criação |
| `updated_at` | timestamptz | NO | Timestamp de atualização |
| `deleted_at` | timestamptz | YES | Soft delete |

### 2.3 Tabela: `protocolos_sanitarios`

**Objetivo**: Templates de protocolos sanitários para padronização de procedimentos.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | uuid | NO | PK |
| `fazenda_id` | uuid | NO | FK para isolamento multi-tenant |
| `nome` | text | NO | Nome do protocolo |
| `descricao` | text | YES | Descrição detalhada |
| `categoria` | text | YES | Categoria (vacinação, controle parasitas, tratamento) |
| `especie_alvo` | text | YES | Espécie de destino (bovino, bubalino) |
| `categoria_produtiva` | text | YES | Categoria (bezerro, novilha, vaca, touro) |
| `ativo` | boolean | NO | Se o protocolo está ativo (default: true) |
| `versao` | text | YES | Versão do protocolo |
| `valido_de` | date | YES | Data de início de vigência |
| `valido_ate` | date | YES | Data de fim de vigência |
| `observacoes` | text | YES | Observações |
| `client_id` | text | NO | Identifica origem |
| `client_op_id` | uuid | NO | UUID da operação |
| `client_tx_id` | uuid | NO | UUID da transação |
| `client_recorded_at` | timestamptz | NO | Timestamp do registro |
| `server_received_at` | timestamptz | NO | Timestamp do recebimento |
| `created_at` | timestamptz | NO | Timestamp de criação |
| `updated_at` | timestamptz | NO | Timestamp de atualização |
| `deleted_at` | timestamptz | YES | Soft delete |

### 2.4 Tabela: `protocolos_sanitarios_itens`

**Objetivo**: Itens individuais que compõem um protocolo sanitário.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | uuid | NO | PK |
| `fazenda_id` | uuid | NO | FK para isolamento multi-tenant |
| `protocolo_id` | uuid | NO | FK para protocolos_sanitarios |
| `ordem` | int | YES | Ordem de execução no protocolo |
| `tipo` | sanitario_tipo_enum | NO | Tipo de procedimento |
| `produto` | text | NO | Produto/vacina/medicamento |
| `fabricante` | text | YES | Laboratório fabricante |
| `intervalo_dias` | int | YES | Dias após evento anterior |
| `dose_num` | int | YES | Número da dose (1ª, 2ª, etc.) |
| `gera_agenda` | boolean | NO | Se gera lembrete na agenda (default: true) |
| `dedup_template` | text | YES | Template para deduplicação de agenda |
| `idade_minima_dias` | int | YES | Idade mínima para aplicação |
| `idade_maxima_dias` | int | YES | Idade máxima para aplicação |
| `observacoes` | text | YES | Observações específicas |
| `client_id` | text | NO | Identifica origem |
| `client_op_id` | uuid | NO | UUID da operação |
| `client_tx_id` | uuid | NO | UUID da transação |
| `client_recorded_at` | timestamptz | NO | Timestamp do registro |
| `server_received_at` | timestamptz | NO | Timestamp do recebimento |
| `created_at` | timestamptz | NO | Timestamp de criação |
| `updated_at` | timestamptz | NO | Timestamp de atualização |
| `deleted_at` | timestamptz | YES | Soft delete |

### 2.5 Tabela: `agenda_itens`

**Objetivo**: Tarefas agendadas geradas por protocolos ou criadas manualmente.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | uuid | NO | PK |
| `fazenda_id` | uuid | NO | FK para isolamento multi-tenant |
| `dominio` | dominio_enum | NO | Categoria do item |
| `tipo` | text | YES | Tipo específico |
| `status` | agenda_status_enum | NO | 'agendado', 'concluido', 'cancelado' |
| `data_prevista` | date | NO | Data para execução |
| `animal_id` | uuid | YES | FK para animal |
| `lote_id` | uuid | YES | FK para lote |
| `protocolo_item_id` | uuid | YES | FK para protocolos_sanitarios_itens |
| `dedup_key` | text | YES | Chave para deduplicação |
| `source_kind` | agenda_source_kind_enum | NO | 'manual' ou 'automatico' |
| `observacoes` | text | YES | Observações |
| `client_id` | text | NO | Identifica origem |
| `client_op_id` | uuid | NO | UUID da operação |
| `client_tx_id` | uuid | NO | UUID da transação |
| `client_recorded_at` | timestamptz | NO | Timestamp do registro |
| `server_received_at` | timestamptz | NO | Timestamp do recebimento |
| `created_at` | timestamptz | NO | Timestamp de criação |
| `updated_at` | timestamptz | NO | Timestamp de atualização |
| `deleted_at` | timestamptz | YES | Soft delete |

### 2.6 Enums Relacionados

```sql
-- Tipos de eventos
CREATE TYPE dominio_enum AS ENUM (
  'sanitario', 'pesagem', 'nutricao', 
  'movimentacao', 'reproducao', 'financeiro'
);

-- Tipos de eventos sanitários
CREATE TYPE sanitario_tipo_enum AS ENUM (
  'vacinacao', 'vermifugacao', 'medicamento'
);

-- Status da agenda
CREATE TYPE agenda_status_enum AS ENUM (
  'agendado', 'concluido', 'cancelado'
);

-- Origem do item da agenda
CREATE TYPE agenda_source_kind_enum AS ENUM (
  'manual', 'automatico'
);
```

---

## 3. Matriz de Permissões e Editabilidade

### 3.1 Resumo por Perfil de Usuário

| Recurso | Cowboy | Manager | Owner |
|---------|--------|---------|-------|
| **Leitura de Eventos** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Inserção de Eventos** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Edição de Eventos** | ❌ Não | ❌ Não | ❌ Não (append-only) |
| **Exclusão de Eventos** | ❌ Não | ❌ Não | ❌ Não (soft delete via deleted_at) |
| **Leitura de Protocolos** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Criação de Protocolos** | ❌ Não | ✅ Sim | ✅ Sim |
| **Edição de Protocolos** | ❌ Não | ✅ Sim | ✅ Sim |
| **Exclusão de Protocolos** | ❌ Não | ✅ Sim | ✅ Sim |
| **Leitura de Agenda** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Gerenciamento de Agenda** | ✅ Sim | ✅ Sim | ✅ Sim |
| **Gerenciamento de Membros** | ❌ Não | ❌ Não | ✅ Sim |

### 3.2 Políticas RLS Detalhadas

#### 3.2.1 Tabela `eventos`

```sql
-- SELECT: Qualquer membro com membership ativo
CREATE POLICY "permite_select_eventos" ON eventos
  FOR SELECT
  USING (has_membership(fazenda_id));

-- INSERT: Qualquer membro pode inserir
CREATE POLICY "permite_insert_eventos" ON eventos
  FOR INSERT
  WITH CHECK (has_membership(fazenda_id));

-- UPDATE: Bloqueado por trigger prevent_business_update
-- DELETE: Bloqueado por trigger prevent_business_update
```

#### 3.2.2 Tabela `eventos_sanitario`

```sql
-- Mesma política de eventos
CREATE POLICY "permite_select_sanitario" ON eventos_sanitario
  FOR SELECT
  USING (has_membership(fazenda_id));

CREATE POLICY "permite_insert_sanitario" ON eventos_sanitario
  FOR INSERT
  WITH CHECK (has_membership(fazenda_id));
```

#### 3.2.3 Tabela `protocolos_sanitarios`

```sql
-- SELECT: Qualquer membro
CREATE POLICY "permite_select_protocolos" ON protocolos_sanitarios
  FOR SELECT
  USING (has_membership(fazenda_id));

-- INSERT/UPDATE/DELETE: Owner/Manager apenas
CREATE POLICY "permite_write_protocolos" ON protocolos_sanitarios
  FOR ALL
  USING (has_membership(fazenda_id) 
         AND role_in_fazenda(fazenda_id) IN ('owner', 'manager'))
  WITH CHECK (has_membership(fazenda_id) 
              AND role_in_fazenda(fazenda_id) IN ('owner', 'manager'));
```

#### 3.2.4 Tabela `agenda_itens`

```sql
-- SELECT: Qualquer membro
CREATE POLICY "permite_select_agenda" ON agenda_itens
  FOR SELECT
  USING (has_membership(fazenda_id));

-- INSERT/UPDATE: Qualquer membro pode gerenciar agenda
CREATE POLICY "permite_write_agenda" ON agenda_itens
  FOR ALL
  WITH CHECK (has_membership(fazenda_id));
```

### 3.3 Restrições de Sistema

#### 3.3.1 Trigger Append-Only (`prevent_business_update`)

```sql
CREATE OR REPLACE FUNCTION prevent_business_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Permite UPDATE apenas em colunas de sistema
  IF OLD IS NOT NULL THEN
    IF (
      OLD.id IS DISTINCT FROM NEW.id OR
      OLD.dominio IS DISTINCT FROM NEW.dominio OR
      OLD.occurred_at IS DISTINCT FROM NEW.occurred_at OR
      OLD.animal_id IS DISTINCT FROM NEW.animal_id OR
      OLD.lote_id IS DISTINCT FROM NEW.lote_id OR
      OLD.source_task_id IS DISTINCT FROM NEW.source_task_id OR
      OLD.corrige_evento_id IS DISTINCT FROM NEW.corrige_evento_id OR
      -- Colunas específicas de sanitario
      OLD.tipo IS DISTINCT FROM NEW.tipo OR
      OLD.produto IS DISTINCT FROM NEW.produto OR
      OLD.fabricante IS DISTINCT FROM NEW.fabricante OR
      OLD.lote_produto IS DISTINCT FROM NEW.lote_produto
    ) THEN
      RAISE EXCEPTION 'Append-only violation. Updates to business columns are not allowed.';
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Diagnóstico de Problemas e Oportunidades de Melhoria

### 4.1 Problemas Identificados

#### 4.1.1 Colunas Duplicadas ou Redundantes

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| `observacoes` em múltiplas tabelas | Média | Campo `observações` existe em `eventos_sanitario`, `protocolos_sanitarios`, `protocolos_sanitarios_itens`, `agenda_itens`. Pode levar a inconsistências. |
| `tipo` como text vs enum | Baixa | `tipo` em `eventos_sanitario` é enum, mas em `agenda_itens` é text livre. Falta padronização. |
| `responsaveis` como text[] | Média | Array de texto sem validação de formato. Não há FK para usuários. |

#### 4.1.2 Fragmentação de Dados

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| Informações do produto dispersas | Alta | `produto`, `fabricante`, `lote_produto`, `data_validade` em `eventos_sanitario`. Não existe tabela de produtos para controle de estoque e rastreabilidade. |
| Falta tabela de produtos veterinários | Alta | Sem catálogo centralizado de produtos. Dificulta controle de estoque, validação de lotes e relatórios de consumo. |
| Sem histórico de preços | Média | Não há registro do preço pago por produto em cada aplicação. |

#### 4.1.3 Colunas Ausentes para Rastreabilidade

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| Sem número de nota fiscal | Alta | Não registra aquisição de produtos. Obrigatório para GTA e rastreabilidade. |
| Sem identificador de seringa | Baixa | Não rastreia qual seringa foi usada. Importante para controle de qualidade. |
| Sem temperatura de armazenamento | Média | Vacinas requerem cadeia de frio. Não há registro de temperatura no momento da aplicação. |
| Sem certificado do profissional | Média | Não registra CRMV ou certificação de quem aplicou. Pode ser obrigatório em algumas situações. |
| Sem status de aprovação | Alta | Eventos críticos (vacinação obrigatória) não passam por fluxo de aprovação. |

#### 4.1.4 Inconsistências de Tipos e Formatos

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| `via_administracao` como text livre | Média | Sem padronização. Poderia ser enum ou FK para catálogo. |
| `local_aplicacao` como text livre | Média | Sem padronização de nomenclatura. |
| `unidade_dose` como text livre | Média | Sem validação de unidades (ml, IU, mg). |
| `dose` sem unidade explícita | Alta | `dose` é numeric mas unidade está em coluna separada. |

#### 4.1.5 Problemas de Performance

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| Falta índice em occurred_at | Alta | Consultas por período não têm índice otimizado. |
| Falta índice em animal_id + data | Alta | Queries de histórico animal sem índice composto. |
| Falta índice em produto + data | Média | Relatórios de consumo de produto lentos. |
| JOIN entre eventos e detalhe sem FK | Média | Não há FK explícita de eventos_sanitario para eventos. |

#### 4.1.6 Dificuldades de Manutenção

| Problema | Severidade | Descrição |
|----------|------------|-----------|
| Metadados de sync em todas as tabelas | Baixa | Repetição de 8 colunas por tabela aumenta complexidade de migrations. |
| Sem versão de schema nas migrações | Média | Dificulta rollback e debugging. |
| Falta migrations de rollback | Alta | Migrações não têm correspondente de undo. |

### 4.2 Oportunidades de Melhoria Identificadas

#### 4.2.1 Melhorias de Rastreabilidade

1. **Tabela de Produtos Veterinários**: Criar catálogo centralizado com informações regulatórias (registro MAPA, princípio ativo, classificação).
2. **Tabela de Lotes de Produtos**: Rastrear lotes adquiridos com nota fiscal, fornecedor, data de recebimento.
3. **Controle de Estoque**: Registrar entrada/saída de produtos por evento sanitário.
4. **Registro de Temperatura**: Captura automática ou manual de temperatura no momento da aplicação de biológicos.
5. **Assinatura Digital**: Possibilidade de registrar com foto ou assinatura do responsável.

#### 4.2.2 Melhorias de Governança

1. **Fluxo de Aprovação**: Implementar workflow de aprovação para eventos sanitários críticos.
2. **Auditoria Avançada**: Adicionar campos de versão, hash de integridade, IP de origem.
3. **Validação de Período de Carência**: Verificar automaticamente carência para abate/ordenha.
4. **Alertas de Vencimento**: Notificar produtos próximos ao vencimento.

#### 4.2.3 Melhorias de Usabilidade

1. **Templates de Protocolos**: Criar biblioteca templates pré-definidos conforme orientações MAPA.
2. **Assistente de Criação de Protocolos**: Wizard com validações passo-a-passo.
3. **App Offline**: Melhorias na sincronização offline para áreas rurais sem conectividade.
4. **Integração com GTA**: Geração automática de Guia de Transporte Animal baseada em eventos sanitários.

---

## 5. Propostas de Melhorias Técnicas e Funcionais

### 5.1 Melhorias Técnicas Priorizadas

#### Prioridade ALTA (Impacto Crítico)

| # | Melhoria | Descrição | Esforço | Impacto |
|---|----------|-----------|---------|---------|
| 1 | **Tabela produtos_veterinarios** | Catálogo centralizado de produtos com registro MAPA, princípio ativo, classificação, fornecedor | Médio | Alta rastreabilidade |
| 2 | **Tabela lotes_produtos** | Rastrear lotes adquiridos com nota fiscal, fornecedor, validade | Médio | Conformidade legal |
| 3 | **Índices otimizados** | Criar índices compostos para consultas frequentes (animal_id+occurred_at, produto+data) | Baixo | Performance |
| 4 | **Campo nota_fiscal** | Adicionar campo para registrar aquisição de produtos | Baixo | Rastreabilidade |
| 5 | **Campo temperatura** | Registrar temperatura de armazenamento no momento da aplicação | Baixo | Qualidade vacinal |

#### Prioridade MÉDIA (Impacto Significativo)

| # | Melhoria | Descrição | Esforço | Impacto |
|---|----------|-----------|---------|---------|
| 6 | **Tabela estoques** | Controle de entrada/saída de produtos por evento | Alto | Gestão |
| 7 | **Campo periodo_carencia** | Adicionar informações de carência em produtos | Médio | Compliance |
| 8 | **Enum via_administracao** | Padronizar vias de administração disponíveis | Baixo | Qualidade dados |
| 9 | **Enum local_aplicacao** | Padronizar locais de aplicação | Baixo | Qualidade dados |
| 10 | **FK explícita eventos→detalhes** | Adicionar FK de eventos_sanitario para eventos | Médio | Integridade |

#### Prioridade BAIXA (Impacto Moderado)

| # | Melhoria | Descrição | Esforço | Impacto |
|---|----------|-----------|---------|---------|
| 11 | **Campo crmv_responsavel** | Registrar CRMV do profissional responsável | Baixo | Legal |
| 12 | **Campo identificador_seringa** | Rastrear seringa utilizada | Baixo | QA |
| 13 | **Assinatura digital** | Registro fotográfico ou assinatura do aplicador | Médio | Auditoria |
| 14 | **Tabela categorias_produto** | Classificação de produtos (biológico, farmacêutico, manejo) | Médio | Organização |
| 15 | **Histórico de preços** | Registrar custos por aplicação | Médio | Gestão |

### 5.2 Melhorias Funcionais Priorizadas

#### Prioridade ALTA (Impacto Crítico)

| # | Funcionalidade | Descrição | Esforço | Impacto |
|---|----------------|-----------|---------|---------|
| 1 | **Fluxo de aprovação** | Workflow para aprovação de eventos sanitários críticos | Alto | Governança |
| 2 | **Alertas de carência** | Notificar período de carência para abate/ordenha | Médio | Compliance |
| 3 | **Geração de GTA** | Integração com sistema de GTA baseada em eventos | Alto | Legal |
| 4 | **Templates MAPA** | Biblioteca de protocolos sesuaias normativas MAPA | Médio | Compliance |

#### Prioridade MÉDIA (Impacto Significativo)

| # | Funcionalidade | Descrição | Esforço | Impacto |
|---|----------------|-----------|---------|---------|
| 5 | **Dashboard sanitário** | Visão consolidada de status vacinal do rebanho | Médio | Operações |
| 6 | **Relatório de consumo** | Relatório de produtos utilizados por período/lote | Médio | Gestão |
| 7 | **Alertas de estoque** | Notificar produtos com estoque baixo | Baixo | Operações |
| 8 | **Calendário sanitário** | Visualização anual de eventos sanitários planejados | Médio | Planejamento |
| 9 | **Importação de NF** | Importar dados de produtos via nota fiscal eletrônica | Alto | Produtividade |

#### Prioridade BAIXA (Impacto Moderado)

| # | Funcionalidade | Descrição | Esforço | Impacto |
|---|----------------|-----------|---------|---------|
| 10 | **Integração Sisbov** | Sincronização com sistema de identificação bovina | Alto | Certificação |
| 11 | **APP de rastreabilidade** | Consulta de histórico animal por QR code/brinco | Médio | Traceability |
| 12 | **Auditoria de conformidade** | Relatório de aderência a protocolos | Médio | Compliance |
| 13 | **Alertas de vencimento** | Notificar produtos próximos ao vencimento | Baixo | Gestão |
| 14 | **Templates personalizados** | Criar protocolos baseados em histórico | Médio | Produtividade |

### 5.3 Propostas de Índices para Otimização

```sql
-- Índices críticos para performance
CREATE INDEX ix_eventos_animal_data ON eventos(fazenda_id, animal_id, occurred_at DESC);
CREATE INDEX ix_eventos_lote_data ON eventos(fazenda_id, lote_id, occurred_at DESC);
CREATE INDEX ix_eventos_occurred_at ON eventos(fazenda_id, occurred_at DESC);
CREATE INDEX ix_eventos_sanitario_produto ON eventos_sanitario(fazenda_id, produto, occurred_at DESC);
CREATE INDEX ix_agenda_data_prevista ON agenda_itens(fazenda_id, data_prevista);
CREATE INDEX ix_agenda_status ON agenda_itens(fazenda_id, status, deleted_at);

-- Índices para deduplicação
CREATE UNIQUE INDEX ix_agenda_dedup ON agenda_itens(fazenda_id, dedup_key) 
  WHERE status = 'agendado' AND deleted_at IS NULL;

-- Índices para relatórios
CREATE INDEX ix_eventos_periodo ON eventos(fazenda_id, occurred_at DESC) 
  WHERE deleted_at IS NULL;
```

---

## 6. Catálogo de Protocolos Sanitários Recomendados

### 6.1 Protocolos de Vacinação (MAPA Obrigatórios)

#### 6.1.1 Protocolo: Aftosa (Obligatório - Nacional)

**Base Legal:** Instrução Normativa MAPA nº 38/2020

**Objetivo:** imunização contra Febre Aftosa

**Público-alvo:** Bovinos e bubalinos de todas as idades

**Esquema:**
| Dose | Idade/Período | Produto | Dose | Via | Observações |
|------|---------------|---------|------|-----|-------------|
| 1ª | 0-24 meses | Vacina aftosa | 2ml | SC | Preferencialmente no terço médio do pescoço |
| Reforço | 6 meses após 1ª | Vacina aftosa | 2ml | SC | Segunda dose para animais primovacinados |
| Anual | >24 meses | Vacina aftosa | 2ml | SC | Dose de manutenção |

**Período de aplicação:** Fevereiro-Abril (1ª etapa) e Agosto-Outubro (2ª etapa)

**Carência:** 0 dias para leite, 21 dias para abate

#### 6.1.2 Protocolo: Brucelose (Obligatório - Rebanho Fêmeas)

**Base Legal:** Instrução Normativa MAPA nº 10/2021

**Objetivo:** Controle e Erradicação da Brucelose

**Público-alvo:** Fêmeas bovinas de 3 a 8 meses de idade

**Esquema:**
| Dose | Idade/Período | Produto | Dose | Via | Observações |
|------|---------------|---------|------|-----|-------------|
| Única | 3-8 meses | B19 ou RB51 | 5ml | SC | Repetir em 30 dias se B19, RB51 dose única |

**Carência:** 21 dias para abate, 0 dias para leite (consultar legislação vigente)

#### 6.1.3 Protocolo: Carbúnculo Sintomático (Recomendado)

**Objetivo:** Prevenção de Carbúnculo Hemático e Symptomaticus

**Público-alvo:** Bovinos e bubalinos de todas as idades

**Esquema:**
| Dose | Idade/Período | Produto | Dose | Via | Observações |
|------|---------------|---------|------|-----|-------------|
| 1ª | >6 meses | Vacina carbúnculo | 2ml | SC | Região lateral do pescoço |
| Reforço | 6 meses após 1ª | Vacina carbúnculo | 2ml | SC | |
| Anual | Anual | Vacina carbúnculo | 2ml | SC | Manutenção |

### 6.2 Protocolos de Controle Parasitário

#### 6.2.1 Protocolo: Vermifugação Bovinos de Corte

**Objetivo:** Controle de endoparasitas em diferentes categorias produtivas

**Categorias-alvo:**

**Bezerras (0-12 meses):**
| Idade | Produto | Dose | Via | Observações |
|-------|---------|------|-----|-------------|
| 2 meses | Anti-helmíntico | Conforme peso | Oral/SC | Primera dose |
| 4 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 6 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 8 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 10 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 12 meses | Anti-helmíntico | Conforme peso | Oral/SC | |

**Novilhas (12-24 meses):**
| Idade | Produto | Dose | Via | Observações |
|-------|---------|------|-----|-------------|
| 14 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 18 meses | Anti-helmíntico | Conforme peso | Oral/SC | |
| 22 meses | Anti-helmíntico | Conforme peso | Oral/SC | |

**Vacas Adultas:**
| Momento | Produto | Dose | Via | Observações |
|---------|---------|------|-----|-------------|
| Pré-parto (60 dias) | Anti-helmíntico | Conforme peso | Oral/SC | Reduzir carga parasitária |
| Pós-parto (30 dias) | Anti-helmíntico | Conforme peso | Oral/SC | |

**Touros:**
| Momento | Produto | Dose | Via | Observações |
|---------|---------|------|-----|-------------|
| Trimestral | Anti-helmíntico | Conforme peso | Oral/SC | Manutenção |

**Observações:**
- Alternar princípios ativos para evitar resistência
- Realizar teste de eficácia (FECRT) anualmente
- Considerar rotação de pastagens

#### 6.2.2 Protocolo: Carrapaticida

**Objetivo:** Controle de ectoparasitas (carrapatos, moscas, bernes)

**Público-alvo:** Todos os animais do rebanho

**Esquema:**
| Período | Produto | Dose | Via | Observações |
|---------|---------|------|-----|-------------|
| Setembro-Novembro | Carrapaticida | Conforme peso | Pour-on/Injetável | Início da estação seca |
| Janeiro-Março | Carrapaticida | Conforme peso | Pour-on/Injetável | Alta infestação |
| Maio-Julho | Carrapaticida | Conforme peso | Pour-on/Injetável | Final da estação seca |

### 6.3 Protocolos de Reprodução

#### 6.3.1 Protocolo: Manejo Reprodutivo Pré-Cobrição

**Objetivo:** Preparar fêmeas para estação de monta

| Momento | Procedimento | Produto/Dose | Observações |
|---------|--------------|--------------|-------------|
| D-60 pré-monta | Vacinação reprodutiva | Vibriose + Campilobacteriose | 5ml SC |
| D-45 pré-monta | Vermifugação | Anti-helmíntico | Conforme peso |
| D-30 pré-monta | Carrapaticida | Carrapaticida | Conforme peso |
| D-21 pré-monta | Aplicação de prostaglandina | PGF2α | Sincronização cio |
| D-0 (Monta) | Descarte diagnóstico | Avaliação reprodutiva | Identificar fêmeas aptas |

#### 6.3.2 Protocolo: Protocolo de Transferência de Embriões

**Objetivo:** Reprodução assistida em fêmeas elite

**Doadoras:**
| Dia | Procedimento | Produto | Dose | Observações |
|-----|--------------|---------|------|-------------|
| D0 | Início superovulação | FSH | Decrescente | 8-10 aplicações |
| D4 | Início superovulação | FSH | Decrescente | |
| D6 | Aplicação prostaglandina | PGF2α | 2ml | Regressão corpo lúteo |
| D7 | Detecção cio | - | - | Inseminação artificial |
| D8-11 | Detecção cio | - | - | IA repetida |
| D17 | Coleta de embriões | Lavagem uterina | - | 7-8 dias após IA |

**Receptoras:**
| Dia | Procedimento | Produto | Dose | Observações |
|-----|--------------|---------|------|-------------|
| D-8 | Sincronização | Dispositivo vaginal | Progesterona | |
| D-1 | Retirada dispositivo | PGF2α | 2ml | |
| D0 | IA | Sêmen | - | 54-56h após retirada |
| D7 | Transferência | Embrião | - | |

### 6.4 Protocolos de Biossegurança

#### 6.4.1 Protocolo: Entrada de Animais (Quarentena)

**Objetivo:** Prevenir introdução de doenças

| Dia | Procedimento | Observações |
|-----|--------------|-------------|
| D0 | Receção e identificação | Brinco, registro, fotografia |
| D0 | Triagem clínica | Avaliação geral, score corporal |
| D1 | Vacinação base | Aftosa (se necessário) |
| D3-7 | Exames laboratoriais | Brucelose, tuberculose, anaplasmose, babesiose |
| D7 | Vermifugação | Tratamento anti-helmíntico |
| D14 | Avaliação parasitológica | Contagem de ovos por grama (OPG) |
| D21 | Carrapaticida | Tratamento ectoparasitas |
| D30 | Nova avaliação clínica | Confirmar sanidade |
| D30 | Introdução ao rebanho | Gradual, preferência para pastagem isolada |

#### 6.4.2 Protocolo: Descarte Sanitário

**Critérios de descarte obrigatório:**
| Critério | Observação |
|----------|------------|
| Brucelose positiva | Sacrifício sanitário conforme legislação |
| Tuberculose positiva | Sacrifício sanitário |
| Mastite crônica recurrente | Três ou mais episódios em lactação |
| Infertilidade persistente | Mais de 365 dias sem prenhez |
| Tuberculose | Teste positivo |
| Leigh syndrome (BSE) | Identificação e notificação obrigatória |

### 6.5 Template de Implementação de Protocolo

```sql
-- Exemplo: Inserção de protocolo no sistema
INSERT INTO protocolos_sanitarios (
  fazenda_id,
  nome,
  descricao,
  categoria,
  especie_alvo,
  categoria_produtiva,
  ativo,
  versao,
  valido_de,
  valido_ate,
  observacoes,
  client_id,
  client_op_id,
  client_tx_id,
  client_recorded_at
) VALUES (
  'fazenda-id',
  'Protocolo Aftosa 2025 - 1ª Etapa',
  'Vacinação obrigatória contra Febre Aftosa conforme IN MAPA 38/2020',
  'vacinacao',
  'bovino',
  'todos',
  true,
  '1.0',
  '2025-02-01',
  '2025-04-30',
  'Seguir orientações do médico veterinário responsável',
  'app:web',
  gen_random_uuid(),
  gen_random_uuid(),
  NOW()
);

-- Itens do protocolo (exemplo)
INSERT INTO protocolos_sanitarios_itens (
  fazenda_id,
  protocolo_id,
  ordem,
  tipo,
  produto,
  fabricante,
  intervalo_dias,
  dose_num,
  gera_agenda,
  dedup_template,
  idade_minima_dias,
  idade_maxima_dias,
  observacoes,
  client_id,
  client_op_id,
  client_tx_id,
  client_recorded_at
) VALUES 
(
  'fazenda-id',
  'protocolo-id',
  1,
  'vacinacao',
  'Vacina Febre Aftosa oleosa',
  'Laboratório Veterinário',
  0,
  1,
  true,
  'aftosa_2025_1etapa',
  0,
  NULL,
  'Aplicar 2ml por animal via subcutânea',
  'app:web',
  gen_random_uuid(),
  gen_random_uuid(),
  NOW()
);
```

### 6.6 Checklist de Conformidade MAPA

| Item | Requisito | Frequência | Observações |
|------|-----------|------------|-------------|
| Registro de propriedade | GTA/Supra-GTA | Atualização anual | Atualizar a cada mudança |
| Vacinação aftosa | Obrigatório | Semestral | Comprovar junto ao serviço oficial |
| Vacinação brucelose | Rebanho fêmeas | Uma vez (3-8 meses) | Registrar no sistema oficial |
| Teste tuberculose | Rebanho reprodutor | Anual | Realizar teste cervical comparativo |
| Guia de Transporte Animal | Movimentação | Por movimentação | Emitir GTA eletrônica |
| Notificação de doenças | Imediato | Ocorrência | Notificar ao órgão oficial |
| Arquivo de atestados | 10 anos | Permanente | Manter registros |
| Receita兽医ária | Medicamentos controlados | Por prescrição | Arquivar cópia |

---

## 7. Referências Normativas

### 7.1 Legislação Federal (MAPA)

- **IN MAPA 38/2020**: Programa Nacional de Erradicação da Febre Aftosa
- **IN MAPA 10/2021**: Programa Nacional de Controle e Erradicação da Brucelose e Tuberculose
- **IN MAPA 44/2007**: Regulamento técnico de identidade e qualidade da carne bovina
- **Decreto 5.741/2006**: Sistemização de ações de defesa sanitária animal

### 7.2 Regulamentações Técnicas

- **OIE Terrestrial Animal Health Code**: Padrões internacionais de bem-estar animal
- **MAPA - Manual de Legislação**: Legislação de produtos veterinários
- **ANVISA - RDC 157/2017**: Boas práticas de fabricação de medicamentos veterinários

### 7.3 Certificações e Programas

- **PROMEBO**: Programa de Melhoramento da Bovinocultura de Corte
- **PNCEBT**: Programa Nacional de Controle e Erradicação da Brucelose e Tuberculose
- **Sisbov**: Sistema de Identificação e Certificação Bovídea

---

## 8. Conclusão

Este documento apresenta uma análise abrangente da estrutura de eventos sanitários no sistema GestaoAgro, identificando pontos de melhoria críticos para conformidade com regulamentações brasileiras e otimização operacional.

### Principais Achados:

1. **Rastreabilidade**: Necessidade urgente de tabela de produtos e lotes para conformidade legal
2. **Performance**: Falta de índices compostos para consultas frequentes
3. **Governança**: Ausência de fluxos de aprovação para eventos críticos
4. **Protocolos**: Catálogo robusto de templates alinhados ao MAPA

### Próximos Passos Recomendados:

1. Implementar tabela de produtos veterinários com campos regulatórios
2. Adicionar índices de performance nas tabelas de eventos
3. Desenvolver módulo de controle de estoque integrado
4. Criar workflow de aprovação para eventos críticos
5. Implementar templates de protocolos MAPA no sistema

---

**Documento preparado conforme:**  
Padrões de documentação técnica GestaoAgro v1.0  
Base legal: Legislação MAPA vigente (2025)
