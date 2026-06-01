```md
# Known Gaps — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Registrar lacunas conhecidas, bloqueios operacionais e pontos que não devem ser inferidos pelo app, por agentes ou por documentação derivada.

Este documento evita que funcionalidades parcialmente existentes sejam tratadas como fonte técnica completa.

---

## Status possíveis

| Status | Significado |
|---|---|
| Bloqueado | Não deve ser afirmado/automatizado sem nova fonte técnica explícita. |
| Parcial | Existe base parcial, mas insuficiente para decisão crítica. |
| Não confirmado | Não há validação suficiente do comportamento no estado atual. |
| Futuro | Pode entrar no roadmap, mas não deve ser assumido no MVP atual. |
| Permitido como auxiliar | Pode aparecer como sinal/UX, mas não como fonte primária. |

---

## Lacunas críticas

| Tema | Status | Regra |
|---|---|---|
| Carência ativa como sinal sanitário | Permitido com fonte estruturada | Apenas quando derivada de evento sanitário estruturado. |
| Sem carência sanitária vigente nas fontes estruturadas | Permitido com fonte estruturada | Não implica liberação comercial, venda ou abate. |
| Liberação sanitária final | Bloqueado | Exige contrato próprio e aceite de produto. |
| Aptidão comercial baseada em carência | Bloqueado | Carência isolada não autoriza venda/abate. |
| Peso atual confiável | Bloqueado | Não inferir apenas por última pesagem sem regra validada. |
| Pronto para venda | Bloqueado | Exige fonte comercial/técnica explícita. |
| Apto para abate | Bloqueado | Exige fonte sanitária, peso e regra técnica explícita. |
| Protocolo executado | Bloqueado | Protocolo isolado não comprova execução. |
| Agenda concluída como histórico | Bloqueado | Execução histórica exige evento. |
| IATF pendente amplo | Não confirmado | Não assumir motor reprodutivo amplo sem validação. |

---

## Carência sanitária

### Status

Permitido como **sinal sanitário** quando houver fonte estruturada suficiente.

Continua bloqueado como:

- liberação sanitária final;
- aptidão para venda;
- aptidão para abate;
- autorização comercial;
- decisão operacional crítica isolada.

### Fonte mínima permitida

Para exibir carência ativa ou ausência de carência vigente como sinal sanitário, a fonte deve vir de evento sanitário estruturado, com dados suficientes como:

- data do evento;
- produto ou regra aplicada;
- animal/lote vinculado;
- campos estruturados de carência, como `eventos_sanitario.carencia_*_ate`, quando existentes;
- vínculo com fonte técnica ou snapshot da regra aplicada.

### Fontes insuficientes

Não usar como fonte de carência:

- agenda sanitária;
- protocolo isolado;
- checklist;
- ausência de pendência;
- ausência de ocorrência;
- sinal visual;
- tag manual;
- conclusão de agenda sem evento.

### Regra

Carência sanitária pode ser exibida como sinal técnico limitado.

Não afirmar:

- liberação sanitária final;
- livre para venda;
- livre para abate;
- apto comercialmente;
- apto operacionalmente.

### Linguagem recomendada

Preferir:

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
````
---

## Peso atual confiável

### Status

Bloqueado.

### O que pode existir

- eventos de pesagem;
- último peso registrado;
- peso por lote;
- médias calculáveis;
- histórico de pesagem.

### O que não pode ser inferido automaticamente

- peso atual confiável;
- ganho esperado;
- peso projetado;
- aptidão comercial;
- aptidão para abate.

### Regra

Última pesagem não é automaticamente “peso atual confiável” sem política técnica de validade, método, data, margem e contexto.

---

## Venda/abate

### Status

Bloqueado.

### O que pode existir

- evento de venda;
- fluxo de compra/venda;
- custo;
- preço;
- status do animal;
- dados sanitários parciais;
- dados de peso parciais.

### O que não pode ser inferido

- pronto para venda;
- apto para abate;
- livre de restrição;
- margem final confiável sem custo consolidado;
- liberação sanitária.

### Regra

Venda/abate exige composição técnica explícita. Tags, sinais, agenda ou último peso não bastam.

---

## Agenda concluída

### Status

Bloqueado como histórico isolado.

### Risco

Tratar agenda concluída como fato pode produzir:

- histórico falso;
- KPI incorreto;
- baixa de estoque indevida;
- falsa execução de protocolo;
- auditoria inconsistente.

### Regra

Agenda concluída só pode participar de histórico se houver evento ou vínculo técnico explícito que comprove execução.

---

## Protocolo executado

### Status

Bloqueado.

### Regra

Protocolo é configuração/regra.  
Execução deve vir de evento.

Não usar frases como:

```txt
Protocolo executado
```

se a fonte for apenas protocolo, agenda ou checklist.

---

## Tags, sinais e insights

### Status

Permitido como auxiliar.

### Permitido

- alerta visual;
- filtro;
- priorização;
- card read-only;
- sinal de pendência;
- indicação de limitação.

### Proibido

- fonte primária;
- autorização operacional;
- bloqueio crítico isolado;
- prova de execução;
- carência;
- venda/abate;
- peso confiável;
- compliance universal.

---

## Compliance sanitário/regulatório

### Status

Parcial.

### O que pode existir

- base regulatória;
- catálogo;
- overlay;
- checklist;
- sinal;
- aviso;
- pendência documental.

### Risco

Transformar aviso regulatório em bloqueio universal sem regra explícita.

### Regra

Compliance precisa declarar:

- fonte;
- aplicabilidade;
- escopo;
- estado/UF se aplicável;
- validade;
- se é informativo, pendente, obrigatório ou bloqueante.

---

## Reprodução ampla/IATF

### Status

Não confirmado para motor amplo.

### Confirmar antes de assumir

- cobertura;
- IA;
- IATF;
- diagnóstico de gestação;
- reconcepção;
- calendário reprodutivo amplo;
- indicadores reprodutivos complexos.

### Regra

Fluxos confirmados devem ser tratados conforme implementação real.  
Não inferir motor reprodutivo amplo apenas por existir parto/cria/pós-parto.

---

## Financeiro/KPI avançado

### Status

Parcial/futuro, conforme área.

### Não assumir sem validação

- custo total consolidado por animal;
- custo por arroba confiável;
- margem final por lote;
- projeção de lucro;
- DRE completa;
- rateio automático universal;
- inventário financeiro completo.

### Regra

KPI financeiro deve declarar fonte, período, inclusão/exclusão e limitação.

---

## Lotes/pastos e lotação

### Status

Parcial conforme eventos e read models existentes.

### Não inferir sem fonte

- tempo de lotação confiável;
- histórico completo de permanência;
- ganho de peso por período;
- lotação média exata;
- taxa de ocupação histórica completa.

### Fonte esperada

- eventos de movimentação;
- eventos de pesagem;
- estado atual;
- datas de entrada/saída;
- lote/pasto explicitamente vinculado.

---

## Manual e suporte

### Status

Derivado.

Manuais não são fonte primária de regra de negócio.

Se manual e código divergirem:

1. confiar no código/migration ativa;
2. corrigir o manual;
3. registrar limitação se necessário.

---

## Como responder diante de lacuna

Quando a fonte for insuficiente, usar padrão:

```txt
Bloqueado como decisão operacional.
Fonte necessária: [fonte técnica].
Fonte disponível: [fonte atual].
Motivo: [risco].
```

Exemplo:

```txt
Não é seguro afirmar que o animal está livre de carência.
Fonte disponível: evento sanitário e produto.
Fonte necessária: regra consolidada de carência com data, produto, espécie/categoria e validade técnica.
```

---

## Critério de aceite

Uma nova funcionalidade respeita este documento quando:

- não transforma lacuna em decisão;
- declara fonte ausente;
- usa status parcial/bloqueado quando necessário;
- evita inferências críticas;
- mantém tags/sinais/insights como auxiliares;
- não usa manual ou auditoria antiga como fonte primária.

```