# Manual da Tela — Sanitário

Atualizado em: 2026-07-12
**Baseline Commit:** `32d7779`

## Para que serve

A Central Sanitária ajuda a organizar protocolos, janelas sanitárias, agenda sanitária local, histórico sanitário, pendências documentais, produtos, estoque, ocorrências e sinais sanitários.

Use para:

* consultar protocolos;
* avaliar janelas sanitárias;
* usar contexto operacional explícito na pré-checagem;
* ver pendências sanitárias;
* planejar agenda sanitária manual local;
* consultar eventos sanitários;
* consultar histórico sanitário anterior à entrada;
* consultar pendências documentais;
* acompanhar produtos e custos, quando disponíveis;
* ver sinais de carência sanitária;
* registrar ocorrências ou suspeitas, quando aplicável.

---

## Conceitos principais

### Protocolo sanitário

É a regra ou configuração do manejo.

> 💡 **Exemplo:** Vacinar categoria X a cada Y dias.
> ⚠️ **Atenção:** O protocolo configurado **não** prova que a aplicação foi feita.

### Agenda sanitária

Representa uma tarefa futura ou pendência programada.

> 💡 **Exemplo:** Vacina prevista para hoje.
> ⚠️ **Atenção:** Agenda sanitária **não** é evento sanitário.

Na Central Sanitária, a agenda manual local representa intenção futura. Reagendar agenda não executada altera apenas a data planejada. Cancelar agenda não executada altera apenas o status da agenda.

### Evento sanitário

Representa a aplicação ou ocorrência executada e registrada formalmente.
**Exemplos:** vacina aplicada, vermífugo aplicado, tratamento realizado, exame registrado ou ocorrência sanitária registrada.

> 📌 **Regra:** O evento é a única fonte histórica factual e confiável de manejo.

### Contexto operacional

Algumas janelas sanitárias dependem de contexto externo informado explicitamente, como área de risco para raiva, cadência anual/semestral, contexto reprodutivo ou manejo.

> ⚠️ **Atenção:** Contexto operacional ajuda a avaliar a janela, mas não substitui fonte técnica nem execução.

Se o contexto necessário não estiver informado, a pré-checagem pode permanecer como `Dados insuficientes`.

### Histórico sanitário anterior

Histórico sanitário anterior é usado para registrar fatos anteriores à entrada do animal no app/fazenda, especialmente em compra, importação ou cadastro inicial.

Pode aparecer separado como:

* histórico executado;
* histórico externo documentado;
* declarações;
* pendências documentais;
* agenda futura.

Declaração sem documento pode não liberar pendências críticas.

### Produto, dose e lote

Quando aplicável, o registro de evento sanitário pode conter: produto, dose, via de aplicação, lote de estoque utilizado, responsável, custo e período de carência.

---

## Carência sanitária

A carência sanitária pode aparecer como um sinal visual de auxílio quando houver um evento sanitário estruturado que dê suporte a ela.

### Exemplos de copy adequada na UI

* ✅ `Carência sanitária ativa até [data], conforme evento sanitário registrado.`
* ✅ `Sem carência sanitária vigente nas fontes estruturadas disponíveis.`

> ⚠️ **Regra Crítica:** O sinal de carência sanitária é apenas uma dimensão sanitária isolada. Ele **não** significa:
> * Liberado para venda.
> * Apto para abate.
> * Liberação sanitária final.
> 
> 

### Fontes válidas para carência sanitária

A carência deve vir exclusivamente de um evento sanitário estruturado, contendo dados como: data do evento, produto aplicado, regra técnica ou snapshot aplicado, identificação de animal/lote e campo estruturado de carência preenchido.

### Fontes insuficientes para carência

**Nunca** use como prova ou cálculo de carência: agenda aberta, protocolo isolado, checklist geral, ausência de pendência/ocorrência, tags visuais livres ou observações em texto aberto.

---

## Biossegurança e checklist

O checklist sanitário ou de biossegurança serve para orientar a rotina e registrar o contexto operacional da fazenda.

* ⚠️ **Atenção:** O preenchimento de um checklist **não** é prova universal de conformidade regulatória.
* Uma ocorrência real registrada deve gerar uma pendência corretiva específica na agenda se houver ação necessária pendente.

### Suspeita ou doença notificável

Quando existir o fluxo, a suspeita clínica ou ocorrência sanitária deve ser registrada com um escopo claro e explícito: animal, animais afetados, lote, evento associado, observação e ação corretiva pendente (se houver).

> ⚠️ **Regra:** O registro de suspeita serve para alerta e triagem; ele **não** é um diagnóstico clínico final.

---

## Central Sanitária e filtros

A rota `/protocolos-sanitarios` concentra a operação sanitária completa.

Abas/superfícies esperadas:

* `Janelas sanitárias`;
* `Agenda sanitária`;
* `Catálogo sanitário`;
* `Histórico sanitário`;
* `Conformidade futura/desabilitada`.

Atalhos vindos do detalhe do animal ou do lote podem abrir a Central com filtro inicial aplicado.

* Filtro por animal mostra apenas/destaca o animal de origem.
* Filtro por lote lista apenas animais daquele lote.
* Se animal e lote vierem juntos, o animal tem prioridade e o lote fica como contexto auxiliar.
* `Limpar filtro` volta à visão geral.

> ⚠️ **Regra:** Filtro não cria agenda, evento, estoque, carência ativa ou fila de sincronização.

---

## Custo sanitário

O custo sanitário é calculado e registrado quando há a composição de: produto, quantidade, lote de estoque, custo unitário, custo total e o snapshot econômico da operação.

> ⚠️ **Regra:** Se o custo estiver ausente, o sistema deve exibir uma limitação clara (Ex: `Custo não informado.`). **Nunca** trate um custo em branco como custo zero real (`R$ 0,00`).

---

## O que não interpretar errado

| Informação | Não significa |
| --- | --- |
| **Protocolo configurado** | Aplicação feita |
| **Agenda sanitária aberta** | Evento sanitário executado |
| **Agenda futura** | Histórico executado |
| **Histórico externo declarado** | Comprovação crítica documentada |
| **Contexto operacional preenchido** | Fonte técnica primária ou execução |
| **Filtro ativo na Central** | Operação executada |
| **Sem carência vigente nas fontes** | Liberado para venda ou abate (Aptidão comercial) |
| **Checklist sem alteração** | Conformidade universal garantida |
| **Produto cadastrado** | Produto aplicado |
| **Produto aplicado em tela** | Estoque baixado com sucesso (Requer evento associado) |
| **Custo ausente** | Custo zero (`R$ 0,00`) |

---

## Boas práticas

* Registrar a aplicação sanitária exatamente no momento do manejo no campo.
* Informar o produto, a dosagem exata e a via de administração em todos os manejos aplicados.
* Vincular o lote de estoque correto para garantir o rastreio econômico e de insumos.
* Conferir o status de sincronização (`sync`) após salvar registros em ambientes offline.
* Usar o campo de observações para detalhar reações adversas ou exceções no manejo.
* **Nunca** marcar uma agenda sanitária como "concluída" para gerar histórico se o manejo real não tiver um evento sanitário correspondente registrado.
* Usar `Registrar histórico anterior` apenas para fatos anteriores à entrada, mantendo evidência e observação quando disponíveis.
* Usar a Central Sanitária para planejamento completo; usar detalhes de animal/lote apenas como resumo contextual.

---

## Erros comuns

* **“O protocolo aparece na tela, então o animal já foi tratado”**
Incorreto. O protocolo é apenas a regra ou configuração de planejamento.
* **“A agenda sanitária está atrasada, então o animal está doente”**
Não necessariamente. Significa apenas que há uma tarefa de manejo pendente ou vencida.
* **“O sinal mostra 'Sem carência sanitária vigente', então posso mandar para o frigorífico”**
Não. Isso é apenas um indicador sanitário restrito aos dados do app. A liberação para abate exige composição de peso, documentação (GTA), regras comerciais e decisão humana.
* **“O checklist foi enviado sem alterações, então a fazenda está 100% em conformidade”**
Não. O checklist é uma ferramenta de apoio operacional e contextual, não uma auditoria regulatória universal.

---

## Quando acionar suporte

Acione o suporte se:

* um evento sanitário duplicar no histórico após a sincronização;
* o produto aplicado desaparecer da linha do tempo do animal;
* a baixa de estoque não ocorrer ou duplicar após o registro do evento sanitário;
* o cálculo ou sinal visual de carência aparecer com datas incorretas;
* as tarefas da agenda sanitária não corresponderem aos protocolos configurados;
* um registro de ocorrência sanitária ou suspeita não for salvo;
* o app travar ou indicar falha de sync persistente ao salvar manejos sanitários.
