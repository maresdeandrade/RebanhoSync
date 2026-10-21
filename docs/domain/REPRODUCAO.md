# Reprodução — RebanhoSync

Atualizado em: 2026-10-20

**Baseline documental original:** `32d7779`

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

## Registro factual implementado e escopo

Na baseline de código `origin/main@27a3bed`, há implementação versionada para registrar cobertura e IA, diagnóstico vinculado a episódio, parto, aborto/perda gestacional, vínculo mãe-cria e correções factuais quando modeladas. Eventos e detalhes reprodutivos sustentam projeções reconstruíveis de estado; essas projeções permanecem `state_*`/read models, não histórico. Referências: `src/lib/reproduction/register.ts`, `src/lib/reproduction/status.ts`, `src/lib/reproduction/remoteSync.ts` e testes `src/lib/reproduction/__tests__/register.test.ts`, `src/lib/reproduction/__tests__/status.test.ts`, `src/lib/reproduction/__tests__/remoteSync.test.ts`. A Fase 13 consta como funcionalmente encerrada em `docs/context/PROJECT_STATUS.md`; esses testes versionados não foram executados nesta reconciliação e não comprovam deployment remoto.

Essa capacidade factual individual não foi encontrada como inclusão explícita no MVP consultado. Não convertê-la em compromisso de produto nem confundi-la com automação ampla.

---

## Escopo não confirmado como motor amplo

Não assumir como suporte implementado ou capacidade do MVP:

* motor amplo de IATF;
* automação integral de IA/cobertura;
* motor abrangente de diagnóstico de gestação/reconcepção;
* estação de monta completa;
* indicadores reprodutivos avançados;
* motor universal de calendário reprodutivo.

> **Regra:** Registro factual individual de cobertura/IA/diagnóstico não comprova automação ampla, decisão clínica ou performance reprodutiva avançada; possibilidade futura não é compromisso de desenvolvimento sem roadmap aprovado.

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

Não há comprovação de motor amplo. O registro factual individual descrito em “Registro factual implementado e escopo” é uma capacidade distinta.

### Regra

Não afirmar suporte a automação ampla, decisão clínica, calendário universal, estação de monta ou indicadores avançados com base apenas em Evento individual ou projeção.

Termos que exigem qualificação explícita: “IATF automatizada”, “IA/cobertura integral”, “diagnóstico automatizado”, reconcepção, taxa de prenhez, intervalo entre partos e taxa de desmame.

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
* aborto/perda gestacional, com Evento factual e vínculo ao episódio quando disponível;
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