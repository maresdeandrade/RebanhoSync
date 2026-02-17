# Database Schema - Gestão Pecuária

Este documento reflete o schema atual do banco de dados (Supabase/Postgres) e as invariantes de multi-tenant e append-only.

**Última atualização:** Baseada nas migrações até `0036_reproducao_views_v1.sql`.

---

## 1. Invariantes de Arquitetura

### Multi-Tenant (Isolamento por Fazenda)
- **Coluna Obrigatória:** Todas as tabelas de negócio possuem `fazenda_id` (UUID).
- **FKs Compostas:** Chaves estrangeiras são SEMPRE compostas por `(id, fazenda_id)` para garantir que um registro só referencie outro da mesma fazenda.
- **RLS:** Row Level Security ativado em todas as tabelas. Política padrão: `USING (public.has_membership(fazenda_id))`.

### Envelope de Sync (Offline-First)
Todas as tabelas possuem as seguintes colunas de controle para sincronização e auditoria:
- **`client_id`** (`text`): Identificador do dispositivo/origem (ex: `browser:uuid`, `server`).
- **`client_op_id`** (`uuid`): ID único da operação (idempotência).
- **`client_tx_id`** (`uuid`): ID da transação/gesto (agrupamento atômico).
- **`client_recorded_at`** (`timestamptz`): Quando ocorreu no cliente.
- **`server_received_at`** (`timestamptz`): Quando chegou no servidor (default: `now()`).
- **`deleted_at`** (`timestamptz`): Soft delete (NULL = ativo).
- **`created_at`, `updated_at`** (`timestamptz`): Auditoria padrão.

### Append-Only (Event Sourcing)
- **Tabelas:** `eventos` e suas extensões (`eventos_*`).
- **Garantia:** Trigger `prevent_business_update` bloqueia `UPDATE` em colunas de negócio. Apenas `deleted_at`, `updated_at` e `server_received_at` podem ser alterados.
- **Correções:** Feitas via novo evento com `corrige_evento_id` apontando para o original.

---

## 2. Tabelas por Domínio

### A. Tenant & Auth
| Tabela | Descrição | Colunas Chave / Constraints |
| :--- | :--- | :--- |
| **`fazendas`** | Raiz do tenant. | `id` (PK), `nome`, `codigo`, `municipio`, `estado` (enum), `cep`, `area_total_ha`, `tipo_producao` (enum), `sistema_manejo` (enum), `timezone`.<br>Constraint: `ck_fazendas_area_positiva`. |
| **`user_fazendas`** | Membership (N:N). | `(user_id, fazenda_id)` (PK), `role` (`owner`, `manager`, `cowboy`), `is_primary`, `invited_by`.<br>Index único: `ux_user_fazendas_active`. |
| **`user_profiles`** | Perfil do usuário. | `user_id` (PK), `display_name`, `phone`, `avatar_url`, `locale`, `timezone`. |
| **`user_settings`** | Preferências. | `user_id` (PK), `active_fazenda_id` (FK fazendas), `theme`, `sync_prefs`. |

### B. State (Estado Atual - Mutável)
| Tabela | Descrição | Colunas Chave / Constraints |
| :--- | :--- | :--- |
| **`pastos`** | Áreas de pastagem. | `id` (PK), `fazenda_id`, `nome`, `area_ha`, `capacidade_ua`, `tipo_pasto` (enum), `infraestrutura` (jsonb).<br>Unique: `(id, fazenda_id)`. |
| **`lotes`** | Grupos de animais. | `id` (PK), `fazenda_id`, `nome`, `status` (ativo/inativo), `pasto_id`, `touro_id`.<br>FKs: `pasto_id`, `touro_id` (compostas). |
| **`animais`** | Rebanho. | `id` (PK), `fazenda_id`, `identificacao`, `sexo` (M/F), `status` (ativo/vendido/morto), `lote_id`, `pai_id`, `mae_id`, `papel_macho`, `habilitado_monta`.<br>FKs: `lote_id`, `pai_id`, `mae_id` (compostas).<br>Index: `ix_animais_identificacao`. |
| **`animais_sociedade`** | Animais de terceiros. | `id` (PK), `fazenda_id`, `animal_id`, `contraparte_id`, `percentual`, `inicio`, `fim`.<br>Constraint: `uq_animais_sociedade_ativa` (um ativo por animal). |
| **`categorias_zootecnicas`** | Regras de classificação. | `id` (PK), `fazenda_id`, `categoria` (enum), `sexo`, `idade_min_meses`, `idade_max_meses`.<br>Unique: `(fazenda_id, categoria, sexo)`. |
| **`contrapartes`** | Pessoas/Empresas. | `id` (PK), `fazenda_id`, `tipo` (pessoa/empresa), `nome`, `documento`, `email`. |
| **`protocolos_sanitarios`** | Templates de vacinação. | `id` (PK), `fazenda_id`, `nome`, `ativo`, `valido_de`, `valido_ate` (via payload). |
| **`protocolos_sanitarios_itens`** | Itens do template. | `id` (PK), `fazenda_id`, `protocolo_id`, `tipo`, `produto`, `intervalo_dias`, `dose_num`, `gera_agenda`, `dedup_template`. |

### C. Agenda (Mutável - Rail 1)
| Tabela | Descrição | Colunas Chave / Constraints |
| :--- | :--- | :--- |
| **`agenda_itens`** | Tarefas futuras. | `id` (PK), `fazenda_id`, `dominio` (enum), `tipo`, `status` (agendado/concluido/cancelado), `data_prevista`, `animal_id`, `lote_id`.<br>`dedup_key` (text), `source_kind` (manual/automatico), `source_ref` (jsonb).<br>Unique Index: `ux_agenda_dedup_active` (fazenda_id, dedup_key) WHERE status='agendado'.<br>Check: `ck_agenda_alvo` (animal ou lote obrigatório). |

### D. Eventos (Imutável - Rail 2)
Tabela base + tabelas de detalhe (1:1).

| Tabela | Descrição | Colunas Chave / Constraints |
| :--- | :--- | :--- |
| **`eventos`** | Tabela base. | `id` (PK), `fazenda_id`, `dominio` (enum), `occurred_at`, `animal_id`, `lote_id`.<br>`source_task_id` (FK agenda), `corrige_evento_id` (FK self).<br>Trigger: `prevent_business_update`. |
| **`eventos_sanitario`** | Detalhe sanitário. | `evento_id` (PK, FK eventos), `fazenda_id`, `tipo` (vacinacao/...), `produto`. |
| **`eventos_pesagem`** | Detalhe pesagem. | `evento_id` (PK, FK eventos), `fazenda_id`, `peso_kg` (check > 0). |
| **`eventos_nutricao`** | Detalhe nutrição. | `evento_id` (PK, FK eventos), `fazenda_id`, `alimento_nome`, `quantidade_kg`. |
| **`eventos_movimentacao`** | Detalhe movimentação. | `evento_id` (PK, FK eventos), `fazenda_id`, `from_lote_id`, `to_lote_id`, `from_pasto_id`, `to_pasto_id`. |
| **`eventos_reproducao`** | Detalhe reprodução. | `evento_id` (PK, FK eventos), `fazenda_id`, `tipo` (cobertura/IA/parto/diagnostico), `macho_id`. |
| **`eventos_financeiro`** | Detalhe financeiro. | `evento_id` (PK, FK eventos), `fazenda_id`, `tipo` (compra/venda), `valor_total`, `contraparte_id` (FK contrapartes). |

---

## 3. Views Principais (Helpers)

### Ativos (Soft Delete Filter)
- `vw_animais_active`: `SELECT * FROM animais WHERE deleted_at IS NULL`
- `vw_lotes_active`: `SELECT * FROM lotes WHERE deleted_at IS NULL`
- `vw_pastos_active`: `SELECT * FROM pastos WHERE deleted_at IS NULL`
- `vw_agenda_active`: `SELECT * FROM agenda_itens WHERE deleted_at IS NULL AND status = 'agendado'`

### Negócio
- **`vw_sanitario_pendencias`**: Calcula pendências sanitárias baseadas na agenda e protocolos.
- **`vw_sanitario_historico`**: Histórico unificado de eventos sanitários com detalhes de protocolo.
- **`vw_repro_episodios`**: Reconstrói episódios reprodutivos (Serviço -> Diagnóstico -> Parto).
- **`vw_repro_status_animal`**: Determina o status reprodutivo atual (Vazia, Prenha, Parida, etc.) baseado no histórico.

---

## 4. Discrepâncias Detectadas (vs Documentação Antiga)

1.  **Novas Tabelas de Domínio:** `animais_sociedade` (gestão de parceria) e `categorias_zootecnicas` (regras de classificação) não constavam na documentação anterior.
2.  **Evolução de Pastos:** A tabela `pastos` recebeu colunas `infraestrutura` (jsonb) e `tipo_pasto` (enum) não documentadas anteriormente.
3.  **Detalhes de Eventos:**
    - `eventos_reproducao` possui `macho_id`.
    - `eventos_financeiro` possui `contraparte_id` e `valor_total`.
4.  **Envelope Sync:** As colunas `client_tx_id`, `client_recorded_at` e `server_received_at` foram padronizadas em todas as tabelas, reforçando o contrato de sincronização.
5.  **Fazendas:** Adicionados campos de localização (`estado`, `cep`) e produção (`area_total_ha`, `tipo_producao`, `sistema_manejo`).
