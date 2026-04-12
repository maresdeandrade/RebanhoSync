# Stack Tecnologico

> **Status:** Derivado (Inventario)
> **Fonte de Verdade:** `package.json`
> **Ultima Atualizacao:** 2026-04-07

## Core

| Tecnologia | Versao |
| --- | --- |
| React | ^19.2.3 |
| React DOM | ^19.2.3 |
| TypeScript | ^5.5.3 |
| Vite | ^6.4.1 |
| React Router DOM | ^6.30.2 |

## Offline e dados

| Tecnologia | Versao | Uso |
| --- | --- | --- |
| TanStack React Query | ^5.56.2 | Cache e suspense de dados remotos |
| Dexie | ^4.3.0 | Banco local IndexedDB |
| dexie-react-hooks | ^4.2.0 | Reatividade sobre stores locais |
| Supabase JS | latest | Auth, Postgres e Edge Functions |
| date-fns | ^3.6.0 | Datas e intervalos |

## UI

| Tecnologia | Versao | Uso |
| --- | --- | --- |
| Tailwind CSS | ^3.4.11 | Estilizacao utilitaria |
| Radix UI | varios pacotes | Primitivos acessiveis |
| shadcn/ui | composicao local | Sistema base de componentes |
| lucide-react | ^0.462.0 | Iconografia |
| sonner | ^1.5.0 | Toasts |
| recharts | ^2.12.7 | Graficos |

## Formularios e validacao

| Tecnologia | Versao |
| --- | --- |
| react-hook-form | ^7.53.0 |
| zod | ^3.23.8 |
| @hookform/resolvers | ^3.9.0 |

## Qualidade e testes

| Tecnologia | Versao | Uso |
| --- | --- | --- |
| ESLint | ^9.9.0 | Lint |
| Vitest | ^4.0.18 | Testes unitarios/integracao |
| Testing Library | ^16.3.2 | Testes de UI |
| jsdom | ^28.1.0 | Ambiente DOM para testes |
| fake-indexeddb | ^6.2.5 | Testes do Dexie |
| Prettier | ^3.3.3 | Formatacao |

## Scripts relevantes

- `dev`: servidor local
- `build`: build de producao
- `lint`: validacao estatica
- `test`: suite principal
- `test:e2e`: fluxos guiados criticos em Vitest
- `gates`, `audit:data`, `gates:*`: validacoes documentais do pacote Antigravity

## Observacoes

- Nao ha Next.js, Zustand ou backend Node dedicado no repositorio atual.
- O projeto usa lazy loading nas paginas principais e code splitting no build.
