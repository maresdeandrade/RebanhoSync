```markdown
# Antigravity Prompt — Risk Review

Use para revisar riscos antes de implementar ou aprovar uma mudança.

## Mudança Proposta

```txt
[DESCREVER_MUDANCA]

```

### Escopo

* `[ARQUIVOS_OU_DOMINIOS]`

---

## Avaliação de Riscos

Analise a proposta com base nas seguintes categorias de ameaça:

### 1. Produto

* Confusão para o usuário no campo;
* Aumento desnecessário de passos no fluxo;
* Perda de clareza operacional;
* Decisão crítica tomada sem fonte confiável.

### 2. Domínio e Invariantes

* **Agenda:** Tratada indevidamente como histórico;
* **Evento:** Tratado de forma não factual;
* **`state_*`:** Utilizado incorretamente como histórico;
* **Protocolo:** Tratado como execução ativa;
* **Tags/Sinais/Insights:** Virando regra ou fonte primária;
* **Métricas Críticas:** Carência, venda ou abate sem fonte técnica explícita.

### 3. Técnico e Arquitetura

* Quebra do modelo *offline-first*;
* Operação ou comando não idempotente;
* Perda de capacidade de *rollback*;
* Duplicidade de fonte de verdade;
* Regra de negócio crítica acoplada na UI;
* *Sync* parcial sem mecanismo de *reconcile*;
* Conflito ou vazamento *multi-tenant*.

### 4. Segurança

* *Bypass* ou falha de RLS;
* Quebra de isolamento estrito por `fazenda_id`;
* Exposição de tokens ou chaves no *client*;
* *Client* operando com privilégio indevido (`service_role`).

### 5. Testes

* Teste ausente para o novo comportamento;
* Teste frágil ou dependente de estado volátil;
* Cobertura insuficiente de cenários de exceção (*edge cases*);
* Regressão de comportamento anterior não coberta.

---

## Classificação de Severidade

Classifique cada risco identificado sob uma das seguintes métricas:

* 🟢 **Baixo**
* 🟡 **Médio**
* 🔴 **Alto**
* ❌ **Bloqueante**

---

## Matriz de Riscos

| Risco | Severidade | Evidência / Gatilho | Mitigação Proposta | Bloqueia a Entrega? |
| --- | --- | --- | --- | --- |
| [Nome do Risco] | `[Status]` | [Onde/Como ocorre no código] | [Ação para neutralizar] | [Sim/Não] |

---

## Entrega e Veredito

Responder com a seguinte estrutura conclusiva:

* **Veredito:** [APROVADO | APROVADO COM RESSALVAS | REJEITADO]
* **Riscos bloqueantes:** [Lista de pontos que impedem o avanço imediato]
* **Ajustes mínimos:** [O que deve ser corrigido antes da implementação]
* **Testes obrigatórios:** [Cenários específicos que precisam de cobertura de teste]
* **Recomendação final:** [Orientação estratégica para os próximos passos]

```

```