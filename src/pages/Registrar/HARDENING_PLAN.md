# Registrar Hardening Plan (Metas Longas e Reais)

## Objetivo macro
Concluir o hardening incremental do hotspot `Registrar` sem regressao funcional, reduzindo acoplamento entre UI, regra, payload e IO, e mantendo o modulo previsivel para manutencao e operacao offline-first.

## Meta 1 — Fechar fronteira Helpers vs Effects
Prazo estimado: 1 a 2 semanas  
Status atual: em andamento avancado

Entregaveis:
- Nenhum arquivo de `helpers/` com IO remoto/local.
- Todo acesso a Dexie/RPC/pull concentrado em `effects/`.
- `index.tsx` atuando como orquestrador, sem blocos longos de IO inline.

Criterios de conclusao:
- `rg "db\\.|createGesture|pullDataForFarm"` nao retorna `helpers/`.
- Testes locais de `effects` cobrindo caminhos de sucesso/fallback.

## Meta 2 — Componentizacao local orientada a fluxo
Prazo estimado: 2 a 3 semanas  
Status atual: iniciada

Entregaveis:
- Extrair blocos de UI densos para `components/` por secao de fluxo.
- Primeiro pacote: `financeiro` (contraparte, compra sem selecao, resumo financeiro).
- Segundo pacote: `sanitario` (produto/protocolo/eligibilidade).
- Terceiro pacote: `movimentacao/nutricao` (checks e bloqueios).

Criterios de conclusao:
- `index.tsx` com reducao visivel de tamanho e ramificacoes UI.
- Componentes com props explicitando apenas dependencias reais.
- Sem duplicacao de regra de negocio em componente.

## Meta 3 — Contratos de estado da tela
Prazo estimado: 1 a 2 semanas

Entregaveis:
- Tipos locais para estado de formulario por trilho.
- Normalizacao de setters utilitarios para reduzir repeticao.
- Guardrails de transicao de etapa com regras centralizadas.

Criterios de conclusao:
- Menos mutacoes ad-hoc de estado no `index.tsx`.
- Testes de regressao dos fluxos de etapa e quick actions.

## Meta 4 — Baseline de regressao funcional do Registrar
Prazo estimado: 1 semana

Entregaveis:
- Cobertura de cenarios criticos do `Registrar` em testes de pagina.
- Casos minimos: sanitario por protocolo, compra com geracao, venda com contraparte, parto com redirect pos-parto.

Criterios de conclusao:
- `pnpm test` estavel em reexecucoes consecutivas.
- Sem alteracao de comportamento observado nos fluxos atuais.

## Meta 5 — Preparar replicacao do padrao para Agenda e ProtocolosSanitarios
Prazo estimado: 2 a 4 semanas

Entregaveis:
- Blueprint reaproveitavel de estrutura `helpers/effects/components`.
- Checklist de migracao incremental por hotspot.
- Definicao de ordem de extracao por risco.

Criterios de conclusao:
- `Agenda` e `ProtocolosSanitarios` com plano recortado por subfluxo.
- Sem reescrita ampla; apenas batches pequenos e validaveis.

## Meta 6 — Fechamento da etapa (hardening Registrar)
Prazo estimado total da etapa: 7 a 12 semanas (execucao incremental)

Definition of Done da etapa:
- `Registrar` com fronteiras claras (`helpers`, `effects`, `components`).
- `index.tsx` substancialmente menor e focado em orquestracao.
- Documentacao local coerente (`README`, `AGENTS`, plano de hardening).
- Validacao verde: `pnpm run lint`, `pnpm test`, `pnpm run build`.
