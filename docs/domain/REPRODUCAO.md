# Reprodução — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir o contrato de domínio reprodutivo do RebanhoSync, com foco no escopo confirmado: parto, pós-parto, cria e vínculo determinístico mãe-cria.

Este documento também impede que fluxos reprodutivos amplos sejam assumidos sem validação real.

---

## Escopo confirmado principal

O escopo confirmado principal envolve:

* parto;
* pós-parto;
* cria;
* vínculo mãe-cria;
* evento reprodutivo;
* criação inicial da cria;
* agenda derivada da cria quando aplicável;
* acompanhamento inicial.

---

## Escopo não confirmado como motor amplo

Não assumir sem validação específica:

* IATF ampla;
* cobertura;
* inseminação artificial completa;
* diagnóstico de gestação;
* reconcepção;
* estação de monta completa;
* indicadores reprodutivos avançados;
* motor universal de calendário reprodutivo.

> ⚠️ **Regra:** Esses temas podem existir futuramente, mas não devem ser inferidos.

---

## Contrato central

| Conceito | Fonte |
| --- | --- |
| **Parto realizado** | Evento reprodutivo |
| **Cria nascida** | Animal criado/vinculado + evento de origem |
| **Pós-parto** | Evento ou agenda relacionada ao episódio |
| **Tarefa futura da cria** | Agenda |
| **Estado atual da cria** | `state_*` ou read model |
| **Regra de acompanhamento** | Protocolo/configuração |

---

## Parto

Parto é fato histórico.

> ⚠️ **Fonte correta:** Evento de parto / evento reprodutivo.

Deve registrar, conforme fluxo: mãe, data, resultado, cria (se houver), sexo da cria (se conhecido), status inicial, observações, responsável e vínculo com fazenda.

### Parto pode gerar

* criação de animal/cria;
* agenda de cuidados da cria;
* agenda de pós-parto;
* atualização de estado reprodutivo;
* vínculo determinístico mãe-cria.

### Parto não pode ser apenas

* agenda futura;
* protocolo;
* checklist;
* sinal visual.

---

## Cria

Cria é animal individual gerado por parto ou cadastrado com origem declarada.

Deve preservar: vínculo com mãe (quando conhecido), vínculo com evento de parto (quando aplicável), `fazenda_id`, identidade própria, status inicial, data de nascimento (se conhecida) e origem.

> ⚠️ **Regra:** Não criar cria órfã quando o fluxo exige mãe/parto. Não duplicar cria em retry.

---

## Pós-parto

Pós-parto pode ser: evento de avaliação, agenda de acompanhamento, checklist operacional ou sinal de pendência.

> ⚠️ **Regra:** Pós-parto planejado é agenda. Pós-parto realizado é evento.

---

## Agenda da cria

Agenda da cria pode incluir: cura de umbigo, D7, D30, vacinação inicial, desmame, pesagem e outras rotinas configuradas.

> ⚠️ **Regra:** Agenda da cria é intenção futura. Não comprova execução.

---

## Vínculo determinístico

Fluxo esperado:

```txt
Mãe ──> Evento de parto ──> Cria ──> Agenda/estado inicial

```

Esse vínculo deve ser rastreável.

### Riscos

* cria sem mãe quando obrigatória;
* cria sem evento de origem;
* evento sem cria quando deveria criar;
* duplicidade de cria;
* agenda da cria duplicada;
* retry criando múltiplos registros;
* rollback incompleto.

---

## Estado atual reprodutivo

Estado atual pode ser lido por `state_*` ou read model equivalente. Não deve substituir histórico.

### Exemplos

* parida;
* vazia;
* prenhe;
* em pós-parto;
* desconhecido.

> ⚠️ **Regra:** Só afirmar estado reprodutivo if houver fonte explícita ou read model validado.

---

## IATF e reprodução ampla

### Status

Não confirmado como motor amplo.

### Regra

Não criar documentação ou UI afirmando suporte amplo se o código não validar.

Termos que exigem confirmação: IATF, IA, cobertura, touro em estação, diagnóstico de gestação, reconcepção, taxa de prenhez, intervalo entre partos e taxa de desmame.

---

## Indicadores reprodutivos

Só calcular com fonte adequada.

| Indicador | Fonte necessária |
| --- | --- |
| Nascimentos no período | Eventos de parto |
| Crias vivas | Eventos + status atual |
| Mortalidade de cria | Eventos de óbito + vínculo |
| Pós-parto pendente | Agenda aberta |
| Pós-parto executado | Evento |
| Taxa de prenhez | Fonte reprodutiva validada |
| Intervalo entre partos | Eventos de parto da mesma matriz |

---

## Edge cases

Verificar:

* parto sem cria;
* natimorto;
* aborto, se modelado;
* cria sem sexo informado;
* mãe vendida/morta;
* cria duplicada por retry;
* agenda duplicada da cria;
* pós-parto realizado sem evento;
* alteração manual de data de nascimento;
* vínculo mãe-cria corrigido;
* cria cadastrada sem evento por inventário inicial.

---

## Relação com sanitário

Cuidados sanitários da cria devem respeitar o domínio sanitário.

### Exemplos

* cura de umbigo planejada = agenda;
* cura realizada = evento sanitário ou evento operacional modelado;
* produto usado = detail sanitário;
* carência = não inferir.

---

## Relação com animais/taxonomia

Cria é animal. A categoria/estágio inicial deve seguir o arquivo `docs/domain/ANIMAIS_TAXONOMIA.md`.

> ⚠️ Não inferir estágio futuro sem regra validada.

---

## Validação

Mudanças reprodutivas devem considerar:

* teste de parto;
* teste de criação de cria;
* teste de vínculo mãe-cria;
* teste de agenda derivada;
* teste de duplicidade/retry;
* teste de rollback, se offline;
* teste de RLS se backend for alterado.

### Referências

* `.agents/skills/reproducao-parto-posparto-cria/SKILL.md`
* `docs/technical/TESTING_GATES.md`

---

## Critério de aceite

Uma mudança em reprodução é aceitável quando:

* evento representa fato;
* agenda representa tarefa futura;
* cria tem identidade própria;
* vínculo mãe-cria é rastreável;
* não há duplicidade em retry;
* não assume IATF ampla sem fonte;
* não cria estado reprodutivo crítico sem base;
* declara limitações quando a fonte é parcial.

```


```