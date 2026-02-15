# Mapa do Repositório

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** File System
> **Última Atualização:** 2026-02-15

Estrutura de diretórios e responsabilidades dos módulos.

## `src/` (Frontend)

### `src/components/`

Componentes React reutilizáveis.

- **ui/**: Componentes base (Botões, Inputs) baseados em Shadcn/Radix.
- **auth/**: Componentes de proteção de rotas (`AuthGate`, `RequireAuth`).
- **layout/**: Estrutura da página (`AppShell`, `TopBar`).

### `src/hooks/`

Custom Hooks.

- `useAuth.tsx`, `useCurrentRole.ts`.

### `src/lib/`

Núcleo da lógica de negócio e infraestrutura.

- **offline/**: Motor Offline-First (Dexie, Sync Worker, Queue).
- **events/**: Abstração de Eventos e Validadores.
- **domain/**: Regras de negócio puras (`categorias.ts`...).
- **reproduction/**: Logica específica de reprodução (linking, status).
- **sanitario/**: Lógica de protocolos e pendências.

### `src/pages/`

Componentes de página conectados às rotas.

- Organizados por funcionalidade (`Animais.tsx`, `Dashboard.tsx`, etc).

## `supabase/` (Backend)

### `supabase/functions/`

Edge Functions (Deno/TypeScript).

- **sync-batch/**: Endpoint principal de sincronização (Firewall + Write Gateway).
- **test-auth/**: (Provável) Função de teste de autenticação.

### `supabase/migrations/`

Arquivos SQL de versionamento do banco de dados (não listados individualmente aqui).

---

_Gerado a partir da listagem de diretórios._
