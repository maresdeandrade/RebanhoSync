# Row Level Security (RLS) & Modelo de Segurança

Este documento descreve o modelo de segurança **REAL** implementado no sistema, baseado nas migrações e invariants de arquitetura. O sistema utiliza uma estratégia "Defense in Depth" combinando RLS, Stored Procedures (RPCs) e validações em triggers.

## 1. Princípios de Segurança

O modelo de segurança é construído sobre três pilares:

1.  **Isolamento Absoluto (Tenancy)**: Dados de uma fazenda são invisíveis para outras.
2.  **Least Privilege (RBAC)**: Cowboys operam, Managers gerenciam recursos, Owners gerenciam o negócio.
3.  **Integridade (Append-Only)**: Histórico de eventos é imutável via triggers de banco.

---

## 2. Tenancy e Isolamento

O sistema é multi-tenant lógico, onde todos os dados residem nas mesmas tabelas, segregados pela coluna `fazenda_id`.

### Enforcement
1.  **RLS Obrigatório**: Todas as tabelas de tenant possuem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
2.  **Policies de Leitura**: Todo `SELECT` exige `has_membership(fazenda_id)`.
3.  **Chaves Estrangeiras Compostas**:
    Para evitar ataques de "referência cruzada" (ex: associar um animal da Fazenda A a um lote da Fazenda B), todas as FKs internas incluem `fazenda_id`.
    ```sql
    -- Exemplo real (tabela animais)
    CONSTRAINT fk_animais_lote
      FOREIGN KEY (lote_id, fazenda_id)
      REFERENCES lotes (id, fazenda_id)
    ```
    Isso garante que a integridade referencial só é válida dentro do mesmo tenant.

---

## 3. Helpers de Segurança

Funções SQL estáveis utilizadas em todas as policies para verificar permissões.

### `public.has_membership(_fazenda_id uuid) -> boolean`
Verifica se o usuário atual (`auth.uid()`) possui um registro ativo em `user_fazendas` para a fazenda informada.
- **Uso**: Policies de `SELECT` e `INSERT` básico.

### `public.role_in_fazenda(_fazenda_id uuid) -> farm_role_enum`
Retorna o papel (`cowboy`, `manager`, `owner`) do usuário na fazenda.
- **Uso**: Policies de escrita (`INSERT`/`UPDATE`/`DELETE`) para restringir operações administrativas.

---

## 4. Matriz RBAC Real

Permissões baseadas nos roles definidos em `farm_role_enum`.

| Funcionalidade | Cowboy | Manager | Owner | Notas |
| :--- | :---: | :---: | :---: | :--- |
| **Leitura (Geral)** | ✅ | ✅ | ✅ | Ver dados da fazenda |
| **Animais** (C/R/U/D) | ✅ | ✅ | ✅ | Operacional dia-a-dia |
| **Agenda** (C/R/U/D) | ✅ | ✅ | ✅ | Concluir tarefas |
| **Eventos** (Insert) | ✅ | ✅ | ✅ | Registrar manejo |
| **Eventos** (Update/Del) | ❌ | ❌ | ❌ | **Bloqueado por Trigger** (Append-Only) |
| **Recursos** (Pastos/Lotes) | ❌ | ✅ | ✅ | Gestão estrutural |
| **Cadastros** (Protocolos/Contrapartes) | ❌ | ✅ | ✅ | Gestão sanitária/financeira |
| **Fazenda** (Update Metadata) | ❌ | ❌ | ✅ | Editar nome/cidade |
| **Membros** (Gerenciar) | ❌ | ⚠️ | ✅ | Manager não toca em Owners |

**Legenda**:
- ✅ Permitido
- ❌ Negado (RLS Policy ou Trigger)
- ⚠️ Parcial (Manager pode gerenciar Cowboy/Manager, mas não Owner)

---

## 5. Policies por Categoria

### A. State Tables (`pastos`, `lotes`, `contrapartes`, `protocolos_*`)
Dados estruturais da fazenda.
- **SELECT**: `has_membership(fazenda_id)`
- **INSERT/UPDATE/DELETE**: `role_in_fazenda(fazenda_id) IN ('owner', 'manager')`
  - *Manager e Owner têm controle total.*
  - *Cowboy tem apenas leitura.*

### B. Eventos (`eventos`, `eventos_*`)
Histórico imutável de fatos ocorridos (`eventos_sanitario`, `eventos_pesagem`, etc.).
- **SELECT**: `has_membership(fazenda_id)`
- **INSERT**: `has_membership(fazenda_id)` (Todos podem registrar fatos)
- **UPDATE/DELETE**: **BLOQUEADO**
  - Trigger `prevent_business_update` impede alterações em colunas de negócio, permitindo apenas soft-delete (`deleted_at`) e metadados de sync.

### C. Agenda (`agenda_itens`)
Planejamento futuro (mutável).
- **SELECT**: `has_membership(fazenda_id)`
- **INSERT/UPDATE/DELETE**: `has_membership(fazenda_id)`
  - *Todos podem criar e concluir tarefas.*

### D. Admin Tables (`fazendas`, `user_profiles`, `user_settings`)
Tabelas de nível superior ou configurações de usuário.
- **`fazendas`**:
  - SELECT: `has_membership(id)`
  - INSERT: `created_by = auth.uid()`
  - UPDATE/DELETE: `role_in_fazenda(id) = 'owner'`
- **`user_profiles`** / **`user_settings`**:
  - ALL: `user_id = auth.uid()` (Isolamento total por usuário)

### E. Membership (`user_fazendas`)
Tabela crítica de associação Usuário <-> Fazenda.
- **SELECT**:
  ```sql
  user_id = auth.uid() OR has_membership(fazenda_id)
  ```
  *(Permite ver a si mesmo ou membros das fazendas que participo)*
- **INSERT/UPDATE/DELETE**: **NENHUMA POLICY PERMISSIVA**
  - Operações de escrita são **exclusivas via RPCs** (`SECURITY DEFINER`).
  - Isso impede manipulação direta da tabela via API, forçando as regras de negócio dos RPCs.

---

## 6. RPCs de Administração (Security Definer)

Funções privilegiadas que executam com permissões de superusuário para aplicar regras de negócio complexas que o RLS não cobre. Todas definem `search_path = public` para segurança.

### `create_fazenda(nome, ...)`
- **Permissão**: Usuário autenticado com `can_create_farm()` (flag de profile ou já sendo owner).
- **Ação**:
  1. Cria registro em `fazendas`.
  2. Cria registro em `user_fazendas` como **Owner** (Primary).
  3. Atualiza `user_settings.active_fazenda_id`.

### `admin_set_member_role(fazenda_id, target_user_id, new_role)`
- **Permissão**: Owner (total) ou Manager (parcial).
- **Safeguards (Regras de Negócio)**:
  1. **Manager Protection**: Manager não pode alterar role de um Owner.
  2. **Last Owner Protection**: Não permite rebaixar o último Owner da fazenda.
  3. **Promotion Restriction**: Apenas Owner pode promover alguém a Owner.

### `admin_remove_member(fazenda_id, target_user_id)`
- **Permissão**: **Owner Only**.
- **Safeguards**:
  1. **Last Owner Protection**: Não permite remover o último Owner.
  2. Executa soft-delete (`deleted_at = now()`).

---

## 7. Vetores Mitigados

### Cross-Tenant Access
- **Risco**: Usuário A acessar dados da Fazenda B.
- **Mitigação**: Todas as policies exigem `has_membership(fazenda_id)`. Composite FKs impedem relacionamentos mistos.

### Privilege Escalation
- **Risco**: Manager se promover a Owner ou Cowboy alterar permissões.
- **Mitigação**: Tabela `user_fazendas` não tem permissão de escrita direta (RLS). RPCs `admin_*` validam explicitamente o role do caller (`auth.uid()`) antes de executar. Campo `can_create_farm` em `user_profiles` é travado contra auto-edição.

### Business Logic Bypass (Eventos)
- **Risco**: Alterar fatos passados (ex: mudar peso de uma pesagem antiga).
- **Mitigação**: Trigger `prevent_business_update` em `eventos` e tabelas filhas rejeita qualquer UPDATE que altere colunas de dados, permitindo apenas updates de sistema (sync, deleted_at).

### SQL Injection via RPC
- **Risco**: Injeção em funções `SECURITY DEFINER`.
- **Mitigação**: Uso estrito de parâmetros tipados (PL/pgSQL) e `search_path = public` para evitar hijacking de operadores/funções.

---

## 8. Riscos Encontrados

Durante a revisão do modelo atual:

1.  **Criação de Fazendas "Viral"**: A função `can_create_farm()` permite que qualquer usuário que já seja Owner de uma fazenda crie novas fazendas indefinidamente. Embora não seja uma falha de segurança de dados, pode ser um vetor de abuso de recursos (spam de fazendas).
    *   *Mitigação Atual*: Nenhuma (by design para crescimento).
    *   *Recomendação*: Monitorar criação de fazendas ou adicionar rate-limit no futuro.

2.  **Imutabilidade de Eventos vs Correção**: O modelo append-only é rígido. Correções legítimas exigem soft-delete do evento errado e criação de um novo (com `corrige_evento_id`).
    *   *Status*: Implementado e seguro, mas exige suporte correto no Frontend para não gerar "lixo" lógico.
