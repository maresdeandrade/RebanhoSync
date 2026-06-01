```md
# Agro Base — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir a base conceitual agropecuária usada pelo RebanhoSync.

Este arquivo estabelece vocabulário comum e fronteiras entre os domínios.  
Detalhes específicos ficam nos documentos próprios de cada área.

---

## Escopo do produto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

### Foco principal
- controle de rebanho;
- manejo operacional;
- agenda de tarefas;
- registro de eventos;
- lotes e pastos;
- sanidade;
- reprodução;
- movimentação;
- compra/venda;
- custos e indicadores operacionais.

### Não é foco imediato
- ERP fiscal completo;
- emissão fiscal;
- NF-e;
- contabilidade completa;
- automação crítica de venda/abate;
- decisão sanitária sem fonte técnica explícita.

---

## Contrato central

```txt
Agenda = intenção/tarefa futura
Evento = fato executado
state_* = estado atual/read model
Protocolo = regra/configuração
Tags/sinais/insights = auxiliares

```

### Detalhes

* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`

---

## Entidades centrais

| Entidade | Papel |
| --- | --- |
| **Fazenda** | Unidade operacional e fronteira multi-tenant. |
| **Animal** | Unidade individual de gestão zootécnica, sanitária, reprodutiva e econômica. |
| **Lote** | Agrupamento operacional de animais. |
| **Pasto** | Unidade física/produtiva de alocação. |
| **Manejo** | Ação planejada ou executada. |
| **Agenda** | Tarefa futura ou pendência. |
| **Evento** | Fato histórico executado. |
| **Protocolo** | Regra/configuração para orientar manejo. |
| **Produto/Insumo** | Recurso usado em manejo sanitário, nutricional ou operacional. |
| **Contraparte** | Pessoa ou empresa ligada a compra, venda, serviço ou movimentação. |

---

## Fazenda

A fazenda é a fronteira operacional e de segurança.

### Regras

* todo dado operacional sensível deve respeitar `fazenda_id`;
* não pode haver relação cross-tenant indevida;
* RLS deve proteger dados por vínculo usuário/fazenda;
* UI não é barreira suficiente de autorização.

---

## Animal

Animal é a unidade individual de gestão.

Pode ter: identificação, sexo, raça, categoria, estágio, status, origem, destino, lote atual, pasto atual, histórico de eventos e estado atual consolidado.

### Não inferir automaticamente

* peso atual confiável;
* aptidão para venda;
* aptidão para abate;
* carência ativa/livre;
* liberação sanitária.

### Detalhes

* `docs/domain/ANIMAIS_TAXONOMIA.md`

---

## Lote e pasto

Lote é agrupamento operacional.

Pasto é unidade física/produtiva.

Podem apoiar: localização, manejo, lotação, movimentação e análise operacional.

### Não inferir automaticamente

* tempo de lotação confiável;
* ganho de peso por período;
* produtividade do pasto;
* histórico completo de permanência;
* sem eventos, datas e fontes suficientes.

### Detalhes

* `docs/domain/LOTES_PASTOS.md`

---

## Manejo

Manejo pode estar em dois estados conceituais:

| Situação | Fonte |
| --- | --- |
| Planejado/pendente | Agenda |
| Executado | Evento |

> ⚠️ **Regra:** Manejo planejado não é manejo executado.

---

## Sanidade

Sanidade envolve: protocolos, agenda sanitária, eventos sanitários, produtos, doses, estoque, compliance e biossegurança.

### Separação obrigatória

| Conceito | Fonte |
| --- | --- |
| Regra sanitária | Protocolo/configuração |
| Tarefa sanitária | Agenda |
| Aplicação realizada | Evento sanitário |
| Produto aplicado | Detail do evento sanitário |
| Compliance/checklist | Camada regulatória/auxiliar |
| Carência | Fonte técnica explícita |

### Detalhes

* `docs/domain/SANITARIO.md`

---

## Reprodução

No escopo confirmado principal, reprodução envolve: parto, pós-parto, cria, vínculo mãe-cria e agenda derivada da cria.

### Não assumir motor amplo de

* IATF;
* cobertura;
* IA;
* diagnóstico de gestação;
* reconcepção;
* sem validação específica.

### Detalhes

* `docs/domain/REPRODUCAO.md`

---

## Compra, venda e saída

Compra/venda envolve: entrada, saída, contraparte, valor, custo, snapshot econômico e status patrimonial.

### Não inferir automaticamente

* pronto para venda;
* apto para abate;
* margem final confiável;
* custo total consolidado;
* liberação sanitária.

### Detalhes

* `docs/domain/COMPRA_VENDA.md`

---

## Tags, sinais e insights

São auxiliares.

### Podem

* alertar;
* filtrar;
* priorizar;
* compor painel;
* indicar limitação.

### Não podem

* ser fonte primária;
* provar execução;
* substituir evento;
* substituir agenda;
* substituir `state_*`;
* liberar carência;
* autorizar venda/abate.

### Detalhes

* `docs/domain/TAGS_SIGNALS_CONTRACT.md`

---

## Decisões bloqueadas sem fonte técnica explícita

Não afirmar nem automatizar sem fonte própria:

* carência ativa;
* livre de carência;
* peso atual confiável;
* pronto para venda;
* apto para abate;
* liberação sanitária;
* conformidade regulatória universal;
* protocolo executado;
* agenda concluída como fato histórico.

---

## Critério de aceite

Uma funcionalidade respeita a base agropecuária quando:

* identifica a fonte de verdade correta;
* separa intenção, fato, estado e regra;
* preserva rastreabilidade;
* respeita `fazenda_id`;
* não infere decisão crítica sem fonte;
* declara limitações quando a fonte é parcial;
* não transforma UX auxiliar em regra operacional.

```

```