# Mapa de Rotas

> **Status:** Derivado (Inventario)
> **Fonte de Verdade:** `src/App.tsx`
> **Ultima Atualizacao:** 2026-04-07

## Rotas publicas

| Caminho | Componente |
| --- | --- |
| `/` | `Index` |
| `/login` | `Login` |
| `/signup` | `SignUp` |
| `/invites/:token` | `AcceptInvite` |

## Rotas autenticadas sem fazenda ativa

| Caminho | Guard | Componente |
| --- | --- | --- |
| `/select-fazenda` | `RequireAuth` | `SelectFazenda` |
| `/criar-fazenda` | `RequireAuth` | `CriarFazenda` |

## Rotas de fazenda ativa

Todas abaixo rodam dentro de `RequireAuth` + `RequireFarm` + `AppShell`.

### Operacao principal

| Caminho | Componente |
| --- | --- |
| `/home` | `Home` |
| `/onboarding-inicial` | `OnboardingInicial` |
| `/registrar` | `Registrar` |
| `/agenda` | `Agenda` |
| `/eventos` | `Eventos` |
| `/dashboard` | `Dashboard` |
| `/relatorios` | `Relatorios` |
| `/reconciliacao` | `Reconciliacao` |

### Animais

| Caminho | Componente |
| --- | --- |
| `/animais` | `Animais` |
| `/animais/importar` | `AnimaisImportar` |
| `/animais/novo` | `AnimalNovo` |
| `/animais/:id` | `AnimalDetalhe` |
| `/animais/:id/editar` | `AnimalEditar` |
| `/animais/:id/reproducao` | `AnimalReproducao` |
| `/animais/:id/pos-parto` | `AnimalPosParto` |
| `/animais/:id/cria-inicial` | `AnimalCriaInicial` |
| `/animais/transicoes` | `AnimaisTransicoes` |

### Lotes e pastos

| Caminho | Componente |
| --- | --- |
| `/lotes` | `Lotes` |
| `/lotes/importar` | `LotesImportar` |
| `/lotes/novo` | `LoteNovo` |
| `/lotes/:id` | `LoteDetalhe` |
| `/lotes/:id/editar` | `LoteEditar` |
| `/pastos` | `Pastos` |
| `/pastos/importar` | `PastosImportar` |
| `/pastos/novo` | `PastoNovo` |
| `/pastos/:id` | `PastoDetalhe` |
| `/pastos/:id/editar` | `PastoEditar` |

### Dominios auxiliares

| Caminho | Componente |
| --- | --- |
| `/financeiro` | `Financeiro` |
| `/contrapartes` | `Contrapartes` |
| `/reproducao` | `ReproductionDashboard` |
| `/protocolos-sanitarios` | `ProtocolosSanitarios` |
| `/categorias` | `Categorias` |
| `/categorias/novo` | `CategoriaNova` |

### Fazenda, perfil e membros

| Caminho | Componente |
| --- | --- |
| `/perfil` | `Perfil` |
| `/membros` | `Membros` |
| `/admin/membros` | `AdminMembros` |
| `/editar-fazenda` | `EditarFazenda` |

## Fallback

| Caminho | Componente |
| --- | --- |
| `*` | `NotFound` |

## Observacoes

- A protecao por papel acontece principalmente em UI + RLS; o roteamento React protege autenticacao e contexto de fazenda.
- O menu efetivo tambem depende do modo de experiencia da fazenda e do papel atual.
