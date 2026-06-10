# README — Curadoria Sanitária v2

Atualizado em: 2026-06-09  
Fase: 12D4.1 — Correção de granularidade Protocolo → Item → ProductClass → Produto  
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

As matrizes sanitárias v2 foram reestruturadas para corrigir a granularidade conceitual.

Regra canônica:

```txt
SanitaryProtocol = programa sanitário macro versionado
SanitaryProtocolItemVersion = etapa/fase/variação operacional do protocolo
ProductClass = classe/tipo sanitário exigido pelo item
ProductClassDefaultRule = default operacional, não regra crítica
SanitaryProduct = produto comercial configurado/executado
Fonte técnica = evidência por campo
Evento sanitário = produto real + dose/via executadas + carência congelada
```

Nenhum documento desta pasta é seed final, não cria agenda automática, não autoriza execução, não calcula carência ativa, não libera venda, abate, leite ou aptidão operacional.

---

## Correção principal da 12D4.1

A matriz anterior confundia, em alguns pontos:

- protocolo com fase do protocolo;
- protocolo com produto/classe;
- bloqueio de espécie com protocolo próprio;
- controle parasitário por produto, em vez de estratégia/categoria produtiva.

A 12D4.1 corrige isso.

### Regra de granularidade

| Pergunta | Entidade correta |
|---|---|
| Qual programa sanitário existe? | `SanitaryProtocol` |
| Qual ação/fase/janela dentro do programa? | `SanitaryProtocolItemVersion` |
| Que tipo de produto satisfaz a ação? | `ProductClass` |
| Qual produto real foi configurado/executado? | `SanitaryProduct` |
| Qual campo está sustentado por qual evidência? | `TechnicalSource` / `source_refs_by_field` |
| Produto planejado na agenda foi executado? | Não. Só evento confirma execução |

---

## Modelo canônico

```txt
SanitaryProtocol
  -> SanitaryProtocolItemVersion
      -> ProductRequirement
          -> ProductClass
              -> ProductClassDefaultRule
              -> ProductClassMembership
                  -> SanitaryProduct
                      -> DoseRule
                      -> RouteRule
                      -> WithdrawalRule
                      -> SpeciesAuthorization
                      -> TechnicalSources
```

---

## Regras obrigatórias

### Protocolo

Protocolo é programa macro.

Exemplos corretos:

```txt
brucelose
febre_aftosa
raiva_herbivoros
clostridioses
leptospirose
controle_parasitario_bezerros_pre_desmama
controle_parasitario_recria_estrategico_5_7_9
controle_parasitario_engorda_pre_confinamento
controle_parasitario_matrizes_pre_parto
```

Não usar protocolo por:

```txt
produto comercial
fase de dose
bloqueio específico de espécie
zona territorial quando a diferença é regra de jurisdição
```

### Item

Item é a ação/fase/variação operacional.

Exemplos:

```txt
brucelose.b19.femeas_3_8_meses
brucelose.rb51.femeas_bovinas_estrategico
clostridioses.primovac.dose_1
clostridioses.primovac.reforco_30_dias
clostridioses.revacinacao_anual
controle_parasitario.recria.mes_5
controle_parasitario.recria.mes_7
controle_parasitario.recria.mes_9
```

### ProductClass

ProductClass é requisito técnico do item.

Exemplos:

```txt
vacina_brucelose_b19
vacina_brucelose_rb51
vacina_clostridial_multivalente
bacterina_leptospirose
vacina_antirrabica_inativada
antiparasitario_endoparasiticida_sistemico
endectocida_lactona_macrocilica
benzimidazol_oral
ectoparasiticida_pour_on
```

### SanitaryProduct

Produto comercial é configurável/executável. Não é protocolo.

Exemplos:

```txt
Bovilis RB-51
Fortress 7
Leptoferm-5
Raivacel Multi
Ivomec
Supramec
Eprinex
Valbazen
Panacur
Ranger
```

---

## Enums canônicos

### CurationStatus

| Status | Significado |
|---|---|
| `candidate` | Extraído/rascunho curatorial |
| `needs_review` | Falta fonte, revisão técnica ou decisão veterinária |
| `approved_for_catalog` | Pode compor catálogo curado/controlado |
| `blocked` | Não usar para carga, agenda ou execução sugerida |
| `archived` | Histórico/inativo |

`approved_for_seed` não é status canônico.

### AutomationStatus

| Status | Significado |
|---|---|
| `manual_only` | Uso apenas manual/documental |
| `preview_allowed` | Pode aparecer em preview operacional; sem agenda automática |
| `agenda_allowed` | Pode gerar intenção futura após catálogo curado e contexto válido |
| `blocked` | Não pode gerar preview nem agenda operacional |

### ExecutionProductPolicy

| Valor | Significado | Regra |
|---|---|---|
| `not_required` | Item não depende de produto | Exame, alerta, manejo sem produto |
| `required_at_agenda` | Agenda registra produto planejado | Não vira produto executado |
| `required_at_execution` | Produto obrigatório apenas no evento | Padrão para vacinas e produtos com carência |
| `fixed_by_protocol` | Protocolo exige produto específico | Excepcional; exige fonte forte |

---

## Regras de segurança

- Produto planejado na agenda não é produto executado.
- Produto planejado não gera carência.
- Agenda não baixa estoque.
- Agenda não cria histórico sanitário.
- Default de classe pode sugerir dose/via, mas não valida execução.
- Carência nunca fica em protocolo, item, classe, agenda ou guideline.
- Carência vem do produto executado + espécie + aptidão + via + dose_basis + fonte forte.
- Bubalino não herda autorização bovina.
- Bloqueio por espécie deve nascer de `species_authorization`, não de protocolo próprio.

---

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md` | Protocolos macro (`SanitaryProtocol`) com granularidade corrigida |
| `MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md` | Itens/fases/variações operacionais (`SanitaryProtocolItemVersion`) |
| `MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | `ProductClass`, defaults e produtos comerciais exemplos/configuráveis |
| `MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md` | Fontes técnicas por origem e por campo |
| `SUPLEMENTO_BULAS_POR_ORIGEM_V2.md` | Bulas avulsas e MSD agrupadas por origem, sem tratar MSD como catálogo nacional |
| `RELATORIO_REVISAO_12D4_1_GRANULARIDADE_PROTOCOLO_ITEM.md` | Relatório de correção 12D4.1 |

---

## Critério para avançar para 12D5

A 12D5 só deve iniciar após revisão humana confirmar:

- granularidade dos protocolos;
- itens/fases de cada protocolo;
- `ProductClass` exigida por item;
- inexistência de protocolo de bloqueio por espécie;
- controle parasitário por estratégia/categoria produtiva;
- carência ausente de protocolo/item/classe;
- produtos comerciais apenas como exemplos/configuração/execução.
