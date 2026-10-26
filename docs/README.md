# Documentação — RebanhoSync

Índice da documentação ativa. Evidências e planos encerrados preservam histórico, mas não substituem as fontes correntes.

## Estado corrente

- **Fase 24 — Release Hardening / Scale Readiness**; F24.5 integrada e F24.6 ativa.
- F24.6A1 integrada pelo PR #200; certificação restrita ao envelope reconnect 1k. Não implica capacidade geral de escala.
- F24.6A2 é proposta de inventário estático; escopo e critérios devem ser formalizados antes do início.
- Sync Sanitário v2 está implementado sob gate remoto desligado; rollout e importação real não estão autorizados, e produção não está provisionada.

Hierarquia factual: código e migrations ativas; depois [estado do projeto](./context/PROJECT_STATUS.md); depois documentos normativos e derivados. Este índice e os READMEs não substituem essas fontes.

Fontes de continuidade:

- [Estado do projeto](./context/PROJECT_STATUS.md)
- [Roadmap](./product/ROADMAP.md)
- [Plano ativo](./review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](./review/CURRENT_PHASE_HANDOFF.md)
- [Índice mestre do portfólio A–I](./review/MASTER_BACKLOG.md) — cruza iniciativas, evidências e dependências; não substitui status de fases ou certificações.

## Contratos centrais

- [Fonte de verdade](./context/SOURCE_OF_TRUTH.md)
- [Eventos e Agenda](./technical/EVENTS_AGENDA_CONTRACT.md)
- [Arquitetura](./technical/ARCHITECTURE.md)
- [Offline e sync](./technical/OFFLINE_SYNC.md)
- [Supabase e RLS](./technical/SUPABASE_RLS.md)
- [Gates de teste](./technical/TESTING_GATES.md)
- [ADRs](./technical/README.md#decisões-arquiteturais)

## Domínios

- [Sanitário](./domain/SANITARIO.md)
- [Animais e taxonomia](./domain/ANIMAIS_TAXONOMIA.md)
- [Lotes e pastos](./domain/LOTES_PASTOS.md)
- [Reprodução](./domain/REPRODUCAO.md)
- [Compra e venda](./domain/COMPRA_VENDA.md)

## Produto e UX

- [Visão de produto](./product/PRODUCT_VISION.md)
- [Escopo MVP](./product/MVP_SCOPE.md)
- [Mapa de capacidades](./product/CAPABILITY_MAP.md)
- [Rastreabilidade de requisitos](./product/REQUIREMENTS_TRACEABILITY.md)
- [Princípios de UX](./ux/UX_PRINCIPLES.md)
- [Padrões de tela](./ux/SCREEN_PATTERNS.md)
- [Tokens visuais](./ux/VISUAL_TOKENS.md)

## Histórico e evidências

- `docs/review/evidence/`: comprovações técnicas e curatoriais.
- `docs/archive/`: documentos históricos fora do uso operacional.

Não reescrever histórico para refletir o estado atual; atualizar os índices e fontes ativas.

## Agentes

- [Dispatcher principal](../AGENTS.md)
- [Regras centrais](../.agents/rules/CORE_RULES.md)
- [Carregamento de contexto](../.agents/rules/CONTEXT_LOADING.md)
