---
name: domain-glossary
description: Use when asking about livestock terminology, pecuária glossary, domain terms like "IA", "UA", "GMD", "lote vs pasto", "Two Rails", "Agenda vs Evento", "dedup_key", or when needing to clarify domain-specific vocabulary in GestaoAgro.
---

# Skill: domain-glossary

## Mission

Provide authoritative definitions of domain-specific terms used in Gestão Agro, covering both **livestock/agricultural terminology** (IA, UA, GMD) and **system architecture concepts** (Two Rails, Agenda, Evento, dedup_key). Reduce ambiguity and onboard new team members to domain language.

## When to Use

- User asks "o que é IA?", "what is UA?", "lote vs pasto difference"
- Need to clarify agricultural/livestock terms
- Explaining system architecture terms (Two Rails, Agenda, Evento)
- Writing documentation and need precise term usage
- Code review mentions unclear domain vocabulary

---

## Glossário de Domínio - Gestão Agro

### 🐄 Termos Pecuários (Livestock Terms)

#### IA (Inseminação Artificial)

**Definição**: Artificial insemination - reproductive technique where semen is manually deposited into a female's reproductive tract.  
**Uso no Sistema**: Tipo de evento de reprodução (`eventos_reproducao.tipo = 'IA'`)  
**⚠️ Não confundir com**: "AI" (Artificial Intelligence)

#### UA (Unidade Animal)

**Definição**: Standardized unit representing the forage consumption of a bovine weighing 450kg. Used to calculate pasture capacity.  
**Fórmula**: `UA = peso_animal_kg / 450`  
**Exemplo**: Animal de 540kg = 1.2 UA  
**Uso no Sistema**: Campo `pastos.capacidade_ua` (numeric)

#### GMD (Ganho Médio Diário)

**Definição**: Average Daily Gain - average weight gained per day over a period.  
**Fórmula**: `GMD = (peso_final - peso_inicial) / dias_periodo`  
**Unidade**: kg/dia  
**Uso no Sistema**: Calculado a partir de `eventos_pesagem`

#### Lote

**Definição**: **Management group** of animals (não necessariamente no mesmo pasto físico). Unidade lógica de manejo.  
**Características**:

- Pode ter um touro associado (`lotes.touro_id`)
- Pode estar em um pasto específico (`lotes.pasto_id`)
- Status: `ativo` | `inativo`

**Exemplo**: "Lote Engorda 01" com 50 novilhos

#### Pasto

**Definição**: **Physical pasture/paddock** - área física de pastagem.  
**Características**:

- Área em hectares (`pastos.area_ha`)
- Capacidade em UA (`pastos.capacidade_ua`)
- Pode conter múltiplos lotes (relação 1:N)

**Lote vs Pasto**:

- Um **pasto** pode ter vários **lotes** ao mesmo tempo
- Um **lote** está em um pasto (ou nenhum, se confinado)
- Movimentação de lote: muda `lotes.pasto_id`
- Movimentação de animal: muda `animais.lote_id`

#### Animais

**Status**:

- `ativo`: Animal presente na fazenda
- `vendido`: Animal foi vendido (data_saida preenchida)
- `morto`: Animal morreu (data_saida preenchida)

**Sexo**:

- `M`: Macho
- `F`: Fêmea

**Papel de Macho** (`papel_macho_enum`):

- `reprodutor`: Macho usado para reprodução natural ou IA
- `rufiao`: Macho vasectomizado usado para detectar cio (heat detection)

#### Protocolos Sanitários

**Definição**: Template de ações sanitárias (vacinas/vermífugos) que geram agenda items automaticamente.  
**Componentes**:

- `protocolos_sanitarios`: Cabeçalho (nome, descrição)
- `protocolos_sanitarios_itens`: Itens individuais com intervalo_dias, dose_num

**Exemplo**: Protocolo "Bezerros" com item "Febre Aftosa - Dose 1" (intervalo: 180 dias)

---

### 🏗️ Termos Arquiteturais

#### Two Rails (Dois Trilhos)

**Definição**: Paradigma arquitetural que separa **estado futuro/mutável** (Agenda) de **fatos passados/imutáveis** (Eventos).

**Rail 1: Agenda** (Mutável)

- Tabela: `agenda_itens`
- Natureza: **Intenções futuras** que podem ser alteradas
- Status: `agendado` → `concluido` | `cancelado`
- Permite: UPDATE de status, data_prevista, payload
- Dedup: `dedup_key` (índice parcial para status='agendado')

**Rail 2: Eventos** (Append-Only)

- Tabelas: `eventos` + `eventos_sanitario`, `eventos_pesagem`, etc.
- Natureza: **Fatos passados imutáveis**
- Triggers: `prevent_business_update()` bloqueia UPDATE em colunas de negócio
- Correções: Via contra-lançamento (novo evento que referencia o original via `corrige_evento_id`)

**Por que separar?**

- UX rápido (mudar data da agenda sem perder histórico)
- Auditoria total (eventos nunca são alterados)
- Protocolos automatizados (geram agenda, não eventos)

#### Gesture (Gesto)

**Definição**: Atomic transaction unit representing a single user action in the offline-first system.  
**Componentes**:

- `client_tx_id`: UUID que agrupa operações da mesma ação
- `queue_gestures`: Metadados (status, fazenda_id, created_at)
- `queue_ops`: Operações individuais (INSERT/UPDATE/DELETE) com snapshots para rollback

**Ciclo de Vida**:

```
PENDING → SYNCING → DONE (sucesso)
                  └→ REJECTED (rollback local)
                  └→ ERROR (retry ou falha permanente)
```

#### Idempotência

**Definição**: Garantia de que executar a mesma operação múltiplas vezes produz o mesmo resultado.  
**Implementação**:

- Cada operação tem `client_op_id` único (UUID gerado no frontend)
- Índices únicos: `(fazenda_id, client_op_id) WHERE deleted_at IS NULL`
- Servidor rejeita operação se `client_op_id` já existe (retorna `APPLIED` mesmo assim)

**Exemplo**: Se o app tentar inserir o mesmo animal duas vezes (por instabilidade de rede), o banco rejeita a duplicata.

#### dedup_key

**Definição**: Chave de deduplicação para `agenda_itens` gerados automaticamente por protocolos.  
**Formato**: Template preenchido com IDs reais, ex: `"proto:{protocolo_id}:item:{item_id}:animal:{animal_id}"`  
**Índice**: `ux_agenda_dedup_active` em `(fazenda_id, dedup_key)` WHERE `status='agendado'`

**Por que?**
Se um protocolo dispara 2x (ex: bug ou re-execução manual), o banco impede duplicatas. A segunda inserção falha por violação de constraint.
O servidor, ao detectar a colisão, não retorna um erro, mas sim um status `APPLIED_ALTERED`, informando ao cliente que a operação foi um "noop" porque a tarefa já existia.

**Exemplo**:

```sql
-- Primeira execução: OK
INSERT INTO agenda_itens (fazenda_id, dedup_key, ...)
VALUES ('f1', 'proto:p1:item:i1:animal:a1', ...);

-- Segunda execução: FALHA (duplicate key)
```

#### Anti-Teleporte

2. User offline move Animal #1 de Lote B → C (queu local)
3. Sync: Operação 1 OK, Operação 2 tenta mover de B→C mas servidor ainda vê animal em A → REJECT
4. O cliente envia um batch contendo apenas a operação: `UPDATE animais SET lote_id = 'lote_B' WHERE id = 'animal_1'`.
5. O servidor analisa o batch, não encontra o evento de movimentação correspondente para o `animal_1` e rejeita a operação (e todo o batch) com o código `ANTI_TELEPORTE`. Nenhuma alteração é feita no banco de dados.

**Solução**: Sync worker faz rollback local, user vê animal de volta em Lote A.
**Solução**: O cliente deve sempre gerar o evento de movimentação junto com a atualização do estado do animal na mesma transação (gesto).

#### Soft Delete

**Definição**: Deletion logic that marks records as deleted (`deleted_at IS NOT NULL`) instead of physical deletion.  
**Vantagens**:

- Auditoria completa
- Rollback de deleções
- Índices únicos parciais (`WHERE deleted_at IS NULL`)

**Uso**:

```sql
-- "Deletar" animal
UPDATE animais SET deleted_at = NOW() WHERE id = '...';

-- Restaurar animal
UPDATE animais SET deleted_at = NULL WHERE id = '...';
```

#### RLS (Row Level Security)

**Definição**: Supabase/PostgreSQL feature que filtra linhas automaticamente baseado no usuário autenticado (`auth.uid()`).  
**Funções Auxiliares**:

- `has_membership(fazenda_id)`: Retorna `true` se `auth.uid()` está em `user_fazendas` para a fazenda
- `role_in_fazenda(fazenda_id)`: Retorna `'cowboy' | 'manager' | 'owner'`

**Exemplo de Policy**:

```sql
CREATE POLICY "animais_select_by_membership"
ON animais FOR SELECT
USING (has_membership(fazenda_id));
```

Resultado: User só vê animais de fazendas onde tem membership.

---

## Guardrails

### Uso Correto de Termos

- ✅ "IA" sempre significa "Inseminação Artificial", nunca "Artificial Intelligence"
- ✅ "Lote" é grupo de manejo, "Pasto" é área física
- ✅ "Agenda" é mutável (futuro), "Evento" é imutável (passado)
- ✅ "Gesture" é transação offline, não "gesto do usuário" genérico

### Evitar Ambiguidade

- ⚠️ "Mover animal": especificar se é mudança de `lote_id` (animal) ou `pasto_id` (lote)
- ⚠️ "Protocolo": especificar se é `protocolos_sanitarios` (template) ou "fluxo de trabalho" genérico
- ⚠️ "Evento": especificar se é `eventos` (tabela) ou "event" genérico de programação

---

## Examples

### Example 1: Clarificar IA em Code Review

**Code**:

```typescript
// ❌ Ambíguo
const iaResult = await processIA(animal);
```

**Clarification**:

```typescript
// ✅ Claro
const inseminacaoResult = await processInseminacaoArtificial(animal);
// ou
const iaResult = await processInseminacaoArtificial(animal); // IA = Inseminação Artificial
```

### Example 2: Lote vs Pasto na UI

**User pergunta**: "Como movo um animal de pasto?"

**Resposta**:
Depende do que você quer:

1. **Mover animal individualmente**: Altere `animais.lote_id` (animal troca de lote)
2. **Mover lote inteiro**: Altere `lotes.pasto_id` (todos os animais do lote vão juntos)

Na UI: "Registrar → Movimentação" altera `animais.lote_id` (opção 1).

### Example 3: Explicar Anti-Teleporte para Stakeholder

**Stakeholder**: "Por que o app desfez minha movimentação?"

**Resposta**:
O sistema tem uma regra de segurança chamada **Anti-Teleporte**. Ela garante que animais só podem sair do lote onde **realmente estão** no servidor.

**Cenário**:

1. Você estava offline e moveu Boi #123 de Lote A → B
2. Depois moveu Boi #123 de Lote B → C (ainda offline)
3. Ao sincronizar, o servidor processou A→B (OK), mas quando tentou processar B→C, o animal ainda estava registrado no Lote A no servidor
4. O sistema reverteu localmente para evitar inconsistência

**Solução**: Aguarde o sync completar antes de fazer movimentações sequenciais.

---

## Definition of Done

- [ ] Term is defined with **precise meaning** (not vague)
- [ ] **Context** provided (where/how it's used in codebase)
- [ ] **Examples** show correct vs incorrect usage
- [ ] **Cross-references** to related terms (e.g., Lote → Pasto, Agenda → Evento)
- [ ] No conflicting definitions across codebase and docs

---

## References

- `AI_RULES.md` - Domain architecture rules and glossary
- `docs/ARCHITECTURE.md` - Two Rails explanation
- `docs/DB.md` - Database schema and constraints
- `docs/OFFLINE.md` - Gesture-based sync architecture
- `supabase/migrations/0001_init.sql` - Schema definitions and enums
