# Itens de Protocolo Sanitario v2 Candidatos — 12F0

Atualizado em: 2026-06-14

Este arquivo resume os itens candidatos da 12F0 após revisão curatorial com fontes normativas e bulas comerciais de apoio.

**Natureza do arquivo:** documental/curatorial.
**Não é seed. Não é migration. Não promove protocolo para execução automática.**

## Decisão consolidada

Nenhum item 12F0 é `agenda_allowed`.

Todos os itens preservam:

```ts
allowsAgendaAuto = false
```

A 12F0 permite, no máximo:

- `preview_allowed`: item pode aparecer em prévia operacional, sem criar agenda, evento, baixa de estoque, carência ou autorização operacional.
- `manual_only`: item pode ser consultado/registrado manualmente, exigindo decisão técnica ou legal externa.
- `blocked`: item não deve gerar ação operacional.
- `archived`: item mantido apenas para histórico, contingência normativa ou rastreabilidade documental.

## Tabela de itens atualizada

| item_key | protocol_key | productRequirementKind | classe/grupo | curationStatus | automationStatus | sourceRefs principais | source_gaps | decisão 12F0 |
|---|---|---|---|---|---|---|---|---|
| `b19_femeas_3_8_meses` | `brucelose_b19` | `product_class` | `vacina_brucelose_b19` | `needs_review` | `manual_only` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | UF/classe PNCEBT; SVE; MV habilitado; marcação; produto comercial e escopo bubalino por bula | Manter elegibilidade documental para fêmeas bovinas/bubalinas 3–8 meses; sem agenda automática |
| `clostridial_primovac_dose1` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `needs_review` | `preview_allowed` | `SRC_BULA_FORTRESS7` | Produto específico não fixado; bubalino não confirmado; idade mínima pode variar por bula/MV | Preview conservador para bovinos; execução exige produto real |
| `clostridial_primovac_dose2` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `needs_review` | `preview_allowed` | `SRC_BULA_FORTRESS7` | Intervalo 4–6 semanas confirmado apenas para produto/fonte específica; não generalizar classe | Preview de reforço da primovacinação; execução exige produto real e dose anterior documentada |
| `clostridial_reforco_anual` | `clostridioses` | `product_class` | `vacina_clostridial_multivalente` | `needs_review` | `preview_allowed` | `SRC_BULA_FORTRESS7` | Recorrência anual por produto/fonte; regionalidade e calendário da fazenda pendentes | Preview anual permitido; sem agenda automática |
| `raiva_area_risco_anual` | `raiva_herbivoros` | `product_class` | `vacina_antirrabica_inativada` | `needs_review` | `manual_only` | `SRC_PNCRH_RAIVA`; `SRC_BULA_RAIVACEL_MULTI`; `SRC_BULA_ANTIRRABICA_LABOVET` | Área de ocorrência/foco/perifoco; norma estadual; espécie por produto; overlay regional ausente | Manter manual/regional; não gerar agenda legal automática |
| `lepto_primovac_dose1` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `needs_review` | `manual_only` | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Esquema varia por produto; sorovares variam; bubalino sem confirmação; gestação/lactação depende de bula | Manual only; produto e sorovares obrigatórios |
| `lepto_primovac_dose2` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `needs_review` | `manual_only` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Nem todo produto exige segunda dose; Leptoferm 5 traz dose inicial única para bovinos | Não assumir dose 2 por classe; usar apenas se produto selecionado exigir |
| `lepto_reforco_anual_semestral` | `leptospirose` | `product_class` | `bacterina_leptospirose` | `needs_review` | `manual_only` | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Semestralidade depende de alta incidência/critério MV; não é regra global | Manual only; recorrência exige configuração técnica da fazenda/MV |
| `ibr_bvd_primovac_dose1` | `ibr_bvd` | `product_class` | `vacina_ibr_bvd_combinada` | `needs_review` | `preview_allowed` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Restrito a bovinos nas bulas consultadas; bubalino bloqueado; composição varia | Preview para bovinos; execução exige produto real |
| `ibr_bvd_primovac_dose2` | `ibr_bvd` | `product_class` | `vacina_ibr_bvd_combinada` | `needs_review` | `preview_allowed` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Intervalo 21–30 dias confirmado em produtos específicos; não generalizar para toda classe | Preview da segunda dose condicionado à dose 1 documentada |
| `recria_maio` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `needs_review` | `preview_allowed` | `SRC_EMBRAPA_VERMINOSE` | Recomendação regional/contextual; produto, peso, resistência e carência ausentes | Corrigir semântica: mês 5 = maio, não 5 meses de idade; preview operacional |
| `recria_julho` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `needs_review` | `preview_allowed` | `SRC_EMBRAPA_VERMINOSE` | Recomendação regional/contextual; produto, peso, resistência e carência ausentes | Corrigir semântica: mês 7 = julho, não 7 meses de idade; preview operacional |
| `recria_setembro` | `controle_parasitario_recria_5_7_9` | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | `needs_review` | `preview_allowed` | `SRC_EMBRAPA_VERMINOSE` | Recomendação regional/contextual; produto, peso, resistência e carência ausentes | Corrigir semântica: mês 9 = setembro, não 9 meses de idade; preview operacional |
| `pre_desmama_situacional` | `vermifugacao_pre_desmama` | `product_class_group` | `pcg_antiparasitarios_bezerros_pre_desmama` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE` | Não há regra universal; em bezerros zebu extensivos o benefício pode ser baixo; manejo intensivo/leite muda decisão | Rebaixado de `preview_allowed` para `manual_only`; depende de MV/manejo |
| `pre_confinamento_dose_unica` | `vermifugacao_pre_confinamento_pasto_vedado` | `product_class_group` | `pcg_antiparasitarios_pre_confinamento` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Produto, peso, carência e destino abate são críticos; risco operacional alto | Manual only; execução exige produto real, peso e snapshot de carência |
| `matrizes_pre_parto_antiparasitario` | `matrizes_pre_parto` | `product_class_group` | `pcg_antiparasitarios_matrizes_pre_parto` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN` | Gestação/lactação varia por produto; risco em leite e início de gestação | Manual only; produto precisa declarar uso em gestantes/lactantes ou MV assumir decisão |
| `matrizes_pre_parto_lepto_reforco_situacional` | `matrizes_pre_parto` | `product_class` | `bacterina_leptospirose` | `needs_review` | `manual_only` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Reforço pré-parto não é regra universal; depende de risco reprodutivo, produto e MV | Manual only; não criar rotina automática por DPP |
| `fmd_historico_contingencia` | `febre_aftosa` | `specific_product` | produto oficial de campanha | `archived` | `blocked` | `SRC_PNEFA_MAPA` | Vacinação suspensa no Brasil; uso operacional depende de emergência normativa/SVO | Arquivar; não criar campanha operacional |
| `fmd_historico_contingencia` | `febre_aftosa` | `none` | — | `archived` | `blocked` | `SRC_PNEFA_MAPA` | Status livre sem vacinação exige bloqueio de uso rotineiro | Manter bloqueio e permitir apenas histórico/contingência formal |

## Itens com mudança relevante em relação à versão anterior

| antes | depois | motivo |
|---|---|---|
| `recria_mes_5` | `recria_maio` | 5/7/9 no protocolo estratégico refere meses do calendário, não idade |
| `recria_mes_7` | `recria_julho` | 5/7/9 no protocolo estratégico refere meses do calendário, não idade |
| `recria_mes_9` | `recria_setembro` | 5/7/9 no protocolo estratégico refere meses do calendário, não idade |
| `pre_desmama_dose_unica` com `preview_allowed` | `pre_desmama_situacional` com `manual_only` | não há regra universal; depende de manejo, categoria, carga parasitária e decisão técnica |
| B19 com gap de fonte legal completa | B19 com fonte PNCEBT confirmada, mas ainda `manual_only` | idade/sexo/espécie foram confirmados; execução continua legal-operacional e regional |
| carência implícita por classe | carência apenas por evento/produto executado | dose/carência variam por produto e não podem ser herdadas da classe |
| bubalino por analogia | bubalino apenas com menção explícita | evita extrapolação off-label |

## Regras de execução preservadas

```ts
const item12F0Policy = {
  allowsAgendaAuto: false,
  doseSource: "produto_executado",
  routeSource: "produto_executado",
  withdrawalSource: "evento_produto_snapshot",
  bubalinoCoverage: "explicit_source_only",
  productClassDoseValidation: "forbidden",
  productClassWithdrawalValidation: "forbidden",
} as const;
```

```ts
const inventoryConsumptionPolicy = {
  source: "event_execution_only",
  agendaCanReserveStock: false,
  agendaCanConsumeStock: false,
  eventMustReferenceProduct: true,
  eventMustReferenceInventoryLotWhenFromStock: true,
  consumptionMustReferenceSourceEventoId: true,
} as const;
```

## ProductClassGroup antiparasitários 12F0

Os itens antiparasitários usam grupos curatoriais para evitar fixar produto no protocolo. O grupo define classes candidatas aceitas, mas não valida dose, via, carência, leite, gestação, lactação ou espécie na execução.

| productClassGroupKey | membros candidatos | itens que usam | bloqueios obrigatórios |
|---|---|---|---|
| `pcg_antiparasitarios_recria_estrategicos` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | `recria_maio`; `recria_julho`; `recria_setembro` | produto real; peso; carência por produto; repetir classe exige justificativa/MV; combinação exige bula própria |
| `pcg_antiparasitarios_pre_confinamento` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | `pre_confinamento_dose_unica` | produto real; peso; carência para abate; destino abate controlado; bubalino com fonte explícita |
| `pcg_antiparasitarios_matrizes_pre_parto` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | `matrizes_pre_parto_antiparasitario` | produto real; peso; leite por bula; gestação/lactação por bula ou MV; bubalino com fonte explícita |
| `pcg_antiparasitarios_bezerros_pre_desmama` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | `pre_desmama_situacional` | produto real; peso/idade mínimos por bula; decisão situacional/MV; bubalino com fonte explícita |

```ts
const antiparasitarioGroupBlockers12F0 = {
  withdrawalRequiresExecutedProduct: true,
  doseRequiresWeightAndExecutedProduct: true,
  milkRequiresLabel: true,
  gestationLactationRequiresLabelOrMv: true,
  bubalineRequiresExplicitSource: true,
  repeatedClassRequiresMvJustification: true,
  combinationRequiresOwnLabel: true,
} as const;
```

## Observações para 12F1

- Modelar `regionalApplicabilityRule` antes de qualquer agenda legal.
- Criar tabela/objeto de `sourceRefs` por campo, não apenas por item.
- Separar `classDefaultRule` de `productExecutionRule`.
- Exigir `produto_id`, `dose_snapshot`, `via_snapshot`, `carencia_snapshot` e `sourceRefs` no evento sanitário executado.
- Bloquear execução para bubalinos quando a bula/norma não citar explicitamente a espécie.
- Tratar febre aftosa apenas como histórico/contingência normativa, não como rotina operacional.
