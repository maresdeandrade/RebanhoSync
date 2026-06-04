# Sanitário — Roadmap Rebaseline

Atualizado em: 2026-06-04  
**Baseline Commit:** `8cd5534`

## Objetivo

Registrar a reorganização das fases sanitárias do RebanhoSync após mudanças de prioridade durante o desenvolvimento.

Este documento evita que escopos críticos fiquem descobertos ou sejam reabertos indevidamente.

---

## Decisão

A frente sanitária passa a ser organizada em seis fases principais:

| Fase | Nome | Status |
|---|---|---|
| Fase 1 | Protocolos, versionamento e encerramento do legado | Concluída |
| Fase 2 | Rastreabilidade sanitária operacional | Concluída |
| Fase 3 | Consolidação sanitária operacional | Concluída |
| Fase 4 | Clínica, compliance e checklists sanitários | Concluída |
| Fase 5 | Exceções e reconciliação sanitária | Próxima |
| Fase 6 | Robustez sanitária em staging | Pendente |

---

## Fase 1 — Protocolos, Versionamento e Legado

### Escopo consolidado

- Hardening de contrato sanitário/protocolos.
- `operational_complement` canônico.
- Filtro de protocolos inativos/deletados.
- Defaults seguros de agenda.
- Dedup estruturado.
- Bloqueio de edição direta de protocolo oficial.
- Versionamento imutável de itens.
- Remoção operacional de `protocol_item_id` legado.

### Contrato final

- `logical_item_key` = identidade lógica.
- `protocolos_sanitarios_itens.id` = versão física.
- `protocol_item_version_id` = referência operacional em agenda/evento.
- `protocol_item_snapshot` = regra histórica aplicada.

### Status

Concluída.

---

## Fase 2 — Rastreabilidade Sanitária Operacional

### Escopo consolidado

- Evento sanitário como fonte factual.
- Produto aplicado.
- Lote de estoque.
- Dose/unidade/via.
- Responsável.
- Carência.
- Custo.
- Baixa de estoque idempotente.
- Relatórios por produto, animal, lote e protocolo.
- Sinais de carência baseados em evento.

### Contrato final

Carência e custo vêm de `eventos_sanitario` estruturado e movimentações vinculadas ao evento.

Agenda/protocolo isolado não são fonte de carência.

### Status

Concluída.

---

## Fase 3 — Consolidação Sanitária Operacional

### Escopo consolidado

- Histórico sanitário auditável.
- Relatórios sanitários.
- Sinais sanitários.
- Identificação de eventos incompletos.
- Produto sem lote.
- Custo ausente.
- Estoque inconsistente.
- UX de histórico/rastreabilidade.

### Status

Concluída.

---

## Fase 4 — Clínica, Compliance e Checklists Sanitários

### Escopo consolidado

- Doenças notificáveis.
- Suspeita clínica.
- Checklists documentais.
- Alertas regulatórios.
- Biossegurança.
- Terapia/protocolo clínico não-recorrente.
- Separação entre protocolo operacional, caso clínico, checklist e compliance.

### O que foi resolvido

- Checklist regulatório disponível deixou de ser pendência geral.
- Ausência de runtime deixou de significar não conformidade.
- Biossegurança virou ocorrência contextual.
- Rotina normal virou `sem_ocorrencia_informada`.
- Doença notificável passou a exigir vínculo clínico.
- Suspeita sem animal/lote/evento não vira pendência.
- Pendência corretiva só nasce de ocorrência real.
- Agenda corretiva preserva `source_evento_id`.

### Status

Concluída para MVP/SLC.

### Pendências futuras controladas

- `sanitario_casos` por lote.
- Data estruturada de resolução de ocorrência.
- Fluxo assistido de encerramento de ocorrência.

Essas pendências não bloqueiam a Fase 5.

---

## Fase 5 — Exceções e Reconciliação Sanitária

### Escopo

- Painel de exceções sanitárias.
- Evento incompleto.
- Produto sem lote.
- Custo ausente.
- Estoque inconsistente.
- Correção histórica.
- Complemento de rastreabilidade.
- Estorno de baixa.
- Contra-lançamento.
- Resolução/cancelamento de ocorrência.
- Encerramento de pendência corretiva.
- Reconciliação assistida.

### Objetivo

Permitir corrigir operação sanitária sem quebrar histórico.

### Regra central

Não editar evento histórico destrutivamente.

Correção deve ser novo fato vinculado:

```txt
evento original permanece
correção = novo evento vinculado
complemento = novo evento vinculado
estorno = novo evento vinculado
resolução = novo evento vinculado

```

### Status

Próxima fase.

---

## Fase 6 — Robustez Sanitária em Staging

### Escopo

* Multi-tenant;
* Concorrência;
* Sync;
* RLS;
* Retry;
* Recompute;
* Baixa de estoque idempotente;
* Agenda corretiva;
* Ocorrência + pendência;
* Protocolos versionados;
* Eventos sanitários rastreáveis.

### Objetivo

Validar que o domínio sanitário aguenta uso real.

### Status

Pendente.

---

## Escopos que não pertencem mais à frente sanitária atual

Não abrir dentro das Fases 5 ou 6:

* venda;
* abate;
* sociedade;
* motor comercial;
* autorização final de comercialização;
* peso atual confiável;
* resultado econômico global;
* dashboards comerciais.

Essas temas devem entrar em épica própria depois da robustez sanitária.

---

## Mapa de cobertura das fases antigas

| Escopo antigo | Cobertura atual |
| --- | --- |
| Agenda/scheduler definitivo | Fase 1 + Fase 2 + validação Supabase |
| Recompute/dedup/anti-zumbi | Fase 1 |
| Agenda antiga/nova | Fase 1B/1C |
| Materialização oficial | Fase 1A/1BC |
| Carência operacional | Fase 2/3 |
| Doenças notificáveis | Fase 4 |
| Checklists | Fase 4 |
| Biossegurança | Fase 4 |
| Alertas regulatórios | Fase 4 |
| UX e relatórios sanitários | Fase 3/4 |
| Exceções e reconciliação | Fase 5 |
| Governança/robustez/staging | Fase 6 |

---

## Critério para considerar o sanitário encerrado

A frente sanitária pode ser considerada encerrada quando:

* Fase 5 permitir corrigir exceções sem mutação destrutiva;
* Fase 6 validar RLS, sync, retry e concorrência em staging;
* documentação ativa apontar para `docs/domain/SANITARIO.md`;
* skills e AGENTS não reintroduzirem contrato antigo;
* testes/lint/build e baseline Supabase passarem.

---

## Risco principal se este rebaseline for ignorado

Reintrodução de:

* checklist como pendência geral;
* doença notificável sem vínculo clínico;
* carência por protocolo;
* agenda como histórico;
* correção destrutiva de evento;
* sinal/tag como fonte primária;
* aptidão comercial inferida por sanitário isolado.

---

### Observação final

Os dois arquivos enviados como `docs/domain/SANITARIO.md` e `src/lib/insights/README.md` pareciam já conter parte do contrato novo. A versão acima deixa o contrato sanitário **canônico e centralizado**, reduzindo o risco de um agente futuro seguir documentação antiga.

```

```