# Mapa de Rotas (Routes)

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** `src/App.tsx`
> **Última Atualização:** 2026-02-15

Inventário das rotas da aplicação, proteções de acesso e componentes associados.

---

## 1. Rotas Públicas

Rotas acessíveis sem autenticação.

| Caminho      | Componente | Descrição                          |
| :----------- | :--------- | :--------------------------------- |
| `/login`     | `Login`    | Tela de login                      |
| `/register`  | `Register` | Tela de cadastro de novo usuário   |
| `/bem-vindo` | `Welcome`  | Tela de boas-vindas (pós-cadastro) |

## 2. Rotas Protegidas (Auth Required)

Rotas que exigem autenticação (`RequireAuth`), mas não necessariamente uma fazenda selecionada.

| Caminho          | Guard         | Componente   | Descrição                |
| :--------------- | :------------ | :----------- | :----------------------- |
| `/fazendas`      | `RequireAuth` | `FarmSelect` | Seleção de fazenda ativa |
| `/fazendas/nova` | `RequireAuth` | `FarmCreate` | Criação de nova fazenda  |

## 3. Rotas da Fazenda (Farm Required)

Rotas que exigem autenticação E uma fazenda ativa (`RequireFarm`).
Renderizadas dentro do `AppShell` (Layout com Sidebar/Header).

| Caminho          | Componente      | Descrição                                           | Acesso        |
| :--------------- | :-------------- | :-------------------------------------------------- | :------------ |
| `/`              | `Home`          | Dashboard principal                                 | Todos         |
| `/animais`       | `Animais`       | Listagem de animais                                 | Todos         |
| `/animais/:id`   | `AnimalDetalhe` | Detalhes do animal                                  | Todos         |
| `/registrar`     | `Registrar`     | Registro de manejo (Sanitário/Pesagem/Movimentação) | Todos         |
| `/pastos`        | `Pastos`        | Gestão de pastos e lotação                          | Todos         |
| `/lotes`         | `Lotes`         | Gestão de lotes                                     | Todos         |
| `/agenda`        | `Agenda`        | Agenda de tarefas sanitárias/manejo                 | Todos         |
| `/protocolos`    | `Protocolos`    | Biblioteca de protocolos sanitários                 | Manager/Owner |
| `/financeiro`    | `Financeiro`    | Módulo financeiro (Placeholder)                     | Manager/Owner |
| `/membros`       | `AdminMembros`  | Gestão de equipe e permissões                       | Owner         |
| `/configuracoes` | `Configuracoes` | Configurações da fazenda                            | Manager/Owner |

## 4. Estrutura de Proteção (Guards)

- `AuthGate`: Componente wrapper que verifica estado de autenticação global.
- `RequireAuth`: Redireciona para `/login` se não autenticado.
- `RequireFarm`: Redireciona para `/fazendas` se autenticado mas sem `active_fazenda_id`.
- `AppShell`: Fornece estrutura de navegação e contexto visual da fazenda.

---

> **Nota:** As permissões de acesso (Role Based Access Control) são aplicadas via RLS no backend e ocultação de elementos na UI, mas a proteção de rota no React Router é primariamente Autenticação + Seleção de Contexto.
