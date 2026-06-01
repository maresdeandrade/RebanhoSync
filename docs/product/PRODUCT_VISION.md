# Product Vision — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir a visão de produto do RebanhoSync, seu público-alvo, proposta de valor, posicionamento e limites estratégicos.

Este documento orienta decisões de escopo, UX, priorização e roadmap.

---

## Visão

RebanhoSync é um app agropecuário offline-first para ajudar produtores rurais a controlar o rebanho, organizar manejos, registrar eventos e tomar decisões operacionais com mais segurança.

O produto deve ser simples o suficiente para uso no campo e robusto o suficiente para preservar histórico, rastreabilidade e controle por fazenda.

---

## Público-alvo principal

Produtores e gestores de pecuária de corte de pequeno e médio porte.

### Perfil esperado

* rebanho em escala operacional gerenciável;
* rotina de campo com internet instável;
* necessidade de controle prático;
* pouca tolerância a sistemas complexos;
* foco em manejo, sanidade, movimentação, compra/venda e visão operacional;
* uso por proprietário, gerente, vaqueiro/cowboy ou equipe técnica.

---

## Problema

Na rotina de fazenda, informações importantes costumam ficar dispersas:

* caderno;
* memória do produtor;
* mensagens de WhatsApp;
* planilhas;
* notas fiscais/documentos;
* conhecimento do funcionário;
* observações não padronizadas.

### Riscos associados

* perder histórico;
* esquecer manejo;
* duplicar aplicação;
* errar lote/pasto;
* vender animal com informação incompleta;
* não saber custo real;
* não confiar nos dados.

---

## Proposta de valor

O RebanhoSync deve entregar:

* controle individual e por lote;
* agenda prática de manejos;
* registro histórico de eventos;
* funcionamento offline;
* sincronização segura;
* separação clara entre pendência e fato executado;
* visão operacional do dia;
* apoio a decisões sem inventar dados;
* rastreabilidade mínima para gestão confiável.

---

## Posicionamento

RebanhoSync não deve tentar ser um ERP rural completo no MVP.

```txt
App operacional offline-first para gestão prática de rebanho e manejo pecuário.

```

### Não posicionar como

* ERP fiscal completo;
* Sistema contábil rural;
* Motor automático de decisão de abate;
* Plataforma regulatória universal;
* Sistema preditivo avançado.

### Diferenciais

* **Offline-first real:** O produto deve funcionar em ambiente de campo com internet instável.
* **Separação entre intenção e fato:** Agenda não é histórico. Evento é fato executado.
* **Rastreabilidade operacional:** Toda operação relevante deve preservar fonte, data, vínculo e responsável quando aplicável.
* **Segurança multi-tenant:** Dados da fazenda devem respeitar isolamento por `fazenda_id` e RLS.
* **Simplicidade de uso:** Fluxos devem ser diretos, com baixa fricção e linguagem de campo.

---

## Princípios de produto

* Campo primeiro.
* Offline primeiro.
* Menos campos obrigatórios, mais rastreabilidade nos pontos críticos.
* Agenda organiza futuro.
* Evento preserva histórico.
* Estado atual deve ser claro.
* Sinal visual não pode virar regra crítica.
* Decisão bloqueada é melhor que decisão falsa.
* MVP deve ser confiável antes de ser amplo.

---

## Decisões críticas de produto

> ⚠️ **Regra:** Não automatizar sem fonte técnica explícita: carência activa, livre de carência, pronto para venda, apto para abate, peso atual confiável, conformidade regulatória universal, protocolo executado ou agenda concluída como fato histórico.

Esses temas podem aparecer como bloqueados, parciais ou dependentes de validação.

---

## Experiência esperada

O usuário deve conseguir responder rapidamente:

* O que tenho para fazer hoje?
* O que está atrasado?
* Onde estão meus animais?
* O que aconteceu com este animal?
* Quais manejos foram feitos?
* O que está pendente no sanitário?
* Quais animais/lotes exigem atenção?
* O que foi comprado ou vendido?
* Quais dados ainda faltam para uma decisão segura?

---

## Não objetivos do MVP

Não são objetivos imediatos:

* NF-e;
* SPED/fiscal;
* contabilidade completa;
* gestão bancária;
* folha de pagamento;
* marketplace;
* automação de abate;
* predição avançada;
* recomendação veterinária autônoma;
* compliance regulatório universal como bloqueio automático.

---

## Critério de sucesso do produto

O MVP é bem-sucedido se:

* o produtor consegue registrar a rotina principal;
* a agenda reduz esquecimento;
* o histórico de eventos é confiável;
* o app funciona offline;
* a sincronização não duplica operações;
* o usuário entende o que é pendência, histórico e estado atual;
* os dados críticos não são inferidos indevidamente;
* o sistema ajuda a operar melhor sem criar falsa segurança.

---

## Relação com outros documentos

* **Regras de fonte de verdade:** `docs/context/SOURCE_OF_TRUTH.md`
* **Lacunas conhecidas:** `docs/context/KNOWN_GAPS.md`
* **Base agropecuária:** `docs/domain/AGRO_BASE.md`
* **Escopo MVP:** `docs/product/MVP_SCOPE.md`
* **Fora de escopo:** `docs/product/OUT_OF_SCOPE.md`