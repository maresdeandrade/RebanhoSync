# Debug Guide - Onboarding Issues

## Como Debugar os Problemas Reportados

### 1. Abra o Developer Tools do Browser

- Pressione `F12` ou `Ctrl+Shift+I`
- Vá para a aba **Console**

### 2. Limpe o Console

- Clique no ícone 🚫 (clear) no console

### 3. Execute os Testes e Observe os Logs

---

## SCENARIO 2: Botão "Criar Fazenda" não aparece

### Passos:

1. Faça login com o usuário que tem `can_create_farm=true`
2. Vá para `/select-fazenda`
3. **Observe o console** - você verá logs assim:

```
[SelectFazenda] Checking can_create_farm for user: <user-id>
[SelectFazenda] ✅ can_create_farm RPC returned: <valor>
[SelectFazenda] Type of data: <tipo>
[SelectFazenda] Setting canCreateFarm to: <true/false>
```

### O que verificar:

- **Se `can_create_farm RPC returned: false`**
  → O problema está no banco de dados
  → Execute a query #11 do `debug_onboarding.sql`:

  ```sql
  SELECT
    (SELECT can_create_farm FROM public.user_profiles WHERE user_id = auth.uid()) as can_create_farm_flag,
    public.can_create_farm() as can_create_farm_function,
    (SELECT COUNT(*) FROM public.user_fazendas WHERE user_id = auth.uid() AND role = 'owner' AND deleted_at IS NULL) as owner_count;
  ```

  - `can_create_farm_flag` deve ser `true` OU `owner_count` deve ser > 0
  - Se ambos forem falsos, o usuário não tem permissão

- **Se retornou `true` mas botão não aparece**
  → Problema no React/UI
  → Verifique se `canCreateFarm` state está sendo setado corretamente

---

## SCENARIO 3: Novo usuário não vê fazenda após aceitar convite

### Passos:

1. Crie novo usuário (signup)
2. Aceite um convite
3. Vá para `/select-fazenda`
4. **Observe o console do acceptInvite**:

```
[AcceptInvite] Accepting invite: <token>
[AcceptInvite] Invite accepted, fazenda: <fazenda-id>
```

5. **No Supabase SQL Editor**, execute (após logar como o novo usuário):

```sql
-- Verifica se membership foi criado
SELECT uf.user_id, uf.fazenda_id, uf.role, f.nome
FROM public.user_fazendas uf
JOIN public.fazendas f ON f.id = uf.fazenda_id
WHERE uf.user_id = auth.uid()
  AND uf.deleted_at IS NULL;
```

### Possíveis causas:

- Membership não foi criado → problema no `accept_invite` RPC
- Membership criado mas não visível → problema RLS
- Frontend não está buscando corretamente

---

## SCENARIO 4: Owner não consegue criar segunda fazenda

### Passos:

1. Login como owner de uma fazenda
2. Vá para `/criar-fazenda`
3. **Observe o console**:

```
[CriarFazenda] Checking permission for user: <user-id>
[CriarFazenda] ✅ can_create_farm RPC returned: <valor>
[CriarFazenda] Permission result: ALLOWED/DENIED
```

### Se mostrar "DENIED":

Execute no SQL Editor:

```sql
-- Verifica se é owner
SELECT
  uf.fazenda_id,
  uf.role,
  f.nome,
  public.can_create_farm() as can_create
FROM public.user_fazendas uf
JOIN public.fazendas f ON f.id = uf.fazenda_id
WHERE uf.user_id = auth.uid()
  AND uf.deleted_at IS NULL;
```

### Deve mostrar:

- Pelo menos uma linha com `role = 'owner'`
- `can_create = true`

Se `can_create = false`, há problema na função `can_create_farm()`.

---

## SCENARIO Membros: Só vê próprio usuário

### Diagnóstico rápido:

No SQL Editor, execute:

```sql
-- Lista TODOS os membros da fazenda ativa
WITH active_farm AS (
  SELECT active_fazenda_id
  FROM public.user_settings
  WHERE user_id = auth.uid()
)
SELECT
  uf.user_id,
  uf.role,
  up.display_name,
  up.email
FROM public.user_fazendas uf
JOIN public.user_profiles up ON up.user_id = uf.user_id
CROSS JOIN active_farm af
WHERE uf.fazenda_id = af.active_fazenda_id
  AND uf.deleted_at IS NULL;
```

### Se a query acima retorna TODOS os membros:

→ Problema no frontend (`AdminMembros.tsx`)
→ A query do frontend usa `!inner` que pode estar filtrando

### Se a query acima retorna SÓ VOCÊ:

→ Problema RLS nos outros user_profiles
→ Verificar políticas de `user_profiles`

---

## Próximos Passos

1. **Execute os testes com o console aberto**
2. **Copie os logs do console** e me envie
3. **Execute as queries SQL** relevantes e me envie os resultados

Com essas informações, posso identificar exatamente onde está o problema!
