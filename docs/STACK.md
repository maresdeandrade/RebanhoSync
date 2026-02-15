# Stack Tecnológico

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** `package.json`
> **Última Atualização:** 2026-02-15

Inventário de tecnologias, bibliotecas e ferramentas utilizadas no projeto.

---

## 1. Core Framework

| Tecnologia     | Versão (aprox) | Finalidade              |
| :------------- | :------------- | :---------------------- |
| **React**      | ^18.3.1        | Biblioteca de UI        |
| **TypeScript** | ^5.5.3         | Linguagem e Tipagem     |
| **Vite**       | ^5.4.1         | Build Tool e Dev Server |

## 2. Estado e Data Fetching

| Biblioteca         | Versão   | Finalidade                                     |
| :----------------- | :------- | :--------------------------------------------- |
| **TanStack Query** | ^5.51.23 | Gerenciamento de estado do servidor / Caching  |
| **Zustand**        | ^4.5.4   | Gerenciamento de estado global (auth, fazenda) |
| **Dexie.js**       | ^4.0.8   | Banco de dados local (IndexedDB) wrapper       |

## 3. Backend e Serviços

| Serviço        | Biblioteca              | Versão  | Finalidade                                |
| :------------- | :---------------------- | :------ | :---------------------------------------- |
| **Supabase**   | `@supabase/supabase-js` | ^2.45.1 | BaaS (Auth, DB, Realtime, Edge Functions) |
| **PostgreSQL** | (Supabase)              | 15+     | Banco de dados relacional                 |

## 4. UI e Estilização

| Biblioteca       | Versão           | Finalidade                                          |
| :--------------- | :--------------- | :-------------------------------------------------- |
| **Tailwind CSS** | ^3.4.10          | Framework de CSS utilitário                         |
| **Radix UI**     | (Vários pacotes) | Primitivos de UI acessíveis (Dialog, Popover, etc.) |
| **Lucide React** | ^0.427.0         | Ícones                                              |
| **Sonner**       | ^1.5.0           | Toasts e notificações                               |
| **Recharts**     | ^2.12.7          | Gráficos e Dashboards                               |

## 5. Formulários e Validação

| Biblioteca              | Versão  | Finalidade                      |
| :---------------------- | :------ | :------------------------------ |
| **React Hook Form**     | ^7.52.2 | Gestão de estado de formulários |
| **Zod**                 | ^3.23.8 | Validação de schema             |
| **@hookform/resolvers** | ^3.9.0  | Integração Zod + RHF            |

## 6. Rotas e Navegação

| Biblioteca           | Versão  | Finalidade     |
| :------------------- | :------ | :------------- |
| **React Router DOM** | ^6.26.1 | Roteamento SPA |

## 7. Qualidade e Testes

| Ferramenta   | Versão         | Finalidade                     |
| :----------- | :------------- | :----------------------------- |
| **ESLint**   | ^9.9.0         | Linting e análise estática     |
| **Vitest**   | ^2.0.5         | Test Runner (Unit/Integration) |
| **Prettier** | (Via extensão) | Formatação de código           |

## 8. Utilitários (Libs)

| Biblioteca                | Versão  | Finalidade                 |
| :------------------------ | :------ | :------------------------- |
| **date-fns**              | ^3.6.0  | Manipulação de datas       |
| **clsx / tailwind-merge** | -       | Utilitários de classes CSS |
| **uuid**                  | ^10.0.0 | Geração de IDs únicos      |

---

> **Nota:** Para versões exatas (lockfile), consulte `pnpm-lock.yaml` na raiz do projeto.
