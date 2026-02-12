# Roteiro de Testes E2E (MVP)

Este documento define fluxos de teste end-to-end para validar as funcionalidades críticas do sistema, incluindo autenticação, RBAC, offline-first, sincronização, e validações de negócio.

---

## Fluxo 0: Autenticação e Seleção de Fazenda

### Objetivo

Validar que o sistema protege rotas e gerencia corretamente a fazenda ativa.

### Pré-requisitos

- Usuário cadastrado no sistema (`/signup`)
- Usuário tem membership em pelo menos uma fazenda

### Passos

1. **Acesse `/login`** sem estar autenticado
   - ✅ Página de login é exibida
   - ✅ Formulário pede email e password

2. **Faça login** com credenciais válidas
   - ✅ Redirecionamento automático após login

3. **Cenário A: Primeira vez / Sem fazenda ativa**
   - ✅ Sistema redireciona para `/select-fazenda`
   - ✅ Lista mostra todas as fazendas onde o usuário tem membership ativo
   - ✅ Cada item mostra: nome da fazenda, role do usuário, is_primary

4. **Selecione uma fazenda** da lista
   - ✅ Sistema atualiza `user_settings.active_fazenda_id` no Supabase
   - ✅ Sistema atualiza `"gestao_agro_active_farm_id"` no localStorage
   - ✅ Redirecionamento para `/home`

5. **Valide a persistência**
   - Dê refresh na página (F5)
   - ✅ Sistema mantém a fazenda ativa (busca de localStorage)
   - ✅ Não redireciona para `/select-fazenda` novamente

6. **Cenário B: Usuário já tem fazenda ativa**
   - Faça login novamente (ou acesse diretamente `/home` autenticado)
   - ✅ Sistema busca `user_settings.active_fazenda_id` do Supabase
   - ✅ Carrega para localStorage se divergente
   - ✅ Redireciona direto para `/home` (sem passar por `/select-fazenda`)

### Validações

- `user_settings.active_fazenda_id` no Supabase = fazenda selecionada
- localStorage `"gestao_agro_active_farm_id"` = fazenda selecionada
- Refresh mantém fazenda ativa (não exige relogin/reseleção)

---

## Fluxo 1: RBAC - Member Management (Owner Only)

### Objetivo

Validar que apenas owner pode gerenciar membros e que safeguards funcionam.

### Pré-requisitos

- Usuário autenticado como **owner** em uma fazenda
- Fazenda tem pelo menos 2 membros (1 owner + 1 cowboy/manager)

### Passos

#### 1. Acesso à Página de Admin

1. **Navegue para `/admin/membros`**
   - ✅ Owner: página carrega lista de membros
   - ❌ Manager/Cowboy: acesso negado ou página vazia (não implementado guard de UI ainda)

2. **Liste os membros** da fazenda ativa
   - ✅ Mostra: display_name, email, role, data de aceite
   - ✅ Owner vê ações: "Alterar Role", "Remover"

#### 2. Alterar Role (Manager → Owner)

1. **Owner altera role** de um manager para owner
   ```typescript
   await supabase.rpc("admin_set_member_role", {
     _fazenda_id: fazenda_id,
     _target_user_id: manager_user_id,
     _new_role: "owner",
   });
   ```

   - ✅ RPC retorna sucesso
   - ✅ UI atualiza role para "owner"
   - ✅ Banco `user_fazendas.role` = 'owner'

#### 3. Tentar Rebaixar Último Owner (Safeguard)

1. **Cenário**: Fazenda tem apenas 1 owner
2. **Owner tenta rebaixar a si mesmo** para manager
   ```typescript
   await supabase.rpc("admin_set_member_role", {
     _fazenda_id: fazenda_id,
     _target_user_id: owner_user_id,
     _new_role: "manager",
   });
   ```

   - ❌ RPC lança exceção: `"Cannot demote the last owner"`
   - ✅ UI mostra erro ao usuário
   - ✅ Banco mantém role = 'owner'

#### 4. Manager Tenta Alterar Role de Owner (Safeguard)

1. **Autentique como manager** (troque de conta ou use outro dispositivo)
2. **Manager tenta rebaixar owner** para cowboy
   ```typescript
   await supabase.rpc("admin_set_member_role", {
     _fazenda_id: fazenda_id,
     _target_user_id: owner_user_id,
     _new_role: "cowboy",
   });
   ```

   - ❌ RPC lança exceção: `"Only owner can change role of an owner"`
   - ✅ UI mostra erro ao usuário
   - ✅ Banco mantém role original do owner

#### 5. Remover Membro

1. **Owner remove um cowboy** via RPC `admin_remove_member`

   ```typescript
   await supabase.rpc("admin_remove_member", {
     _fazenda_id: fazenda_id,
     _target_user_id: cowboy_user_id,
   });
   ```

   - ✅ RPC retorna sucesso
   - ✅ UI remove membro da lista
   - ✅ Banco: `user_fazendas.deleted_at` = now() (soft delete)

2. **Cowboy removido tenta acessar** a fazenda
   - ❌ Não aparece na lista `/select-fazenda`
   - ❌ Se tentar acessar `/home` com fazenda antiga no localStorage, recebe 403

#### 6. Tentar Remover Último Owner (Safeguard)

1. **Owner tenta remover a si mesmo** (último owner)
   ```typescript
   await supabase.rpc("admin_remove_member", {
     _fazenda_id: fazenda_id,
     _target_user_id: owner_user_id,
   });
   ```

   - ❌ RPC lança exceção: `"Cannot remove the last owner"`
   - ✅ UI mostra erro
   - ✅ Banco mantém membership ativo

### Validações

- Owner pode alterar qualquer role (exceto último owner)
- Manager NÃO pode alterar role de owner
- Não pode remover/rebaixar último owner
- Soft delete funciona (deleted_at setado)

---

## Fluxo 2: Sanitário Offline → Online → Sync

### Objetivo

Validar que eventos criados offline são sincronizados corretamente quando online.

### Pré-requisitos

- Usuário autenticado com fazenda ativa
- Pelo menos 1 lote com 3+ animais cadastrados

### Passos

#### 1. Preparação (Online)

1. Abra o app e **garanta que dados foram carregados** (lista de animais visível)
2. Verifique **"Online"** em algum indicador de status (se existir)

#### 2. Modo Offline

1. **Desligue a internet** (Modo Avião ou desabilite Wi-Fi)
2. Confirme que não há conectividade (ex: ping falhando)

#### 3. Criar Evento Sanitário Offline

1. **Navegue para `/registrar`**
2. **Selecione um lote** da lista
3. **Selecione 3 animais** do lote
4. **Escolha domínio**: Sanitário
5. **Tipo**: Vacinação
6. **Produto**: "Febre Aftosa"
7. **Data/hora**: Agora (ou customize)
8. **Confirme** a ação

#### 4. Validações Locais (Offline)

1. **Verifique Dexie** (via DevTools ou query)

   ```typescript
   const gestures = await db.queue_gestures
     .where("status")
     .equals("PENDING")
     .toArray();
   ```

   - ✅ Existe 1 gesto com `status = "PENDING"`
   - ✅ `fazenda_id` correto
   - ✅ `client_tx_id` preenchido

2. **Verifique operações pendentes**

   ```typescript
   const ops = await db.queue_ops
     .where("client_tx_id")
     .equals(client_tx_id)
     .toArray();
   ```

   - ✅ Existem operações (1 evento base + 3 detalhes sanitário)
   - ✅ Cada op tem `client_op_id`, `table`, `action`, `record`

3. **Verifique eventos locais** (otimismo)

   ```typescript
   const eventos = await db.event_eventos
     .where("fazenda_id")
     .equals(fazenda_id)
     .toArray();
   ```

   - ✅ 3 novos eventos aparecem no log local
   - ✅ Timeline do animal mostra evento (se houver UI)

4. **Contador de pendentes** (se existir na UI)
   - ✅ TopBar/Badge mostra "3 pendentes" ou similar

#### 5. Voltar Online

1. **Ligue a internet** (Modo Avião OFF ou Wi-Fi ON)
2. **Aguarde sync automático** (worker roda a cada 5s)

#### 6. Aguardar Sync Completo

1. **Monitore Dexie**

   ```typescript
   const gesture = await db.queue_gestures.get(client_tx_id);
   ```

   - ✅ `status` muda para `"SYNCING"`
   - ✅ Depois muda para `"DONE"`

2. **Verifique queue_ops**

   ```typescript
   const ops = await db.queue_ops
     .where("client_tx_id")
     .equals(client_tx_id)
     .toArray();
   ```

   - ✅ Array vazio (operações deletadas após sucesso)

3. **Contador de pendentes**
   - ✅ Badge zera (ou desaparece)

#### 7. Validações no Servidor

1. **Abra Supabase Dashboard** ou execute query SQL:

   ```sql
   SELECT * FROM eventos
   WHERE fazenda_id = :fazenda_id
   ORDER BY occurred_at DESC
   LIMIT 10;
   ```

   - ✅ 3 eventos de `dominio = 'sanitario'` aparecem
   - ✅ `client_tx_id` bate com o do gesto local

2. **Verifique detalhes**
   ```sql
   SELECT * FROM eventos_sanitario
   WHERE fazenda_id = :fazenda_id;
   ```

   - ✅ 3 registros com `produto = 'Febre Aftosa'`
   - ✅ `evento_id` bate com `eventos.id`

#### 8. Validação na UI (Online)

1. **Navegue para `/animais`**
2. **Selecione um dos 3 animais** vacinados
3. **Vá em aba "Timeline"** (ou similar)
   - ✅ Evento sanitário aparece na linha do tempo
   - ✅ Data/hora corresponde ao registrado offline
   - ✅ Produto "Febre Aftosa" visível

### Validações Finais

- Gesto offline → Dexie (PENDING)
- Sync → Supabase (eventos + detalhes)
- UI reflete dados sincronizados (timeline atualizada)
- Sem duplicação de eventos (idempotência via client_op_id)

---

## Fluxo 3: Movimentação (Anti-Teleporte)

### Objetivo

Validar que a regra anti-teleporte funciona: UPDATE de `lote_id` sem evento de movimentação é rejeitado.

### Pré-requisitos

- Usuário autenticado com fazenda ativa
- Pelo menos 1 animal e 2 lotes cadastrados

### Passos

#### 1. Tentativa de "Teleporte" (Deve Falhar)

1. **Crie gesto** que atualiza `lote_id` **sem evento de movimentação**:

   ```typescript
   await createGesture(fazenda_id, [
     {
       table: "animais",
       action: "UPDATE",
       record: {
         id: animal_id,
         lote_id: novo_lote_id,
       },
     },
   ]);
   ```

2. **Aguarde sync**
   - ✅ Edge Function valida anti-teleport **ANTES** de aplicar qualquer op
   - ❌ Retorna `REJECTED` para TODAS as ops (atomicidade)

   ```json
   {
     "results": [
       {
         "op_id": "uuid",
         "status": "REJECTED",
         "reason_code": "ANTI_TELEPORTE",
         "reason_message": "UPDATE animais.lote_id sem evento base de movimentação no mesmo tx"
       }
     ]
   }
   ```

3. **Valide o rollback local**
   - ✅ Gesto vai para `status = "REJECTED"`
   - ✅ `rollbackOpLocal()` restaura `before_snapshot` do animal
   - ✅ UI mostra animal no **lote original** (rollback visual)
   - ✅ `queue_rejections` contém erro para notificar usuário

#### 2. Movimentação Correta (Deve Funcionar)

1. **Crie gesto** com evento completo:

   ```typescript
   const evento_id = crypto.randomUUID();
   await createGesture(fazenda_id, [
     {
       table: "eventos",
       action: "INSERT",
       record: {
         id: evento_id,
         dominio: "movimentacao",
         occurred_at: new Date().toISOString(),
         animal_id: animal_id,
       },
     },
     {
       table: "eventos_movimentacao",
       action: "INSERT",
       record: {
         evento_id: evento_id,
         from_lote_id: lote_antigo_id,
         to_lote_id: novo_lote_id,
       },
     },
     {
       table: "animais",
       action: "UPDATE",
       record: {
         id: animal_id,
         lote_id: novo_lote_id,
       },
     },
   ]);
   ```

2. **Valide aplicação otimista**
   - ✅ Dexie local mostra animal no **novo lote** imediatamente

3. **Aguarde sync**
   - ✅ Edge Function passa na validação anti-teleport
   - ✅ Todas as ops retornam `APPLIED`
   - ✅ Gesto vai para `status = "DONE"`

4. **Valide no servidor**

   ```sql
   SELECT * FROM animais WHERE id = :animal_id;
   ```

   - ✅ `lote_id` = novo_lote_id

   ```sql
   SELECT * FROM eventos WHERE id = :evento_id;
   ```

   - ✅ Evento de movimentação criado

   ```sql
   SELECT * FROM eventos_movimentacao WHERE evento_id = :evento_id;
   ```

   - ✅ Detalhe com `from_lote_id` e `to_lote_id` corretos

5. **Valide na UI**
   - **Detalhe do animal**: ✅ Lote atual = novo lote
   - **Timeline**: ✅ Evento de movimentação aparece

### Validações

- Teleporte direto (sem evento) → REJECTED + rollback
- Movimentação completa (evento base + detalhe + update) → APPLIED
- Atomicidade: Se uma op falha anti-teleport, TODAS falham

---

## Fluxo 4: Deduplicação de Agenda

### Objetivo

Validar que tarefas automáticas com mesmo `dedup_key` não duplicam.

### Pré-requisitos

- Usuário autenticado
- Protocolo sanitário configurado com `gera_agenda = true` e `dedup_template` preenchido

### Passos

#### 1. Criar Tarefa Agendada Manual (Baseline)

1. **Crie tarefa** via UI ou gesture:

   ```typescript
   await createGesture(fazenda_id, [
     {
       table: "agenda_itens",
       action: "INSERT",
       record: {
         id: crypto.randomUUID(),
         dominio: "sanitario",
         tipo: "vacinacao",
         status: "agendado",
         data_prevista: "2026-03-01",
         animal_id: animal_id,
         dedup_key: `${animal_id}:vacinacao:febre-aftosa:2026-03-01`,
         source_kind: "automatico",
       },
     },
   ]);
   ```

2. **Aguarde sync**
   - ✅ Tarefa criada no banco (`status = APPLIED`)

#### 2. Tentar Duplicar (Mesmo dedup_key)

1. **Crie tarefa idêntica** (mesmo dedup_key):

   ```typescript
   await createGesture(fazenda_id, [
     {
       table: "agenda_itens",
       action: "INSERT",
       record: {
         id: crypto.randomUUID(), // ID diferente
         dominio: "sanitario",
         tipo: "vacinacao",
         status: "agendado",
         data_prevista: "2026-03-01",
         animal_id: animal_id,
         dedup_key: `${animal_id}:vacinacao:febre-aftosa:2026-03-01`, // MESMO dedup_key
         source_kind: "automatico",
       },
     },
   ]);
   ```

2. **Aguarde sync**
   - ✅ Postgres detecta unique constraint violation (ux_agenda_dedup_active)
   - ✅ Edge Function captura erro `23505`
   - ✅ Retorna `APPLIED_ALTERED` (colisão de dedup, não é erro)

   ```json
   {
     "op_id": "uuid",
     "status": "APPLIED_ALTERED",
     "altered": { "dedup": "collision_noop" }
   }
   ```

3. **Valide banco**

   ```sql
   SELECT COUNT(*) FROM agenda_itens
   WHERE fazenda_id = :fazenda_id
     AND dedup_key = :dedup_key
     AND status = 'agendado'
     AND deleted_at IS NULL;
   ```

   - ✅ Count = 1 (não duplicou)

4. **Valide Dexie local**
   - ✅ Gesto vai para `status = "DONE"` (APPLIED_ALTERED conta como sucesso)
   - ✅ UI mostra apenas 1 tarefa (sem duplicata)

#### 3. Concluir Tarefa e Re-Agendar (Deve Permitir)

1. **Conclua a tarefa** existente:

   ```typescript
   await createGesture(fazenda_id, [
     {
       table: "agenda_itens",
       action: "UPDATE",
       record: {
         id: tarefa_id,
         status: "concluido",
       },
     },
   ]);
   ```

   - ✅ Banco atualiza `status = 'concluido'`

2. **Crie nova tarefa** com MESMO dedup_key:

   ```typescript
   await createGesture(fazenda_id, [
     {
       table: "agenda_itens",
       action: "INSERT",
       record: {
         id: crypto.randomUUID(),
         dedup_key: `${animal_id}:vacinacao:febre-aftosa:2026-04-01`, // MESMO dedup_key
         status: "agendado",
       },
     },
   ]);
   ```

3. **Valide criação**
   - ✅ Unique index **NÃO bloqueia** (tarefa anterior tem `status = 'concluido'`, não 'agendado')
   - ✅ Nova tarefa criada com sucesso (`status = APPLIED`)

### Validações

- Dedup impede múltiplas tarefas `agendado` com mesmo `dedup_key`
- Colisão retorna `APPLIED_ALTERED`, não `REJECTED`
- Após conclusão (`status != 'agendado'`), dedup não bloqueia nova tarefa

---

## Fluxo 5: Criação de Fazenda + Bootstrap Owner

### Objetivo

Validar que RPC `create_fazenda` cria fazenda, membership owner, e define como ativa.

### Pré-requisitos

- Usuário autenticado (mas sem fazenda ativa)

### Passos

1. **Chame RPC create_fazenda**

   ```typescript
   const { data: fazenda_id, error } = await supabase.rpc("create_fazenda", {
     _nome: "Fazenda Teste E2E",
     _codigo: "FTE-001",
     _municipio: "São Paulo",
   });
   ```

2. **Valide retorno**
   - ✅ `fazenda_id` (UUID) retornado
   - ✅ Sem erro

3. **Verifique tabela `fazendas`**

   ```sql
   SELECT * FROM fazendas WHERE id = :fazenda_id;
   ```

   - ✅ Registro existe
   - ✅ `nome = 'Fazenda Teste E2E'`
   - ✅ `created_by = auth.uid()`

4. **Verifique tabela `user_fazendas`**

   ```sql
   SELECT * FROM user_fazendas
   WHERE fazenda_id = :fazenda_id
     AND user_id = auth.uid();
   ```

   - ✅ Membership criado
   - ✅ `role = 'owner'`
   - ✅ `is_primary = true`
   - ✅ `accepted_at IS NOT NULL`

5. **Verifique `user_settings.active_fazenda_id`**

   ```sql
   SELECT active_fazenda_id FROM user_settings WHERE user_id = auth.uid();
   ```

   - ✅ `active_fazenda_id = fazenda_id` (nova fazenda setada como ativa)

6. **Valide redirect na UI**
   - ✅ Sistema detecta `active_fazenda_id` preenchido
   - ✅ Redireciona para `/home` (sem passar por `/select-fazenda`)

### Validações

- Fazenda criada com sucesso
- Owner bootstrap automático
- Fazenda setada como ativa automaticamente
- UX fluida (sem passos manuais extras)

---

## Fluxo 6: Hardening de Eventos (Fase 2)

### Objetivo

Validar constraints e reason codes padronizados apos migracoes 0023 a 0026.

### Passos

1. **Financeiro com valor invalido**
   - Enviar `eventos_financeiro.valor_total <= 0`.
   - Esperado: `REJECTED` com `reason_code = VALIDATION_FINANCEIRO_VALOR_TOTAL`.

2. **Nutricao com quantidade invalida**
   - Enviar `eventos_nutricao.quantidade_kg <= 0` quando preenchida.
   - Esperado: `REJECTED` com `reason_code = VALIDATION_NUTRICAO_QUANTIDADE`.

3. **Movimentacao sem destino**
   - Enviar `eventos_movimentacao` sem `to_lote_id` e sem `to_pasto_id`.
   - Esperado: `REJECTED` com `reason_code = VALIDATION_MOVIMENTACAO_DESTINO`.

4. **Movimentacao com origem igual destino**
   - Enviar `from_lote_id = to_lote_id` (ou `from_pasto_id = to_pasto_id`).
   - Esperado: `REJECTED` com `reason_code = VALIDATION_MOVIMENTACAO_ORIGEM_DESTINO`.

5. **Financeiro com contraparte de outra fazenda**
   - Enviar `eventos_financeiro` com `contraparte_id` de tenant diferente.
   - Esperado: `REJECTED` com `reason_code = VALIDATION_FINANCEIRO_CONTRAPARTE`.

6. **PK ausente em UPDATE/DELETE**
   - Enviar operacao de `UPDATE` ou `DELETE` sem `id`/`evento_id`.
   - Esperado: `REJECTED` com `reason_code = VALIDATION_MISSING_PRIMARY_KEY`.

### Validacoes

- Todas as rejeicoes retornam `op_id`, `reason_code`, `reason_message`.
- Fluxos validos continuam com `APPLIED` ou `APPLIED_ALTERED`.

---

## Fluxo 7: Rollout Operacional (Fase 4)

### Objetivo

Validar feature flags por fazenda e monitoracao operacional no dashboard.

### Passos

1. **Abrir `/editar-fazenda` como owner**
   - Alterar `Regras estritas` e `Anti-teleporte estrito`.
   - Salvar.

2. **Validar persistencia das flags**
   ```sql
   select id, metadata -> 'eventos_rollout' as eventos_rollout
   from public.fazendas
   where id = :fazenda_id;
   ```
   - Esperado: flags salvas no JSON `metadata.eventos_rollout`.

3. **Executar um gesto que seria bloqueado por anti-teleporte**
   - Com `strict_anti_teleporte=true`: esperado `REJECTED` com `ANTI_TELEPORTE`.
   - Com `strict_anti_teleporte=false`: esperado sem rejeicao de prevalidacao.

4. **Abrir `/dashboard`**
   - Validar cards operacionais:
     - taxa de sucesso do sync
     - backlog de sync
     - taxa global de rejeicao
   - Validar visualizacoes:
     - rejeicoes por dominio
     - rejeicoes por regra

### Validacoes

1. Feature flag altera comportamento do `sync-batch` por fazenda.
2. Dashboard reflete dados de `queue_gestures` e `queue_rejections`.
3. Operacao consegue identificar rapidamente degradacao e acionar rollback.

---

## Notas Gerais

### Ferramentas para Validação

- **Dexie DevTools**: Inspecionar stores offline (chrome://extensions → Dexie Database Explorer)
- **Supabase Dashboard**: Validar dados no servidor (SQL Editor, Table Editor)
- **Network Tab**: Monitorar requisições sync-batch (payload, response, headers)
- **Console Logs**: `[sync-worker]` logs mostram status de sync

### Cenários Cobertos Recentemente

- **Invite System**: Implementado com fluxo de convite e aceite em `/invites/:token`.
- **Trocar Fazenda Ativa**: UI implementada em `/select-fazenda`.
- **Perfil do Usuário e Preferências**: Implementado em `/perfil` (dados de perfil e settings).
- **Logoff**: Implementado com limpeza de sessão/localStorage no fluxo de autenticação.

### Cenários Ainda Não Cobertos (Pendências)

- **Reconciliação Manual**: Expandir cobertura E2E da tela `/reconciliacao` para resolução assistida de conflitos.
