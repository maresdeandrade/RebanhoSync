# Mapa do Repositório (Repo Map)

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** Estrutura de Diretórios
> **Última Atualização:** 2026-02-15

Visão geral da organização de pastas e módulos do projeto GestaoAgro.

---

## 1. Raiz do Projeto

| Diretório/Arquivo | Descrição                                              |
| :---------------- | :----------------------------------------------------- |
| `.agent/`         | Configurações, skills e workflows do Agente AI.        |
| `docs/`           | Documentação Normativa e Derivada.                     |
| `src/`            | Código fonte da aplicação Frontend (React).            |
| `supabase/`       | Configurações, migrações e Edge Functions do Supabase. |
| `package.json`    | Dependências e scripts npm.                            |
| `vite.config.ts`  | Configuração do bundler Vite.                          |

## 2. Código Fonte (`src/`)

### 2.1 Componentes (`src/components/`)

- `auth/`: Componentes de autenticação e proteção de rotas (`AuthGate`, `RequireAuth`).
- `common/`: Componentes reutilizáveis genéricos.
- `events/`: Componentes de exibição de eventos (Timeline).
- `layout/`: Estrutura da página (`AppShell`, `SideNav`, `TopBar`).
- `manejo/`: Formulários de registro de manejo.
- `members/`: Gestão de membros e convites.
- `ui/`: Componentes base do Design System (Shadcn/Radix).

### 2.2 Hooks (`src/hooks/`)

Hooks personalizados para lógica de UI e estado.

- `useAuth.tsx`: Contexto de autenticação.
- `useFarm.tsx`: Contexto da fazenda ativa.
- `useToast.ts`: Notificações.

### 2.3 Core & Libs (`src/lib/`)

Núcleo da lógica de negócios e infraestrutura.

- `offline/`: **Core Offline-First**.
  - `db.ts`: Schema do Dexie.js.
  - `syncWorker.ts`: Lógica de sincronização background.
  - `ops.ts`: Operações de banco (Repositório).
  - `types.ts`: Tipagem compartilhada DB/App.
  - `tableMap.ts`: Mapeamento Dexie <-> Supabase.
- `supabase.ts`: Cliente Supabase instanciado.
- `utils.ts`: Utilitários gerais (classes CSS, formatação).
- `validators.ts`: Schemas Zod.
- Domain Modules (`events/`, `sanitario/`, `reproduction/`): Lógica específica de domínio.

### 2.4 Páginas (`src/pages/`)

Componentes de rota (Views).

- `Home.tsx`: Dashboard.
- `Animais/`: Listagem e Detalhe de animais.
- `Registrar.tsx`: Formulário central de manejo.
- `Agenda.tsx`: Gestão de tarefas.
- `Protocolos.tsx`: Gestão de protocolos sanitários.
- `Configuracoes.tsx`: Configurações gerais.

## 3. Backend (`supabase/`)

### 3.1 Migrações (`supabase/migrations/`)

Histórico de DDL do banco de dados (PostgreSQL).

- `0001_init.sql`: Schema inicial.
- `...`: Migrações incrementais.

### 3.2 Edge Functions (`supabase/functions/`)

Funções server-side (Deno).

- `sync-batch/`: **API de Sincronização**. Recebe batches do cliente, valida e processa transacionalmente.

## 4. Documentação (`docs/`)

Ver [`README.md`](./README.md) para índice completo de documentação.
