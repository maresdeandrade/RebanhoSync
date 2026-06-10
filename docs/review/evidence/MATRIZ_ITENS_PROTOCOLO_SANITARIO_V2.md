# Matriz de SanitaryProtocolItemVersion v2

Atualizado em: 2026-06-09
Fase: 12D4 — Rebaseline conceitual (ProductClass, status curatorial, política de execução)
Versão anterior: 12D3 (Extração curatorial)
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Esta matriz representa **versões de itens versionáveis** (`SanitaryProtocolItemVersion`) dentro de cada `SanitaryProtocol`.

Cada item descreve uma etapa lógica de ação sanitária. O item exige uma `ProductClass` — não um produto comercial específico.

**Nenhum item está ativo. Nenhum item gera agenda automática. Nenhuma carência foi liberada.**

---

## Modelo canônico do item (12D4)

```
SanitaryProtocolItemVersion
  -> logical_item_key       (chave lógica estável)
  -> action_type            (tipo de ação sanitária)
  -> item_status            (status do item)
  -> product_class_key      (chave da ProductClass exigida)
  -> execution_product_policy (política de produto na execução)
  -> eligibility_rule       (regra de elegibilidade)
  -> operational_window_rule (janela operacional)
  -> dose_default_snapshot  (default de dose — sugestão, não validação)
  -> route_default_snapshot (default de via — sugestão, não validação)
  -> source_refs_by_field   (fontes por campo)
  -> limitations            (limitações declaradas)
  -> curation_status
  -> automation_status
```

Carência **não entra no item**. Carência é atributo de `WithdrawalRule` do `SanitaryProduct` executado.

---

## ExecutionProductPolicy canônico (12D4)

| Valor | Significado | Regra |
|---|---|---|
| `not_required` | Item não depende de produto | Exame, alerta, manejo sem produto |
| `required_at_agenda` | Agenda precisa registrar produto planejado | Não vira produto executado |
| `required_at_execution` | Produto obrigatório apenas no evento | Padrão mais seguro — vacinas e produtos com carência |
| `fixed_by_protocol` | Protocolo exige produto específico | Usar só com fonte forte explícita |

---

## Legenda de colunas

- **family_code**: família de protocolo (chave do SanitaryProtocol)
- **logical_item_key**: chave lógica do item (estável, não muda com versão)
- **action_type**: tipo de ação sanitária
- **item_status**: status do item nesta versão
- **product_class_key**: chave da ProductClass que o item exige
- **product_class_id_future**: ID futuro na tabela `sanitario_product_classes_v2` (vazio até 12D5)
- **execution_product_policy**: quando e como o produto executado é exigido
- **operational_window_rule**: âncora e offset da janela operacional
- **dose_default_snapshot**: dose default da classe (sugestão operacional, não validação)
- **route_default_snapshot**: via default da classe (sugestão operacional, não validação)
- **booster_rule**: regra de reforço
- **species_authorization_status**: status de autorização por espécie (bovino/bubalino)
- **source_refs_by_field**: campos com fonte disponível
- **field_source_status**: status da cobertura por campo crítico
- **limitations**: limitações declaradas
- **curation_status**: estado curatorial
- **automation_status**: estado de automação

---

## Tabela de SanitaryProtocolItemVersion

| family_code | logical_item_key | action_type | item_status | product_class_key | product_class_id_future | execution_product_policy | operational_window_rule | dose_default_snapshot | route_default_snapshot | booster_rule | species_authorization_status | source_refs_by_field | field_source_status | limitations | curation_status | automation_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `febre_aftosa` | `fmd_zona_vacinacao_campanha_1` | `vacinacao` | `condicional` | `vacina_fmd_inativada` | — (12D5) | `required_at_execution` | campanhas semestrais PNEFA (mai/nov); antes das campanhas do estado | 2 mL (guideline — default de classe) | SC ou IM (guideline — default de classe) | semestral por norma | bovino: `SIM_NORMA` (PNEFA — bovídeos); bubalino: `SIM_NORMA` condicional (PNEFA — bovídeos; curadoria estadual) | dose: guideline_apoio; via: guideline_apoio; legal_status: guideline+norma (PRECISA_VALIDAR) | eligibility_rule: PRECISA_VALIDAR; operational_window: PRECISA_VALIDAR; product_requirement: PRECISA_VALIDAR | Norma vigente por UF exigida antes de desbloquear; Portaria 665/2024 + PNEFA vigentes | `needs_review` | `blocked` |
| `febre_aftosa` | `fmd_zona_livre_sem_vacinacao_bloqueio` | `alerta` | `bloqueado` | — (sem produto) | — | `not_required` | não aplicável | — | — | — | bovino: `NAO_AUTORIZADO`; bubalino: `NAO_AUTORIZADO` | legal_status: guideline (cita proibição) | legal_status: PRECISA_VALIDAR (norma vigente) | Nunca gerar preview nem agenda; protocolo registra bloqueio documental | `blocked` | `blocked` |
| `brucelose` | `brucelose_b19_femeas_3_8_meses_primovac` | `vacinacao` | `obrigatorio` | `vacina_brucelose_b19` | — (12D5) | `required_at_execution` | nascimento+90d (3 meses) a nascimento+240d (8 meses) — fêmeas bovinas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | dose única na vida (sem reforço) | bovino fêmea: `SIM_NORMA` (PNCEBT IN-21/2008 — PRECISA_VALIDAR); bubalino: `PRECISA_VALIDAR` (norma estadual) | dose: guideline_apoio; via: guideline_apoio; legal_status: guideline+norma (PRECISA_VALIDAR); species: norma (PRECISA_VALIDAR) | eligibility_rule: PRECISA_VALIDAR; operational_window: PRECISA_VALIDAR; product_requirement: PRECISA_VALIDAR; species_authorization: PRECISA_VALIDAR | Dose única na vida; fêmeas apenas; marcação com ferro obrigatória | `needs_review` | `blocked` |
| `brucelose` | `brucelose_rb51_bovinas_alternativa` | `vacinacao` | `condicional` | `vacina_brucelose_rb51` | — (12D5) | `required_at_execution` | nascimento+90d em diante; fêmeas negativas ao teste | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | dose única (alternativa a B19) | bovino fêmea: `PRECISA_VALIDAR`; bubalino fêmea: `NAO_AUTORIZADO` | dose: guideline_apoio; via: guideline_apoio; species: bula produto-específica (Bovilis® RB-51 cita apenas bovinos — evidência produto-específica) | species_authorization: PRECISA_VALIDAR (bovino); NAO_AUTORIZADO (bubalino) | Não usar em bubalinas; não usar em lactantes; não obrigatória | `needs_review` | `blocked` |
| `raiva` | `raiva_herbivoros_area_risco_anual` | `vacinacao` | `condicional` | `vacina_antirrabica_inativada` | — (12D5) | `required_at_execution` | anual; antes do período de risco (verão/calendário estadual) | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | 1x/ano em área de risco | bovino: `PRECISA_VALIDAR` (programa estadual); bubalino: `PRECISA_VALIDAR` (programa estadual) | dose: guideline_apoio; via: guideline_apoio; obrigatoriedade: guideline (variável por estado) | eligibility_rule: PRECISA_VALIDAR; operational_window: PRECISA_VALIDAR | Não obrigatório em todo o país; regionalizado por zona de risco; bubalino por programa estadual | `needs_review` | `blocked` |
| `clostridioses` | `clostridial_core_primovac_dose1` | `vacinacao` | `recomendado` | `vacina_clostridial_multivalente` | — (12D5) | `required_at_execution` | protocolo início (1–2 meses de vida ou entrada no sistema) a início+8 semanas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose1 de 2) | bovino: `PRECISA_VALIDAR` (produto — bulas geralmente incluem bovinos); bubalino: `PRECISA_VALIDAR` (verificar bula) | dose: guideline_apoio; via: guideline_apoio; intervalo: guideline_apoio | eligibility_rule: PRECISA_VALIDAR; operational_window: PRECISA_VALIDAR; product_requirement: PRECISA_VALIDAR | Não iniciar antes da colostragem; não confundir com antraz (carbúnculo hemático) | `needs_review` | `preview_allowed` |
| `clostridioses` | `clostridial_core_primovac_dose2` | `vacinacao` | `recomendado` | `vacina_clostridial_multivalente` | — (12D5) | `required_at_execution` | dose1 + 4 semanas a dose1 + 8 semanas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose2 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Depende conclusão dose1 | `needs_review` | `preview_allowed` |
| `clostridioses` | `clostridial_core_reforco_anual` | `vacinacao` | `recomendado` | `vacina_clostridial_multivalente` | — (12D5) | `required_at_execution` | aniversário última dose a aniversário + 60 dias | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | 1x/ano | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio; reforco: guideline_apoio | product_requirement: PRECISA_VALIDAR | Após conclusão da primovacinação | `needs_review` | `preview_allowed` |
| `clostridioses` | `clostridial_bezerros_primovac_dose1` | `vacinacao` | `recomendado` | `vacina_clostridial_multivalente` | — (12D5) | `required_at_execution` | nascimento+30d (1 mês) a nascimento+90d | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose1 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Iniciar após colostragem; resposta vacinal depende de colostro vacinal | `needs_review` | `preview_allowed` |
| `clostridioses` | `clostridial_bezerros_primovac_dose2` | `vacinacao` | `recomendado` | `vacina_clostridial_multivalente` | — (12D5) | `required_at_execution` | dose1 + 4 semanas a dose1 + 8 semanas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose2 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Depende conclusão dose1 | `needs_review` | `preview_allowed` |
| `leptospirose` | `lepto_primovac_dose1` | `vacinacao` | `recomendado` | `bacterina_leptospirose` | — (12D5) | `required_at_execution` | entrada no sistema / 6–9 meses de idade a entrada + 8 semanas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose1 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio; intervalo: guideline_apoio | eligibility_rule: PRECISA_VALIDAR; product_requirement: PRECISA_VALIDAR | Carência altamente variável por bula; SP exige por portaria estadual | `needs_review` | `blocked` |
| `leptospirose` | `lepto_primovac_dose2` | `vacinacao` | `recomendado` | `bacterina_leptospirose` | — (12D5) | `required_at_execution` | dose1 + 4 semanas a dose1 + 8 semanas | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | — (dose2 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Depende conclusão dose1 | `needs_review` | `blocked` |
| `leptospirose` | `lepto_reforco_semestral_anual` | `vacinacao` | `recomendado` | `bacterina_leptospirose` | — (12D5) | `required_at_execution` | aniversário última dose a aniversário + 60 dias | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | 1–2x/ano | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; reforco: guideline_apoio | product_requirement: PRECISA_VALIDAR | Reforço pré-chuvoso recomendado | `needs_review` | `blocked` |
| `leptospirose` | `lepto_reforca_pre_parto_matrizes` | `vacinacao` | `recomendado` | `bacterina_leptospirose` | — (12D5) | `required_at_execution` | 6–8 semanas antes do parto | 2 mL (guideline — default de classe) | SC (guideline — default de classe) | por gestação | bovino fêmea: `PRECISA_VALIDAR`; bubalino: não aplicável neste item | dose: guideline_apoio; via: guideline_apoio; obrigatoriedade_gestantes: guideline_apoio | product_requirement: PRECISA_VALIDAR | Inativadas seguras em gestantes avançadas; não aplicar vivas no 1º trimestre | `needs_review` | `preview_allowed` |
| `ibr_bvd_pi3_brsv` | `viral_respiratorio_primovac_dose1` | `vacinacao` | `recomendado` | `vacina_ibr_bvd_combinada` | — (12D5) | `required_at_execution` | ≥ 3–6 meses de idade a início + 8 semanas | 2 mL (guideline — default de classe) | IM (guideline — default de classe) | — (dose1 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `NAO_AUTORIZADO` (sem bula específica) | dose: guideline_apoio; via: guideline_apoio; intervalo: guideline_apoio | species_authorization: NAO_AUTORIZADO (bubalino) | Vivas contraindicadas em gestantes; bubalino bloqueado sem bula específica | `needs_review` | `preview_allowed` |
| `ibr_bvd_pi3_brsv` | `viral_respiratorio_primovac_dose2` | `vacinacao` | `recomendado` | `vacina_ibr_bvd_combinada` | — (12D5) | `required_at_execution` | dose1 + 4 semanas a dose1 + 6 semanas | 2 mL (guideline — default de classe) | IM (guideline — default de classe) | — (dose2 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `NAO_AUTORIZADO` | dose: guideline_apoio; via: guideline_apoio | species_authorization: NAO_AUTORIZADO (bubalino) | Depende da conclusão dose1; reforço anual | `needs_review` | `preview_allowed` |
| `campylobacteriose` | `campy_reprodutores_primovac_dose1` | `vacinacao` | `recomendado` | `bacterina_campylobacter` | — (12D5) | `required_at_execution` | 45–60 dias antes da estação de monta | 2 mL (guideline — inferido) | SC (guideline — inferido) | — (dose1 de 2) | bovino: `PRECISA_VALIDAR`; bubalino: `NAO_AUTORIZADO` (não aplicável) | dose: guideline_apoio (inferido); via: guideline_apoio (inferido) | product_requirement: PRECISA_VALIDAR; dose: PRECISA_VALIDAR | Touros: dose única SC 45d antes da estação | `needs_review` | `preview_allowed` |
| `campylobacteriose` | `campy_reprodutores_primovac_dose2` | `vacinacao` | `recomendado` | `bacterina_campylobacter` | — (12D5) | `required_at_execution` | dose1 + 30 dias | 2 mL (guideline — inferido) | SC (guideline — inferido) | anual | bovino: `PRECISA_VALIDAR`; bubalino: `NAO_AUTORIZADO` | dose: guideline_apoio (inferido); via: guideline_apoio (inferido) | product_requirement: PRECISA_VALIDAR | Reforço anual antes da estação | `needs_review` | `preview_allowed` |
| `controle_parasitario` | `ivermectina_injetavel_dose_unica` | `vermifugacao` | `recomendado` | `endectocida_ivermectina_injetavel` | — (12D5) | `required_at_execution` | entrada confinamento ou conforme avaliação de carga parasitária | 1 mL/50kg = 200 µg/kg (guideline — default de classe) | SC (guideline — default de classe) | conforme carga parasitária | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Não usar em lactantes; rotacionar classes para resistência | `needs_review` | `blocked` |
| `controle_parasitario` | `ivermectina_pour_on_dose_unica` | `vermifugacao` | `recomendado` | `endectocida_ivermectina_pour_on` | — (12D5) | `required_at_execution` | conforme carga parasitária | 1 mL/10kg linha dorsal (guideline — default de classe) | tópica/pour-on (guideline) | conforme carga | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Aplicação cutânea dorsal; não administrar < 42 dias de outro endectocida | `needs_review` | `preview_allowed` |
| `controle_parasitario` | `eprinomectina_pour_on_dose_unica` | `vermifugacao` | `recomendado` | `endectocida_eprinomectina_pour_on` | — (12D5) | `required_at_execution` | conforme carga parasitária | 1 mL/10kg linha dorsal (guideline — default de classe) | tópica/pour-on (guideline) | conforme carga | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Carência zero EXIGE bula explícita; indicado para lactantes; nunca inferir zero por ausência | `needs_review` | `blocked` |
| `controle_parasitario` | `albendazol_10pct_dose_unica` | `vermifugacao` | `recomendado` | `antielmintico_albendazol` | — (12D5) | `required_at_execution` | conforme carga parasitária ou calendário anual | 10 mg/kg = 1 mL/10kg (guideline — default de classe) | oral/PO (guideline) | anual ou por carga | bovino: `PRECISA_VALIDAR`; bubalino: `PRECISA_VALIDAR` | dose: guideline_apoio; via: guideline_apoio | product_requirement: PRECISA_VALIDAR | Contraindicado em gestantes (hepatotóxico); carência carne ~14d e leite ~72h — confirmar bula | `needs_review` | `preview_allowed` |
| `rb51_bubalino` | `rb51_bubalino_bloqueio_total` | `alerta` | `bloqueado` | — (sem produto) | — | `not_required` | não aplicável | — | — | — | bubalino: `NAO_AUTORIZADO` (bula produto-específica Bovilis® RB-51 cita apenas bovinos) | species_authorization: bula produto-específica | NAO_AUTORIZADO (bubalino) | Uso em bubalinas contraindicado por evidência produto-específica; alerta documental | `blocked` | `blocked` |
| `toxocara_bubalino` | `toxocara_vitulorum_bubalino_pesquisa` | `alerta` | `somente_alerta` | — (sem produto registrado) | — | `not_required` | após diagnóstico/pesquisa | — | — | — | bubalino: `PRECISA_VALIDAR` (sem vacina registrada; pesquisa) | item_status: guideline (experimental) | NAO_AUTORIZADO para agenda | Sem vacina registrada; controle por antiparasitários orais | `blocked` | `blocked` |
| `carrapato_bm86` | `bm86_recombinante_uso_restrito` | `vacinacao` | `somente_alerta` | `vacina_bm86_recombinante` | — (12D5) | `not_required` | — | — | — | — | bovino: `PRECISA_VALIDAR` (aprovação parcial); bubalino: `PRECISA_VALIDAR` | item_status: guideline (experimental/restrito) | NAO_AUTORIZADO para agenda | Aprovação parcial por estado; custo alto; eficiência variável | `blocked` | `blocked` |
| `salmonella_autogena` | `salmonella_autogena_uso_mv` | `vacinacao` | `somente_alerta` | — (autógena — produto sob demanda) | — | `fixed_by_protocol` | após diagnóstico confirmado | — | — | — | bovino: `PRECISA_VALIDAR` (uso restrito); bubalino: `PRECISA_VALIDAR` | item_status: guideline (uso restrito) | NAO_AUTORIZADO para agenda automática | Diagnóstico obrigatório; autorização MAPA; eficácia variável; MV responsável | `blocked` | `blocked` |

---

## Regras aplicadas na extração (12D4)

1. **`product_class_key`** substituiu `product_candidate` como referência do item. Produto comercial não identifica o item.
2. **`execution_product_policy`** é campo obrigatório do item. Padrão: `required_at_execution` para vacinas e produtos com carência.
3. **`dose_default_snapshot`** e **`route_default_snapshot`** são defaults operacionais extraídos do guideline — sugestão, não validação.
4. **Carência** não entra em nenhuma coluna do item. Carência é atributo do `SanitaryProduct` executado.
5. **`fixed_by_protocol`** somente em `salmonella_autogena` (vacina autógena por diagnóstico) — único caso com produto sob demanda específico.
6. **`somente_alerta`** e **`bloqueado`** → `automation_status = blocked` invariavelmente.
7. **`product_class_id_future`** permanece vazio/documental até 12D5 criar a tabela `sanitario_product_classes_v2`.

---

_Versão: 12D4 | SanitaryProtocolItemVersion com ProductClass | Sem carência | Sem agenda_
