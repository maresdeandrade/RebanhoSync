# Auditoria de Isolamento Multi-Tenant (RebanhoSync)

**Data:** 2026-02-08
**Auditor:** Jules (AI)
**Contexto:** Revisão completa da arquitetura multi-tenant para garantir isolamento estrito por fazenda (`fazenda_id`).

---

## 1. Identificação do Tenant Key

O sistema utiliza **`fazenda_id`** (UUID) como chave primária de tenant em todas as tabelas de dados.

- **Tabela Raiz:** `public.fazendas` (ID do tenant).
- **Tabela de Associação:** `public.user_fazendas` (Mapeia `user_id` -> `fazenda_id` com roles).
- **Propagação:** Todas as tabelas de estado (`animais`, `lotes`, `pastos`, etc.) e eventos (`eventos`, `agenda_itens`) possuem a coluna `fazenda_id` obrigatória (NOT NULL).

## 2. Auditoria de Schema (Banco de Dados)

### Constraints e Índices
A maioria das tabelas críticas possui um índice único composto `(id, fazenda_id)` ou `(dedup_key, fazenda_id)`, o que reforça a integridade e performance das queries filtradas por tenant.

| Tabela | Coluna Tenant | FKs Tenant-Aware | Índice Único Tenant | Status |
| :--- | :--- | :--- | :--- | :--- |
| `fazendas` | `id` (PK) | N/A | `PK` | ✅ Seguro |
| `user_fazendas` | `fazenda_id` | ✅ FK `fazendas(id)` | `(user_id, fazenda_id)` | ✅ Seguro |
| `pastos` | `fazenda_id` | ✅ FK `fazendas(id)` | `(id, fazenda_id)` | ✅ Seguro |
| `lotes` | `fazenda_id` | ✅ FK `pastos(id, fazenda_id)` | `(id, fazenda_id)` | ✅ Seguro |
| `animais` | `fazenda_id` | ✅ FK `lotes(id, fazenda_id)` | `(id, fazenda_id)` | ✅ Seguro |
| `eventos` | `fazenda_id` | ✅ FK `animais(id, fazenda_id)` | `(id, fazenda_id)` | ✅ Seguro |
| `agenda_itens` | `fazenda_id` | ✅ FK `animais(id, fazenda_id)` | `(dedup_key, fazenda_id)` | ✅ Seguro |
| `contrapartes` | `fazenda_id` | ✅ FK `fazendas(id)` | `(id, fazenda_id)` | ✅ Seguro |
| `protocolos_sanitarios`| `fazenda_id` | ✅ FK `fazendas(id)` | `(id, fazenda_id)` | ✅ Seguro |
| `animais_sociedade` | `fazenda_id` | ✅ FK `animais(id, fazenda_id)` | `(fazenda_id, animal_id)` | ✅ Seguro |

**Destaque Positivo:** As Foreign Keys (FKs) compostas (ex: `fk_animais_lote` referenciando `lotes(id, fazenda_id)`) garantem matematicamente que um animal não pode pertencer a um lote de outra fazenda.

### RLS (Row Level Security)

As políticas de segurança foram auditadas nas migrações `0001_init.sql`, `0004_rls_hardening.sql`, `0019` e `0020`.

- **Padrão Encontrado:** `USING (public.has_membership(fazenda_id))`
- **Função Helper:** `public.has_membership(_fazenda_id)` verifica a tabela `user_fazendas` para o usuário autenticado (`auth.uid()`).
- **Cobertura:** TODAS as tabelas de dados possuem RLS habilitado e policies restritivas.
- **Escrita:** Policies de `INSERT`/`UPDATE` também exigem membership (e.g., `WITH CHECK (public.has_membership(fazenda_id))`).

## 3. Auditoria de Aplicação (Backend / Edge Functions)

### `sync-batch` (Supabase Edge Function)
O endpoint principal de sincronização (`supabase/functions/sync-batch/index.ts`) implementa camadas de defesa em profundidade:

1.  **Validação JWT Manual:** Garante que o usuário é quem diz ser.
2.  **Contexto RLS:** Cria cliente Supabase com o token do usuário, forçando as regras de banco.
3.  **Verificação Explícita de Membership:** Consulta `user_fazendas` antes de processar qualquer operação do lote.
4.  **Força Bruta de Tenant ID:** Sobrescreve `record.fazenda_id` com o ID validado do request, impedindo injeção de dados em outros tenants via payload malicioso.
5.  **Bloqueio de Tabelas Sensíveis:** Impede escrita direta em `user_profiles`, `user_settings` e `user_fazendas`.

### `create_fazenda` (RPC)
As funções `create_fazenda` (versões em `0003` e `0017`) são `SECURITY DEFINER` mas operam de forma segura:
- Criam a fazenda.
- Inserem o usuário criador como `owner`.
- Retornam o ID gerado.
- Não aceitam ID arbitrário de fora.

## 4. Auditoria de Aplicação (Frontend)

### `pull.ts`
- Utiliza `supabase.from(...).select('*').eq('fazenda_id', fazenda_id)`.
- Mesmo se o filtro falhasse no cliente, o RLS no servidor retornaria 0 linhas para fazendas não autorizadas.

### `syncWorker.ts`
- Envia o `fazenda_id` no corpo do request para o `sync-batch`.
- O servidor valida esse ID contra o token do usuário.

## 5. Conclusão

O sistema apresenta um nível **Excelente** de isolamento multi-tenant.
- **Não foram encontradas vulnerabilidades de vazamento de dados entre fazendas (Cross-Tenant Leak).**
- A arquitetura "Two Rails" combinada com FKs compostas e RLS estrito cria uma defesa robusta.
- As Edge Functions agem como gatekeepers adicionais, validando lógica de negócio e tenant antes de tocar no banco.

**Nenhuma ação corretiva é necessária no momento.**
