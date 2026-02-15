# REBANHOSYNC - Guia para Agentes e Desenvolvedores

Este arquivo define as convenções, regras arquiteturais e diretrizes de desenvolvimento para o projeto **REBANHOSYNC**.

**Contexto:**
- **Tipo:** Aplicação Web Offline-First (PWA).
- **Domínio:** Gestão Pecuária.
- **Tenancy:** Multi-tenant estrito (por `farm_id`).
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions).
- **Sync:** Orientado a gestos/transações com `client_tx_id`.

---

## 1. Estrutura do Repositório

Organização modular focada em domínio e capacidades offline.

- **`src/`**
  - **`components/`**: Componentes UI (shadcn/ui, base components).
  - **`hooks/`**: Custom hooks (data fetching, state management).
  - **`lib/`**: Núcleo da lógica de negócios e infraestrutura.
    - **`domain/`**: Entidades, tipos e regras de negócio puras (ex: `Animal`, `Lote`).
    - **`events/`**: Definições de eventos de domínio para o sistema de Event Sourcing/Sync.
    - **`offline/`**: Lógica de sincronização, Dexie.js (IndexedDB), filas de sync.
    - **`reproduction/`**: Lógica específica de reprodução animal.
    - **`sanitario/`**: Lógica específica de manejo sanitário.
  - **`pages/`**: Rotas e views da aplicação.
  - **`utils/`**: Utilitários gerais.
- **`supabase/`**
  - **`migrations/`**: Scripts SQL de versionamento do banco.
  - **`functions/`**: Edge Functions (Deno).
  - **`tests/`**: Testes de banco de dados (pgTAP).

---

## 2. Comandos Padrão

Utilize `pnpm` como gerenciador de pacotes.

- **Desenvolvimento:**
  - `pnpm dev`: Inicia o servidor de desenvolvimento Vite.
  - `pnpm build`: Gera o build de produção em `dist/`.
  - `pnpm lint`: Executa a verificação de código estática (ESLint).
  - `pnpm format`: Formata o código com Prettier.

- **Testes:**
  - `pnpm test`: Executa testes unitários e de integração (Vitest).
  - `pnpm test:ui`: Executa testes com interface gráfica.

- **Supabase (Local):**
  - `supabase start`: Inicia a stack local do Supabase.
  - `supabase stop`: Para a stack local.
  - `supabase db reset`: Reseta o banco de dados local (apaga dados).
  - `supabase gen types typescript --local > src/lib/supabase-types.ts`: Gera tipagens TypeScript do banco.

---

## 3. Convenções de Tenancy (Multi-tenant)

O isolamento entre fazendas é **CRÍTICO**. Nunca confie apenas no frontend para filtrar dados.

1.  **Backend (RLS):**
    - Todas as tabelas devem ter Row Level Security (RLS) habilitado.
    - Policies devem verificar explicitamente `farm_id` ou relação de membro.
    - **NUNCA** exponha dados de outros tenants.

2.  **Frontend:**
    - Todos os hooks de busca de dados (ex: `useLotes`, `useAnimals`) devem aceitar e filtrar obrigatoriamente pelo `farm_id` atual.
    - Ao criar registros (insert), o `farm_id` deve ser preenchido automaticamente com o contexto atual da fazenda.

3.  **Unique Constraints:**
    - Chaves únicas de negócio devem ser compostas com `farm_id`.
    - Exemplo: `UNIQUE (farm_id, brinco)` para animais, não apenas `brinco`.

---

## 4. Convenções de RBAC (Role-Based Access Control)

Utilize o princípio do **privilégio mínimo**.

**Roles Definidas:**
| Role | Descrição | Permissões Típicas |
| :--- | :--- | :--- |
| **`owner`** | Proprietário da Fazenda | Acesso total, gerenciar usuários, deletar fazenda, faturamento. |
| **`manager`** | Gerente | Ver e editar todos os dados operacionais, relatórios. Não pode gerenciar billing/faturamento. |
| **`cowboy`** | Operador de Campo | Foco em coleta de dados. Leitura ampla, criação de eventos. Edição/Deleção restrita aos próprios registros recentes. |

**Implementação:**
- Verificações de permissão devem ocorrer no:
  1.  **DB (RLS):** Policies baseadas em claims ou tabelas de perfil.
  2.  **API (Edge Functions):** Verificar role antes de executar ação.
  3.  **UI:** Ocultar botões/ações não permitidas.

---

## 5. Convenções de Sync (Offline-First)

O sistema utiliza um modelo de sincronização baseado em **Gestos/Transações**.

1.  **Idempotência:**
    - Toda ação de mutação (POST/PUT/DELETE) enviada pelo cliente DEVE incluir um `client_tx_id` (UUID v4 gerado no frontend).
    - O Backend deve armazenar e verificar este ID para prevenir duplicidade em caso de retries de rede.
    - Se `client_tx_id` já existe -> Retornar sucesso (200) com o resultado original, sem reprocessar.

2.  **Fluxo de Dados:**
    - **Escrita:** Optimistic UI no Dexie.js -> Fila de Sync -> Supabase (via RPC ou REST).
    - **Leitura:** Supabase -> Dexie.js -> UI.

3.  **Tratamento de Conflitos:**
    - "Last Write Wins" (LWW) para atualizações simples de campos.
    - Lógica de negócio específica para eventos de domínio (ex: não pode registrar parto se animal não estiver prenhe).

---

## 6. Convenções Supabase (Security & Performance)

Padrões rigorosos para garantir segurança e performance no PostgreSQL.

1.  **RLS (Row Level Security):**
    - **Obrigatório** em todas as tabelas públicas.
    - Policies devem ser performáticas (evite joins complexos em policies de leitura frequente).

2.  **RPCs & Functions (SECURITY DEFINER):**
    - Funções `SECURITY DEFINER` bypassam o RLS. Use com extremo cuidado.
    - **Search Path:** Sempre defina `SET search_path = public` (ou schema específico) para evitar hijacking.
    - **Validação de Input:** Valide todos os parâmetros de entrada.
    - **Validação de Auth:** Verifique explicitamente `auth.uid()` e se o usuário tem permissão no `farm_id` alvo dentro da função.

    ```sql
    -- Exemplo de cabeçalho seguro
    CREATE OR REPLACE FUNCTION public.minha_funcao_segura(p_farm_id UUID)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      -- Validação de Permissão Manual Obrigatória
      IF NOT EXISTS (
        SELECT 1 FROM farm_members
        WHERE farm_id = p_farm_id AND user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'Acesso negado';
      END IF;

      -- Lógica...
    END;
    $$;
    ```

3.  **Índices:**
    - Crie índices para colunas usadas em filtros (`farm_id`, `deleted_at`, chaves estrangeiras).

---

## 7. Checklist de PRs (Pull Requests)

Antes de solicitar merge, verifique:

- [ ] **Build:** O projeto compila sem erros (`pnpm build`).
- [ ] **Lint:** O código passa no linter (`pnpm lint`).
- [ ] **Testes:** Testes unitários/integração relevantes passam ou foram criados (`pnpm test`).
- [ ] **Tenancy:** Todas as novas queries/mutações filtram por `farm_id`.
- [ ] **Offline:** Alterações de schema foram refletidas no Dexie.js e na lógica de sync.
- [ ] **Segurança:** Novas tabelas têm RLS. RPCs `SECURITY DEFINER` têm validação de `auth.uid()`.
- [ ] **Migrações:** Scripts SQL são idempotentes e reversíveis (se aplicável).
