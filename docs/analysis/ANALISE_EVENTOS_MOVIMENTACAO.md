# Análise Técnica de Campos de Eventos de Movimentação

## 1. Escopo e Premissas

Esta análise cobre a implementação atual de criação e gerenciamento de eventos de movimentação no aplicativo GestaoAgro, com foco em:

- Formulário de registro (`/registrar`)
- Persistência em `eventos` e `eventos_movimentacao`
- Regras de validação frontend/backend
- Permissões por perfil e por fazenda (RLS + memberships)
- Regras de interdependência entre campos
- Propostas de otimização e expansão

### 1.1 Fontes Primárias (código)

- `src/pages/Registrar.tsx`
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0004_rls_hardening.sql`
- `supabase/functions/sync-batch/index.ts`
- `src/lib/offline/ops.ts`
- `src/hooks/useAuth.tsx`
- `src/App.tsx`
- `src/components/layout/SideNav.tsx`
- `src/pages/Home.tsx`

### 1.2 Observação de nomenclatura de papéis

No código atual, o papel equivalente a "admin" é `manager`.

- Enum de roles: `cowboy | manager | owner`
- Não existe valor `admin` no schema atual

---

## 2. Fluxo Atual de Criação de Evento de Movimentação

1. Usuário acessa `/registrar`.
2. Seleciona lote de origem.
3. Seleciona um ou mais animais do lote.
4. Escolhe ação `movimentacao`.
5. Seleciona lote de destino.
6. Confirma o registro.
7. Para cada animal selecionado, o frontend gera no mesmo gesto:
   - `INSERT` em `eventos` (domínio `movimentacao`)
   - `INSERT` em `eventos_movimentacao`
   - `UPDATE` em `animais.lote_id` (estado atual)
8. O backend aplica validação anti-teleporte antes de aceitar o batch.

### 2.1 Modelo operacional atual

- **Eventos são append-only**: não há edição de colunas de negócio após criação.
- **Correções** devem ser feitas por novo evento (contra-lançamento/correção), não por edição.

---

## 3. Inventário e Mapeamento Completo de Campos

## 3.1 Campos do formulário de movimentação (UI)

| Campo (UI) | Nome técnico frontend | Tipo | Obrigatório | Regra frontend | Destino no banco |
|---|---|---|---|---|---|
| Lote origem | `selectedLoteId` | `string` (UUID esperado) | Sim (para avançar com animais) | Sem lote não há lista de animais para seleção | Filtro de seleção (não persiste diretamente) |
| Animais selecionados | `selectedAnimais` | `string[]` (UUIDs) | Sim | Botão "Próximo" desabilitado se vazio | `eventos.animal_id`, `eventos.lote_id`, `eventos_movimentacao.from_lote_id`, `animais.id` (UPDATE) |
| Tipo de manejo | `tipoManejo` | union (`sanitario/pesagem/movimentacao`) | Sim | Botão "Próximo" desabilitado se nulo | `eventos.dominio = 'movimentacao'` |
| Lote destino | `movimentacaoData.toLoteId` | `string` (UUID esperado) | **Deveria ser sim** | Exibido no bloco de movimentação; sem bloqueio robusto para vazio no confirmar | `eventos_movimentacao.to_lote_id`, `animais.lote_id` (UPDATE) |

## 3.2 Campos persistidos em `eventos` (registro base)

| Campo técnico | Tipo | Tabela.coluna | Origem | Validação / restrição |
|---|---|---|---|---|
| `id` | `uuid` | `eventos.id` | `crypto.randomUUID()` | PK |
| `fazenda_id` | `uuid` | `eventos.fazenda_id` | contexto fazenda ativa | not null + RLS + forçado no servidor |
| `dominio` | `dominio_enum` | `eventos.dominio` | `tipoManejo` | enum obrigatório |
| `occurred_at` | `timestamptz` | `eventos.occurred_at` | `new Date().toISOString()` | not null |
| `occurred_on` | `date` gerado | `eventos.occurred_on` | gerado do `occurred_at` | computed stored |
| `animal_id` | `uuid` nullable | `eventos.animal_id` | animal iterado | FK composta com `fazenda_id` |
| `lote_id` | `uuid` nullable | `eventos.lote_id` | lote atual do animal | FK composta com `fazenda_id` |
| `source_task_id` | `uuid` nullable | `eventos.source_task_id` | não preenchido no fluxo atual | opcional |
| `corrige_evento_id` | `uuid` nullable | `eventos.corrige_evento_id` | não preenchido no fluxo atual | opcional |
| `observacoes` | `text` nullable | `eventos.observacoes` | não preenchido no fluxo atual | opcional |
| `payload` | `jsonb` | `eventos.payload` | default `{}` | not null |
| SyncMeta | text/uuid/timestamp | várias colunas | injetado em `createGesture()` | idempotência e rastreio |

## 3.3 Campos persistidos em `eventos_movimentacao` (detalhe 1:1)

| Campo técnico | Tipo | Tabela.coluna | Origem | Validação / restrição |
|---|---|---|---|---|
| `evento_id` | `uuid` | `eventos_movimentacao.evento_id` | id do evento base | PK + FK (`eventos.id`,`fazenda_id`) |
| `fazenda_id` | `uuid` | `eventos_movimentacao.fazenda_id` | fazenda ativa | not null + RLS + forçado no servidor |
| `from_lote_id` | `uuid` nullable | `eventos_movimentacao.from_lote_id` | lote atual do animal | sem FK direta para `lotes` nesta tabela |
| `to_lote_id` | `uuid` nullable | `eventos_movimentacao.to_lote_id` | lote destino selecionado | sem FK direta para `lotes` nesta tabela |
| `from_pasto_id` | `uuid` nullable | `eventos_movimentacao.from_pasto_id` | não usado no fluxo atual | opcional |
| `to_pasto_id` | `uuid` nullable | `eventos_movimentacao.to_pasto_id` | não usado no fluxo atual | opcional |
| `payload` | `jsonb` | `eventos_movimentacao.payload` | default `{}` | not null |
| SyncMeta | text/uuid/timestamp | várias colunas | injetado em `createGesture()` | idempotência e rastreio |

## 3.4 Campo de estado correlato (state rail)

| Campo técnico | Tipo | Tabela.coluna | Origem | Regra |
|---|---|---|---|---|
| `lote_id` | `uuid` nullable | `animais.lote_id` | `movimentacaoData.toLoteId` | atualizado no mesmo batch do evento para cumprir anti-teleporte |

---

## 4. Matriz de Visibilidade por Perfil

Perfis considerados:

- `owner`
- `admin` (mapeado para `manager` no sistema)
- `cowboy`

### 4.1 Visibilidade de campos no fluxo `/registrar`

| Campo | Owner | Admin (manager) | Cowboy | Status |
|---|---|---|---|---|
| Lote origem | Exibido | Exibido | Exibido | Total |
| Seleção de animais | Exibido | Exibido | Exibido | Total |
| Tipo de manejo (Mover) | Exibido | Exibido | Exibido | Total |
| Lote destino | Exibido | Exibido | Exibido | Total |
| Resumo de confirmação | Exibido | Exibido | Exibido | Total |
| Metadados técnicos (`client_op_id`, etc.) | Oculto | Oculto | Oculto | Não-UI |

### 4.2 Justificativa do desenho atual

- A rota `/registrar` não possui gate de role por perfil; exige apenas autenticação + fazenda ativa.
- O controle final de acesso é feito por membership e RLS no backend.
- Para eventos de movimentação, a política de insert permite qualquer membro ativo da fazenda.

---

## 5. Matriz de Edição por Contexto Operacional

| Contexto | Campo | Owner | Admin (manager) | Cowboy | Regra |
|---|---|---|---|---|---|
| Criação (antes de confirmar) | Campos do formulário | Editável | Editável | Editável | UI livre por etapa |
| Confirmação (antes de salvar) | Retorno para etapas anteriores | Editável | Editável | Editável | Pode voltar e ajustar |
| Após persistência (`eventos`) | Colunas de negócio | Somente leitura | Somente leitura | Somente leitura | Trigger append-only |
| Após persistência (`eventos_movimentacao`) | Colunas de negócio | Somente leitura | Somente leitura | Somente leitura | Trigger append-only |
| Estado atual (`animais.lote_id`) | Mudança por novo gesto | Editável | Editável | Editável | Permitido com regras de batch |

### 5.1 Restrições temporais/aprovação hierárquica

Estado atual:

- Não há janela temporal de edição de evento (porque não há edição).
- Não há fluxo de aprovação hierárquica para movimentação.
- Não há override exclusivo para perfis elevados após criação do evento.

---

## 6. Análise de Acesso e Responsabilidades (cenários especiais)

## 6.1 Membership e isolamento por fazenda

- Todo acesso a dados de movimentação depende de membership ativo em `user_fazendas`.
- `fazenda_id` é forçado no backend de sync, reduzindo risco de tenant spoofing.

## 6.2 Herança de fazenda

- Não há modelagem explícita de herança/sucessão de propriedade no schema atual.

## 6.3 Delegação temporária

- Há convite com expiração para entrada de membro, mas não há role temporário com data de expiração após aceitação.

## 6.4 Compartilhamento entre propriedades

- Suportado via múltiplas memberships por usuário.
- Operação sempre ocorre na `active_fazenda_id` selecionada.

## 6.5 Acesso cruzado entre fazendas

- Mitigado por:
  - RLS por membership
  - FK compostas em entidades core (`animais`, `lotes`, `eventos`)
  - Forçamento de `fazenda_id` no backend
- Lacuna atual:
  - `from_lote_id`/`to_lote_id` em `eventos_movimentacao` não têm FK composta direta para `lotes`.

---

## 7. Regras de Campos Interdependentes

1. `selectedLoteId` determina a lista de `selectedAnimais`.
2. `tipoManejo` controla a renderização do bloco de campos de movimentação.
3. `selectedLoteId` filtra opções de destino (`toLoteId`) para não repetir o mesmo lote.
4. `toLoteId` impacta simultaneamente:
   - detalhe de evento (`eventos_movimentacao.to_lote_id`)
   - estado corrente (`animais.lote_id`)
   - resumo de confirmação da UI
5. `animais.lote_id` no batch só é aceito se existir:
   - evento base `eventos` com domínio `movimentacao`
   - detalhe correlato em `eventos_movimentacao`
   - correspondência por `evento_id` no mesmo TX (anti-teleporte)

---

## 8. Gaps Técnicos Identificados

## 8.1 Gaps de validação

1. `toLoteId` não está fortemente bloqueado no frontend antes do salvar.
2. `eventos_movimentacao` não possui constraints que obriguem origem/destino coerentes.
3. Não há validação explícita de `from_lote_id <> to_lote_id` no backend.

## 8.2 Gaps de integridade

1. Falta FK composta de `eventos_movimentacao` para `lotes` (origem/destino).
2. Fluxos alternativos de movimentação operacional (ex.: modais de lote/animal) atualizam estado sem necessariamente criar evento formal no mesmo padrão.

## 8.3 Gaps de UX e governança

1. Ausência de tela dedicada para gestão/auditoria de eventos de movimentação.
2. Sem fluxo de aprovação para movimentações sensíveis.

---

## 9. Proposta de Otimização dos Campos Atuais (priorizada)

## 9.1 Priorização (Impacto x Esforço)

| Prioridade | Ação | Impacto | Esforço |
|---|---|---|---|
| P0 | Tornar `toLoteId` obrigatório no frontend (bloquear confirmar sem destino válido) | Alto | Baixo |
| P0 | Validar no backend: destino não nulo e diferente da origem | Alto | Baixo |
| P0 | Adicionar FK composta para `from_lote_id` e `to_lote_id` em `eventos_movimentacao` | Alto | Médio |
| P1 | Incluir `occurred_at` editável no formulário (com default atual) | Médio | Baixo |
| P1 | Incluir `observacoes` de movimentação e `motivo_movimentacao` (enum) | Alto | Médio |
| P2 | Criar tela de consulta de eventos de movimentação com filtros por lote/animal/período | Alto | Médio |
| P2 | Unificar fluxo operacional de mover animal/lote para sempre gerar evento auditável | Alto | Médio |

## 9.2 Campos potencialmente redundantes/subutilizados

No fluxo atual de movimentação:

- `from_pasto_id` e `to_pasto_id` existem na tabela, mas não são utilizados pelo formulário atual.
- `payload` é usado como reservatório genérico; sem contrato mínimo, tende a dispersão de estrutura.

### Recomendação

- Definir contrato mínimo do `payload` por domínio.
- Ou migrar campos relevantes do `payload` para colunas tipadas conforme uso real.

## 9.3 Validações em tempo real recomendadas

1. Bloquear submit se `toLoteId` vazio.
2. Bloquear submit se `toLoteId === selectedLoteId`.
3. Exibir prévia de impacto: quantidade de animais e lote destino.
4. Alertar sobre capacidade do destino (integração com lotação/pasto quando disponível).

## 9.4 Performance com crescimento de volume

Estado atual:

- Índices principais já existem em `eventos` para timeline por fazenda/domínio/animal.

Oportunidades:

1. Índice dedicado em `eventos_movimentacao(fazenda_id, to_lote_id)`.
2. Índice dedicado em `eventos_movimentacao(fazenda_id, from_lote_id)`.
3. Projeções/materializações para consultas frequentes de movimentação por lote.

---

## 10. Proposta de Expansão e Escalabilidade para Pecuária

## 10.1 Novos campos para operações avançadas

### A) Procedência e certificação sanitária

- `gta_numero`
- `gta_emitida_em`
- `orgao_emissor`
- `sisbov_codigo`
- `documento_origem_tipo`
- `documento_origem_numero`

### B) Peso e ganho de peso correlacionados à movimentação

- `peso_saida_kg`
- `peso_entrada_kg`
- `delta_peso_kg` (derivado)
- `dias_desde_ultima_pesagem`

### C) Gestão de pastagens e lotação

- `pasto_origem_id`
- `pasto_destino_id`
- `capacidade_suporte_ua_destino`
- `lotacao_estimativa_pos_mov`
- `periodo_previsto_uso_dias`

### D) Reprodução vinculada a movimentações

- `status_reprodutivo`
- `diagnostico_gestacao_ref_evento_id`
- `dias_pos_parto`

### E) Nutrição e suplementação

- `plano_nutricional_id`
- `suplemento_principal`
- `consumo_previsto_kg_dia`

### F) Intervenções sanitárias relacionadas

- `checklist_sanitario_id`
- `status_sanitario_pre_mov`
- `quarentena_ate`
- `ultima_vacinacao_ref`

## 10.2 Arquitetura escalável recomendada

1. Modelo canônico por domínio com contratos de payload versionados.
2. Índices compostos orientados a consultas operacionais.
3. Particionamento de `eventos` por período para alto volume.
4. Pipeline assíncrono para integrações externas (balanças, RFID, GTA).
5. Workflow de aprovação para eventos críticos.

## 10.3 Roadmap sugerido

### Fase 1 (curto prazo)

- Fechar validações P0 (frontend/backend)
- Adicionar constraints/FKs faltantes
- Padronizar nomenclatura de role (`manager` vs `admin`)

### Fase 2 (médio prazo)

- Criar tela de eventos de movimentação
- Introduzir campos tipados de motivo/procedência/sanitário mínimo
- Uniformizar trilha de auditoria nos fluxos de movimentação operacional

### Fase 3 (escala)

- Integrações em tempo real (peso/RFID)
- Projeções analíticas e índices avançados
- Governança com aprovação e trilhas de conformidade

---

## 11. Recomendações Finais (Resumo Executivo)

1. A base de movimentação está funcional e com bom desenho de rastreabilidade (event + state no mesmo batch).
2. O principal risco atual é de validação incompleta de destino e integridade referencial no detalhe da movimentação.
3. Antes de expandir o domínio pecuário, é essencial concluir as otimizações P0/P1 para garantir qualidade de dados e previsibilidade operacional.

