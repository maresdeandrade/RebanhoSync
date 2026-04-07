# Mapa do Repositorio

> **Status:** Derivado (Inventario)
> **Fonte de Verdade:** Estrutura do repositorio
> **Ultima Atualizacao:** 2026-04-07

## Raiz

| Caminho | Papel |
| --- | --- |
| `src/` | Frontend React |
| `supabase/` | Migrations e Edge Functions |
| `docs/` | Arquitetura, contratos, snapshot e backlog |
| `scripts/` | Gates e automacoes |
| `config/` | Configuracoes auxiliares |
| `public/` | Assets estaticos |

## `src/`

| Caminho | Papel |
| --- | --- |
| `App.tsx` | Declaracao de rotas |
| `main.tsx` | Bootstrap da aplicacao |
| `components/` | Componentes reutilizaveis |
| `hooks/` | Hooks de auth, dados e UX |
| `lib/` | Dominio, offline, imports, relatorios e telemetry |
| `pages/` | Views roteadas |
| `utils/` | Helpers de interface |

## `src/components/`

- `animals/`: badges e apresentacao do animal
- `auth/`: guards e wrappers de autenticacao
- `events/`: formularios e blocos de eventos
- `layout/`: `AppShell`, `SideNav`, `TopBar`
- `manejo/`: componentes de operacao de campo
- `members/`: membros e convites
- `ui/`: base shadcn/ui

## `src/lib/`

- `offline/`: Dexie, fila, rollback, pull e sync worker
- `events/`: builders e validadores de eventos
- `domain/`: regras de dominio compartilhadas
- `reproduction/`: dashboard, linking, status e registro reprodutivo
- `import/`: parsers CSV e normalizacao
- `reports/`: resumo operacional e exportacoes
- `telemetry/`: metricas locais de piloto
- `farms/`: modo de experiencia da fazenda
- `animals/`: camada de apresentacao, elegibilidade e agrupamento familiar do animal
- `sanitario/`: servicos sanitarios

## `src/pages/`

Superficies principais do produto:

- onboarding: `SelectFazenda`, `CriarFazenda`, `OnboardingInicial`
- operacao: `Home`, `Registrar`, `Agenda`, `Eventos`, `Relatorios`
- rebanho: `Animais`, `AnimalDetalhe`, `AnimalReproducao`, `AnimalPosParto`, `AnimalCriaInicial`, `AnimalTransicoes`
- estrutura: `Lotes`, `Pastos`, importadores e detalhes
- apoio: `Financeiro`, `Contrapartes`, `Dashboard`, `ReproductionDashboard`, `Sanitarios`
- gestao: `Perfil`, `Membros`, `AdminMembros`, `EditarFazenda`

## `supabase/`

| Caminho | Papel |
| --- | --- |
| `migrations/` | Evolucao do schema e hardening |
| `functions/sync-batch/` | Endpoint de sincronizacao transacional |
| `functions/test-auth/` | Endpoint auxiliar de diagnostico |

## Observacoes

- Pastas geradas localmente como `dist/`, `node_modules/` e caches nao entram neste mapa.
- `docs/review/` contem apenas relatorios ainda usados pela governanca documental.
- `docs/archive/` concentra analises e auditorias historicas que nao representam o snapshot operacional atual.
- `docs/ADRs/` contem decisoes de arquitetura: ADR-0001 (taxonomia) e ADR-0002 (produtos_veterinarios global).
- Materiais antigos de planejamento fora de `docs/` foram removidos para reduzir ruido no root do repositorio.
- Migrations nomeadas com prefixo YYYYMMDD (ex: `20260308*`) sao do ciclo de fechamento de TDs de marco/2026.
