# Rotas da Aplicação

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** `src/App.tsx` (React Router)
> **Última Atualização:** 2026-02-15

Lista de todas as rotas declaradas e seus níveis de proteção.

## Rotas Públicas

Abertas a qualquer visitante.

- `/` (Index)
- `/login`
- `/signup`
- `/invites/:token` (Convite)

## Rotas Autenticadas (`RequireAuth`)

Exigem login, mas não exigem fazenda ativa.

- `/select-fazenda`
- `/criar-fazenda`

## Rotas Protegidas (`RequireAuth` + `RequireFarm`)

Exigem login E uma fazenda ativa selecionada.

| Caminho                  | Página               |
| :----------------------- | :------------------- |
| `/home`                  | Home                 |
| `/dashboard`             | Dashboard            |
| `/perfil`                | Perfil               |
| `/membros`               | Membros              |
| `/reconciliacao`         | Reconciliação        |
| `/editar-fazenda`        | Editar Fazenda       |
| **Animais**              |                      |
| `/animais`               | Lista                |
| `/animais/novo`          | Cadastro             |
| `/animais/:id`           | Detalhe              |
| `/animais/:id/editar`    | Edição               |
| **Lotes**                |                      |
| `/lotes`                 | Lista                |
| `/lotes/novo`            | Cadastro             |
| `/lotes/:id`             | Detalhe              |
| `/lotes/:id/editar`      | Edição               |
| **Pastos**               |                      |
| `/pastos`                | Lista                |
| `/pastos/novo`           | Cadastro             |
| `/pastos/:id`            | Detalhe              |
| `/pastos/:id/editar`     | Edição               |
| **Eventos/Agenda**       |                      |
| `/agenda`                | Agenda               |
| `/registrar`             | Registrar Evento     |
| `/eventos`               | Histórico Eventos    |
| **Módulos**              |                      |
| `/reproducao`            | Dashboard Reprodução |
| `/financeiro`            | Financeiro           |
| `/protocolos-sanitarios` | Protocolos           |
| `/categorias`            | Categorias           |
| `/contrapartes`          | Contrapartes         |

## Rotas Administrativas

Exigem Role Owner (Guardado por UI/RPC, mas acessível na rota se membro).

- `/admin/membros`

---

_Gerado a partir da análise de `src/App.tsx`._
