# Capability Map — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Mapear as capacidades do RebanhoSync por área funcional, com status de produto e limites de escopo.

Este documento não substitui validação no código. Ele orienta priorização e evita expansão indevida.

---

## Status

| Status | Significado |
|---|---|
| MVP | Capacidade esperada no MVP/beta operacional. |
| Parcial | Capacidade existe ou pode existir com limitações. |
| Futuro | Capacidade desejável, mas fora do foco imediato. |
| Bloqueado | Não implementar/afirmar sem fonte técnica explícita. |
| Fora de escopo | Não pertence ao MVP atual. |

---

## Mapa resumido

| Área | Capacidade | Status |
|---|---|---|
| Rebanho | Cadastro e identificação animal | MVP |
| Rebanho | Status atual do animal | MVP |
| Rebanho | Histórico por eventos | MVP |
| Rebanho | Categoria/estágio | MVP/Parcial |
| Rebanho | Peso atual confiável | Bloqueado |
| Agenda | Pendências futuras | MVP |
| Agenda | Vencidos/hoje | MVP |
| Agenda | Agenda como histórico | Bloqueado |
| Eventos | Registro de fatos | MVP |
| Eventos | KPIs históricos | MVP/Parcial |
| Sanitário | Protocolo sanitário | MVP |
| Sanitário | Agenda sanitária | MVP |
| Sanitário | Evento sanitário | MVP |
| Sanitário | Produto/dose/lote | MVP/Parcial |
| Sanitário | Carência automática | Bloqueado |
| Reprodução | Parto/cria/pós-parto | MVP |
| Reprodução | IATF ampla | Futuro/Bloqueado |
| Lotes/Pastos | Estrutura produtiva | MVP |
| Lotes/Pastos | Movimentação | MVP |
| Lotes/Pastos | Lotação histórica | Parcial |
| Compra/Venda | Compra/venda básica | MVP/Parcial |
| Compra/Venda | Sociedade pecuária | MVP/Parcial |
| Compra/Venda | Pronto para venda | Bloqueado |
| Financeiro | Custos/snapshots | Parcial |
| Financeiro | KPI financeiro avançado | Futuro |
| Insights | Painel read-only | MVP/Parcial |
| Insights | Sinais auxiliares | MVP |
| Insights | Decisão crítica | Bloqueado |
| Sync | Offline-first | MVP |
| Sync | Rollback/retry/reconcile | MVP |
| Supabase | RLS/multi-tenant | MVP |
| Fiscal | NF-e/SPED/contábil | Fora de escopo |

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

Não inferir:

- peso atual confiável;
- venda/abate;
- carência;
- aptidão reprodutiva;
- liberação sanitária.

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
- linha do tempo;
- base para KPIs históricos;
- auditoria operacional;
- detail tables quando aplicável.

### Limites

Evento sem detail suficiente deve declarar limitação.

---

## Sanitário

### Capacidades MVP

- protocolo sanitário;
- agenda sanitária;
- registro sanitário;
- produto/dose;
- vínculo com estoque quando implementado;
- baixa idempotente quando aplicável;
- compliance/checklist como camada auxiliar.

### Parcial

- custo sanitário consolidado;
- estoque avançado;
- compliance regulatório;
- biossegurança operacional;
- suspeita clínica.

### Bloqueado

- carência ativa;
- livre de carência;
- liberação para abate/venda.

---

## Reprodução

### Capacidades MVP

- parto;
- cria;
- vínculo mãe-cria;
- pós-parto;
- agenda da cria quando aplicável.

### Futuro ou bloqueado sem validação

- IATF;
- IA;
- cobertura;
- diagnóstico de gestação;
- reconcepção;
- indicadores avançados.

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

Esses cálculos dependem de eventos e datas suficientes.

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

### Capacidades MVP

- operação local;
- fila;
- gesture;
- retry;
- rollback;
- reconcile;
- idempotência;
- sucesso parcial explícito.

### Riscos

- duplicidade por retry;
- rollback parcial;
- sync cross-tenant;
- fila presa;
- baixa duplicada.

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