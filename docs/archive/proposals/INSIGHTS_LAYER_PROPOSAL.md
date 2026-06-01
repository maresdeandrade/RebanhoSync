# Proposta Tecnica: Camada `src/lib/insights/`

| Campo | Valor |
|---|---|
| Status | Proposta documental futura |
| Natureza | Arquitetura proposta, sem implementacao |
| Escopo | Camada read-only de composicao operacional |
| Base normativa | `docs/review/RebanhoSync_auditoria.md` |

---

## 1. Natureza da camada

`src/lib/insights/` deve ser proposta como camada futura de composicao operacional read-only.

Ela deve ser:

- camada read-only;
- camada de composicao operacional;
- camada de funcoes puras sempre que possivel;
- consumidora de dados ja carregados;
- emissora de resultados derivados com fonte, limite e classificacao explicitos.

Ela nao deve ser:

- dominio;
- infraestrutura;
- fonte primaria;
- motor de regra critica;
- responsavel por persistencia;
- responsavel por IO;
- responsavel por autorizacao;
- responsavel por mutacao local ou remota.

Modulos de insights recebem dados ja carregados por adapters, hooks, services ou read models externos. Modulos de insights nao acessam diretamente Supabase, Dexie, RPC, stores, hooks ou UI.

---

## 2. Nao objetivos

`src/lib/insights/` nao deve:

- criar eventos;
- concluir agenda;
- materializar agenda;
- recalcular protocolo sanitario;
- consultar Supabase/Dexie diretamente;
- persistir tags/marcadores;
- responder pronto para venda/abate;
- calcular carencia ativa conclusiva;
- gerar agenda por IA;
- implementar consulta em linguagem natural;
- criar motor geral IATF.

---

## 3. Estrutura futura proposta

Estrutura proposta, sem implementacao:

```txt
src/lib/insights/
  AGENTS.md
  README.md
  types.ts
  sourceContract.ts
  agendaNeeds.ts
  vaccineNeeds.ts
  sanitaryRiskSummary.ts
  lotOperationalSummary.ts
```

Modulos futuros/parciais, fora do MVP 1:

```txt
herdStageSummary.ts
reproductionSummary.ts
```

Modulos explicitamente bloqueados:

```txt
commercialReadiness.ts
tagClassifiers.ts
naturalLanguageInsights.ts
iatfAgendaEngine.ts
```

---

## 4. Contrato de retorno

Todo insight deve retornar um envelope com fonte e limites explicitos.

| Campo | Finalidade |
|---|---|
| `items` | Resultado derivado |
| `source.primary` | Fonte primaria usada |
| `source.auxiliary` | Fontes auxiliares |
| `source.forbidden` | Fontes proibidas/insuficientes |
| `classification` | Classificacao geral |
| `items[].classification` | Classificacao individual quando aplicavel |
| `limits` | O que a conclusao nao prova |
| `warnings` | Lacunas, risco de agenda zumbi, dado parcial |
| `generatedAt` | Momento do calculo |
| `referenceDate` | Data de corte operacional |

Classificacoes permitidas:

- `validado`
- `parcialmente validado`
- `inferido`
- `nao confirmado no codigo inspecionado`
- `bloqueado`

---

## 5. Contrato temporal

Todo calculo por periodo deve receber explicitamente:

| Campo | Regra |
|---|---|
| `referenceDate` | Data operacional de corte |
| `periodStart` | Inicio do periodo analisado |
| `periodEnd` | Fim do periodo analisado |
| `timezone` | Fuso usado para interpretar dia operacional |

Regras:

- "hoje" depende de `referenceDate` e `timezone`;
- proximos 7/30 dias devem ser calculados a partir de `referenceDate`;
- agenda atrasada deve usar `data_prevista < referenceDate`;
- datas invalidas devem gerar `warning`, nao conclusao silenciosa;
- calculos temporais nao devem depender de `new Date()` interno sem parametro explicito.

---

## 6. Filtros obrigatorios de necessidade futura

Necessidade futura so pode considerar agenda materializada valida.

Excluir:

- agenda concluida;
- agenda cancelada;
- agenda deletada/tombstone;
- agenda fora do periodo;
- agenda sem data prevista valida;
- agenda de animal morto;
- agenda de animal vendido;
- agenda de animal inativo;
- duplicidade por `dedup_key`, quando existir.

Nao contar:

- evento historico isolado;
- protocolo ativo sem agenda;
- tag/marcador;
- agenda concluida sem evento como execucao factual.

---

## 7. Modulos MVP 1

| Modulo | Status | Fonte primaria | Responsabilidade |
|---|---|---|---|
| `agendaNeeds.ts` | recomendado | agenda materializada valida | Necessidades futuras por periodo/lote/animal em dominios com agenda confirmada |
| `vaccineNeeds.ts` | recomendado | agenda sanitaria valida | Especializacao sanitaria de `agendaNeeds`, sem recriar scheduler/recompute |
| `sanitaryRiskSummary.ts` | recomendado com ressalva | agenda/views sanitarias previamente carregadas | Atrasos, vencimentos e alertas; compliance parcialmente validado |
| `lotOperationalSummary.ts` | recomendado | agenda valida + `state_animais` + `state_lotes` | Agregador operacional por lote |

Regras do MVP 1:

- `vaccineNeeds.ts` deve compor `agendaNeeds.ts`;
- `sanitaryRiskSummary.ts` nao deve recriar elegibilidade sanitaria;
- `lotOperationalSummary.ts` deve agregar resultados derivados, nao virar nova fonte de verdade;
- todos os modulos devem aceitar dados por parametro;
- todos os modulos devem retornar contrato de fonte, limites e classificacao.

---

## 8. Modulos parciais futuros

| Modulo | Status | Motivo |
|---|---|---|
| `herdStageSummary.ts` | parcial | Depende de taxonomia/read model validado e paridade se virar relatorio oficial |
| `reproductionSummary.ts` | parcial | Cria/pos-parto e validado, mas motor geral IATF nao confirmado |

Esses modulos podem ser propostos depois do MVP 1, desde que declarem limites e nao tratem status reprodutivo como fonte universal consolidada.

---

## 9. Modulos bloqueados

| Modulo | Status | Motivo |
|---|---|---|
| `commercialReadiness.ts` | bloqueado | Exige peso atual confiavel, carencia ativa, bloqueios e status comercial consolidados |
| `tagClassifiers.ts` persistido | bloqueado | Nao existe camada real de marcadores/tags e tags nao sao fonte primaria |
| `naturalLanguageInsights.ts` | bloqueado | Sem read models e roteamento seguro pergunta -> fonte |
| `iatfAgendaEngine.ts` | bloqueado | Motor geral IATF nao confirmado |

Esses bloqueios nao devem ser suavizados dentro da proposta de `insights`.

---

## 10. MVP 1 permitido

O MVP 1 pode responder somente:

- agendas atrasadas;
- agendas vencendo hoje;
- agendas nos proximos 7 dias;
- agendas nos proximos 30 dias;
- necessidade sanitaria por produto/lote/periodo;
- resumo operacional de lote baseado em agenda valida.

O MVP 1 nao deve responder:

- quais animais estao em carencia;
- quais estao prontos para venda/abate;
- qual peso atual confiavel;
- qual status reprodutivo universal;
- quais tags/marcadores persistidos aplicar;
- qualquer pergunta em linguagem natural.

---

## 11. Riscos e mitigacao

| Risco | Severidade | Mitigacao |
|---|---|---|
| Agenda zumbi de animal morto/vendido | Alto | Excluir por `state_animais.status` |
| Agenda concluida contada como necessidade | Alto | Filtrar status |
| Protocolo ativo virar pendencia | Alto | Exigir agenda materializada |
| Evento historico virar necessidade futura | Alto | Separar historico de intencao |
| Sanitario duplicar scheduler/recompute | Alto | `vaccineNeeds` compoe `agendaNeeds`; nao recalcula elegibilidade |
| Divergencia TS/SQL | Medio/alto | Paridade se virar relatorio oficial |
| `insights` virar fonte paralela | Alto | Retornar fontes, limites e classificacao |

---

## 12. Proximo passo

Validar documentalmente esta proposta antes de implementar o MVP 1.
