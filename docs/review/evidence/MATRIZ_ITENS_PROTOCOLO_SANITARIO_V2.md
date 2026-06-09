# Matriz de Itens Versionáveis de Protocolo Sanitário v2

Atualizado em: 2026-06-09
Fase: 12D3 — Extração curatorial de protocolos candidatos
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Itens abaixo são **versões candidatas** para revisão técnica e veterinária.

Cada item representa uma etapa lógica dentro de um protocolo candidato. Nenhum item está ativo. Nenhum item gera agenda automática. Nenhum campo de dose, via ou carência foi liberado.

---

## Legenda de campos

- **protocol_family**: família de protocolo (chave estável)
- **logical_item_key**: chave lógica do item (estável, não muda com versão)
- **action_type**: tipo de ação sanitária
- **item_status**: status do item nesta versão
- **product_requirement_kind**: tipo de exigência de produto
- **product_class**: classe do produto (quando sem produto específico)
- **product_candidate**: nome comercial candidato (quando identificado no guideline)
- **dose**: dose candidata (depende de bula)
- **via**: via de administração candidata (depende de bula)
- **intervalo**: intervalo entre doses
- **reforco**: frequência de reforço
- **janela_inicio / janela_fim**: âncora e offset da janela operacional
- **species_authorization**: status de autorização por espécie
- **bubalino_status**: status específico para bubalino
- **source_refs_by_field**: campos com fonte disponível no guideline
- **limitations**: limitações declaradas
- **automation_status**: status de automação

---

## Tabela de Itens Versionáveis

| protocol_family | logical_item_key | action_type | item_status | product_requirement_kind | product_class | product_candidate | dose | via | intervalo | reforco | janela_inicio | janela_fim | species_authorization | bubalino_status | source_refs_by_field | limitations | automation_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `febre_aftosa` | `fmd_zona_vacinacao_campanha_1` | `vacinacao` | `condicional` | `product_class` | vacina inativada FMD múltipla | NÃO_DEFINIDO (produto aprovado MAPA para zona) | 2 mL (guideline) | SC ou IM (guideline) | semestral (campanhas mai/nov por norma) | dose única semestral | calendário PNEFA (campanhas semestrais) | calendário PNEFA | bovino: `SIM_NORMA` (PNEFA); bubalino: `SIM_NORMA` (PNEFA — "bovídeos") | `SIM_NORMA` condicional — PNEFA inclui bovídeos; curadoria estadual necessária | dose (guideline), via (guideline), legal_status (guideline+norma) | Norma vigente por UF; Portaria 665/2024 atualizada exigida; proibição em zonas livres | `blocked_missing_source` |
| `febre_aftosa` | `fmd_zona_livre_sem_vacinacao_bloqueio` | `alerta` | `bloqueado` | `none` | — | — | — | — | — | — | — | — | bovino: `NAO_AUTORIZADO`; bubalino: `NAO_AUTORIZADO` | `NAO_AUTORIZADO` — uso proibido por norma | legal_status (guideline cita proibição) | Nunca vacinar; protocolo existe apenas como bloqueio documental | `not_automatable_alert` |
| `brucelose` | `brucelose_b19_femeas_3_8_meses_primovac` | `vacinacao` | `obrigatorio` | `product_class` | vacina viva B19 (Brucella abortus cepa B19) | NÃO_DEFINIDO (bula do fabricante aprovado PNCEBT) | 2 mL SC (guideline) | SC (guideline) | dose única na vida | — | nascimento + 90 dias (3 meses de idade) | nascimento + 240 dias (8 meses de idade) | bovino fêmea: `SIM_NORMA` (PNCEBT IN-21/2008) | PRECISA_VALIDAR — PNCEBT pode incluir bubalinas em alguns estados; verificar norma estadual | dose (guideline), via (guideline), legal_status (guideline+norma), species_authorization (guideline bovino) | Dose única na vida; fêmeas apenas; marcar com ferro obrigatório; carência leite 30d por bula (varia) | `blocked_missing_source` |
| `brucelose` | `brucelose_rb51_bovinas_alternativa` | `vacinacao` | `condicional` | `product_class` | vacina viva RB51 (Brucella abortus cepa RB51) | Bovilis® RB-51 (exemplo citado no guideline) | 2 mL SC (guideline) | SC (guideline) | dose única (alternativa a B19) | — | nascimento + 90 dias | sem limite definido | bovino fêmea: `PRECISA_VALIDAR` (guideline cita bula específica; não é obrigatória) | `NAO_AUTORIZADO` — bula Bovilis® RB-51 cita apenas fêmeas bovinas | dose (guideline), via (guideline), species_authorization (guideline — bovino apenas) | Não usar em bubalinas; não usar em lactantes; não obrigatória; carência ~3 semanas carne por bula | `blocked_bubaline_unclear` |
| `raiva` | `raiva_herbivoros_area_risco_anual` | `vacinacao` | `condicional` | `product_class` | vacina inativada raiva herbívoros | NÃO_DEFINIDO (produto aprovado por estado/PNCRH) | 2 mL (guideline) | SC (guideline) | anual (antes período de risco) | 1x/ano em área de risco | calendário estadual (antes do verão) | calendário estadual | bovino: `PRECISA_VALIDAR` (depende de programa estadual); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR — alguns estados incluem bubalinos junto com bovinos | dose (guideline), via (guideline), obrigatoriedade (guideline — variável) | Não obrigatório em todo o país; regionalizado; carência geralmente zero (inativada) — confirmar bula | `blocked_missing_source` |
| `clostridioses` | `clostridial_core_primovac_dose1` | `vacinacao` | `recomendado` | `product_class` | vacina toxoide multivalente clostridioses (7V ou 8V) | NÃO_DEFINIDO (múltiplos fabricantes registrados) | 2 mL SC (guideline) | SC (guideline) | 4–6 semanas (1ª para 2ª dose) | — | protocolo início (1–2 meses de vida ou entrada no sistema) | protocolo início + 8 semanas | bovino: `SIM_BULA` (bulas de produtos clostridiaises geralmente incluem bovinos; confirmar produto) | PRECISA_VALIDAR — geralmente mesmo calendário; verificar bula do produto | dose (guideline), via (guideline), intervalo (guideline) | Carência zero citada no guideline — confirmar por bula; não iniciar antes da colostragem; confusão com carbúnculo hemático (antraz) | `review_required` |
| `clostridioses` | `clostridial_core_primovac_dose2` | `vacinacao` | `recomendado` | `product_class` | vacina toxoide multivalente clostridioses (7V ou 8V) | NÃO_DEFINIDO | 2 mL SC (guideline) | SC (guideline) | — (após 4–6 semanas da dose1) | — | item_dose1 + 4 semanas | item_dose1 + 8 semanas | bovino: `SIM_BULA` (produto) | PRECISA_VALIDAR | dose (guideline), via (guideline) | Depende da conclusão da dose1; carência zero por bula | `review_required` |
| `clostridioses` | `clostridial_core_reforco_anual` | `vacinacao` | `recomendado` | `product_class` | vacina toxoide multivalente clostridioses (7V ou 8V) | NÃO_DEFINIDO | 2 mL SC (guideline) | SC (guideline) | anual | 1x/ano | aniversário da última dose | aniversário + 60 dias (janela aceitável) | bovino: `SIM_BULA` (produto) | PRECISA_VALIDAR | dose (guideline), via (guideline), reforco (guideline) | Reforço anual após conclusão da primovacinação | `review_required` |
| `leptospirose` | `lepto_primovac_dose1` | `vacinacao` | `recomendado` | `product_class` | bacterina leptospirose (5–6 sorogrupos) | NÃO_DEFINIDO (múltiplos fabricantes) | 2 mL SC (guideline) | SC (guideline) | 4–6 semanas (1ª para 2ª) | — | entrada no sistema / 6–9 meses | entrada + 8 semanas | bovino: `PRECISA_VALIDAR` (depende de produto); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR — bubalinos mais suscetíveis à leptospirose; vacina adaptada recomendada | dose (guideline), via (guideline), intervalo (guideline) | Carência variável por bula (carne 14–21d, leite 0–72h por produto); SP: exige por portaria | `blocked_missing_source` |
| `leptospirose` | `lepto_primovac_dose2` | `vacinacao` | `recomendado` | `product_class` | bacterina leptospirose (5–6 sorogrupos) | NÃO_DEFINIDO | 2 mL SC (guideline) | SC (guideline) | — (após 4–6 semanas da dose1) | — | item_dose1 + 4 semanas | item_dose1 + 8 semanas | bovino: `PRECISA_VALIDAR` | PRECISA_VALIDAR | dose (guideline), via (guideline) | Depende conclusão dose1; carência por bula | `blocked_missing_source` |
| `leptospirose` | `lepto_reforco_semestral_anual` | `vacinacao` | `recomendado` | `product_class` | bacterina leptospirose (5–6 sorogrupos) | NÃO_DEFINIDO | 2 mL SC (guideline) | SC (guideline) | semestral ou anual | 1x-2x/ano | aniversário última dose | aniversário + 60 dias | bovino: `PRECISA_VALIDAR` | PRECISA_VALIDAR | dose (guideline), reforco (guideline) | Reforço pré-chuvoso recomendado; carência por bula | `blocked_missing_source` |
| `ibr_bvd_pi3_brsv` | `viral_respiratorio_primovac_dose1` | `vacinacao` | `recomendado` | `product_class` | vacina inativada ou viva modificada IBR/BVD/PI3/BRSV | NÃO_DEFINIDO (ex: CattleMaster 4+L5 — exemplo) | 2 mL IM (guideline) | IM (guideline) | 4 semanas (1ª para 2ª) | — | ≥ 3–6 meses de idade (após colostro) | 8 semanas após início | bovino: `PRECISA_VALIDAR` (produto específico); bubalino: `NAO_AUTORIZADO` (sem bula específica) | `NAO_AUTORIZADO` — usar somente se produto citar bubalino | dose (guideline), via (guideline), intervalo (guideline) | Vivas contraindicadas em gestantes; inativadas seguras em avançadas; bubalino bloqueado sem bula | `blocked_bubaline_unclear` |
| `ibr_bvd_pi3_brsv` | `viral_respiratorio_primovac_dose2` | `vacinacao` | `recomendado` | `product_class` | vacina inativada ou viva modificada IBR/BVD/PI3/BRSV | NÃO_DEFINIDO | 2 mL IM (guideline) | IM (guideline) | — (após 4 semanas da dose1) | — | item_dose1 + 4 semanas | item_dose1 + 6 semanas | bovino: `PRECISA_VALIDAR` | `NAO_AUTORIZADO` bubalino | dose (guideline), via (guideline) | Depende da conclusão dose1; reforço anual | `blocked_bubaline_unclear` |
| `controle_parasitario` | `ivermectina_injetavel_dose_unica` | `vermifugacao` | `recomendado` | `product_class` | endectocida injetável (ivermectina 1%) | NÃO_DEFINIDO (múltiplos fabricantes) | 1 mL/50kg SC (guideline) | SC (guideline) | — (conforme carga parasitária) | — | entrada confinamento ou conforme carga | sem janela definida | bovino: `PRECISA_VALIDAR` (produto); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR — dose geralmente idêntica por peso; verificar bula bubalino | dose (guideline), via (guideline), carencia (guideline — 35d carne) | Carência carne 35d; leite: não usar; não usar em lactantes; rotacionar classes para resistência | `blocked_missing_source` |
| `controle_parasitario` | `ivermectina_pour_on_dose_unica` | `vermifugacao` | `recomendado` | `product_class` | endectocida pour-on (ivermectina 0,5%) | NÃO_DEFINIDO | 1 mL/10kg linha dorsal (guideline) | tópica/pour-on (guideline) | — (não administrar < 42 dias) | — | conforme carga parasitária | sem janela definida | bovino: `PRECISA_VALIDAR` (produto); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR | dose (guideline), via (guideline), carencia (guideline — 28d carne, 0 leite) | Carência carne 28d; leite 0 dias por guideline — confirmar bula; aplicação cutânea dorsal | `review_required` |
| `controle_parasitario` | `eprinomectina_pour_on_dose_unica` | `vermifugacao` | `recomendado` | `product_class` | endectocida pour-on (eprinomectina 0,5%) | NÃO_DEFINIDO (ex: Eprinex — exemplo de princípio ativo, não produto específico) | 1 mL/10kg linha dorsal (guideline) | tópica/pour-on (guideline) | — | — | conforme carga parasitária | sem janela definida | bovino: `PRECISA_VALIDAR` (produto); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR — "Eprinex para carrapatos" citado para leiteiros; verificar bula bubalino | dose (guideline), via (guideline), carencia (guideline — 0 carne e leite) | Carência zero carne e leite por guideline — EXIGE fonte bula explícita; zero não é inferido | `blocked_missing_source` |
| `controle_parasitario` | `albendazol_10pct_dose_unica` | `vermifugacao` | `recomendado` | `product_class` | benzimidazol oral (albendazol 10%) | NÃO_DEFINIDO (múltiplos fabricantes) | 10 mg/kg = 1 mL/10kg PO (guideline) | oral/PO (guideline) | — (anual ou por carga) | — | conforme carga parasitária ou calendário | sem janela definida | bovino: `PRECISA_VALIDAR` (produto); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR | dose (guideline), via (guideline), carencia (guideline — 14d carne, 72h leite) | Carência carne 14d; leite 72h — confirmar bula; contraindicado em gestantes (hepatotóxico) | `review_required` |
| `rb51_bubalino` | `rb51_bubalino_bloqueio_total` | `alerta` | `bloqueado` | `none` | — | — | — | — | — | — | — | — | bubalino: `NAO_AUTORIZADO` (bula cita apenas bovinos) | `NAO_AUTORIZADO` — bloqueio total | species_authorization (guideline — bula Bovilis cita apenas bovinos) | Uso em bubalinas contraindicado por bula; marcar NAO_AUTORIZADO; somente alerta documental | `not_automatable_alert` |
| `toxocara_bubalino` | `toxocara_vitulorum_bubalino_pesquisa` | `alerta` | `somente_alerta` | `none` | — | — | — | — | — | — | — | — | bubalino: `PRECISA_VALIDAR` (experimental — sem vacina registrada) | PRECISA_VALIDAR (sem vacina registrada) | item_status (guideline — classificado como experimental) | Sem vacina registrada; controle atual por antiparasitários orais; nunca gerar agenda automática | `not_automatable_alert` |
| `carrapato_bm86` | `bm86_recombinante_uso_restrito` | `vacinacao` | `somente_alerta` | `product_class` | vacina recombinante Bm86 | NÃO_DEFINIDO (ex: Gavac — aprovado parcialmente em alguns estados) | NÃO_DEFINIDO (depende de bula por estado) | NÃO_DEFINIDO | — | — | — | — | bovino: `PRECISA_VALIDAR` (aprovação parcial); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR — não há bula para bubalinos no Brasil | item_status (guideline — classificado como experimental/restrito) | Aprovação parcial por estado; custo alto; eficiência dependente de parasitismo; não incluir em protocolo padrão | `not_automatable_alert` |
| `salmonella_autogena` | `salmonella_autogena_uso_mv` | `vacinacao` | `somente_alerta` | `specific_product` | vacina autógena Salmonella (uso restrito) | NÃO_DEFINIDO (autógena — requer diagnóstico) | NÃO_DEFINIDO | NÃO_DEFINIDO | — | — | após diagnóstico confirmado | — | bovino: `PRECISA_VALIDAR` (uso restrito MV + MAPA); bubalino: `PRECISA_VALIDAR` | PRECISA_VALIDAR | item_status (guideline — uso restrito/pesquisa) | Diagnóstico confirmado de Salmonella obrigatório; autorização MAPA necessária; eficácia variável | `not_automatable_alert` |

---

## Regras aplicadas na extração

1. **Dose e via** extraídas apenas onde o guideline forneceu valor numérico; onde "confirmar por bula" foi a instrução, marcado como `NÃO_DEFINIDO`.
2. **Carência** não foi declarada como candidata final em nenhum item. Apenas referenciada como `source_refs_by_field` para indicar que o guideline cita um valor que precisa de confirmação por bula.
3. **Bubalino_status** sempre derivado de análise do guideline por produto. Onde o guideline é ambíguo ou silencioso, marcado como `PRECISA_VALIDAR`. Onde a bula cita bovinos apenas, marcado `NAO_AUTORIZADO`.
4. **Itens experimentais/alerta** todos marcados como `somente_alerta` ou `bloqueado` com `automation_status = not_automatable_alert`.
5. **Nenhum item** foi marcado como `obrigatorio` sem fonte de norma oficial explicitamente identificada.

---

_Versão: 12D3 | Itens candidatos para revisão | Não são seed | Não geram agenda_
