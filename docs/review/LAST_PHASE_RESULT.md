# Resultado funcional mais recente — Fase 19 / Foundations + Shell + Branding

Atualizado em: 2026-08-24
Baseline de abertura: `main@b07a1252a6436a413f9562a7f9079269cb49d026`
Decisão final: **READY — Fase 19 concluída**

## Resultado

A Fase 19 transformou o contrato visual da F18 em infraestrutura compartilhada sem migrar integralmente Home, Animais, AnimalDetalhe, Registrar ou Agenda.

- `components.json` aponta agora para o CSS produtivo real, `src/globals.css`;
- a escala tipográfica nomeada, superfícies, elevação, overlay e foco foram alinhados ao contrato aprovado;
- `brand.*` e `neutral.*` foram separados das famílias `semantic.success`, `warning`, `error`, `info`, `offline`, `pending`, `conflict`, `unknown` e `not-permitted` em light/dark;
- Button, Select, Dialog, Sheet e StatusBadge foram ajustados preservando APIs existentes;
- `PageHeader` e `FilterBar` são aliases das implementações canônicas `PageIntro` e `Toolbar`, sem duplicação;
- `StateBanner` foi adicionado como composição textual acessível para estados operacionais;
- AppShell, TopBar, SideNav, MobileBottomNav e BrandMark foram consolidados para gutters, largura, scroll, foco e touch targets.

## Branding × semântica

Primary/accent continuam identificando marca e ações. StatusBadge e StateBanner consomem famílias semânticas próprias; marca não representa automaticamente confirmação, sincronização, segurança ou autorização. Os estados críticos mantêm texto explícito e não dependem somente de cor.

## Validação visual autenticada

Home, Animais, AnimalDetalhe, Registrar e Agenda foram carregadas em 390×844, 768×1024, 1024×768 e 1440×900, nos temas claro e escuro. Foram confirmados:

- navegação mobile em 390 px e sidebar a partir de 768 px;
- shell, headers, conteúdo e navegação sem clipping estrutural observado;
- touch targets compartilhados de pelo menos 44 px;
- Sheet de navegação e Dialog real utilizáveis no mobile;
- compatibilidade temática de superfícies, bordas, estados, disabled, hover e overlays;
- P0 responsivo do Registrar preservado em 390, 768 e 1024 px; **P0 novo = 0**.

As dívidas visuais P1/P2/P3 permanecem na matriz da F18 para migração por jornada. AnimalDetalhe continua P1, sem regressão P0 confirmada.

## Validação técnica

- testes focados de foundations, SideNav, MobileBottomNav e Registrar: **21/21 aprovados**;
- `pnpm run lint`: aprovado;
- `pnpm run build`: aprovado, mantendo warnings conhecidos de Browserslist, importação mista de `db.ts` e tamanho de chunks;
- `pnpm run gates:docs`: aprovado;
- `git diff --check`: aprovado.

## Guardrails confirmados

- nenhuma regra de negócio foi movida para UI;
- Evento, Agenda, `state_*`, writers, `DecisionRecommendation` e `MetricResult` não foram alterados;
- nenhum código de sync, Dexie, Supabase, migration, RLS ou RPC foi alterado;
- nenhuma jornada da F20 foi migrada integralmente.

## Impacto arquitetural

O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) permanece **PRESERVADO**. A mudança é estritamente de infraestrutura visual e apresentação.

## Próximo estado

O marcador foi avançado para a **Fase 20 — Jornadas UX Críticas**, cuja implementação ainda não foi iniciada.
