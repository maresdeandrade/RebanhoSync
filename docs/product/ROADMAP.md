# Roadmap — RebanhoSync

Atualizado em: 2026-06-02
**Baseline Commit:** `3fe7a81`

## Objetivo

Definir os próximos focos de desenvolvimento do RebanhoSync em nível de produto.

Este documento não é backlog detalhado.
Não deve substituir issues, tarefas técnicas ou prompts de implementação.

---

## Princípios do roadmap

- Estabilizar antes de expandir.
- Proteger offline-first.
- Proteger RLS/multi-tenant.
- Reduzir risco operacional.
- Melhorar UX dos fluxos centrais.
- Evitar automação crítica sem fonte técnica.
- Diferenciar sinal sanitário de autorização comercial.
- Entregar valor prático ao produtor.
- Preservar Agenda/Eventos/`state_*`/Protocolo separados.

---

## Fase atual — Fase 9 (Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo)

Subfase atual: **9A — Inventário Operacional**

Objetivo:

- consolidar base comercial e patrimonial após Fase 8;
- validar custo operacional por inventário;
- garantir idempotência de baixa;
- isolar sociedade patrimonial por RLS;
- preparar classificação operacional como leitura apenas.

Entregas esperadas (Subfase 9A):

- conversão de unidade (compra/apresentação -> base) registrada e testada;
- custo operacional diferencia ausência vs zero;
- snapshot econômico imutável (histórico preservado);
- baixa de inventário idempotente (retry-safe);
- isolamento de sociedade patrimonial por RLS;
- classificação operacional como leitura apenas (read-only snapshot).

Critério de aceite:

- todos os 6 contratos obrigatórios implementados;
- testes cobrem fluxo completo;
- `git diff --check` passa;
- sem warnings TypeScript/ESLint em código novo.

Referência: `docs/review/ACTIVE_PHASE_PLAN.md` e `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`

---

## Fases anteriores consolidadas

### Consolidação SLC (Fases 1-6 e Gates)

Concluído em baseline `3fe7a81`:

- `docs/context/`, `docs/domain/`, `docs/technical/`, `docs/product/` consolidados;
- Sanitário (Fase 6): append-only, correcção idempotente, evento original preservado;
- RLS validado para sanitário, estoque e sociedade;
- Suite de 1744 testes passando, lint limpo, build sem erros bloqueantes.

Detalhes em `docs/context/PROJECT_STATUS.md` e `docs/review/LAST_PHASE_RESULT.md`.

---

## Próximos focos (pós-Fase 9A)

### Próximo foco 1 — UX operacional dos fluxos centrais

Objetivo:

- reduzir fricção na rotina de campo;
- deixar claro o que é pendência, execução e histórico;
- melhorar leitura da Central Operacional;
- simplificar fluxos de registro.

Áreas:

- Home/Central Operacional;
- Agenda;
- Registrar;
- Animal;
- Sanitário;
- Lotes/Pastos;
- Compra/Venda.

Critério de aceite:

- menos ambiguidade;
- menos campos desnecessários;
- CTA claro;
- estados vazio/parcial/bloqueado claros;
- sem regra crítica nova na UI;
- sinais sanitários não são apresentados como autorização comercial.

---

## Próximo foco 2 — Robustez sanitária

Objetivo:

- separar definitivamente protocolo, agenda, evento, compliance e checklist;
- garantir baixa de estoque idempotente;
- tratar exceções sanitárias;
- permitir sinal sanitário de carência apenas com fonte estruturada;
- impedir falsa liberação sanitária, comercial, venda ou abate.

Áreas:

- registro sanitário;
- agenda sanitária;
- produto/dose/lote;
- estoque/custo;
- compliance/checklists;
- carência sanitária como sinal;
- exceções/reconciliação.

Critério de aceite:

- agenda não vira histórico;
- evento sanitário é fonte de execução;
- produto/dose/lote têm limitação declarada;
- carência sanitária pode aparecer como sinal se vier de evento sanitário estruturado;
- carência sanitária não autoriza venda, abate ou liberação final;
- checklist/compliance não vira prova universal de conformidade;
- sync/retry não duplica baixa.

---

## Próximo foco 3 — Exceções e reconciliação

Objetivo:

- permitir corrigir operação sem quebrar histórico;
- tratar evento incompleto;
- produto sem lote;
- custo ausente;
- estoque inconsistente;
- correção histórica;
- estorno/contra-lançamento.

Critério de aceite:

- erro fica visível;
- correção é auditável;
- não há edição destrutiva de histórico;
- sucesso parcial é tratável;
- rollback é coerente;
- sinal derivado de evento corrigido deve ser recalculado ou invalidado de forma rastreável.

---

## Próximo foco 4 — Lotes, pastos e desempenho operacional

Objetivo:

- melhorar gestão de lotação;
- histórico de movimentação;
- permanência;
- ECC por animal/lote;
- ganho de peso por período com fonte declarada.

Critério de aceite:

- estado atual não é tratado como histórico;
- indicadores declaram fonte;
- ganho de peso exige pesagens válidas;
- ECC individual pode compor média de lote;
- sem inferir produtividade sem dados.

---

## Próximo foco 5 — Compra/venda e visão econômica básica

Objetivo:

- consolidar compra/venda/sociedade;
- preservar snapshots econômicos;
- apoiar visão simples de custo/receita;
- evitar promessa de margem completa sem fonte;
- impedir que carência sanitária seja confundida com aptidão comercial.

Critério de aceite:

- custo ausente não vira zero real;
- snapshot histórico preservado;
- venda altera status de forma coerente;
- sociedade não é tag;
- pronto para venda/abate segue bloqueado;
- venda/abate não pode ser liberado apenas por `sanitario:sem_carencia_vigente` ou alias legado `sanitario:livre_carencia`.

---

## Futuro — KPIs e gestão financeira ampliada

Objetivo futuro:

- custo por animal/lote;
- margem parcial;
- custo por período;
- indicadores de manejo;
- visão administrativa clara.

Requisito:

- fonte financeira explícita;
- períodos definidos;
- rateios documentados;
- limitações visíveis;
- testes.

---

## Futuro — Compliance regulatório avançado

Objetivo futuro:

- catálogo regulatório;
- overlay estadual;
- biossegurança;
- feed-ban;
- doenças notificáveis;
- alertas documentais.

Requisito:

- fonte oficial;
- aplicabilidade;
- versionamento;
- separação de alerta vs bloqueio;
- não transformar compliance em evento;
- não transformar checklist ou ausência de ocorrência em liberação final.

---

## Futuro — Reprodução ampliada

Objetivo futuro:

- IATF;
- IA;
- cobertura;
- diagnóstico de gestação;
- estação de monta;
- indicadores reprodutivos.

Requisito:

- contrato de domínio;
- modelagem de eventos;
- agenda;
- estado atual;
- testes;
- limites bem definidos.

---

## Bloqueios estratégicos
