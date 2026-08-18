---
name: sanitario-registro-operacional
description: Use para registro sanitário operacional, conclusão de agenda, produtos, doses, consumo de estoque, evento sanitário, ocorrência de biossegurança ou correção factual. Não usar como skill principal para catálogo oficial, overlay regulatório ou compliance conceitual.
role: domain
---

# Sanitário Registro Operacional

## Mission

Protect the operational sanitary flow of RebanhoSync: sanitary agenda, sanitary event registration, veterinary products, stock lots, doses, costs, execution records, biosecurity occurrences and corrective sanitary pending actions.

This skill is for operational sanitary execution, not regulatory catalog/compliance design.

---

## When to use

Use when task touches:

- Registro de evento sanitário;
- Vacinação;
- Vermifugação;
- Tratamento;
- Exame sanitário;
- Conclusão de agenda sanitária;
- Vínculo agenda sanitária → evento;
- Produtos veterinários;
- Dose/quantidade/unidade;
- Lote de estoque;
- Baixa de estoque por evento sanitário;
- Snapshot econômico do consumo sanitário;
- UI operacional de registrar sanitário;
- Ocorrência de biossegurança;
- Suspeita notificável no fluxo de registro;
- Pendência corretiva sanitária vinculada a ocorrência;
- Correção/complemento/estorno sanitário.

---

## Do not use when

Do not use as primary skill when the task is only about:

- Catálogo oficial sanitário;
- Overlay estadual;
- Compliance regulatório puro;
- Feed-ban conceitual;
- Base legal/documental;
- Redação de manual sem mudança operacional.

Use `sanitario-catalogo-regulatorio-compliance` for those cases.

---

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `docs/domain/SANITARIO.md`;
6. arquivos-alvo e testes diretamente relacionados;
7. `.agents/rules/rtk.md`, se houver comandos ou validação.

Carregar `docs/context/SOURCE_OF_TRUTH.md` quando houver conflito entre fato, estado, intenção ou métrica crítica. Carregar `docs/technical/EVENTS_AGENDA_CONTRACT.md` quando a tarefa tocar `agenda_intent`, `event_execution_intent` ou `agenda_closure_intent`.

## Restrições

- Não alterar schema, migration, RLS, RPC ou seed sem autorização explícita e sem usar `migrations-rls-contracts` como skill principal ou única skill de apoio.
- Não executar reset de banco, deploy ou operação destrutiva por padrão.
- Não atualizar Graphify automaticamente; seguir `.agents/rules/GRAPHIFY_USAGE.md`.
- Não usar esta skill como fonte superior ao código e aos documentos normativos ativos.
- Não transformar agenda, fechamento administrativo, protocolo, catálogo ou checklist em fato executado.

---

## Core contract

- Agenda = intenção/tarefa futura.
- Evento = fato executado append-only.
- Fechamento de agenda = estado administrativo da intenção.
- Protocolo = regra/configuração.
- Produto aplicado = evento sanitário estruturado.
- Baixa de estoque = movimento vinculado ao evento.
- Carência operacional = derivação de Evento sanitário estruturado + produto executado + fonte técnica explícita.
- Ocorrência de biossegurança = evento append-only com payload estruturado.
- Pendência corretiva = agenda específica vinculada ao evento de ocorrência.
- Correção = novo evento vinculado, não edição destrutiva.
- `agenda_intent` = intenção de agenda em core puro, sem evento/estoque/carência.
- `event_execution_intent` = intenção de execução sanitária como evento futuro.
- `agenda_closure_intent` = intenção de fechamento administrativo, sem histórico sanitário.

---

## Required invariants

### Agenda

- Agenda não é histórico.
- Agenda não prova execução.
- Agenda concluída não registra manejo executado sem evento compatível.
- Agenda não prova ausência de doença.
- Agenda corretiva só nasce de ocorrência real.
- Pendência corretiva deve preservar `source_evento_id`.

### Evento sanitário

- Evento sanitário é fonte factual.
- Evento sanitário compatível é obrigatório para execução total/parcial de agenda.
- Deve preservar `protocol_item_version_id` e `protocol_item_snapshot` quando vier de protocolo.
- Deve preservar produto/lote/dose/via/responsável/carência/custo quando aplicável.
- Não reinterpretar evento passado pela versão ativa atual do protocolo.

### Execução e fechamento v2

- `agenda_intent` não persiste agenda real por si só.
- `event_execution_intent` declara `createsEvent: true`, mas `persistsEvent: false`.
- Execução parcial exige motivo para cada animal planejado não executado.
- `agenda_closure_intent` não cria evento, estoque, carência ou histórico.
- Fechamento sem execução, cancelamento e dispensa exigem motivo.
- Produto executado não deve ser inferido automaticamente do produto planejado.

### Produto e estoque

- Se há produto estruturado, exigir dose, unidade e via.
- Se há `estoque_lote_id`, copiar lote/validade/custo como snapshot quando disponível.
- Baixa de estoque deve ser idempotente.
- Retry/sync não pode duplicar baixa.
- Saldo negativo não deve ser aceito silenciosamente.

### Carência

- Carência só vem de evento sanitário estruturado.
- Sem carência configurada deve ser registrado como `null`, não inferido.
- Livre de carência não autoriza venda/abate.

### Biossegurança

- Rotina normal = `sem_ocorrencia_informada`.
- Esse estado não significa “conforme”.
- Wizard não deve abrir automaticamente.
- Ocorrência só existe quando usuário registra ocorrência real.
- `gera_pendencia=false` não cria agenda.
- `gera_pendencia=true` + `prazo_correcao` pode criar agenda específica.

### Doença notificável

- Não criar pendência geral para confirmar ausência de doença.
- Suspeita notificável exige `animal_id`, `animal_ids` ou `lote_id`.
- Com animal, pode abrir `alerta_sanitario` e `sanitario_casos`.
- Com lote sem animal, registrar em evento/payload até existir caso coletivo por lote.

---

## Correction/reconciliation rules

When fixing a sanitary problem:

- Do not update the original event destructively.
- Create a linked correction/complement/reversal event.
- Preserve original event auditability.
- Use explicit reason/motivo.
- Keep stock reversal/contra-lançamento idempotent.
- Do not silently delete or overwrite stock movements.

Allowed correction types:

- `complemento_rastreabilidade`;
- `correcao_custo`;
- `correcao_lote_estoque`;
- `estorno_baixa_estoque`;
- `contra_lancamento_estoque`;
- `resolucao_ocorrencia_biosseguranca`;
- `cancelamento_ocorrencia_biosseguranca`;
- `encerramento_pendencia_corretiva`.

---

## Forbidden patterns

- Using agenda as event history.
- Using protocol as execution.
- Using regulatory checklist as a routine required task.
- Creating general farm pending task for disease absence.
- Inferring withdrawal from protocol/catalog.
- Inferring commercial sale/slaughter eligibility.
- Updating historical event destructively.
- Duplicating stock consumption on retry.
- Persisting a tag/signal as primary truth.
- Putting critical sanitary rule only inside React UI.

---

## Expected implementation shape

Prefer:

- pure helpers for validation;
- operation builders;
- event payload contract tests;
- small UI adapters;
- focused tests by surface.

Avoid:

- broad refactors;
- hidden side effects;
- UI-only business rules;
- cross-domain changes;
- implicit corrections.

---

## Validation

Seguir `.agents/rules/rtk.md`.

Mínimo para alteração de governança ou documentação sanitária:

```bash
git status --short --untracked-files=all
git diff --check
```

Para patch funcional sanitário, executar testes focados e adicionar lint/build somente quando proporcionais ao risco. Se tocar Supabase, schema, RLS, RPC, migration ou sync-batch, executar a validação funcional indicada em `rtk.md` e coordenar com `migrations-rls-contracts`.

Operações destrutivas exigem autorização explícita, necessidade técnica demonstrada e compatibilidade simultânea com `rtk.md` e `migrations-rls-contracts`. Graphify só pode ser atualizado quando `.agents/rules/GRAPHIFY_USAGE.md` classificar a mudança como estrutural relevante.

## Output expected

Report:

* Files changed.
* Operational rule changed.
* Primary source used.
* Tests added/updated.
* Validation commands and results.
* Risks remaining.
* Whether agenda/event/protocol/compliance contracts were affected.
