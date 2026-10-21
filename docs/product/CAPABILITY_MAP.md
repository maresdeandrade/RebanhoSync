# Capability Map — RebanhoSync

Atualizado em: 2026-10-20

**Baseline documental original:** `32d7779`

## Objetivo

Mapear as capacidades do RebanhoSync por área funcional, com status de produto e limites de escopo.

Este documento não substitui validação no código. Ele orienta priorização e evita expansão indevida.

---

## Status

| Status | Significado |
|---|---|
| MVP | Capacidade incluída no escopo atual aprovado do MVP/beta. |
| Complementar | Capacidade preservada no produto, mas não obrigatória como critério de aprovação do núcleo mínimo do MVP. Implementação, validação, disponibilidade e rollout são dimensões independentes. |
| Parcial | Capacidade incluída, com limites de fonte, dados ou operação explícitos. |
| Futuro | Possibilidade de produto, sem compromisso de desenvolvimento sem roadmap aprovado. |
| Bloqueado | A decisão/automação descrita não pode ser afirmada sem fonte e contrato próprios. |
| Fora de escopo | Capacidade explicitamente excluída do MVP atual. |
| A definir | Código ou evidência existe, mas a inclusão no escopo de produto não foi decidida nos documentos consultados. |

`Complementar` é uma proposta de classificação, não uma aprovação de produto; use-a assim até existir decisão explícita. Os status desta coluna descrevem **escopo de produto**, não implementação, validação, integração ou rollout. Essas dimensões exigem evidência própria; consulte [`REQUIREMENTS_TRACEABILITY.md`](./REQUIREMENTS_TRACEABILITY.md).

---

## Mapa resumido

| Área | Capacidade | Status de produto |
|---|---|---|
| Rebanho | Cadastro, identificação e estado atual | MVP |
| Rebanho | Histórico factual por eventos | MVP |
| Rebanho | Categoria/estágio quando modelado | Parcial |
| Rebanho | Peso atual confiável | Bloqueado |
| Agenda | Pendências futuras, vencidos e tarefas do dia | MVP |
| Agenda | Agenda como histórico factual | Bloqueado |
| Eventos | Registro de fatos executados | MVP |
| Eventos | KPIs históricos | Parcial |
| Sanitário | Protocolos e aplicação factual | MVP |
| Sanitário | Agenda Sanitária v2 local | MVP |
| Sanitário | Produto/dose/lote e vínculo com estoque | Parcial |
| Sanitário | Carência ativa / sem carência vigente como sinal | MVP, condicionado a fonte técnica e cobertura suficiente; ausência de registro não prova ausência |
| Sanitário | Liberação sanitária/comercial para venda ou abate | Bloqueado |
| Sanitário | Sync remoto Sanitário v2 e rollout | A definir |
| Reprodução | Parto, cria, vínculo mãe-cria e pós-parto | MVP |
| Reprodução | Registro factual de cobertura/IA/diagnóstico ligado a episódio | Complementar (proposta, pendente decisão) |
| Reprodução | Motor amplo de IATF, estação de monta e indicadores avançados | Fora de escopo |
| Lotes/Pastos | Estrutura produtiva e movimentação interna | MVP |
| Lotes/Pastos | Ocupação e métricas históricas | Parcial |
| Lotes/Pastos | Trânsito externo/GTA | A definir |
| Compra/Venda | Compra/venda básica | Parcial |
| Compra/Venda | Sociedade pecuária | Parcial |
| Compra/Venda | Aptidão/liberação automática para venda | Bloqueado |
| Importação | Importação V2 de animais, lotes e pastos | Complementar (proposta, pendente decisão) |
| Simulação | Simulação produtiva/comercial efêmera | Complementar (proposta, pendente decisão) |
| Financeiro | Custos/snapshots | Parcial |
| Financeiro | KPI financeiro avançado | Futuro |
| Insights | Painel read-only e sinais auxiliares | Parcial |
| Insights | Decisão crítica/autônoma | Bloqueado |
| Sync | Operação local offline-first | MVP |
| Sync | Retry/replay/reconcile entre superfícies | Parcial |
| Supabase | RLS/multi-tenant | MVP |
| Fiscal | NF-e/SPED/contabilidade completa | Fora de escopo |

---

## Rebanho

### Capacidades MVP

- cadastro animal;
- identificação;
- sexo/raça quando disponível;
- categoria/estágio quando modelado;
- status atual;
- vínculo com lote/pasto;
- histórico por eventos;
- filtros básicos.

### Limites

Não inferir peso atual confiável, aptidão reprodutiva nem aptidão/liberação comercial. Carência ativa ou encerrada pode ser exibida como sinal sanitário somente quando derivada de evento sanitário estruturado e fonte técnica aplicável; isso não libera venda, abate ou trânsito.

---

## Agenda

### Capacidades MVP

- tarefa futura;
- pendência;
- vencimento;
- atraso;
- agenda sanitária;
- agenda operacional;
- agenda derivada de protocolo quando aplicável.

### Limites

Agenda não é histórico.
Agenda concluída sem evento não é prova operacional suficiente.

---

## Eventos

### Capacidades MVP

- registro de fatos executados;
- linha do tempo e auditoria baseadas em Eventos e detalhes factuais;
- KPIs históricos que agregam a fonte canônica apropriada a cada indicador, incluindo lançamentos financeiros canônicos quando pertinentes;
- proveniência, período e cobertura explícitos em cada resultado.

### Limites

Agenda não é fonte de histórico e `state_*` representa estado atual/read model. Evento sem detail suficiente ou fonte complementar ausente deve declarar limitação; ausência de cobertura não equivale a zero factual.

---

## Sanitário

### MVP

- protocolo como regra/configuração;
- Agenda Sanitária v2 local como tarefa futura;
- registro factual sanitário por Evento e detalhe próprio;
- produto, dose, lote e vínculo de estoque conforme disponibilidade e elegibilidade;
- carência ativa ou ausência de carência vigente somente como sinal derivado de execução estruturada, fonte técnica aplicável e cobertura suficiente;

### Parcial ou a definir

- Sync remoto Sanitário v2: implementação versionada e dimensões locais/remotas são distintas; schema, migrations, RPCs ou worker não provam implantação ou ativação. Certificação por contrato/ambiente e autorização de rollout exigem evidência própria; não inferir rollout;
- custo sanitário consolidado, estoque avançado, compliance regulatório amplo, biossegurança operacional e suspeita clínica: dependem dos limites e fontes de cada fluxo.

### Bloqueado

- liberação sanitária/comercial para venda ou abate;
- aptidão comercial derivada somente de carência ou de checklist contextual.

Carência derivada é sinal sanitário, não autorização operacional ou comercial.

---

## Reprodução

### MVP

- parto, cria, vínculo mãe-cria e pós-parto;
- agenda derivada da cria quando aplicável.

### Complementar (proposta, pendente decisão de produto)

A implementação versionada inclui cobertura, IA, diagnóstico ligado a episódio, parto, aborto/perda gestacional, vínculo mãe-cria, correções de diagnóstico/parto/aborto nos campos suportados e projeção reprodutiva reconstruível. A Fase 13 está encerrada conforme `PROJECT_STATUS.md`. A proposta complementar refere-se ao registro factual de cobertura/IA/diagnóstico além do foco de produto em parto/cria; não equivale a motor amplo de IATF/calendário, estação de monta, automação clínica, decisão veterinária autônoma ou indicadores avançados. A proposta não foi aprovada como decisão de produto nem torna esses fluxos requisito de aceite do MVP.

### Fora de escopo

- motor amplo de IATF, automação integral de IA/cobertura/diagnóstico, estação de monta e indicadores reprodutivos avançados.

Um evento factual individual não comprova motor reprodutivo amplo.

---

## Lotes e pastos

### Capacidades MVP

- cadastro de lote/pasto;
- alocação atual;
- movimentação;
- leitura de ocupação;
- histórico quando baseado em eventos.

### Parcial

- tempo de lotação;
- histórico completo de permanência;
- ganho de peso por pasto/lote;
- taxa de lotação histórica.

### Limites

Cálculos de ocupação, permanência, lotação e ganho de peso são parciais e dependem de eventos, datas e fontes suficientes; ausência de cobertura não significa zero factual. O escopo consultado não decide suporte a trânsito externo/GTA; movimentação interna não implica autorização regulatória.

---

## Compra, venda e sociedade

### Capacidades MVP/parcial

- compra;
- venda;
- saída;
- contraparte;
- custo;
- snapshot econômico;
- sociedade pecuária;
- vínculo com animais.

### Bloqueado

- pronto para venda automático;
- apto para abate automático;
- margem final confiável sem custo completo.

---

## Importação

### Complementar (proposta, pendente decisão de produto)

Importação V2 de animais, lotes e pastos está integrada como capacidade técnica. Os três fluxos usam preview/validação, processamento em chunks e `persistImportV2Preview`, que persiste via `createGesture` offline-first, com IDs determinísticos de operação/transação e resultados explícitos de sucesso parcial/retryable. Reapresentar o mesmo preview permite retry idempotente dentro desses limites; isso não comprova checkpoint durável de retomada após reinício, rollback global entre chunks ou recuperação integral.

A proposta complementar não foi aprovada como decisão de produto e não torna a importação requisito de aceite do núcleo do MVP. Importação sanitária real permanece separada e gateada; integração técnica da importação não comprova rollout remoto.

---

## Simulação produtiva/comercial

### Complementar (proposta, pendente decisão de produto)

A simulação produtiva/comercial é uma capacidade técnica integrada na Fase 23, formalmente encerrada. Compara cenários a partir de fatos observados e premissas explícitas; é efêmera e não persiste Evento, Agenda, estado operacional ou transação. Não produz recomendação autônoma, autorização comercial ou decisão veterinária. A proposta complementar não foi aprovada como decisão de produto e não torna a simulação requisito de aceite do MVP.

---

## Financeiro e KPIs

### Parcial

- custos operacionais;
- snapshots;
- valores de compra/venda;
- indicadores básicos.

### Futuro

- DRE;
- margem por lote avançada;
- custo por arroba confiável;
- ROI;
- rateio completo;
- análise preditiva.

---

## Insights e sinais

### Capacidades MVP

- painel read-only;
- pendências;
- sinais auxiliares;
- status completo/parcial/vazio/bloqueado;
- fonte e limitação declaradas.

### Bloqueado

- criar evento;
- criar agenda;
- persistir decisão crítica;
- liberar carência/venda/abate;
- definir peso confiável.

---

## Sync/offline

### MVP

- operação local offline-first com persistência e fila;
- retry, idempotência e recuperação nos contratos que os implementam.

### Parcial

- cobertura de retry/replay, rollback, reconcile e pull varia por domínio e store; a garantia de uma superfície não deve ser generalizada para todas as tabelas.
- indicadores e relatórios permanecem condicionados à cobertura dos fatos e aos fluxos de convergência disponíveis.

A implementação técnica, os testes versionados e o rollout são dimensões separadas; a matriz de rastreabilidade lista as evidências por capacidade.

---

## Supabase/RLS

### Capacidades MVP

- Auth;
- Postgres;
- RLS;
- isolamento por `fazenda_id`;
- roles/membership;
- RPCs validadas;
- baseline funcional.

### Riscos

- policy ampla;
- RPC sem validação de fazenda;
- FK sem `fazenda_id`;
- client com lógica de autorização crítica.

---

## Critério de atualização

Atualizar este mapa quando:

- uma capacidade muda de status;
- uma lacuna é resolvida;
- uma capacidade sai do MVP;
- uma nova área entra no escopo;
- uma decisão crítica ganha fonte técnica explícita;
- o roadmap muda.

Não atualizar para ajuste visual ou patch sem impacto de capacidade.