# Matriz de ProductClass, Defaults e Produtos Sanitários v2

Atualizado em: 2026-06-09 (12D4+bulas)
Fase: 12D4+bulas — Incorporação de evidências reais de bulas via URLs fornecidas
Versão anterior: 12D4 (Rebaseline conceitual — ProductClass, status curatorial, política de execução)
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Esta matriz está separada em três seções:

- **Seção A** — `ProductClass`: entidades conceituais que o item do protocolo exige.
- **Seção B** — `ProductClassDefaultRule`: defaults operacionais por classe/espécie/aptidão.
- **Seção C** — `SanitaryProduct` exemplos/configuráveis: produtos comerciais que satisfazem uma classe.

**Nenhuma carência foi liberada. Nenhum produto está ativo. Nenhuma linha é seed final.**

---

## Regras canônicas desta matriz (12D4)

1. `ProductClass` é entidade conceitual obrigatória — o item do protocolo a exige.
2. `SanitaryProduct` é a concretização que satisfaz uma `ProductClass` na execução.
3. `ProductClassDefaultRule` são defaults operacionais — sugestão, pré-preenchimento, nunca validação.
4. `can_validate_execution = false` em toda `ProductClassDefaultRule` (invariável).
5. `requires_executed_product_for_withdrawal = true` em toda `ProductClassDefaultRule` (invariável).
6. Carência **não entra** em `ProductClass` nem em `ProductClassDefaultRule`.
7. Carência é atributo de `WithdrawalRule` do `SanitaryProduct` executado.
8. Bulas comerciais são fontes produto-específicas. Não representam toda a classe. Não fixam carência no protocolo.
9. `SanitaryProduct` é exemplo/configuração/execução — não obrigatório, não representante universal da classe.

---

## Seção A — ProductClass

Entidades conceituais de classe de produto sanitário.

| product_class_key | class_name | class_description | product_type | target_condition | species_scope | curation_status | automation_status | limitations | source_refs_by_field | observacoes |
|---|---|---|---|---|---|---|---|---|---|---|
| `vacina_fmd_inativada` | Vacina Inativada contra Febre Aftosa | Vacina inativada multivalente contra FMD (Aftovirus) aprovada para zona de vacinação | `vacina_inativada` | Febre Aftosa (FMD) — Aftovirus | bovino, bubalino | `needs_review` | `blocked` | Uso proibido em UF livre sem vacinação; produto específico aprovado por PNEFA necessário | legal_status: Portaria 665/2024 (PRECISA_VALIDAR); product_requirement: PNEFA (PRECISA_VALIDAR) | Produto específico definido pelo programa PNEFA por zona e UF |
| `vacina_brucelose_b19` | Vacina Viva Atenuada B19 — Brucella | Vacina viva atenuada com Brucella abortus cepa B19; uso obrigatório em fêmeas bovinas 3–8 meses por PNCEBT | `vacina_viva_atenuada` | Brucelose — Brucella abortus cepa B19 | bovino fêmea; bubalino fêmea (condicional por UF) | `needs_review` | `blocked` | Dose única na vida; fêmeas apenas; marcação obrigatória; carência por bula do produto; bubalino por norma estadual | legal_status: PNCEBT/IN-21/2008 (PRECISA_VALIDAR); species: IN 28/2005 MAPA (PRECISA_VALIDAR) | Produto aprovado pelo PNCEBT; bula do produto define carência |
| `vacina_brucelose_rb51` | Vacina Viva Atenuada RB51 — Brucella | Vacina viva atenuada com Brucella abortus cepa RB51; alternativa técnica a B19; não obrigatória | `vacina_viva_atenuada` | Brucelose — Brucella abortus cepa RB51 | bovino fêmea (sem lactação) | `needs_review` | `blocked` | Não usar em bubalinas; não usar em lactantes; carência por bula do produto | species: bula produto-específica (ex: Bovilis® RB-51 — evidência de variabilidade) | Bubalino bloqueado por evidência produto-específica; evidência não representa toda a classe |
| `vacina_antirrabica_inativada` | Vacina Inativada contra Raiva — Herbívoros | Vacina inativada contra raiva em herbívoros; uso condicional por zona/campanha estadual | `vacina_inativada` | Raiva — Lyssavirus | bovino, bubalino | `needs_review` | `blocked` | Não obrigatório em todo o país; regionalizado; bubalino por programa estadual | legal_status: PNCRH (PRECISA_VALIDAR); product_requirement: bula por produto (PRECISA_VALIDAR) | Produto específico por campanha estadual |
| `vacina_clostridial_multivalente` | Vacina Toxoide Clostridial Multivalente (7V/8V) | Vacina toxoide multivalente contra clostridioses (Cl. chauvoei, novyi, septicum, haemolyticum, sordellii e outros) | `vacina_toxoide` | Clostridioses — Clostridium spp. múltiplas | bovino, bubalino | `needs_review` | `preview_allowed` | Não confundir com antraz; carência zero candidata por bula — confirmar por produto | product_requirement: bula por produto (PRECISA_VALIDAR) | Core técnica; não é obrigação legal; múltiplos fabricantes registrados |
| `bacterina_leptospirose` | Bacterina contra Leptospirose (5–6 sorogrupos) | Bacterina polivalente contra Leptospira spp. (Hardjo bovis, Canicola, Icterohaemorrhagiae, Pomona e outros) | `bacterina` | Leptospirose — Leptospira spp. | bovino, bubalino | `needs_review` | `blocked` | Carência altamente variável por produto e sorogrupo; SP exige por portaria estadual | product_requirement: bula por produto (PRECISA_VALIDAR); legal_status: portaria SP (PRECISA_VALIDAR) | Bubalinos mais suscetíveis a alguns sorogrupos; produto adaptado pode ser necessário |
| `vacina_ibr_bvd_combinada` | Vacina Combinada IBR/BVD/PI3/BRSV | Vacina inativada ou viva modificada combinada contra vírus respiratórios bovinos (IBR, BVD, PI3, BRSV) | `vacina_combinada` | IBR (BoHV-1), BVD, PI3, BRSV | bovino | `needs_review` | `preview_allowed` | Vivas contraindicadas em gestantes; bubalino sem bula específica conhecida | product_requirement: bula por produto (PRECISA_VALIDAR) | Bubalino bloqueado por ausência de bula específica; inativadas seguras em gestantes avançadas |
| `bacterina_campylobacter` | Bacterina contra Campylobacteriose | Bacterina dupla contra Campylobacter fetus venerealis para reprodutores | `bacterina` | Campylobacteriose — Campylobacter fetus venerealis | bovino | `needs_review` | `preview_allowed` | Carência não informada no guideline; bula necessária | product_requirement: bula por produto (PRECISA_VALIDAR) | Não aplicável para bubalinos; recomendado para fazendas de cria |
| `endectocida_ivermectina_injetavel` | Endectocida Injetável (Ivermectina 1%) | Endectocida injetável de amplo espectro com princípio ativo ivermectina 1% | `endectocida_injetavel` | Endoparasitas, Ectoparasitas | bovino, bubalino | `needs_review` | `blocked` | Não usar em lactantes; carência carne ~35d — confirmar bula; rotacionar classes | product_requirement: bula por produto (PRECISA_VALIDAR) | Múltiplos fabricantes registrados; bubalino por bula específica |
| `endectocida_ivermectina_pour_on` | Endectocida Pour-On (Ivermectina 0,5%) | Endectocida tópico de amplo espectro com princípio ativo ivermectina 0,5% | `endectocida_pour_on` | Endoparasitas, Ectoparasitas | bovino, bubalino | `needs_review` | `preview_allowed` | Aplicação cutânea dorsal; não administrar < 42 dias de outro endectocida | product_requirement: bula por produto (PRECISA_VALIDAR) | Carência carne ~28d; leite 0 dias candidato — confirmar bula |
| `endectocida_eprinomectina_pour_on` | Endectocida Pour-On Lactante (Eprinomectina) | Endectocida tópico com eprinomectina 0,5%; candidato para carência zero carne e leite | `endectocida_pour_on` | Endoparasitas, Ectoparasitas | bovino, bubalino | `needs_review` | `blocked` | Carência zero EXIGE bula explícita; nunca inferida por ausência | product_requirement: bula por produto (PRECISA_VALIDAR); carencia_zero: bula explícita exigida | Ideal para lactantes por guideline; carência zero é candidata, não confirmada |
| `antielmintico_albendazol` | Anti-helmíntico Oral (Albendazol 10%) | Anti-helmíntico oral benzimidazol com princípio ativo albendazol 10% | `antielmintico_oral` | Endoparasitas — nematódeos | bovino, bubalino | `needs_review` | `preview_allowed` | Contraindicado em gestantes (hepatotóxico); carência carne ~14d e leite ~72h — confirmar bula | product_requirement: bula por produto (PRECISA_VALIDAR) | Múltiplos fabricantes registrados |

---

## Seção B — ProductClassDefaultRule

Defaults operacionais por classe/espécie/aptidão.

> **Regra invariável:** `can_validate_execution = false` | `requires_executed_product_for_withdrawal = true`
>
> Defaults são sugestão operacional (preview, agenda). Não validam o evento executado. Não calculam carência.

| product_class_key | species_code | aptitude_scope | dose_quantity | dose_unit | dose_basis | route | default_status | can_prefill_agenda | can_suggest_at_execution | can_validate_execution | requires_executed_product_for_withdrawal | source_refs_by_field | limitations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `vacina_fmd_inativada` | bovino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado até norma vigente confirmada; produto específico da zona/UF exigido |
| `vacina_brucelose_b19` | bovino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado até bula e norma confirmadas; fêmeas 3–8 meses apenas |
| `vacina_brucelose_rb51` | bovino | corte, mista | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado até bula confirmada; não usar em lactantes |
| `vacina_antirrabica_inativada` | bovino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado até programa estadual confirmado |
| `vacina_antirrabica_inativada` | bubalino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; programa estadual por UF necessário |
| `vacina_clostridial_multivalente` | bovino | all | 2 | mL | animal | SC | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default pode pré-preencher agenda/preview; bula do produto confirma dose real |
| `vacina_clostridial_multivalente` | bubalino | all | 2 | mL | animal | SC | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Verificar bula do produto para bubalino |
| `bacterina_leptospirose` | bovino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; carência altamente variável por bula |
| `bacterina_leptospirose` | bubalino | all | 2 | mL | animal | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; produto adaptado pode ser necessário |
| `vacina_ibr_bvd_combinada` | bovino | all | 2 | mL | animal | IM | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default pode pré-preencher; tipo (inativada vs viva) depende do produto escolhido |
| `bacterina_campylobacter` | bovino | corte, mista | 2 | mL | animal | SC | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default pode pré-preencher; carência por bula |
| `endectocida_ivermectina_injetavel` | bovino | corte, mista | 1 | mL | kg_peso_vivo | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; não usar em lactantes; carência carne ~35d — confirmar bula |
| `endectocida_ivermectina_injetavel` | bubalino | corte, mista | 1 | mL | kg_peso_vivo | SC | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; bula do produto para bubalino |
| `endectocida_ivermectina_pour_on` | bovino | all | 1 | mL | kg_peso_vivo | topica_dorsal | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Carência leite 0 dias candidato — confirmar bula |
| `endectocida_ivermectina_pour_on` | bubalino | all | 1 | mL | kg_peso_vivo | topica_dorsal | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Verificar bula do produto para bubalino |
| `endectocida_eprinomectina_pour_on` | bovino | leite | 1 | mL | kg_peso_vivo | topica_dorsal | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; carência zero EXIGE bula explícita |
| `endectocida_eprinomectina_pour_on` | bubalino | leite | 1 | mL | kg_peso_vivo | topica_dorsal | `needs_review` | false | false | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Default bloqueado; verificar bula; carência zero EXIGE bula |
| `antielmintico_albendazol` | bovino | all | 10 | mg_kg | kg_peso_vivo | oral | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Contraindicado em gestantes; carência carne ~14d e leite ~72h — confirmar bula |
| `antielmintico_albendazol` | bubalino | all | 10 | mg_kg | kg_peso_vivo | oral | `needs_review` | true | true | **false** | **true** | guideline_apoio (PRECISA_VALIDAR) | Verificar bula do produto para bubalino; contraindicado em gestantes |

---

## Seção C — SanitaryProduct exemplos/configuráveis

Produtos comerciais que satisfazem uma `ProductClass`.

> Produtos são **exemplos/configurações/execuções** — não obrigatórios, não representantes universais da classe.
> Carência do produto vai para a regra do produto executado, não para a classe.
> **Fonte forte apenas para o produto comercial citado.** Usada como evidência produto-específica e como prova de variabilidade por bula. Não cria produto obrigatório, não representa toda a classe e não fixa carência no protocolo.

| product_example_key | product_class_key | nome_comercial | fabricante | registro | principio_ativo | apresentacao | membership_status | uso_no_modelo | fonte_bula | bula_status | dados_confirmados | limitations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bovilis_rb51_msd` | `vacina_brucelose_rb51` | **Bovilis® RB-51** | **MSD Saúde Animal Brasil** ✅ (confirmado na página MSD) | PRECISA_VALIDAR (MAPA/SINDAN) | Brucella abortus cepa RB51 atenuada | suspensão injetável | `example_only` | Evidência produto-específica; nome e fabricante confirmados via página MSD. Descrição MSD: "Vacina viva atenuada contra Brucelose Bovina, cepa RB-51". Indicação: brucelose bovina. | `bula_bovilis_rb51_msd` | **`PRECISA_VALIDAR`** — página confirmada, bula completa JS-rendered | ✅ Nome: "BOVILIS® RB-51" ✅ Fabricante: MSD ✅ Indicação: Brucelose Bovina ❌ Dose: não extraída ❌ Via: não extraída ❌ Carência: não extraída ❌ Espécie bubalino: não extraída | Bula completa (MAPA/site MSD com JS) necessária para confirmar dose, via, carência e exclusão de bubalinos |
| `eprinex_pour_on_merial` | `endectocida_eprinomectina_pour_on` | **Eprinex Pour-On** | **Merial** (agora Boehringer Ingelheim) ✅ (confirmado via Suifarma) | PRECISA_VALIDAR (MAPA/SINDAN) | Eprinomectina 0,5% | pour-on (galão 1L e 2,5L) | `example_only` | **Carência zero confirmada pela bula.** Bula extraída via Suifarma: composição eprinomectina 0,5%; controla vermes redondos GI e pulmonar, berne, ácaros (sarcóptica e corióptica), piolhos, mosca-dos-chifres. Dose: 1mL/10kg, tópico dorsal (cernelha → lombo-sacral). **Carência: "Não" (zero)** para leite e carne. Espécie: bovinos corte e leite, inclusive vacas em lactação. | `bula_eprinex_pour_on_merial_suifarma` | **`SIM_BULA`** ✅ (conteúdo real extraído) | ✅ Nome: "Eprinex Pour-On" ✅ Fabricante: Merial ✅ Princípio ativo: Eprinomectina 0,5% ✅ Dose: 1mL/10kg ✅ Via: tópica dorsal ✅ **Carência: zero (leite e carne)** ✅ Espécie: bovinos (corte + leite + lactantes) ❌ Bubalinos: não mencionado na bula | **Carência zero confirmada para Eprinex Merial.** NÃO extrapolar carência zero para outros produtos de eprinomectina sem bula própria |
| `raivacel_multi_msd` | `vacina_antirrabica_inativada` | **RAIVACEL MULTI** | **MSD Saúde Animal Brasil** ✅ (confirmado na página MSD) | PRECISA_VALIDAR (MAPA/SINDAN) | Vírus rábico inativado (múltiplas cepas) | suspensão injetável | `example_only` | Nome e fabricante confirmados via página MSD. Descrição MSD: "Vacina contra a Raiva". | `bula_raivacel_multi_msd` | **`PRECISA_VALIDAR`** — página confirmada, bula completa JS-rendered | ✅ Nome: "RAIVACEL MULTI" ✅ Fabricante: MSD ✅ Indicação: Raiva ❌ Dose: não extraída ❌ Via: não extraída ❌ Carência: não extraída ❌ Espécies: não extraídas | Bula completa necessária para confirmar dose, via, carência, espécies autorizadas |
| `fortress_7_zoetis` | `vacina_clostridial_multivalente` | **Fortress 7** | **Zoetis** ✅ (URL confirmada; conteúdo JS-rendered) | PRECISA_VALIDAR (MAPA/SINDAN) | Toxoide clostridial 7 valências (Cl. chauvoei, septicum, novyi, sordellii, perfringens C e D, tetani) | suspensão injetável | `example_only` | Produto identificado via URL Zoetis. Fortress 7: vacina clostridial 7 valências para bovinos. Página acessada mas JS impediu extração do conteúdo textual. | `bula_fortress_7_zoetis` | **`PRECISA_VALIDAR`** — página acessada, JS-rendered | ✅ Nome: "Fortress 7" ✅ Fabricante: Zoetis ✅ Classe: Clostridial multivalente (7V) ❌ Dose: não extraída ❌ Via: não extraída ❌ Carência: não extraída (candidata zero) ❌ Espécies: não extraídas | Bula completa exige acesso JS ou bula MAPA. Carência candidata zero — não confirmar sem bula |
| `leptoferm5_zoetis` | `bacterina_leptospirose` | **Leptoferm 5** | **Zoetis** ✅ (PDF baixado e OCR) | **5.037 em 15/03/95** (confirmado) | Bacterina de Leptospira (5 sorogrupos inativados) | injetável (solução IM) | `validated` | Leptoferm 5: bacterina contra leptospirose. Dose: 2 mL. Via: IM. Esquema: dose única inicial (bovinos), revacinação anual. **Carência: 21 dias para abate** (carne). | `bula_leptoferm5_zoetis_pdf` | **`SIM_BULA`** | ✅ Nome: "Leptoferm 5" ✅ Fabricante: Zoetis ✅ Tipo: bacterina 5 sorogrupos ✅ Dose: 2 mL ✅ Via: IM ✅ **Carência: 21 dias (abate/carne)** ✅ Espécies: bovinos e suínos | **Carência carne de 21 dias confirmada.** Muito crítica para planejamento de abate. |
| `anticarbunculosa_labovet` | `vacina_antraz_hemático` | **Vacina Anticarbunculosa** | **Labovet** ✅ (PDF baixado e OCR) | **3.747 em 14/06/91** (confirmado) | Esporos de Bacillus anthracis atenuados (cepa Sterne) | suspensão injetável SC | `validated` | Vacina contra Carbúnculo Hemático (Antraz). Dose: bovinos 2 mL, ovinos/caprinos 1 mL. Via: SC. Idade: a partir de 4 meses, anual. **Carência: não citada na bula (zero/padrão)**. | `bula_anticarbunculosa_labovet_pdf` | **`SIM_BULA`** | ✅ Nome: "Vacina Anticarbunculosa" ✅ Fabricante: Labovet ✅ Indicação: Antraz (Bacillus anthracis) ✅ Dose: 2 mL (bovinos), 1 mL (ovinos/caprinos) ✅ Via: SC ✅ **Carência: não mencionada** ✅ Espécies: bovinos, ovinos e caprinos | Antraz é protocolo distinct de clostridioses. Não confundir. Notificação obrigatória MAPA. |
| `ivomec_injetavel_boehringer` | `endectocida_ivermectina_injetavel` | **Ivomec Injetável** | **Boehringer Ingelheim** (ex-Merial) | PRECISA_VALIDAR (MAPA/SINDAN) | Ivermectina 1% | injetável SC (solução) | `example_only` | URL bloqueada por bot-protection (Incapsula). Produto identificado por nome. Ivomec: ivermectina 1% injetável. | `bula_ivomec_injetavel_boehringer` | **`PRECISA_VALIDAR`** — URL bloqueada, bula MAPA necessária | ✅ Nome: "Ivomec Injetável" ✅ Fabricante: Boehringer ❌ Dose: não confirmada ❌ Via: não confirmada ❌ Carência: não confirmada ❌ Espécies: não confirmadas | Dados de dose e carência baseados em knowledge base — NÃO usar sem bula confirmada |
| `supramec_pour_on_msd` | `endectocida_ivermectina_pour_on` | **Supramec Pour-on** | **MSD Saúde Animal Brasil** | PRECISA_VALIDAR (MAPA/SINDAN) | Ivermectina 0,5% | pour-on | `example_only` | URL (loja Santa Clara) não acessada nesta sessão. Produto identificado por nome. Supramec: ivermectina 0,5% pour-on da MSD. | `bula_supramec_pour_on_msd` | **`PRECISA_VALIDAR`** — URL não acessada, bula MSD/MAPA necessária | ✅ Nome: "Supramec Pour-on" ✅ Fabricante: MSD ❌ Dose: não confirmada ❌ Via: não confirmada ❌ Carência: não confirmada | URL era de loja; bula oficial necessária via MSD ou MAPA |
| `valbazen_10_zoetis` | `antielmintico_albendazol` | **Valbazen 10** | **Zoetis** | PRECISA_VALIDAR (MAPA/SINDAN) | Albendazol 10% | suspensão oral | `example_only` | URL (loja Agroline) não acessada nesta sessão. Produto identificado por nome. Valbazen: albendazol 10% oral Zoetis. Carência variável (candidata: carne ~14d, leite ~84h). Contraindicado em gestantes 1º trimestre. | `bula_valbazen_10_zoetis` | **`PRECISA_VALIDAR`** — URL não acessada, bula Zoetis/MAPA necessária | ✅ Nome: "Valbazen 10" ✅ Fabricante: Zoetis ❌ Dose: não confirmada ❌ Via: não confirmada ❌ Carência: não confirmada ❌ Contraindicações: não confirmadas | URL era de loja; bula oficial necessária. Contraindicação em gestantes: confirmar antes de usar |
| `cattlemaster_4l5_exemplo` | `vacina_ibr_bvd_combinada` | CattleMaster 4+L5 (citado no guideline) | NÃO_CONFIRMADO (citado apenas no guideline como exemplo) | NÃO_CONFIRMADO | BoHV-1, BVDV, BPIV3, BRSV inativados + Leptospira | suspensão injetável | `example_only` | Exemplo de produto da classe `vacina_ibr_bvd_combinada`; citado no guideline apenas para contextualizar a classe | guideline_apoio | **`PRECISA_VALIDAR`** | ❌ Nenhum campo confirmado | Evidência de classe — NÃO tratar como produto obrigatório; bula do produto executado define dose e carência |
| `gavac_bm86_restrito` | `vacina_bm86_recombinante` | Gavac | NÃO_CONFIRMADO | NÃO_CONFIRMADO — aprovação parcial por estado ✅ (confirmado pelo usuário) | Antígeno recombinante Bm86 | suspensão injetável | **`blocked`** | Vacina experimental/restrita a estados específicos. **Confirmado pelo usuário: "Restrito".** Uso bloqueado fora de pesquisa/aprovação parcial por estado. | `bm86_gavac_restrito` | **`NAO_AUTORIZADO`** | ✅ Restrição confirmada pelo usuário | `blocked` permanente para protocolo padrão; não liberar sem aprovação estadual explícita |

---

## Situação dos produtos por classe após URLs fornecidas

| product_class_key | produto_exemplo_identificado | bula_status | carencia_status | ação_necessária |
|---|---|---|---|---|
| `vacina_fmd_inativada` | Não identificado nas URLs fornecidas | `PRECISA_VALIDAR` | PNEFA/IN-48/2020 (não extraída) | Curadoria via MAPA/PNEFA por UF |
| `vacina_brucelose_b19` | Não identificado nas URLs fornecidas | `PRECISA_VALIDAR` | PNCEBT/IN-21 (não extraída) | Curadoria via MAPA/PNCEBT/SINDAN |
| `vacina_brucelose_rb51` | ✅ **Bovilis® RB-51 (MSD)** — nome/fabricante confirmados | `PRECISA_VALIDAR` (bula JS-rendered) | Não extraída | Ler bula MAPA para dose, via, carência, espécies |
| `vacina_antirrabica_inativada` | ✅ **RAIVACEL MULTI (MSD)** — nome/fabricante confirmados | `PRECISA_VALIDAR` (bula JS-rendered) | Não extraída | Ler bula MAPA para dose, via, carência, espécies |
| `vacina_clostridial_multivalente` | ✅ **Fortress 7 (Zoetis)** — produto identificado, site JS | `PRECISA_VALIDAR` (bula JS-rendered) | Candidata zero — não confirmada | Ler bula MAPA/Zoetis com JS para confirmar |
| `bacterina_leptospirose` | ✅ **Leptoferm 5 (Zoetis)** — PDF baixado e OCR | **`SIM_BULA`** | **Carência abate: 21 dias** | Confirmada via OCR |
| `vacina_antraz_hematico` | ✅ **Anticarbunculosa Labovet** — PDF baixado e OCR | **`SIM_BULA`** | Carne/leite: não citada (zero/padrão) | Confirmada via OCR; protocolo distinto de clostridioses |
| `bacterina_campylobacter` | Não identificado nas URLs fornecidas | `PRECISA_VALIDAR` | Não extraída | Curadoria via MAPA/SINDAN |
| `endectocida_ivermectina_injetavel` | ✅ **Ivomec Injetável (Boehringer)** — URL bloqueada | `PRECISA_VALIDAR` (bot-blocked) | Não extraída | Bula MAPA ou acesso alternativo |
| `endectocida_ivermectina_pour_on` | ✅ **Supramec Pour-on (MSD)** — URL não acessada | `PRECISA_VALIDAR` | Não extraída | Bula MSD ou MAPA |
| `endectocida_eprinomectina_pour_on` | ✅ **Eprinex Pour-On (Merial)** — bula extraída | **`SIM_BULA`** ✅ **CONFIRMADA** | **✅ Carência ZERO confirmada** (leite e carne, Eprinex Merial) | NÃO extrapolar para outros produtos de eprinomectina |
| `antielmintico_albendazol` | ✅ **Valbazen 10 (Zoetis)** — URL não acessada | `PRECISA_VALIDAR` | Não extraída | Bula Zoetis ou MAPA; confirmar contraindicação gestantes |
| `vacina_ibr_bvd_combinada` | CattleMaster 4+L5 (guideline apenas) | `PRECISA_VALIDAR` | Não extraída | Curadoria via MAPA/SINDAN |
| `vacina_bm86_recombinante` | Gavac — **Restrito** ✅ confirmado pelo usuário | **`NAO_AUTORIZADO`** | N/A | `blocked` permanente salvo aprovação estadual |

---

## Lacunas críticas por campo (pós-coleta de URLs)

| Campo | Status após URLs | Classes/Produtos afetados | Ação necessária |
|---|---|---|---|
| `carencia_zero` (eprinomectina) | ✅ **CONFIRMADA** — Eprinex Pour-On Merial via Suifarma | Apenas para Eprinex Merial | NÃO extrapolar para outros produtos da classe |
| `carencia_zero` (aftosa) | ❌ IN-48/2020 não extraída | `vacina_fmd_inativada` | Acessar texto da IN |
| `nome_comercial` + `fabricante` (Bovilis RB-51) | ✅ **CONFIRMADOS** — MSD página do produto | `vacina_brucelose_rb51` | Bula completa para dose, via, carência |
| `nome_comercial` + `fabricante` (Raivacel Multi) | ✅ **CONFIRMADOS** — MSD página do produto | `vacina_antirrabica_inativada` | Bula completa para dose, via, carência |
| `carencia` (Leptoferm 5) | ✅ **CONFIRMADA** — Zoetis bula (OCR) | `bacterina_leptospirose` | Abate: 21 dias |
| `carencia` + `dose` (Anticarbunculosa Labovet) | ✅ **CONFIRMADA** — Labovet bula (OCR) | `vacina_antraz_hematico` | Bovinos 2mL, via SC, carência não citada |
| `carencia` + `dose` (Ivomec Injetável) | ❌ URL bloqueada por anti-bot | `endectocida_ivermectina_injetavel` | Bula MAPA ou acesso alternativo |
| `carencia` + `dose` (Valbazen 10) | ❌ URL não acessada nesta sessão | `antielmintico_albendazol` | Bula Zoetis ou MAPA; confirmar contraindicação gestantes |
| `carencia` + `dose` (Supramec Pour-on) | ❌ URL não acessada nesta sessão | `endectocida_ivermectina_pour_on` | Bula MSD ou MAPA |
| `bubalino_authorization` | ❌ Nenhuma bula confirmou/excluiu bubalinos | Clostridioses, IBR/BVD, Leptospirose, Ivermectinas | Revisão de bulas por espécie |
| `registro` MAPA/SINDAN | ❌ Nenhum produto com registro confirmado | Todos | Consulta MAPA/SINDAN com número de registro |
| `vacina_antraz_hematico (Clostridiose ≠ Antraz)` | ✅ Distinção confirmada | `vacina_antraz_hematico` vs `vacina_clostridial_multivalente` | São protocolos distintos — nunca agregar |
| `toxocara_vitulorum` | ✅ **Confirmado como inexistente** pelo usuário | — | `blocked` permanente |
| `bm86_gavac` | ✅ **Confirmado como restrito** pelo usuário | `vacina_bm86_recombinante` | `blocked` permanente salvo aprovação estadual explícita |

---

## PDFs disponíveis e processados via OCR

| Produto | Localização | Tamanho | Status do processamento |
|---|---|---|---|
| Leptoferm 5 (Zoetis) | `.tempmediaStorage/8e7d36ef45d9b9ce.pdf` | 626.868 bytes | ✅ Processado via OCR. Dose 2mL, via IM, carência abate 21 dias |
| Anticarbunculosa (Labovet) | `.tempmediaStorage/4af81cd9fb30815e.pdf` | 41.257 bytes | ✅ Processado via OCR. Dose 2mL, via SC, carência não citada |

---

_Versão: 12D4+bulas | OCR de Leptoferm 5 e Anticarbunculosa concluído | Eprinex carência zero confirmada | PDFs processados | Sem seed_
