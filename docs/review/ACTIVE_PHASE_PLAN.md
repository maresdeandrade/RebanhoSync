# ACTIVE_PHASE_PLAN - Fase 11.5

**Status:** 11.5D concluída localmente / pronta para iniciar 11.5E
**Foco:** Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente
**Criado:** 2026-06-05
**Atualizado:** 2026-06-06
**Plano específico:** `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`

---

## Objetivo em 1 parágrafo

Conduzir a Fase 11.5 como etapa extra entre a Fase 11 e a Fase 12 para redesenhar o fluxo sanitário `Protocolo -> Agenda -> Evento`. A fase deve preparar contrato baseado em fonte bibliográfica/legal/bula para regra e produto, janela operacional sanitária, elegibilidade individual, demanda sanitária agrupada, preview editável, materialização idempotente da agenda e execução real como evento, preservando offline-first e a separação entre regra, intenção futura e fato histórico.

---

## Status da Fase 11.5

- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
- Fase 11.5 — Agenda Sanitária v2: 11.5D concluída localmente / pronta para iniciar 11.5E.
- Fase 12 — Compra/Venda Operacional: Hardening e Lacunas: bloqueada até fechamento formal da 11.5.

Próximo passo:

- 11.5E — Materialização idempotente da agenda sanitária.

---

## Contrato planejado

```txt
Protocolo
-> contrato bibliográfico/legal/bula da regra e produto
-> janela operacional sanitária
-> elegibilidade individual
-> demanda sanitária agrupada
-> preview/editável
-> agenda materializada de forma idempotente
-> evento sanitário executado
```

---

## Princípios obrigatórios

- Protocolo = regra/configuração.
- Produto = fonte primária de dose, via, apresentação e carência.
- Carência deve ser vinculada primariamente ao produto e exige fonte explícita.
- Agenda = intenção operacional futura.
- Evento = fato histórico executado.
- Demanda sanitária = leitura derivada, não agenda nem evento.
- Elegibilidade = cálculo derivado de animal + protocolo + eventos.
- Tags, sinais e insights = auxiliares, nunca fonte primária.
- Agenda sanitária antiga pode ser substituída.
- Dados antigos da agenda sanitária não precisam ser preservados, desde que documentado.
- Materialização de agenda não cria evento.
- Materialização de agenda não baixa estoque.
- Baixa de estoque ocorre apenas na execução real.
- `completed` sanitário depende de evento executado, não de agenda concluída.
- Agenda, preview e demanda agrupada não geram carência.
- Evento executado deve futuramente gravar snapshot da carência calculada.
- “Livre de carência”, “apto para abate” e “pronto para venda” seguem bloqueados como autorização operacional.
- RPC não deve ser caminho principal porque o app é offline-first.

---

## Subfases planejadas

- 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2: concluída localmente.
- 11.5B0 — Contrato bibliográfico de regra sanitária e produto: concluída localmente.
- 11.5B1 — Motor puro de elegibilidade sanitária por janela: concluída localmente.
- 11.5B1.1 — Hardening de elegibilidade por dose múltipla e âncora por evento: concluída localmente.
- 11.5C — Demanda sanitária agrupada: concluída localmente.
- 11.5D — Preview sanitário editável: concluída localmente.
- 11.5E — Materialização idempotente da agenda sanitária.
- 11.5F — Execução sanitária como evento.
- 11.5G — Semântica final de fechamento da agenda.
- 11.5H — Fechamento e handoff.

---

## Resultado da 11.5C

- Core puro criado em `src/lib/sanitario/demand/sanitaryDemand.ts`.
- Testes focados criados em `src/lib/sanitario/demand/__tests__/sanitaryDemand.test.ts`.
- Demanda agrupada consome elegibilidades já calculadas ou chama `computeSanitaryEligibility` sem IO.
- Agrupamento considera protocolo, item/produto/classe, ação, lote, janela e status derivado.
- Nomes de produto e lote são campos de exibição, não identidade primária do grupo.
- `insufficient_data` permanece pendência de cadastro.
- `not_applicable` é contado e excluído da demanda acionável.
- Demanda permanece derivada e não materializa agenda, evento, baixa de estoque ou carência.

## Resultado da 11.5D

- Core puro criado em `src/lib/sanitario/preview/sanitaryOperationalPreview.ts`.
- Testes focados criados em `src/lib/sanitario/preview/__tests__/sanitaryOperationalPreview.test.ts`.
- Preview operacional é derivado de `SanitaryDemandGroup[]` recebido por parâmetro.
- Grupos operacionais são gerados apenas para demandas acionáveis.
- `insufficient_data` permanece bloqueio/cadastro pendente, com identidade operacional.
- `not_applicable` não entra como item operacional.
- `previewGroupId` e `sourceDemandKey` preservam protocolo, item, produto, classe, ação, lote e janela.
- Data sugerida respeita a janela quando possível.
- Campos editáveis são declarados sem persistência.
- Preview permanece simulação derivada, não agenda nem evento, com `materialization: "none"`.

## Escopo da próxima execução

- Criar materialização idempotente da agenda sanitária a partir de preview confirmado.
- Preservar agenda como intenção operacional futura.
- Não criar evento, não baixar estoque e não calcular carência ativa na materialização.
- Manter caminho offline-first e idempotência por chave determinística.

## Escopo proibido nesta transição

- Criar migrations.
- Alterar schema, RLS, sync-batch, Supabase, edge functions ou telas.
- Criar UI, evento ou baixa de estoque.
- Materializar agenda sem idempotência explícita.
- Calcular carência ativa ou autorizar venda/abate.
- Iniciar Fase 12.
- Atualizar profundamente docs permanentes de contexto, arquitetura ou sync.

---

## Validação registrada da 11.5B1/11.5B1.1

```bash
pnpm test -- src/lib/sanitario/eligibility
pnpm test
pnpm run lint
pnpm run build
git diff --check
git status --short --untracked-files=all
```

## Validação mínima antes da 11.5C

```bash
git diff --check
git status --short --untracked-files=all
```
