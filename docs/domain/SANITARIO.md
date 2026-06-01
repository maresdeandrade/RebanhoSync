# Sanitário — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir o contrato de domínio sanitário do RebanhoSync.

Este documento separa registro operacional, protocolo sanitário, agenda sanitária, evento sanitário, produto, estoque, compliance, suspeita clínica, biossegurança e carência.

---

## Escopo

Este documento cobre:

* protocolo sanitário;
* agenda sanitária;
* evento sanitário;
* vacinação;
* vermifugação;
* tratamento;
* exame;
* produto veterinário;
* dose;
* lote de estoque;
* baixa de estoque;
* custo/snapshot sanitário;
* compliance regulatório;
* checklist;
* suspeita clínica;
* biossegurança;
* carência como lacuna bloqueada.

---

## Contrato central

| Conceito | Fonte |
| --- | --- |
| **Regra sanitária** | Protocolo/configuração |
| **Tarefa sanitária** | Agenda |
| **Aplicação executada** | Evento sanitário |
| **Produto aplicado** | Detail do evento sanitário |
| **Estoque consumido** | Movimento/baixa vinculada ao evento |
| **Checklist/compliance** | Camada auxiliar/regulatória |
| **Carência** | Fonte técnica explícita, não inferida |

---

## Protocolo sanitário

Protocolo sanitário é regra/configuração.

Pode definir: tipo de manejo, produto previsto, intervalo, sequência, público-alvo, recorrência e regra de geração de agenda.

### Protocolo pode

* gerar agenda;
* orientar rotina;
* padronizar manejo;
* recalcular pendências.

### Protocolo não pode

* comprovar execução;
* afirmar produto aplicado;
* indicar que animal recebeu dose;
* afirmar carência;
* liberar venda/abate.

---

## Agenda sanitária

Agenda sanitária representa intenção/tarefa futura.

Pode responder: o que está pendente, o que vence hoje, o que está atrasado e qual manejo deve ser feito.

Não pode responder: o que foi executado, qual produto foi aplicado, se o protocolo foi cumprido, se o animal está livre de carência ou se está apto para venda/abate.

> ⚠️ **Regra:** Agenda sanitária concluída sem evento vinculado não deve ser tratada como histórico confiável.

---

## Evento sanitário

Evento sanitário representa execução real.

Deve conter, conforme fluxo: animal ou lote, data, tipo de manejo, produto, dose, unidade, responsável, observação, protocolo vinculado (se aplicável), agenda vinculada (se aplicável) e lote de estoque (se consumido).

### Evento sanitário pode responder

* o que foi aplicado;
* quando foi aplicado;
* em quem foi aplicado;
* quem registrou;
* qual produto/dose foi usada;
* se houve consumo de estoque.

---

## Produto veterinário

Produto veterinário é referência estruturada.

Pode conter: nome, princípio ativo, concentração, unidade, fabricante, categoria, indicação, informações técnicas e restrições.

> ⚠️ **Regra:** Produto cadastrado não significa produto aplicado. Produto previsto em protocolo não significa produto executado.

---

## Estoque e lote

Consumo sanitário deve ser rastreável quando houver baixa de estoque.

Deve preservar: lote de estoque, quantidade, unidade, custo quando disponível, vínculo com evento, idempotência, rollback e sucesso parcial como exceção.

### Riscos

* baixa duplicada em retry;
* evento sem baixa quando deveria consumir;
* baixa sem evento;
* produto sem lote;
* custo ausente tratado como zero real;
* estoque negativo sem regra explícita.

---

## Custo/snapshot sanitário

Quando houver custo vinculado ao consumo sanitário, o evento deve preservar snapshot econômico suficiente. Não depender apenas do estado atual do estoque para recompor custo histórico.

> ⚠️ **Regra:** Custo histórico precisa ser auditável no momento da execução ou por fonte econômica explícita.

---

## Compliance regulatório

Compliance sanitário é camada separada.

Pode envolver: catálogo oficial, overlay por fazenda/UF, feed-ban, doença notificável, suspeita clínica, checklist documental, biossegurança e alertas regulatórios.

### Compliance pode

* alertar;
* indicar pendência;
* orientar validação;
* exigir revisão;
* gerar checklist;
* bloquear se houver regra explícita.

### Compliance não pode

* criar evento sem ocorrência real;
* comprovar execução;
* inferir carência;
* liberar venda/abate;
* substituir protocolo operacional.

---

## Suspeita clínica

Suspeita clínica não é diagnóstico final automaticamente.

Deve declarar: ocorrência, sinais observados, data, animal/lote, responsável, status, necessidade de avaliação, evolução e eventual evento clínico ou sanitário.

> ⚠️ **Regra:** Suspeita pode gerar alerta/checklist/pendência, mas não deve virar diagnóstico ou evento executado sem fonte.

---

## Biossegurança

Biossegurança pode ser tratada como: checklist, ocorrência, pendência documental, alerta, rotina de verificação ou item de compliance.

> ⚠️ **Regra:** Checklist de biossegurança deve ser simples, operacional e preenchido quando houver ocorrência ou alteração relevante. Não transformar checklist disponível em evento executado.

---

## Carência

Carência é decisão bloqueada sem fonte técnica explícita.

### Não afirmar

* carência ativa;
* livre de carência;
* data segura de abate;
* data segura de venda;
* liberação sanitária.

### Fonte necessária

Uma fonte futura válida deve considerará, no mínimo: produto, espécie/categoria, dose, via, data de aplicação, regra técnica de carência, validade, exceções e fonte normativa/técnica.

> ⚠️ Até existir essa fonte consolidada, a resposta deve ser bloqueada ou parcial.

---

## Venda/abate

Sanitário sozinho não deve liberar venda/abate. Venda/abate exige composição explícita com: status animal, peso confiável (se necessário), carência, sanidade, regra comercial, documentação e fonte técnica.

---

## Edge cases

Verificar:

* agenda sanitária vencida;
* agenda concluída sem evento;
* evento sem produto;
* produto sem dose;
* produto sem lote de estoque;
* custo ausente;
* retry duplicando baixa;
* animal vendido/morto com pendência sanitária;
* lote misto;
* protocolo alterado após evento;
* compliance regulatório sem aplicabilidade;
* suspeita clínica sem confirmação;
* checklist sem ocorrência.

---

## Validação

Mudanças sanitárias devem validar conforme risco:

* teste de domínio sanitário;
* teste de agenda → evento;
* teste de estoque/baixa;
* teste de idempotência;
* teste de rollback;
* baseline Supabase se tocar RPC/RLS/migration.

### Referências

* `docs/technical/TESTING_GATES.md`
* `.agents/skills/sanitario-registro-operacional/SKILL.md`
* `.agents/skills/sanitario-catalogo-regulatorio-compliance/SKILL.md`

---

## Critério de aceite

Uma mudança sanitária é aceitável quando:

* separa protocolo, agenda, evento e compliance;
* não trata agenda como histórico;
* não trata protocolo como execução;
* não infere carência;
* não libera venda/abate;
* preserva produto/dose/lote quando necessário;
* mantém baixa de estoque idempotente;
* declara limitações;
* respeita offline-first e RLS.

```


```