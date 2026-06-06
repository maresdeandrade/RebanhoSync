# ACTIVE_PHASE_PLAN - Fase 12B

**Status:** Fase 12B em escopo documental/modelagem; nenhuma implementacao funcional iniciada
**Foco:** Modelagem clean da persistencia sanitaria v2 com liberdade de reset da agenda sanitaria legada
**Criado:** 2026-06-06
**Atualizado:** 2026-06-06
**Plano especifico:** `docs/review/PLANO_FASE_12B_MODELAGEM_CLEAN_PERSISTENCIA_SANITARIA_V2.md`

---

## Objetivo em 1 paragrafo

Consolidar a decisao tecnica da Fase 12B para uma persistencia sanitaria v2 limpa, explicita e testavel, sem obrigacao de compatibilidade reversa com a agenda sanitaria legada. A subfase define estruturas alvo, estrategia de reset, dados descartaveis, dados factuais preservados, requisitos de idempotencia, RLS/multi-tenant, Dexie/offline-first, sync-batch futuro, testes sentinela e criterio de aceite. Esta rodada nao implementa migration, schema, RLS, Dexie, sync-batch, UI, RPC, seed ou regra funcional.

---

## Decisao 12B

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Recomendacao de schema: criar persistencia sanitaria v2 clean em estruturas dedicadas, removendo a agenda sanitaria legada como restricao de produto. `agenda_itens` deixa de ser a superficie sanitaria alvo e deve permanecer apenas para outros dominios ou transicao nao sanitaria.

Justificativa:

- a 12A confirmou que `agenda_itens` sanitario mistura intencao, fechamento administrativo e ponte de execucao;
- `status='concluido'` e ambiguo e nao pode significar `completed` sanitario;
- a nova diretriz autoriza reset controlado de agenda sanitaria antiga, filas incompatíveis e dados demo/legados;
- eventos reais, detalhes sanitarios e movimentacoes de estoque continuam sendo fatos preservados;
- migration funcional deve vir apenas apos a decisao clean/reset estar registrada.

---

## Modelo alvo

Fluxo conceitual:

```txt
Protocolo/regra/produto
-> elegibilidade/demanda/preview derivados
-> agenda_intent
-> sanitario_agenda_v2 + sanitario_agenda_animais_v2
-> event_execution_intent
-> eventos + eventos_sanitario
-> agenda_closure_intent
-> sanitario_agenda_closures_v2 + estado administrativo da agenda
```

Invariantes:

- agenda = intencao/tarefa futura;
- evento = fato historico executado;
- fechamento administrativo nao cria evento;
- baixa de estoque nasce apenas de evento real;
- carencia nasce apenas de produto executado + fonte tecnica explicita;
- agenda, demanda, preview e fechamento nao geram carencia;
- tags, sinais e insights nao viram fonte primaria.

---

## Escopo permitido nesta subfase

- registrar decisao clean/reset;
- desenhar estruturas/tabelas v2;
- classificar dados descartaveis e factuais preservados;
- definir requisitos de idempotencia, conflitos e rollback;
- definir requisitos RLS/multi-tenant e Dexie/offline-first;
- listar arquivos candidatos e testes sentinela;
- preparar a menor proxima subfase segura para migration/RLS.

## Escopo proibido nesta subfase

- aplicar migration SQL;
- alterar enum/tabela/FK/RLS/RPC/Edge Function;
- alterar sync-batch;
- alterar Dexie;
- alterar UI;
- alterar seed;
- criar evento real;
- baixar estoque;
- calcular carencia ativa/liberatoria;
- implementar venda, abate ou aptidao operacional;
- manter legado sanitario apenas por compatibilidade reversa.

---

## Resultado esperado

- 12B fechada como modelagem/documentacao clean/reset;
- plano especifico criado e referenciado;
- `DECISION_LOG` atualizado com a substituicao da direcao transitoria 12A;
- proxima fase recomendada limitada a migration/RLS inicial v2 e reset controlado, com validacao completa.

---

## Proxima fase segura

12C — Migration clean da Agenda Sanitaria v2 e reset controlado do legado sanitario, sem UI ampla, sem Dexie completo e sem sync-batch completo.
