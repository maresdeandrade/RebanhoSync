# Row Level Security (RLS) & Roles

O sistema utiliza RLS do Supabase para garantir que usuários acessem apenas dados de fazendas onde possuem membership ativo.

## Princípio Central: Isolamento por fazenda_id + membership

Todas as policies verificam que:

1. O usuário está **autenticado** (`auth.uid()` não é null)
2. O usuário tem **membership ativo** na fazenda via `has_membership(fazenda_id)`
3. O usuário tem o **role adequado** para a operação (via `role_in_fazenda(fazenda_id)`)

---

## Roles (Papéis)

### 1. **Cowboy** (Operador de Campo)

- **Leitura**: Tudo da fazenda (animais, lotes, pastos, agenda, eventos)
- **Escrita**:
  - ✅ Inserir eventos (sanitário, pesagem, movimentação, etc.)
  - ✅ Atualizar status de agenda (concluir tarefas)
  - ✅ Criar/editar/deletar animais
- **Restrições**:
  - ❌ Não pode criar/editar lotes, pastos, protocolos
  - ❌ Não pode gerenciar membros

### 2. **Manager** (Gestor da Fazenda)

- **Leitura**: Tudo (herda do Cowboy)
- **Escrita**:
  - ✅ Todas as permissões do Cowboy
  - ✅ Criar/editar/deletar lotes, pastos, protocolos, contrapartes
- **Restrições**:
  - ❌ Não pode alterar role de owner (promover/rebaixar)
  - ❌ Não pode remover membros

### 3. **Owner** (Dono da Conta)

- **Leitura**: Tudo (herda do Manager)
- **Escrita**:
  - ✅ Todas as permissões do Manager
  - ✅ Gerenciar membros (adicionar, alterar role, remover) via RPC
  - ✅ Editar/deletar a fazenda
- **Restrições**:
  - ❌ Não pode remover o último owner (safeguard)

---

## Funções Helper

### has_membership(\_fazenda_id uuid)

Verifica se o usuário autenticado tem membership **ativo** na fazenda.

```sql
CREATE FUNCTION has_membership(_fazenda_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_fazendas uf
    WHERE uf.user_id = auth.uid()
      AND uf.fazenda_id = _fazenda_id
      AND uf.deleted_at IS NULL
  );
$$;
```

**Uso em policies**:

```sql
USING (has_membership(fazenda_id))
```

---

### role_in_fazenda(\_fazenda_id uuid)

Retorna o role do usuário na fazenda (ou `NULL` se não for membro).

```sql
CREATE FUNCTION role_in_fazenda(_fazenda_id uuid)
RETURNS farm_role_enum LANGUAGE sql STABLE AS $$
  SELECT uf.role
  FROM user_fazendas uf
  WHERE uf.user_id = auth.uid()
    AND uf.fazenda_id = _fazenda_id
    AND uf.deleted_at IS NULL
  LIMIT 1;
$$;
```

**Uso em policies**:

```sql
WITH CHECK (role_in_fazenda(fazenda_id) IN ('owner', 'manager'))
```

---

## Matriz de Policies por Tabela

### Tenant & Auth

#### user_profiles

- **SELECT/INSERT/UPDATE/DELETE**: Somente para si mesmo

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

#### user_settings

- **SELECT/INSERT/UPDATE/DELETE**: Somente para si mesmo

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

#### fazendas

- **SELECT**: Por membership

```sql
USING (has_membership(id))
```

- **INSERT**: Criador deve ser o usuário autenticado

```sql
WITH CHECK (created_by = auth.uid())
```

- **UPDATE/DELETE**: Owner only

```sql
USING (has_membership(id) AND role_in_fazenda(id) = 'owner')
WITH CHECK (has_membership(id) AND role_in_fazenda(id) = 'owner')
```

#### user_fazendas ⚠️ **SELECT-ONLY**

- **SELECT**: Somente membros da mesma fazenda ou próprio user_id

```sql
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR fazenda_id IN (
      SELECT uf2.fazenda_id
      FROM user_fazendas uf2
      WHERE uf2.user_id = auth.uid()
        AND uf2.deleted_at IS NULL
    )
  )
)
```

- **INSERT/UPDATE/DELETE**: ❌ **BLOQUEADO** pela ausência de policies
  - Membership **só pode ser alterado via RPCs** `security definer`:
    - `create_fazenda()` - cria owner inicial
    - `admin_set_member_role()` - altera role
    - `admin_remove_member()` - soft delete

---

### State (Estado Atual)

#### pastos

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: Owner/Manager only

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (
  has_membership(fazenda_id)
  AND role_in_fazenda(fazenda_id) IN ('owner', 'manager')
)
```

#### lotes

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: Owner/Manager only

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (
  has_membership(fazenda_id)
  AND role_in_fazenda(fazenda_id) IN ('owner', 'manager')
)
```

#### animais

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: **Qualquer membro** (Cowboy pode criar/editar animais)

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (has_membership(fazenda_id))
```

#### contrapartes

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: Owner/Manager only

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (
  has_membership(fazenda_id)
  AND role_in_fazenda(fazenda_id) IN ('owner', 'manager')
)
```

#### protocolos_sanitarios

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: Owner/Manager only

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (
  has_membership(fazenda_id)
  AND role_in_fazenda(fazenda_id) IN ('owner', 'manager')
)
```

#### protocolos_sanitarios_itens

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: Owner/Manager only

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (
  has_membership(fazenda_id)
  AND role_in_fazenda(fazenda_id) IN ('owner', 'manager')
)
```

---

### Agenda (Mutável)

#### agenda_itens

- **SELECT**: Por membership
- **INSERT/UPDATE/DELETE**: **Qualquer membro**

```sql
-- Select
USING (has_membership(fazenda_id))

-- Write
WITH CHECK (has_membership(fazenda_id))
```

---

### Eventos (Append-Only)

#### eventos

- **SELECT**: Por membership
- **INSERT**: **Qualquer membro**
- **UPDATE/DELETE**: ❌ **Bloqueado por trigger** (`prevent_business_update`)

```sql
-- Select
USING (has_membership(fazenda_id))

-- Insert
WITH CHECK (has_membership(fazenda_id))
```

#### eventos\_\* (todos os detalhes)

Aplicam-se as mesmas policies para:

- `eventos_sanitario`
- `eventos_pesagem`
- `eventos_nutricao`
- `eventos_movimentacao`
- `eventos_reproducao`
- `eventos_financeiro`

```sql
-- Select
USING (has_membership(fazenda_id))

-- Insert
WITH CHECK (has_membership(fazenda_id))
```

**Nota**: Triggers `prevent_business_update` bloqueiam UPDATE de colunas de negócio.

---

## RPCs Security Definer

Membership management é **exclusivo via RPC** (não permite INSERT/UPDATE/DELETE direto via API).

### Por que Security Definer?

- RLS **não pode validar lógica complexa** (ex: "não remover último owner")
- RPCs executam com permissões elevadas (`SET row_security = OFF`)
- Validam regras de negócio **antes** de executar a operação

---

### admin_set_member_role(fazenda_id, target_user_id, new_role)

#### Permissões

| Caller Role | Pode alterar Owner? | Pode promover para Owner? |
| ----------- | ------------------- | ------------------------- |
| **owner**   | ✅ Sim              | ✅ Sim                    |
| **manager** | ❌ Não              | ❌ Não                    |
| **cowboy**  | ❌ Acesso negado    | ❌ Acesso negado          |

#### Safeguards

1. ❌ Manager **não pode** alterar role de owner (nem promover nem rebaixar)
2. ❌ Apenas owner pode **promover** para owner
3. ❌ **Não pode rebaixar o último owner** da fazenda
   ```sql
   IF _current_role = 'owner' AND _new_role <> 'owner' THEN
     SELECT count(*) INTO _owner_count
     FROM user_fazendas
     WHERE fazenda_id = _fazenda_id
       AND role = 'owner'
       AND deleted_at IS NULL;

     IF _owner_count = 1 THEN
       RAISE EXCEPTION 'Cannot demote the last owner';
     END IF;
   END IF;
   ```

#### Exemplo

```sql
-- Owner promove manager para owner
SELECT admin_set_member_role(
  'uuid-da-fazenda',
  'uuid-do-manager',
  'owner'
);

-- Manager rebaixa cowboy para... nada (ERROR: manager só mexe em não-owners)
```

---

### admin_remove_member(fazenda_id, target_user_id)

#### Permissões

- **owner only** (manager e cowboy não podem remover)

#### Safeguards

1. ❌ **Não pode remover o último owner** da fazenda

   ```sql
   IF _target_role = 'owner' THEN
     SELECT count(*) INTO _owner_count
     FROM user_fazendas
     WHERE fazenda_id = _fazenda_id
       AND role = 'owner'
       AND deleted_at IS NULL;

     IF _owner_count = 1 THEN
       RAISE EXCEPTION 'Cannot remove the last owner';
     END IF;
   END IF;
   ```

2. Usa **soft delete** (deleted_at = now())
   - Membership não é destruído permanentemente
   - Pode ser "ressuscitado" via `admin_set_member_role` (reseta deleted_at)

#### Exemplo

```sql
-- Owner remove um manager
SELECT admin_remove_member(
  'uuid-da-fazenda',
  'uuid-do-manager'
);

-- Tentar remover o último owner (ERROR)
SELECT admin_remove_member(
  'uuid-da-fazenda',
  'uuid-do-unico-owner'
); -- EXCEPTION: Cannot remove the last owner
```

---

## Funcionamento das Policies (Resumo)

### Leitura (SELECT)

Baseada na função `has_membership(fazenda_id)`. Se o `auth.uid()` não estiver na tabela `user_fazendas` para aquela fazenda, o acesso é **negado**.

### Escrita em State

- **Pastos, Lotes, Contrapartes, Protocolos**: Restrita a `role IN ('owner', 'manager')`
- **Animais, Agenda**: Permitida para **todos os membros ativos**

### Escrita em Eventos

- **INSERT**: Permitida para **todos os membros ativos**
- **UPDATE/DELETE**: **Bloqueada por trigger** (append-only)

### Membership (user_fazendas)

- **SELECT**: Permitido para membros da mesma fazenda
- **INSERT/UPDATE/DELETE**: **Bloqueado** pela ausência de policies
  - Alterações **devem ser feitas via RPC** `admin_set_member_role` ou `admin_remove_member` (Security Definer)
  - Validam safeguards (não remover/rebaixar último owner, manager não altera owner)

---

## Segurança em Camadas

### Camada 1: JWT (Autenticação)

- Edge Function `sync-batch` valida JWT antes de qualquer operação
- 401 Unauthorized se JWT ausente ou inválido

### Camada 2: Membership (Autorização)

- Edge Function valida que `user_id` tem membership ativo em `fazenda_id`
- 403 Forbidden se não for membro

### Camada 3: RLS Policies (Controle Fino)

- Postgres aplica policies baseadas em role
- Owner/Manager/Cowboy têm permissões diferentes

### Camada 4: RPCs Security Definer (Regras de Negócio)

- Validam lógica complexa (não remover último owner)
- Protegem operações críticas (membership management)

---

## Auditoria e Rastreabilidade

Todas as tabelas incluem:

- `client_id`: Identifica o dispositivo/origem
- `client_op_id`: Idempotência (UUID único da operação)
- `client_tx_id`: Agrupa operações em gestos
- `client_recorded_at`: Timestamp de quando o usuário fez a ação
- `server_received_at`: Timestamp de quando o servidor recebeu
- `created_at` / `updated_at`: Auditoria de modificações

Com RLS, esses metadados permitem rastrear **quem** (auth.uid), **quando**, **de onde** (client_id) e **qual fazenda** (fazenda_id) fez cada operação.
