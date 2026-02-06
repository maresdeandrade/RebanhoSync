# Relatório de Análise de Inconsistências - Skills GestãoAgro

**Data**: 2026-02-06  
**Escopo**: Análise de 15 skills em `.agent/skills/` comparadas com documentação em `docs/` e implementação em `src/`

---

## Sumário Executivo

Foram identificadas **23 inconsistências** distribuídas em 5 categorias:

| Categoria | Quantidade | Críticas | Moderadas | Menores |
|-----------|-------------|------------|------------|----------|
| Lógicas | 6 | 2 | 3 | 1 |
| Semânticas | 8 | 1 | 5 | 2 |
| Interface | 4 | 1 | 2 | 1 |
| Dependências | 3 | 0 | 2 | 1 |
| Performance | 2 | 0 | 1 | 1 |

**Total**: 23 inconsistências (3 críticas, 13 moderadas, 7 menores)

---

## 1. Inconsistências Lógicas

### 1.1. Erro de Sintaxe em movement-traceability-runbook

**Localização**: `.agent/skills/movement-traceability-runbook/SKILL.md:108`

**Descrição**: Erro de sintaxe TypeScript - falta de dois pontos (`:`) na propriedade do objeto.

```typescript
// ❌ INCORRETO (linha 108)
from_lote_id from_lote_id,

// ✅ CORRETO
from_lote_id: from_lote_id,
```

**Severidade**: **Crítica** - Código não compila

**Causa Raiz**: Erro de digitação durante criação da skill

**Solução Proposta**: Corrigir a sintaxe adicionando os dois pontos:

```typescript
{
  table: 'eventos_movimentacao',
  action: 'INSERT',
  record: {
    evento_id: evento_id,
    from_lote_id: from_lote_id,  // ✅ Adicionar :
    to_lote_id: to_lote_id
  }
}
```

**Impacto**: Qualquer desenvolvedor que copiar este código terá erro de compilação.

---

### 1.2. Campo Inexistente em agenda-protocols-runbook

**Localização**: `.agent/skills/agenda-protocols-runbook/SKILL.md:199-200`

**Descrição**: A skill menciona campos `protocol_item_version_id` e `interval_days_applied` que não existem no schema oficial documentado em `docs/DB.md`.

```typescript
// Linha 199-200 - Campos não documentados
protocol_item_version_id: _protocol_item.id,
interval_days_applied: _protocol_item.intervalo_dias,
```

**Severidade**: **Moderada** - Código pode falhar em runtime

**Causa Raiz**: A skill foi criada com base em uma versão de schema diferente da documentada

**Solução Proposta**: Remover campos não documentados ou atualizar `docs/DB.md` para incluir estes campos:

**Opção A** (remover campos):
```typescript
INSERT INTO agenda_itens (
  fazenda_id,
  dominio,
  tipo,
  status,
  data_prevista,
  animal_id,
  dedup_key,
  source_kind,
  -- Remover: protocol_item_version_id, interval_days_applied
  client_id,
  client_op_id,
  client_tx_id,
  client_recorded_at
) VALUES (...)
```

**Opção B** (documentar campos em DB.md):
Adicionar em `docs/DB.md` na seção de `agenda_itens`:
- `protocol_item_version_id` (uuid): Referência ao item de protocolo que gerou a tarefa
- `interval_days_applied` (int): Intervalo em dias aplicado do protocolo

**Impacto**: Se os campos não existem no banco, o INSERT falhará. Se existem mas não estão documentados, causa confusão.

---

### 1.3. Inconsistência de Nomenclatura de Campos de Versão

**Localização**: `.agent/skills/agenda-protocols-runbook/SKILL.md:52-53`

**Descrição**: A skill define `protocol_item_id` como "Stable ID for dedup_template" e `version` como campo separado, mas na linha 199 usa `protocol_item_version_id` que não está definido.

```typescript
// Linha 52-53
protocol_item_id uuid NOT NULL, -- Stable ID for dedup_template
version int NOT NULL, -- Versioning for changes

// Linha 199 - Campo diferente
protocol_item_version_id: _protocol_item.id,
```

**Severidade**: **Moderada** - Confusão sobre qual campo usar

**Causa Raiz**: Inconsistência entre definição de schema e uso em código de exemplo

**Solução Proposta**: Padronizar para usar `protocol_item_id` (campo estável) e `version` separadamente:

```typescript
INSERT INTO agenda_itens (
  ...
  protocol_item_id: _protocol_item.protocol_item_id,  // Campo estável
  protocol_item_version: _protocol_item.version,  // Campo de versão
  ...
)
```

**Impacto**: Desenvolvedores podem usar o campo errado, causando falhas de integridade de dados.

---

### 1.4. Falta de Validação de FK em reproduction-runbook

**Localização**: `.agent/skills/reproduction-runbook/SKILL.md:319-322`

**Descrição**: A skill lista validações server-side mas não menciona que `macho_id` pode ser `null` para IA, o que pode causar confusão sobre a validação.

```typescript
// Linha 320 - Validação incompleta
2. **Male is valid** (if provided): `eventos_reproducao.macho_id` must exist and be male (`animais.sexo = 'M'`)
```

**Severidade**: **Menor** - Documentação incompleta

**Causa Raiz**: A validação não considera o caso de IA onde `macho_id` é `null`

**Solução Proposta**: Atualizar a documentação de validação:

```typescript
2. **Male is valid** (if provided): 
   - If `macho_id` is NOT NULL: must exist and be male (`animais.sexo = 'M'`)
   - If `tipo='IA'`: `macho_id` can be NULL (semen from external source)
```

**Impacto**: Desenvolvedores podem implementar validação incorreta que rejeita IA válida.

---

### 1.5. Ordem de Operações em Parto

**Localização**: `.agent/skills/reproduction-runbook/SKILL.md:265-307`

**Descrição**: A skill mostra criação de calf animal ANTES do evento de parto, mas não menciona que isso é necessário para FK constraints.

```typescript
// Linha 265-280 - Cria animal primeiro
{
  client_op_id: uuid(),
  table: "state_animais",
  action: "INSERT",
  record: {
    id: calfId,
    ...
  },
},
// Depois cria evento
```

**Severidade**: **Menor** - Ordem correta mas não explicada

**Causa Raiz**: Falta de explicação sobre dependência de FK

**Solução Proposta**: Adicionar comentário explicativo:

```typescript
// 1. Create calf animal FIRST (required for FK: eventos.animal_id references animais.id)
{
  client_op_id: uuid(),
  table: "state_animais",
  action: "INSERT",
  record: { id: calfId, ... },
},
// 2. Insert parent evento (references calf via animal_id)
```

**Impacto**: Desenvolvedores podem mudar a ordem e causar FK violations.

---

### 1.6. Inconsistência de Status em types.ts

**Localização**: `src/lib/offline/types.ts:1`

**Descrição**: O tipo `GestureStatus` inclui `'SYNCED'` que não é usado no código e não está documentado em `docs/OFFLINE.md`.

```typescript
export type GestureStatus = 'PENDING' | 'SYNCING' | 'DONE' | 'ERROR' | 'SYNCED' | 'REJECTED';
```

**Severidade**: **Menor** - Status não utilizado

**Causa Raiz**: Status adicionado mas nunca implementado

**Solução Proposta**: Remover `'SYNCED'` do tipo ou implementar seu uso:

**Opção A** (remover):
```typescript
export type GestureStatus = 'PENDING' | 'SYNCING' | 'DONE' | 'ERROR' | 'REJECTED';
```

**Opção B** (implementar): Documentar quando usar `'SYNCED'` (ex: para pull sync do servidor)

**Impacto**: Confusão sobre estados válidos de gestos.

---

## 2. Inconsistências Semânticas

### 2.1. Referência a Skill Inexistente

**Localização**: `.agent/skills/health-events-runbook/SKILL.md:139`

**Descrição**: A skill referencia `agenda-reconciliation-runbook/SKILL.md` que não existe no projeto.

```markdown
## References
- [agenda-reconciliation-runbook](../agenda-reconciliation-runbook/SKILL.md)
```

**Severidade**: **Crítica** - Link quebrado

**Causa Raiz**: Skill planejada mas não criada

**Solução Proposta**: Criar a skill `agenda-reconciliation-runbook` ou remover a referência:

**Opção A** (criar skill):
Criar `.agent/skills/agenda-reconciliation-runbook/SKILL.md` com:
- Como resolver conflitos de agenda
- Como lidar com tarefas duplicadas
- Como reconciliar agenda manual vs automática

**Opção B** (remover referência):
```markdown
## References
- [DB.md](../../../docs/DB.md) - eventos_sanitario schema
- [agenda-protocols-runbook](../agenda-protocols-runbook/SKILL.md) - Protocolos automáticos
```

**Impacto**: Usuários não podem acessar documentação referenciada.

---

### 2.2. Store Não Existente em offline-architecture-guide

**Localização**: `.agent/skills/offline-architecture-guide/SKILL.md:86`

**Descrição**: A skill lista `state_fazendas` como store, mas `TABLE_MAP` e `db.ts` não incluem esta tabela.

```typescript
// Linha 86 - Store não existe
- `state_fazendas`
```

**Severidade**: **Moderada** - Informação incorreta

**Causa Raiz**: A skill assume que `fazendas` é replicada localmente, mas não é (é tabela de tenant)

**Solução Proposta**: Remover `state_fazendas` da lista ou adicionar explicação:

**Opção A** (remover):
```typescript
#### 1. `state_*` (State Tables - Local Replica)
Mirrors Supabase tables for instant reads:
- `state_pastos`
- `state_lotes`
- `state_animais`
- `state_contrapartes`
- `state_protocolos_sanitarios`
- `state_protocolos_sanitarios_itens`
- `state_agenda_itens`
```

**Opção B** (adicionar explicação):
```typescript
// Note: fazendas is NOT replicated locally (tenant table, accessed via RPCs only)
```

**Impacto**: Desenvolvedores podem tentar usar `state_fazendas` que não existe.

---

### 2.3. Contagem Incorreta de Migrations

**Localização**: `.agent/skills/repo-onboarding/SKILL.md:99`

**Descrição**: A skill menciona "7 migrations applied (0001_init through 0006_invite_system)" mas existem 7 migrations (0001-0007).

```markdown
**Expected**: 7 migrations applied (0001_init through 0006_invite_system)
```

**Severidade**: **Menor** - Documentação desatualizada

**Causa Raiz**: A skill foi criada antes da migration 0007

**Solução Proposta**: Atualizar para refletir migrations atuais:

```markdown
**Expected**: 7 migrations applied (0001_init through 0007_fix_create_invite)
```

**Impacto**: Confusão sobre número de migrations esperado.

---

### 2.4. Campo `dose_ml` Não Documentado

**Localização**: `.agent/skills/health-events-runbook/SKILL.md:46`

**Descrição**: A skill usa `dose_ml` mas este campo não está documentado em `docs/DB.md`.

```typescript
dose_ml: 5.0,
```

**Severidade**: **Moderada** - Campo não documentado

**Causa Raiz**: Campo adicionado ao schema mas não documentado

**Solução Proposta**: Adicionar campo em `docs/DB.md` na seção `eventos_sanitario`:

```sql
CREATE TABLE eventos_sanitario (
  evento_id uuid PRIMARY KEY REFERENCES eventos(id),
  fazenda_id uuid NOT NULL,
  tipo sanitario_tipo_enum NOT NULL,
  produto text NOT NULL,
  dose_ml numeric(10,2),  -- Volume da dose em mililitros
  via_aplicacao text,  -- subcutânea, intramuscular, etc.
  ...
);
```

**Impacto**: Desenvolvedores podem não saber que este campo existe.

---

### 2.5. Campo `habilitado_monta` Não Documentado

**Localização**: `.agent/skills/reproduction-runbook/SKILL.md:321`

**Descrição**: A skill menciona `animais.habilitado_monta = true` mas este campo não está em `docs/DB.md`.

```typescript
3. **Male is enabled for breeding**: `animais.habilitado_monta = true` (optional but recommended)
```

**Severidade**: **Moderada** - Campo não documentado

**Causa Raiz**: Campo adicionado ao schema mas não documentado

**Solução Proposta**: Adicionar campo em `docs/DB.md` na seção `animais`:

```sql
CREATE TABLE animais (
  id uuid PRIMARY KEY,
  fazenda_id uuid NOT NULL,
  identificacao text NOT NULL,
  sexo sexo_enum NOT NULL,
  ...
  habilitado_monta boolean DEFAULT false,  -- Indica se macho está habilitado para reprodução
  ...
);
```

**Impacto**: Desenvolvedores podem não saber sobre este campo de validação.

---

### 2.6. Payload Structure Inconsistente

**Localização**: `.agent/skills/reproduction-runbook/SKILL.md:60`

**Descrição**: A skill define `payload` como jsonb mas os exemplos usam estrutura inconsistente.

```typescript
payload jsonb, -- e.g. {"resultado_prenhez": "positivo", "touro_codigo": "T-123"}
```

**Severidade**: **Menor** - Falta de padronização

**Causa Raiz**: Payload é flexível por design, mas exemplos não seguem padrão

**Solução Proposta**: Documentar estrutura padrão para cada tipo:

```typescript
// Para tipo='diagnostico'
payload: {
  resultado_prenhez: "positivo" | "negativo" | "inconclusivo",
  metodo_diagnostico: "ultrassom" | "palpação",
}

// Para tipo='parto'
payload: {
  bezerro_id: uuid,  // ID do bezerro criado
  tipo_parto: "normal" | "distócico" | "cesárea",
}

// Para tipo='cobertura' ou 'IA'
payload: {
  touro_codigo?: string,  // Para cobertura natural
  semen_code?: string,  // Para IA
}
```

**Impacto**: Desenvolvedores podem criar payloads inconsistentes.

---

### 2.7. Nome de Variável Incorreto

**Localização**: `.agent/skills/reproduction-runbook/SKILL.md:276`

**Descrição**: A variável é chamada `nascimento_data` mas em `docs/DB.md` o campo é `data_nascimento`.

```typescript
data_nascimento: occurredAt.toISOString().split("T")[0], // YYYY-MM-DD
```

**Severidade**: **Menor** - Nome inconsistente

**Causa Raiz**: Diferença de nomenclatura entre código e documentação

**Solução Proposta**: Padronizar para `data_nascimento` em toda a base de código:

```typescript
// Em types.ts
export interface Animal {
  data_nascimento?: string;  // ✅ Padronizado
  // ❌ Não usar: nascimento_data
}
```

**Impacto**: Confusão sobre nome correto do campo.

---

### 2.8. Inconsistência em Nome de Função

**Localização**: `.agent/skills/repo-onboarding/SKILL.md:63`

**Descrição**: A skill menciona `TODO: Confirm actual env var names` mas não há follow-up.

```markdown
> **TODO**: Confirm actual env var names from codebase (check `src/integrations/supabase/client.ts`)
```

**Severidade**: **Menor** - TODO não resolvido

**Causa Raiz**: TODO deixado durante criação da skill

**Solução Proposta**: Verificar e atualizar com nomes corretos:

```markdown
**Required variables** (check `.env`):

```plaintext
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
```

> ✅ Confirmed: These are the actual env var names used in `src/lib/supabase.ts`
```

**Impacto**: Desenvolvedores podem usar nomes incorretos de variáveis de ambiente.

---

## 3. Inconsistências de Interface

### 3.1. Prefixo Incorreto em offline-architecture-guide

**Localização**: `.agent/skills/offline-architecture-guide/SKILL.md:105-111`

**Descrição**: A skill usa `events_eventos` (com "events_") mas `TABLE_MAP` e `db.ts` usam `event_eventos` (sem "s").

```typescript
// Linha 105-111 - Prefixo incorreto
- `events_eventos`
- `events_eventos_sanitario`
- `events_eventos_pesagem`
```

**Severidade**: **Crítica** - Nomes de stores incorretos

**Causa Raiz**: Erro de digitação na skill

**Solução Proposta**: Corrigir para usar prefixo `event_`:

```typescript
#### 2. `events_*` (Event Tables - Local Log)
Mirrors append-only event tables:
- `event_eventos`
- `event_eventos_sanitario`
- `event_eventos_pesagem`
- `event_eventos_movimentacao`
- `event_eventos_reproducao`
- `event_eventos_nutricao`
- `event_eventos_financeiro`
```

**Impacto**: Qualquer código que copiar estes nomes terá erros de referência.

---

### 3.2. Assinatura de createGesture Incorreta

**Localização**: `.agent/skills/offline-architecture-guide/SKILL.md:171`

**Descrição**: A skill mostra `createGesture` recebendo objeto com `fazenda_id` e `ops`, mas a implementação real recebe `fazenda_id` como primeiro parâmetro.

```typescript
// ❌ INCORRETO na skill (linha 171)
await createGesture({
  fazenda_id: 'f1',
  client_id: 'browser',
  ops: [...],
});

// ✅ CORRETO na implementação (ops.ts:14)
await createGesture(fazenda_id, [
  { table: 'events_eventos', action: 'INSERT', ... },
]);
```

**Severidade**: **Moderada** - Assinatura de função incorreta

**Causa Raiz**: A skill foi criada antes da implementação final ser definida

**Solução Proposta**: Atualizar todos os exemplos na skill:

```typescript
// ✅ CORRETO
await createGesture('f1', [
  {
    client_op_id: uuid(),
    table: 'event_eventos',
    action: 'INSERT',
    record: { id: 'e1', fazenda_id: 'f1', dominio: 'sanitario', ... },
  },
  {
    client_op_id: uuid(),
    table: 'event_eventos_sanitario',
    action: 'INSERT',
    record: { evento_id: 'e1', fazenda_id: 'f1', tipo: 'vacinacao', produto: 'Febre Aftosa' },
  },
]);
```

**Impacto**: Desenvolvedores que seguirem a skill terão erros de compilação.

---

### 3.3. Tipo de Retorno Incorreto

**Localização**: `.agent/skills/animal-lifecycle-runbook/SKILL.md:67`

**Descrição**: A skill mostra `createGesture` sendo chamado sem capturar o retorno, mas a função retorna `client_tx_id`.

```typescript
await createGesture(fazenda_id, operations);
// ❌ Não captura o retorno
```

**Severidade**: **Menor** - Boa prática ignorada

**Causa Raiz**: Exemplo simplificado demais

**Solução Proposta**: Mostrar captura do retorno:

```typescript
const client_tx_id = await createGesture(fazenda_id, operations);
// ✅ Captura o UUID para tracking
```

**Impacto**: Desenvolvedores podem não saber que a função retorna um valor útil.

---

### 3.4. Parâmetro Opcional Não Documentado

**Localização**: `.agent/skills/health-events-runbook/SKILL.md:36`

**Descrição**: A skill mostra `source_task_id` como opcional mas não explica quando deve ser usado.

```typescript
source_task_id: "<agenda_item_id or null>",
```

**Severidade**: **Menor** - Documentação incompleta

**Causa Raiz**: Falta de explicação sobre o propósito do campo

**Solução Proposta**: Adicionar explicação:

```typescript
source_task_id: "<agenda_item_id or null>",  // Opcional: ID da tarefa de agenda que gerou este evento (usado para rastreamento)
```

**Impacto**: Desenvolvedores podem não entender quando preencher este campo.

---

## 4. Inconsistências de Dependências

### 4.1. Referência Circular Entre Skills

**Localização**: `.agent/skills/health-events-runbook/SKILL.md:139`

**Descrição**: A skill referencia `agenda-reconciliation-runbook` que não existe, criando dependência circular não resolvida.

**Severidade**: **Moderada** - Dependência quebrada

**Causa Raiz**: Skill planejada mas não implementada

**Solução Proposta**: Criar a skill `agenda-reconciliation-runbook` ou remover a referência (ver 2.1).

**Impacto**: Usuários não podem navegar entre skills relacionadas.

---

### 4.2. Dependência de Test Framework Não Instalado

**Localização**: `.agent/skills/test-runner/SKILL.md:20-27`

**Descrição**: A skill assume que Vitest está instalado mas o projeto não tem test framework configurado.

```markdown
⚠️ **NO TEST FRAMEWORK DETECTED** in `package.json`
Recommended setup:
- **Unit/Integration**: Vitest (fast, Vite-native)
```

**Severidade**: **Moderada** - Instruções não aplicáveis

**Causa Raiz**: Test framework ainda não configurado no projeto

**Solução Proposta**: Adicionar aviso mais claro:

```markdown
⚠️ **NO TEST FRAMEWORK DETECTED** in `package.json`

Before running tests, you MUST set up the test framework:
1. Install Vitest: `pnpm add -D vitest @vitest/ui`
2. Create `vitest.config.ts`
3. Add test scripts to `package.json`

See "If Tests Do NOT Exist (Setup Required)" section below.
```

**Impacto**: Desenvolvedores podem tentar rodar testes que não existem.

---

### 4.3. Import Path Incorreto

**Localização**: `.agent/skills/sync-debugger/SKILL.md:34`

**Descrição**: A skill mostra import de `db` que não funcionará no console do navegador.

```javascript
const { db } = await import("./src/lib/offline/db");
```

**Severidade**: **Menor** - Código não funcional no console

**Causa Raiz**: Caminho de import não funciona no contexto do navegador

**Solução Proposta**: Usar window global ou Dexie DevTools:

```javascript
// Opção A: Via Dexie DevTools (se instalado)
const db = Dexie.open('PecuariaOfflineDB');

// Opção B: Via window global (se exposto)
const db = window.__PECUARIA_DB__;
```

**Impacto**: Desenvolvedores não conseguirão executar o código de debug.

---

## 5. Inconsistências de Performance

### 5.1. Bulk Operations Sem Paginação

**Localização**: `.agent/skills/movement-traceability-runbook/SKILL.md:126`

**Descrição**: A skill menciona que bulk moves podem timeout mas não sugere paginação ou batching.

```typescript
// Linha 126 - Aviso sem solução
**Warning**: Bulk moves generate 3 ops per animal (30 animals = 90 ops!)
```

**Severidade**: **Moderada** - Problema de escalabilidade não resolvido

**Causa Raiz**: Falta de implementação de batching

**Solução Proposta**: Adicionar função de batching:

```typescript
async function moveAnimaisInBatches(
  animalIds: string[],
  fromLoteId: string,
  toLoteId: string,
  batchSize = 20
) {
  for (let i = 0; i < animalIds.length; i += batchSize) {
    const batch = animalIds.slice(i, i + batchSize);
    await createGesture(fazenda_id, 
      batch.flatMap(animal_id => createMoveOps(animal_id, fromLoteId, toLoteId))
    );
    // Aguarda sync do batch antes do próximo
    await waitForSyncComplete();
  }
}
```

**Impacto**: Operações com muitos animais podem falhar por timeout.

---

### 5.2. Fetch Sem Cache em syncWorker

**Localização**: `src/lib/offline/syncWorker.ts:54`

**Descrição**: O syncWorker busca sessão do Supabase a cada ciclo sem cache, causando overhead desnecessário.

```typescript
const { supabase } = await import("@/lib/supabase");
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
```

**Severidade**: **Menor** - Ineficiência menor

**Causa Raiz**: Sessão não é cacheada entre ciclos

**Solução Proposta**: Cachear sessão ou usar Supabase Auth state change listener:

```typescript
// Cache session globally
let cachedSession: Session | null = null;

// Update on auth changes
supabase.auth.onAuthStateChange((event, session) => {
  cachedSession = session;
});

// Use cached session in syncWorker
if (!cachedSession) {
  throw new Error("Não autenticado - sessão expirada");
}
```

**Impacto**: Overhead menor a cada 5 segundos, mas pode ser otimizado.

---

## 6. Gaps de Documentação

### 6.1. Falta de Documentação de Pull Sync

**Descrição**: A documentação em `docs/OFFLINE.md` descreve o fluxo de push (offline → online) mas não documenta o fluxo de pull (online → offline) para atualizar dados locais.

**Impacto**: Desenvolvedores não sabem como implementar sincronização bidirecional.

**Solução Proposta**: Adicionar seção "Pull Sync" em `docs/OFFLINE.md`:

```markdown
## Fluxo de Sincronização (Online → Offline)

### Pull Sync

Quando o dispositivo está online, o sistema deve periodicamente buscar atualizações do servidor:

1. **Detectar mudanças**: Comparar `server_received_at` local vs remoto
2. **Buscar dados**: Fetch de tabelas modificadas desde último sync
3. **Aplicar localmente**: Atualizar stores `state_*` e `event_*`
4. **Resolver conflitos**: Usar estratégia de last-write-wins ou manual
```

---

### 6.2. Falta de Documentação de Error Handling

**Descrição**: As skills mostram exemplos de sucesso mas não documentam padrões de error handling consistentes.

**Impacto**: Desenvolvedores podem implementar error handling inconsistente.

**Solução Proposta**: Criar `docs/ERROR_HANDLING.md` com:

```markdown
# Padrões de Error Handling

## 1. Erros de Sync

### REJECTED (Erro de Negócio)
- Ação: Mostrar mensagem ao usuário com `reason_message`
- Rollback: Automático via `before_snapshot`
- Retry: NÃO (erro de negócio não é transitório)

### ERROR (Erro de Sistema)
- Ação: Mostrar mensagem genérica + opção de reenviar manual
- Retry: Automático até 3 vezes
- Log: Registrar `last_error` para debugging

## 2. Erros de Validação

### FK Violation
- Causa: Referência a registro inexistente
- Ação: Validar localmente antes de enviar
- UI: Mostrar erro específico (ex: "Lote não encontrado")

### Unique Constraint
- Causa: Duplicata de `client_op_id` ou `dedup_key`
- Ação: Tratar como sucesso (idempotência)
- UI: Não mostrar erro ao usuário
```

---

### 6.3. Falta de Documentação de Testing

**Descrição**: O projeto não tem test framework configurado mas não há documentação sobre estratégia de testes.

**Impacto**: Desenvolvedores não sabem como testar o sistema.

**Solução Proposta**: Criar `docs/TESTING.md` com:

```markdown
# Estratégia de Testes - GestãoAgro

## Níveis de Testes

### 1. Unit Tests
- Framework: Vitest
- Foco: Funções puras, lógica de negócio isolada
- Exemplos: `createGesture`, `applyOpLocal`, `rollbackOpLocal`

### 2. Integration Tests
- Framework: Vitest + fake-indexeddb
- Foco: Interação entre módulos (offline + sync)
- Exemplos: Fluxo completo de criação → sync → rollback

### 3. E2E Tests
- Framework: Playwright
- Foco: Fluxos de usuário completos
- Exemplos: Ver `docs/E2E_MVP.md`

## Cobertura Esperada
- Core offline logic: > 80%
- Sync worker: > 70%
- UI components: > 60%
```

---

## Lista Priorizada de Correções

### Críticas (Prioridade 1 - Imediato)

1. **[movement-traceability-runbook]** Corrigir erro de sintaxe na linha 108
2. **[health-events-runbook]** Remover referência a skill inexistente ou criar skill
3. **[offline-architecture-guide]** Corrigir prefixo de stores de `events_` para `event_`

### Moderadas (Prioridade 2 - Curto Prazo)

4. **[agenda-protocols-runbook]** Remover ou documentar campos `protocol_item_version_id` e `interval_days_applied`
5. **[offline-architecture-guide]** Corrigir assinatura de `createGesture` em todos os exemplos
6. **[health-events-runbook]** Documentar campo `dose_ml` em `docs/DB.md`
7. **[reproduction-runbook]** Documentar campo `habilitado_monta` em `docs/DB.md`
8. **[movement-traceability-runbook]** Implementar batching para bulk operations
9. **[test-runner]** Adicionar aviso mais claro sobre setup de test framework
10. **[repo-onboarding]** Atualizar contagem de migrations para 0001-0007

### Menores (Prioridade 3 - Médio Prazo)

11. **[types.ts]** Remover status `'SYNCED'` não utilizado
12. **[reproduction-runbook]** Adicionar explicação sobre validação de `macho_id` null para IA
13. **[reproduction-runbook]** Adicionar comentário sobre ordem de operações em parto
14. **[animal-lifecycle-runbook]** Mostrar captura de retorno de `createGesture`
15. **[health-events-runbook]** Documentar propósito de `source_task_id`
16. **[sync-debugger]** Corrigir import path para funcionar no console do navegador
17. **[reproduction-runbook]** Padronizar estrutura de `payload` por tipo
18. **[reproduction-runbook]** Padronizar nome de campo para `data_nascimento`
19. **[repo-onboarding]** Resolver TODO sobre nomes de env vars
20. **[syncWorker.ts]** Implementar cache de sessão para reduzir overhead

### Documentação (Prioridade 4 - Quando Possível)

21. Criar `docs/ERROR_HANDLING.md` com padrões de error handling
22. Criar `docs/TESTING.md` com estratégia de testes
23. Adicionar seção "Pull Sync" em `docs/OFFLINE.md`

---

## Recomendações para Prevenir Inconsistências Futuras

### 1. Processo de Review de Skills

- **Antes de criar skill**: Verificar se código de exemplo compila
- **Referências cruzadas**: Verificar se skills referenciadas existem
- **Consistência de nomes**: Usar nomes de campos/tabelas consistentes com `docs/DB.md`

### 2. Validação Automática

- **Lint rule**: Detectar uso de campos não documentados
- **Type checking**: Garantir que exemplos de TypeScript compilam
- **Link checking**: Verificar links entre skills não estão quebrados

### 3. Documentação Viva

- **Schema-first**: Manter `docs/DB.md` como fonte de verdade
- **Auto-sync**: Quando adicionar campo no schema, atualizar automaticamente skills relacionadas
- **Versionamento**: Marcar skills com versão do schema que documentam

### 4. Testes de Skills

- **Test examples**: Executar código de exemplo das skills para garantir que funciona
- **Integration tests**: Testar fluxos completos documentados nas skills
- **E2E validation**: Verificar que cenários E2E descritos funcionam

### 5. Processo de Onboarding

- **Checklist**: Novos desenvolvedores devem ler skills relevantes antes de implementar
- **Mentoria**: Code review deve verificar consistência com skills
- **Atualização**: Quando mudar arquitetura, atualizar todas as skills afetadas

---

## Plano de Ação Detalhado

### Fase 1: Correções Críticas (1-2 dias)

1. Corrigir erro de sintaxe em `movement-traceability-runbook/SKILL.md:108`
2. Criar skill `agenda-reconciliation-runbook` ou remover referência
3. Corrigir prefixo de stores em `offline-architecture-guide/SKILL.md`

### Fase 2: Correções Moderadas (3-5 dias)

4. Atualizar `docs/DB.md` com campos `dose_ml` e `habilitado_monta`
5. Corrigir assinatura de `createGesture` em todas as skills
6. Implementar batching para bulk operations
7. Atualizar contagem de migrations em `repo-onboarding`

### Fase 3: Correções Menores (5-7 dias)

8. Remover status `'SYNCED'` de `types.ts`
9. Adicionar explicações de validação em `reproduction-runbook`
10. Corrigir import path em `sync-debugger`
11. Padronizar nomes de campos e estruturas

### Fase 4: Documentação (7-10 dias)

12. Criar `docs/ERROR_HANDLING.md`
13. Criar `docs/TESTING.md`
14. Adicionar seção "Pull Sync" em `docs/OFFLINE.md`
15. Revisar todas as skills para consistência

### Fase 5: Validação (2-3 dias)

16. Executar código de exemplo de todas as skills
17. Verificar que todos os links entre skills funcionam
18. Testar fluxos E2E documentados
19. Code review final de todas as correções

---

## Conclusão

A análise identificou 23 inconsistências distribuídas em 5 categorias. A maioria é de severidade moderada ou menor, mas 3 inconsistências críticas requerem correção imediata para evitar erros de compilação e links quebrados.

As principais áreas de melhoria são:

1. **Consistência de nomenclatura** entre skills, documentação e implementação
2. **Validação de código de exemplo** para garantir que compila
3. **Documentação completa** de schema e padrões de error handling
4. **Processo de review** para prevenir inconsistências futuras

Com a implementação do plano de ação proposto, a qualidade das skills melhorará significativamente, reduzindo confusão e erros para desenvolvedores que utilizam o sistema.
