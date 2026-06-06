# ACTIVE_PHASE_PLAN - Fase 11.5

**Status:** planejada / pronta para iniciar 11.5A
**Foco:** Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente
**Criado:** 2026-06-05
**Atualizado:** 2026-06-05
**Plano específico:** `docs/review/PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md`

---

## Objetivo em 1 parágrafo

Conduzir a Fase 11.5 como etapa extra entre a Fase 11 e a Fase 12 para redesenhar o fluxo sanitário `Protocolo -> Agenda -> Evento`. A fase deve preparar contrato baseado em janela operacional sanitária, elegibilidade individual, demanda sanitária agrupada, preview editável, materialização idempotente da agenda e execução real como evento, preservando offline-first e a separação entre regra, intenção futura e fato histórico.

---

## Status da Fase 11.5

- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
- Fase 11.5 — Agenda Sanitária v2: planejada / pronta para iniciar 11.5A.
- Fase 12 — Compra/Venda Operacional: Hardening e Lacunas: bloqueada até fechamento formal da 11.5.

Próximo passo:

- 11.5A — Diagnóstico + contrato alvo + teste sentinela de retry/offline/sync.

---

## Contrato planejado

```txt
Protocolo
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
- RPC não deve ser caminho principal porque o app é offline-first.

---

## Subfases planejadas

- 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2.
- 11.5B — Motor puro de elegibilidade sanitária por janela.
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
