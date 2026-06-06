# ACTIVE_PHASE_PLAN - Fase 11.5

**Status:** 11.5C concluída localmente / pronta para iniciar 11.5D
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
- Fase 11.5 — Agenda Sanitária v2: 11.5C concluída localmente / pronta para iniciar 11.5D.
- Fase 12 — Compra/Venda Operacional: Hardening e Lacunas: bloqueada até fechamento formal da 11.5.

Próximo passo:

- 11.5D — Preview operacional editável.

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
- 11.5D — Preview sanitário editável: próxima execução.
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

## Escopo da próxima execução

- Criar preview operacional editável a partir da demanda derivada.
- Preservar preview como simulação operacional, não agenda e não evento.
- Permitir ajustes operacionais permitidos sem alterar regra técnica.
- Não materializar agenda, criar evento, baixar estoque ou calcular carência ativa.

## Escopo proibido nesta transição

- Criar migrations.
- Alterar schema, RLS, sync-batch, Supabase, edge functions ou telas.
- Criar UI, preview, materialização de agenda, evento ou baixa de estoque.
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
