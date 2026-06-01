# Current State (Snapshot Operacional) - RebanhoSync

**Status:** Snapshot vivo
**Última Atualização:** 2026-05-31
**Estado do produto:** Beta interno
**Fase atual:** SLC (Simple, Lovable, Complete) em consolidação

Este documento apresenta um resumo executivo do estado operacional atual do projeto RebanhoSync, com foco nas consolidações recentes e na direção estratégica. Para detalhes aprofundados sobre regras, contratos e arquitetura, consulte os documentos de contexto específicos.

## 1. Leitura de Fase e Foco Atual

O RebanhoSync está na fase de **consolidação operacional**, focando em:
- Preservar a previsibilidade dos fluxos centrais.
- Reduzir a fricção de uso em campo.
- Aumentar a consistência da experiência.
- Estabilizar a qualidade para evolução incremental sem regressão estrutural.

Os hotspots críticos de UI (`Registrar` e `Agenda`) passaram pelo hardening estrutural principal. A fase atual visa refinar e consolidar o que já foi construído.

## 2. Consolidações Recentes (Maio/2026)

As principais consolidações e refinamentos incluem:

- **Ledger Gerencial Administrativo e Lançamentos Financeiros (Fase 8):** Implementação física e offline-first do financeiro gerencial, com tabelas `finance_categories` e `finance_transactions` e RLS rígido.
- **Read Model de Carência Sanitária (Fase 7 e 7.1):** Engine pura (`withdrawalReadModel.ts`) para cálculo de período de carência, com testes robustos e painel premium HSL.
- **Insumos, Estoque e Snapshot Imutável (Fase 6 e 6.1):** Controle de estoque tenant-scoped e snapshot imutável em eventos sanitários e nutricionais.
- **Refinamentos de Experiência e Bloqueio de No-ops:** Dropdown de categorias de insumo inteligente, bloqueio de transições no-op e baseline de estágio na importação CSV.
- **Métricas de Ocupação:** Métricas como tempo de lotação, histórico de movimentação, GMD e ECC calculadas a partir de eventos históricos e exibidas em `LoteDetalhe` e `PastoDetalhe`.
- **Semântica Transversal Padronizada:** Padronização de termos como `Registrar`, `Executar`, `Encerrar`, `Aplicar protocolo`, `Seguir fluxo`.
- **Reforço do Modelo Two Rails:** Clarificação de que Agenda (`agenda_itens`) é intenção e Eventos (`eventos`) são fatos.
- **Saneamento Sanitário:** Consolidação do recorte sanitário, com SQL/Supabase como motor líder e TypeScript preservando contratos e testes.
- **Taxonomia Sanitária Passiva:** Introdução de `ProtocolKind`, `MaterializationMode`, `ComplianceKind` sem mudança de comportamento.
- **Reorganização de `src/lib/sanitario/**`:** Estrutura por responsabilidade e boundary `Registrar` <-> sanitário.
- **Remoção de Shims de Migrations:** Shims pós-squash removidos da pasta ativa.
- **Consolidação de `src/lib/insights/`:** Core puro/read-only de composição operacional, com integração passiva na Home.
- **Pastagens com Trilho Histórico Próprio:** `eventos_pasto_avaliacao` para avaliação/ronda de campo.
- **Refatoração Visual SLC:** Redução de complexidade visual em diversas telas.
- **Seleção de Fazenda Contextual:** Cards de fazenda exibem metadados cadastrais.
- **Handoff Design:** Documentado em `docs/design/HANDOFF_VISUAL_UX_20260508.md`.

## 3. Hotspots Consolidados

Os hotspots `src/pages/Registrar` e `src/pages/Agenda` tiveram seu hardening estrutural principal concluído, com IO, pacotes financeiros/sanitários, orquestração e estado de shell movidos para camadas mais apropriadas. O domínio `src/lib/sanitario` foi reorganizado em `models/`, `engine/`, `catalog/`, `compliance/`, `infrastructure/` e `customization/`.

## 4. Para Detalhes

- **Regras de Domínio:** Consulte `docs/context/CORE_RULES.md` e `docs/context/SOURCE_OF_TRUTH.md`.
- **Lacunas Conhecidas:** Consulte `docs/context/KNOWN_GAPS.md`.
- **Arquitetura:** Consulte `docs/technical/ARCHITECTURE.md`.
- **Processo de Engenharia:** Consulte `docs/PROCESS.md`.
- **Carregamento de Contexto:** Consulte `../.agents/rules/CONTEXT_LOADING.md`.

**Observação:** Este documento é um snapshot de alto nível. Para informações operacionais detalhadas e contratos específicos, consulte os documentos referenciados acima e o código-fonte.
