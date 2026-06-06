# ACTIVE_PHASE_PLAN - Fase 11.5

**Status:** 11.5B0 concluída localmente / pronta para iniciar 11.5B1
**Foco:** Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente
**Criado:** 2026-06-05
**Atualizado:** 2026-06-05
**Plano específico:** `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`

---

## Objetivo em 1 parágrafo

Conduzir a Fase 11.5 como etapa extra entre a Fase 11 e a Fase 12 para redesenhar o fluxo sanitário `Protocolo -> Agenda -> Evento`. A fase deve preparar contrato baseado em fonte bibliográfica/legal/bula para regra e produto, janela operacional sanitária, elegibilidade individual, demanda sanitária agrupada, preview editável, materialização idempotente da agenda e execução real como evento, preservando offline-first e a separação entre regra, intenção futura e fato histórico.

---

## Status da Fase 11.5

- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
- Fase 11.5 — Agenda Sanitária v2: 11.5B0 concluída localmente / pronta para iniciar 11.5B1.
- Fase 12 — Compra/Venda Operacional: Hardening e Lacunas: bloqueada até fechamento formal da 11.5.

Próximo passo:

- 11.5B1 — Motor puro de elegibilidade sanitária por janela.

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
- 11.5B1 — Motor puro de elegibilidade sanitária por janela.
- 11.5C — Demanda sanitária agrupada.
- 11.5D — Preview sanitário editável.
- 11.5E — Materialização idempotente da agenda sanitária.
- 11.5F — Execução sanitária como evento.
- 11.5G — Semântica final de fechamento da agenda.
- 11.5H — Fechamento e handoff.

---

## Escopo permitido nesta preparação

- Criar plano da Fase 11.5.
- Atualizar documentação de controle da fase.
- Registrar decisão arquitetural planejada.
- Bloquear explicitamente a Fase 12 até fechamento formal da 11.5.

---

## Escopo proibido nesta preparação

- Alterar código funcional.
- Criar migrations.
- Alterar schema, RLS, sync-batch, Supabase, edge functions ou telas.
- Criar testes agora.
- Iniciar 11.5A funcional.
- Iniciar Fase 12.
- Atualizar profundamente docs permanentes de contexto, arquitetura ou sync.

---

## Validação obrigatória desta preparação

```bash
git diff --check
git status --short --untracked-files=all
```
