# Plano Fase 12F0 — Estruturação Curatorial dos Protocolos Sanitários v2

Atualizado em: 2026-06-14
Fase: 12F0
Responsável: Comitê técnico-veterinário, regulatório, curatorial e arquitetura de dados RebanhoSync

---

## 1. Decisão executiva

Decisão: `FASE 12F0 CONCLUÍDA COMO CATÁLOGO CURATORIAL CANDIDATO, COM FONTES ATUALIZADAS`.

A 12F0 estrutura os Protocolos Sanitários v2 como catálogo curatorial candidato, auditável e conservador. O resultado é documental: classifica protocolos e itens, define `productRequirementKind`, mapeia `ProductClass`/`ProductClassGroup`, registra `sourceRefs` e `source_gaps`, e declara critérios para preview, agenda futura e 12F1.

Nenhuma linha deste documento é seed final. Nenhuma linha cria agenda, evento, baixa de estoque, carência ativa, liberação de venda, abate, leite ou aptidão operacional.

Resultado curatorial atualizado:

- 10 protocolos do lote inicial classificados.
- 19 itens candidatos estruturados.
- 3 protocolos com `preview_allowed` conservador.
- 6 protocolos em `manual_only`.
- 1 protocolo `archived/blocked` por contexto regulatório atual.
- 0 protocolos `agenda_allowed` nesta fase.
- 0 protocolos `approved_for_catalog` nesta fase.

Mudanças relevantes desta atualização:

- B19 passou a ter fonte forte para espécie, sexo, idade e obrigatoriedade, mas segue `manual_only` por depender de UF/classe PNCEBT, SVE/MV, marcação e produto comercial validado.
- Raiva passou a ter fonte MAPA/PNCRH para dose, via, idade preferencial, reforço e recorrência máxima, mas segue regional/condicional.
- Febre aftosa foi consolidada como `archived/blocked` porque o Brasil está reconhecido como livre de febre aftosa sem vacinação e a vacinação de rotina foi suspensa.
- Controle parasitário recria `5/7/9` foi corrigido para meses de calendário: maio, julho e setembro; não idade de 5, 7 e 9 meses.
- Pré-desmama foi demovido de `preview_allowed` genérico para `manual_only` situacional.
- Carência, dose e via foram reforçadas como propriedades do produto executado/evento, não do protocolo ou classe.

---

## 2. Escopo e não escopo

Escopo executado:

- consolidar lote inicial de Protocolos Sanitários v2;
- padronizar modelo de protocolo e item;
- classificar status curatorial e status de automação;
- registrar lacunas de fonte por campo crítico;
- mapear requisito de produto por item;
- separar vacina, antiparasitário, manejo sanitário, diagnóstico e alerta;
- atualizar `sourceRefs` com normas, páginas oficiais e bulas comerciais localizadas;
- preparar entrada segura para 12F1.

Fora de escopo:

- migration, seed, inserção real em banco ou artefato importável;
- UI, Dexie, sync, `queue_ops`, `sync-batch`, RPC ou Edge Function;
- criação de agenda real ou evento real;
- fechamento executado de agenda;
- baixa de estoque;
- carência ativa;
- venda, abate, leite ou aptidão operacional;
- regra crítica baseada apenas em guideline;
- herança bubalino <- bovino sem fonte explícita;
- validação completa de cadastro MAPA/SIPEAGRO/Athena de todos os produtos.

---

## 3. Fontes e documentos usados

Documentos obrigatórios informados no plano da fase:

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`
- `docs/domain/SANITARIO.md`

Documentos curatoriais sanitários usados como base documental:

- `docs/review/evidence/README_CURADORIA_SANITARIA_V2.md`
- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md`
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md`
- `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md`
- `docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md`
- `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`
- `docs/review/evidence/RELATORIO_REVISAO_12D4_PRODUCT_CLASS_E_STATUS.md`

Fontes técnicas externas incorporadas nesta atualização:

| sourceRef | tipo | cobertura principal | força | URL |
|---|---|---|---|---|
| `SRC_PNCEBT_BRUCELOSE` | norma/programa oficial | brucelose; bovinos/bubalinos; fêmeas; 3–8 meses; obrigatoriedade; trânsito/eventos | forte | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/controle-e-erradicacao-da-brucelose-e-tuberculose-pncebt |
| `SRC_BULA_ABORVAC_B19` | bula comercial | B19; dose 2 mL; via SC; bezerras 3–8 meses; sem revacinação | forte para produto | https://www.zoetis.com.br/especies/bovinos/_assets/pdf/bula-aborvac-br.pdf |
| `SRC_PNCRH_RAIVA` | norma oficial | raiva dos herbívoros; vacina inativada; 2 mL; SC/IM; reforço 30 dias; recorrência até 12 meses | forte | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/qualidade-dos-servicos-veterinarios/arquivos/pncrh/in_05_2002_alt__n_41_2020_norma_tecnica_controle_rh.pdf |
| `SRC_MAPA_RAIVA_VACINA` | página oficial MAPA | vacinação recomendada em focos; bovídeos/equídeos preferencialmente ≥3 meses; caráter temporário da vacinação compulsória | forte contextual | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica |
| `SRC_BULA_FORTRESS7` | bula/página comercial | clostridioses bovinos; 5 mL SC; duas doses 4–6 semanas; reforço anual; abate 21 dias | forte para produto | https://www2.zoetis.com.br/especies/bovinos/fortress/ |
| `SRC_BULA_LEPTOFERM5` | bula/página comercial | leptospirose; bovinos/suínos; 2 mL IM; dose inicial única bovinos; anual; abate 21 dias | forte para produto | https://www.zoetis.com.br/especies/bovinos/leptoferm-52-ml.aspx |
| `SRC_BULA_POLIGUARD` | bula/página comercial | IBR/BVD/lepto bovinos; 5 mL SC; 2 doses 21–30 dias; reforço anual; bezerros >4 meses filhos de mães vacinadas; vacas prenhes | forte para produto | https://www.msd-saude-animal.com.br/produto/poliguard/ |
| `SRC_BULA_BOVIGEN` | bula/página comercial | IBR/BVD/lepto/campylobacteriose bovinos; fêmeas gestantes; reforço anual/semestral conforme risco/produto | forte para produto; revisar antes de execução | https://br.virbac.com/products/biologicos/bovigen-repro-total-se |
| `SRC_EMBRAPA_VERMINOSE` | recomendação técnica | controle estratégico de verminose: recria maio/julho/setembro; entrada em pastagem reservada/confinamento; vacas; restrição pré-desmama | apoio técnico forte, regional | https://old.cnpgc.embrapa.br/publicacoes/divulga/GCD07.html |
| `SRC_BULA_EPRIFORT` | bula comercial | eprinomectina pour-on; bovinos; 1 mL/20 kg; prenhes/lactantes; zero abate/leite | forte para produto | https://www.bimeda.com.br/media/k2/attachments/Epriforte-Bula.pdf |
| `SRC_BULA_SUPRAMEC` | bula/página comercial | ivermectina pour-on; bovinos; 1 mL/10 kg; não recomendado <4 meses; abate 28 dias; leite sem carência | forte para produto | https://www.msd-saude-animal.com.br/produto/supramec-pour-on/ |
| `SRC_BULA_VALBAZEN` | bula comercial | albendazol; bovinos/ovinos; via oral; dose por kg; abate 14 dias; restrição leite; evitar primeiros 45 dias de gestação | forte para produto | https://www.zoetis.com.br/especies/bovinos/_assets/pdf/valbazen10_cobalto_i40013271.pdf |
| `SRC_PNEFA_MAPA` | programa/norma oficial | febre aftosa; Brasil livre sem vacinação; rotina vacinal suspensa; contingência apenas normativa | forte | https://www.gov.br/agricultura/pt-br/assuntos/noticias/2025/reconhecimento-do-brasil-como-pais-livre-de-febre-aftosa-sem-vacinacao-pela-organizacao-mundial-de-saude-animal-omsa |
| `SRC_MAPA_PRODUTOS_VETERINARIOS` | base oficial | validação futura de cadastro, registro, licenciamento e consulta de produtos veterinários | forte para curadoria cadastral | https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/produtos-veterinarios |

Regra aplicada: guideline é apoio curatorial. Campo crítico exige norma oficial, bula, registro de produto ou decisão auditável do MV responsável, conforme o campo.

---

## 4. Modelo curatorial de protocolo

Cada protocolo candidato deve declarar:

| Campo | Regra 12F0 |
|---|---|
| `protocol_key` | chave estável do programa sanitário macro |
| `nome` | nome operacional claro |
| `categoria_sanitaria` | controle de doenças, imunização, controle parasitário, manejo sanitário ou alerta |
| `tipo` | vacina, antiparasitário, manejo sanitário, diagnóstico ou outro |
| `especie_alvo` | bovino, bubalino ou ambos, sem herança implícita |
| `aptidao_alvo` | corte, leite, mista ou restrita |
| `status_legal_regulatorio` | obrigatório, condicional, recomendado técnico, blocked ou archived |
| `curationStatus` | `candidate`, `needs_review`, `approved_for_catalog`, `blocked`, `archived` |
| `automationStatus` | `manual_only`, `preview_allowed`, `agenda_allowed`, `blocked` |
| `is_core` | prioridade técnica, sem significar obrigatoriedade legal |
| `is_conditional` | depende de UF, zona, risco, foco, aptidão ou categoria |
| `is_legal_required` | somente com fonte normativa suficiente e jurisdição definida |
| `fonte_tecnica_principal` | source ref principal |
| `restricoes` | limites técnicos/regulatórios |
| `observacoes_operacionais` | notas para curadoria futura |

---

## 5. Modelo curatorial de item

Cada item candidato deve declarar:

| Campo | Regra 12F0 |
|---|---|
| `protocol_key` | FK lógica do protocolo |
| `item_key` | chave lógica versionável |
| `item_version` | versão documental inicial |
| `acao_sanitaria` | vacinação, vermifugação, manejo, alerta ou diagnóstico |
| `especie` | espécie alvo explícita |
| `sexo_alvo` | macho, fêmea, ambos ou não aplicável |
| `idade_minima/maxima` | apenas se fonte sustenta |
| `aptidao` | corte, leite, mista, todas ou restrita |
| `categoria_animal` | bezerro, recria, matriz, pré-parto, engorda etc. |
| `eligibilityRule` | critério lógico e lacunas |
| `operationalWindowRule` | janela e âncora |
| `sequenceRule` | dose única, dose1/dose2, reforço, recorrência |
| `completionRule` | somente evento executado compatível |
| `productRequirementKind` | `none`, `specific_product`, `product_class`, `product_class_group` |
| `productClassKey` | quando `product_class` |
| `productClassGroupKey` | quando `product_class_group` |
| `specificProductId` | somente quando produto específico auditado |
| `executionProductPolicy` | padrão `required_at_execution` para vacina/antiparasitário |
| `doseRule/routeRule` | apenas por produto/protocolo com fonte forte |
| `withdrawalRule` | informativo; carência ativa só no evento |
| `sourceRefs` | fonte por campo crítico |
| `source_gaps` | lacuna explícita |
| `curationStatus` | status do item |
| `automationStatus` | status do item |
| `allowsPreview` | booleano documental |
| `allowsAgendaAuto` | sempre `false` na 12F0 |
| `reasonCodes` | bloqueios/lacunas |

---

## 6. Lista de protocolos candidatos

Lote inicial da 12F0:

1. `brucelose_b19`
2. `clostridioses`
3. `raiva_herbivoros`
4. `leptospirose`
5. `ibr_bvd`
6. `controle_parasitario_recria_5_7_9`
7. `vermifugacao_pre_desmama`
8. `vermifugacao_pre_confinamento_pasto_vedado`
9. `matrizes_pre_parto`
10. `febre_aftosa`

---

## 7. Matriz de protocolos candidatos

| protocol_key | nome | categoria | tipo | espécie alvo | aptidão alvo | status legal/regulatório | curationStatus | automationStatus | is_core | is_conditional | is_legal_required | fonte principal | restrições | observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `brucelose_b19` | Brucelose B19 | controle_doencas | vacina | fêmeas bovinas e bubalinas; produto comercial ainda exige validação | corte, leite, mista | obrigatório por norma, condicionado a UF/classe/fluxo SVE | `needs_review` | `manual_only` | true | true | true | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | B19: 3–8 meses e fêmeas resolvido; agenda bloqueada por UF/SVE/MV habilitado, marcação e validação de produto/cadastro | Pode calcular elegibilidade por sexo/idade; não agenda automaticamente |
| `clostridioses` | Clostridioses múltiplas | imunizacao | vacina | bovino; bubalino somente se bula autorizar | corte, leite, mista | recomendado técnico | `needs_review` | `preview_allowed` | true | false | false | `SRC_BULA_FORTRESS7` | Fonte forte é produto-específica; não cobre toda classe; bubalino não confirmado | Preview técnico conservador para bovinos; produto executado define dose/via/carência |
| `raiva_herbivoros` | Raiva dos herbívoros | controle_doencas | vacina | bovídeos/equídeos em fonte oficial; mapear para bovino/bubalino por regra operacional | corte, leite, mista | condicional regional/foco | `needs_review` | `manual_only` | true | true | false | `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA` | Depende de foco, perifoco, área de risco, norma estadual e overlay regional | Sem preview/agenda até `regionalApplicabilityRule`; pode gerar alerta manual |
| `leptospirose` | Leptospirose | controle_doencas | vacina | bovino; bubalino se produto autorizar | corte, leite, mista | recomendado técnico; condicional por risco | `needs_review` | `manual_only` | true | true | false | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Esquema varia por produto; sorovar/sorogrupo, gestação/lactação e risco regional não são universais | Não criar primovacinação genérica para toda leptospirose |
| `ibr_bvd` | IBR/BVD | imunizacao | vacina | bovino; bubalino bloqueado sem fonte | corte, leite, mista | recomendado técnico | `needs_review` | `preview_allowed` | true | false | false | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Produto vivo/inativado, gestação e carência dependem de bula/produto | Preview conservador para bovinos; execução exige produto real e snapshot |
| `controle_parasitario_recria_5_7_9` | Controle parasitário estratégico da recria — maio/julho/setembro | controle_parasitario | antiparasitario | bovino; bubalino se produto autorizar | corte, leite, mista | recomendado técnico regional | `needs_review` | `preview_allowed` | true | true | false | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | 5/7/9 são meses de calendário, não idade; regionalidade Cerrado/Brasil Central; produto/peso/carência obrigatórios | Usar `ProductClassGroup`; renomear itens para `recria_maio`, `recria_julho`, `recria_setembro` |
| `vermifugacao_pre_desmama` | Vermifugação pré-desmama situacional | controle_parasitario | antiparasitario | bovino; bubalino se produto autorizar | corte, leite, mista | situacional técnico | `needs_review` | `manual_only` | false | true | false | `SRC_EMBRAPA_VERMINOSE` | Não é recomendação universal; baixa eficácia em bezerros zebu extensivos antes da desmama; pode variar em leite/intensivo | Demovido de preview genérico; exige manejo, MV, produto, peso e carência |
| `vermifugacao_pre_confinamento_pasto_vedado` | Vermifugação pré-confinamento/pasto vedado | controle_parasitario | antiparasitario | bovino; bubalino se produto autorizar | corte, mista | recomendado técnico | `needs_review` | `manual_only` | true | true | false | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Proximidade de abate exige carência produto-específica; janela operacional depende do manejo | Sem agenda; execução só com produto real, peso, via, dose e carência congelada |
| `matrizes_pre_parto` | Matrizes pré-parto | manejo_sanitario | vacina/antiparasitario conforme item | fêmeas bovinas; bubalino se fonte autorizar | corte, leite, mista | situacional técnico | `needs_review` | `manual_only` | true | true | false | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | “30 dias antes do parto” não é regra universal; gestação/lactação variam por produto; MV exigido em cenários de risco | Protocolo composto; sem agenda pré-parto automática |
| `febre_aftosa` | Febre aftosa histórico/contingência | controle_doencas | vacina/alerta | bovino e bubalino | corte, leite, mista | archived/blocked no contexto atual | `archived` | `blocked` | true | true | true quando contingência oficial aplicável | `SRC_PNEFA_MAPA` | Vacinação de rotina suspensa; uso operacional somente por contingência normativa oficial/SVO | Não operacionalizar; manter histórico, bloqueio e contingência futura |

---

## 8. Matriz de itens candidatos

| protocol_key | item_key | item_version | ação | espécie | sexo | idade min/max | aptidão | categoria | eligibilityRule | operationalWindowRule | sequenceRule | completionRule | productRequirementKind | productClassKey | productClassGroupKey | executionProductPolicy | sourceRefs | curationStatus | automationStatus | allowsPreview | allowsAgendaAuto | reasonCodes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `brucelose_b19` | `b19_femeas_3_8_meses` | `0.2-candidate` | vacinação | bovino; bubalino por norma, produto a validar | fêmea | 3 a 8 meses | todas | bezerras | fêmea + idade + espécie coberta + fazenda/UF aplicável | janela etária 3–8 meses; usar meses civis, não apenas 90–240 dias | dose única; sem revacinação B19 | evento sanitário executado com produto B19 e responsável técnico | `product_class` | `vacina_brucelose_b19` | — | `required_at_execution` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | `needs_review` | `manual_only` | false | false | `requires_legal_overlay`, `requires_mv_sve`, `requires_marking`, `requires_product_validation`, `no_agenda_auto` |
| `clostridioses` | `clostridial_primovac_dose1` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | fonte produto-específica | todas | cria/recria | bovino sem evento dose1 válido | início de protocolo definido por manejo/MV | dose 1 de 2 | evento dose1 compatível | `product_class` | `vacina_clostridial_multivalente` | — | `required_at_execution` | `SRC_BULA_FORTRESS7` | `needs_review` | `preview_allowed` | true | false | `source_is_product_specific`, `source_gap_bubalino`, `class_cannot_validate_execution` |
| `clostridioses` | `clostridial_primovac_dose2` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | fonte produto-específica | todas | cria/recria | exige dose1 executada | dose1 + 4–6 semanas se produto compatível | dose 2 de 2 | evento dose2 compatível | `product_class` | `vacina_clostridial_multivalente` | — | `required_at_execution` | `SRC_BULA_FORTRESS7` | `needs_review` | `preview_allowed` | true | false | `interval_product_specific`, `source_gap_bubalino`, `no_agenda_auto` |
| `clostridioses` | `clostridial_reforco_anual` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | fonte produto-específica | todas | todas | última dose executada + produto compatível | anual a partir da última dose, se produto validar | reforço anual | evento reforço compatível | `product_class` | `vacina_clostridial_multivalente` | — | `required_at_execution` | `SRC_BULA_FORTRESS7` | `needs_review` | `preview_allowed` | true | false | `recurrence_product_specific`, `withdrawal_requires_product`, `no_agenda_auto` |
| `raiva_herbivoros` | `raiva_area_risco_anual` | `0.2-candidate` | vacinação | bovídeos/equídeos em fonte oficial; mapear bovino/bubalino | ambos | preferencialmente ≥3 meses em foco/risco | todas | todas | animal em foco/perifoco/área de risco validada | definida por foco, risco, UF e orientação oficial | primovacinação + reforço 30 dias; imunidade até 12 meses | evento antirrábico compatível | `product_class` | `vacina_antirrabica_inativada` | — | `required_at_execution` | `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA` | `needs_review` | `manual_only` | false | false | `requires_regional_overlay`, `requires_state_rule`, `focus_risk_dependent`, `no_agenda_auto` |
| `leptospirose` | `lepto_primovac_dose1` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | produto-específica | todas | recria/reprodução | idade/categoria + produto autorizado | entrada/idade/janela conforme produto/MV | dose 1; pode ser única em alguns produtos | evento dose1 compatível | `product_class` | `bacterina_leptospirose` | — | `required_at_execution` | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `manual_only` | false | false | `scheme_varies_by_product`, `source_gap_bubalino`, `no_generic_primovaccination` |
| `leptospirose` | `lepto_primovac_dose2` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | produto-específica | todas | recria/reprodução | dose1 executada + produto que exige dose2 | 21–30 dias quando produto compatível | dose 2, apenas produtos com esquema em 2 doses | evento dose2 compatível | `product_class` | `bacterina_leptospirose` | — | `required_at_execution` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `manual_only` | false | false | `dose2_not_universal`, `interval_product_specific`, `no_agenda_auto` |
| `leptospirose` | `lepto_reforco_anual_semestral` | `0.2-candidate` | vacinação | bovino; bubalino se bula | ambos | produto-específica | todas | reprodução/leite/corte | última dose + risco/aptidão + produto | anual; semestral apenas em alta incidência/critério MV/produto | recorrente | evento reforço compatível | `product_class` | `bacterina_leptospirose` | — | `required_at_execution` | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `manual_only` | false | false | `semestral_requires_risk_mv`, `source_gap_region`, `no_agenda_auto` |
| `ibr_bvd` | `ibr_bvd_primovac_dose1` | `0.2-candidate` | vacinação | bovino | ambos | produto-específica; exemplo >4 meses quando filho de mãe vacinada | corte, leite, mista | recria/reprodução | bovino + categoria + produto autorizado | início definido por produto/MV | dose 1 de 2 em produtos combinados | evento dose1 compatível | `product_class` | `vacina_ibr_bvd_combinada` | — | `required_at_execution` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `preview_allowed` | true | false | `bubalino_blocked`, `gestation_product_risk`, `class_cannot_validate_execution` |
| `ibr_bvd` | `ibr_bvd_primovac_dose2` | `0.2-candidate` | vacinação | bovino | ambos | produto-específica | corte, leite, mista | recria/reprodução | dose1 executada + produto compatível | 21–30 dias quando produto compatível | dose 2 | evento dose2 compatível | `product_class` | `vacina_ibr_bvd_combinada` | — | `required_at_execution` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `preview_allowed` | true | false | `interval_product_specific`, `bubalino_blocked`, `no_agenda_auto` |
| `controle_parasitario_recria_5_7_9` | `recria_maio` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | ambos | desmame até 24–30 meses, conforme contexto Embrapa | todas | recria | recria em região/manejo compatível + produto autorizado | maio; contexto Cerrado/Brasil Central | calendário estratégico maio/julho/setembro | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | `needs_review` | `preview_allowed` | true | false | `alias_recria_mes_5_deprecated`, `regional_context_required`, `withdrawal_requires_product` |
| `controle_parasitario_recria_5_7_9` | `recria_julho` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | ambos | desmame até 24–30 meses, conforme contexto Embrapa | todas | recria | recria em região/manejo compatível + produto autorizado | julho; contexto Cerrado/Brasil Central | calendário estratégico maio/julho/setembro | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | `needs_review` | `preview_allowed` | true | false | `alias_recria_mes_7_deprecated`, `regional_context_required`, `withdrawal_requires_product` |
| `controle_parasitario_recria_5_7_9` | `recria_setembro` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | ambos | desmame até 24–30 meses, conforme contexto Embrapa | todas | recria | recria em região/manejo compatível + produto autorizado | setembro; contexto Cerrado/Brasil Central | calendário estratégico maio/julho/setembro | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_recria_estrategicos` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | `needs_review` | `preview_allowed` | true | false | `alias_recria_mes_9_deprecated`, `regional_context_required`, `withdrawal_requires_product` |
| `vermifugacao_pre_desmama` | `pre_desmama_dose_unica_situacional` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | ambos | peso/idade dependem do produto | todas | bezerros pré-desmama | somente se manejo/risco/MV justificar | antes da desmama quando indicado por manejo | dose única ou conforme produto | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_bezerros_pre_desmama` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE` | `needs_review` | `manual_only` | false | false | `not_universal_recommendation`, `requires_mv_context`, `requires_weight_product`, `withdrawal_requires_product` |
| `vermifugacao_pre_confinamento_pasto_vedado` | `pre_confinamento_dose_unica` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | ambos | peso/produto | corte, mista | engorda/confinamento | animal entrando em confinamento/pasto vedado + produto autorizado | entrada no confinamento/pasto vedado ou janela MV | dose única ou conforme produto | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_pre_confinamento` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | `needs_review` | `manual_only` | false | false | `withdrawal_abate_risk`, `specific_product_needed_for_withdrawal`, `requires_weight_product`, `no_agenda_auto` |
| `matrizes_pre_parto` | `matrizes_pre_parto_antiparasitario` | `0.2-candidate` | vermifugação | bovino; bubalino se bula | fêmea | gestação/lactação dependem do produto | corte, leite, mista | matrizes pré-parto/periparto | matriz gestante/lactante + produto seguro + MV quando necessário | calendário regional/pico de parição ou regra MV; não fixar 30 dias universal | recorrente por estação/gestação quando indicado | evento antiparasitário compatível | `product_class_group` | — | `pcg_antiparasitarios_matrizes_pre_parto` | `required_at_execution` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN` | `needs_review` | `manual_only` | false | false | `source_gap_gestacao_lactacao`, `source_gap_carencia_leite`, `mv_required_if_extrapolated`, `no_universal_30d_rule` |
| `matrizes_pre_parto` | `matrizes_pre_parto_lepto_reforco_situacional` | `0.2-candidate` | vacinação | bovino; bubalino se bula | fêmea | gestante conforme produto | corte, leite, mista | matrizes pré-parto | matriz prenhe + risco reprodutivo + produto seguro | pré-parto apenas se produto/protocolo/MV justificar | reforço situacional | evento vacinal compatível | `product_class` | `bacterina_leptospirose` | — | `required_at_execution` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | `needs_review` | `manual_only` | false | false | `prepartum_not_general_rule`, `source_gap_product`, `source_gap_milk`, `mv_required` |
| `febre_aftosa` | `fmd_historico_contingencia` | `0.2-archived` | alerta/histórico | bovino, bubalino | ambos | todas | todas | todas | somente contingência normativa oficial/SVO | não aplicável à rotina | contingência | evento histórico executado, se aplicável | `none` | — | — | `not_required` | `SRC_PNEFA_MAPA` | `archived` | `blocked` | false | false | `archived_current_context`, `no_operational_protocol`, `no_campaign_agenda`, `contingency_only` |
| `febre_aftosa` | `fmd_bloqueio_vacinacao_rotina` | `0.2-archived` | alerta/bloqueio | bovino, bubalino | ambos | todas | todas | todas | rotina vacinal bloqueada | não aplicável | bloqueio documental | não se completa por evento sugerido | `none` | — | — | `not_required` | `SRC_PNEFA_MAPA` | `archived` | `blocked` | false | false | `blocked_by_regulatory_context`, `no_preview`, `no_agenda`, `no_product_suggestion` |

---

## 9. Mapa de ProductClass/ProductClassGroup por item

| item/protocolo | productRequirementKind | classe/grupo | regra |
|---|---|---|---|
| Brucelose B19 | `product_class` | `vacina_brucelose_b19` | classe suficiente apenas para elegibilidade; produto real obrigatório na execução |
| Clostridioses | `product_class` | `vacina_clostridial_multivalente` | classe técnica para preview; bula valida dose/via/carência |
| Raiva | `product_class` | `vacina_antirrabica_inativada` | depende de programa regional, foco/risco e produto |
| Leptospirose | `product_class` | `bacterina_leptospirose` | classe insuficiente para esquema/carência; produto executado exigido |
| IBR/BVD | `product_class` | `vacina_ibr_bvd_combinada` | bovino apenas enquanto bubalino sem fonte |
| Recria maio/julho/setembro | `product_class_group` | `pcg_antiparasitarios_recria_estrategicos` | obrigatório por intercambialidade de classes e carência variável |
| Pré-desmama situacional | `product_class_group` | `pcg_antiparasitarios_bezerros_pre_desmama` | obrigatório por idade/peso/produto/manejo variável; manual only |
| Pré-confinamento/pasto vedado | `product_class_group` | `pcg_antiparasitarios_pre_confinamento` | obrigatório; carência para abate depende do produto |
| Matrizes pré-parto antiparasitário | `product_class_group` | `pcg_antiparasitarios_matrizes_pre_parto` | obrigatório; gestação/lactação exigem bula/MV |
| Matrizes pré-parto lepto | `product_class` | `bacterina_leptospirose` | produto executado e segurança gestacional obrigatórios |
| Febre aftosa histórico/contingência | `none` | — | sem produto sugerido; histórico/contingência normativa |
| Febre aftosa bloqueio rotina | `none` | — | alerta/bloqueio documental |

ProductClassGroup normalizados 12F0:

| productClassGroupKey | membros curatoriais candidatos | uso curatorial | status 12F0 |
|---|---|---|---|
| `pcg_antiparasitarios_recria_estrategicos` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | recria estratégica em maio/julho/setembro, quando contexto regional/manejo sustentar | `needs_review` / `preview_allowed` |
| `pcg_antiparasitarios_pre_confinamento` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | entrada em confinamento ou pasto vedado, com foco em produto real, peso e carência para abate | `needs_review` / `manual_only` |
| `pcg_antiparasitarios_matrizes_pre_parto` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | matrizes em período pré-parto/periparto, somente com segurança gestacional/lactacional documentada | `needs_review` / `manual_only` |
| `pcg_antiparasitarios_bezerros_pre_desmama` | `lactonas_macrociclicas`; `benzimidazois`; `imidazotiazoleis`; `associacoes_antiparasitarias` | bezerros pré-desmama apenas em contexto situacional com justificativa técnica/MV | `needs_review` / `manual_only` |

Bloqueios comuns dos grupos antiparasitários:

- carência exige produto real executado e fonte de bula/snapshot no evento;
- dose exige peso válido e produto real, especialmente quando a regra for por kg;
- uso em leite exige bula explícita para aptidão leiteira e carência leite;
- gestação/lactação exige bula explícita ou decisão auditável do MV responsável;
- bubalino exige fonte explícita por norma, bula ou decisão MV auditável; não herda bovino;
- repetir classe em ciclo/estação exige justificativa técnica/MV, especialmente por risco de resistência;
- combinação/associação antiparasitária exige bula própria da combinação; não montar combinação por soma de classes avulsas.

Aliases legados a tratar na 12F1:

| alias legado | item_key recomendado | motivo |
|---|---|---|
| `recria_mes_5` | `recria_maio` | evitar interpretação como idade 5 meses |
| `recria_mes_7` | `recria_julho` | evitar interpretação como idade 7 meses |
| `recria_mes_9` | `recria_setembro` | evitar interpretação como idade 9 meses |
| `pre_desmama_dose_unica` | `pre_desmama_situacional` | evitar recomendação universal |
| `matrizes_pre_parto_lepto_reforco` | `matrizes_pre_parto_lepto_reforco_situacional` | evitar regra geral pré-parto sem risco/produto/MV |
| `fmd_zona_vacinacao_campanha` | `fmd_historico_contingencia` | vacinação de rotina suspensa; item só histórico/contingência |
| `fmd_zona_livre_sem_vacinacao_bloqueio` | `fmd_bloqueio_vacinacao_rotina` | nome mais explícito para bloqueio operacional |

---

## 10. Mapa de sourceRefs e source_gaps

| Campo crítico | Fonte disponível | Gaps 12F0 após revisão | Decisão |
|---|---|---|---|
| `especie` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; bulas produto-específicas | Bubalino confirmado em brucelose por norma; raiva usa bovídeos/equídeos e exige mapeamento operacional; maioria das bulas não cita bubalino | Não herdar bovino → bubalino. `bubalino` só `covered/approved` com fonte explícita ou regra legal auditável |
| `sexo` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | B19 resolvido para fêmeas; demais protocolos dependem de categoria operacional | B19: `sexo_alvo=femea`; machos bloqueados para B19; demais usar sexo apenas quando categoria exigir |
| `idade_minima/maxima` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19`; `SRC_MAPA_RAIVA_VACINA`; `SRC_BULA_POLIGUARD`; `SRC_BULA_SUPRAMEC`; `SRC_EMBRAPA_VERMINOSE` | B19 resolvido: 3–8 meses; raiva preferencialmente ≥3 meses em foco/risco; Supramec não recomendado <4 meses; demais variam por produto | Criar `ageRule` apenas por fonte forte. B19 pode calcular elegibilidade; agenda segue bloqueada sem legal/operacional completo |
| `janela_operacional` | `SRC_PNCEBT_BRUCELOSE`; `SRC_EMBRAPA_VERMINOSE`; `SRC_MAPA_RAIVA_VACINA`; `SRC_PNEFA_MAPA` | Brucelose tem janela etária; verminose recria tem meses maio/julho/setembro em contexto regional; raiva depende de foco/UF; aftosa suspensa | `preview_allowed` limitado. `agenda_allowed` só com overlay regional/fazenda + MV. Aftosa `blocked/archived` |
| `dose` | `SRC_BULA_ABORVAC_B19`; `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Dose forte existe para produtos específicos, não para classe; antiparasitários dependem de peso/produto | Não validar dose por `ProductClass`; dose fica em produto/evento; exigir peso quando dose for por kg |
| `via` | Mesmas fontes do campo `dose` | Via confirmada por produto/protocolo específico; não generalizável por classe | `routeRule` por produto; validável quando fonte forte; informativa quando origem for guideline/MV |
| `reforco/intervalo` | `SRC_BULA_ABORVAC_B19`; `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_EMBRAPA_VERMINOSE` | Resolvido para alguns produtos: B19 sem revacinação; Fortress 7 4–6 semanas + anual; raiva reforço 30 dias + até 12 meses; Leptoferm anual; Poliguard/Bovigen 21–30 dias + anual | Trocar gap genérico por `intervalRule` produto-específico; classe continua com gap |
| `recorrencia` | `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_EMBRAPA_VERMINOSE` | Recorrência anual/semestral existe em fontes específicas, mas depende de risco, produto, aptidão e região | Pode gerar elegibilidade/preview; não materializar agenda automática sem overlay regional/fazenda/MV |
| `carencia` | `SRC_BULA_FORTRESS7`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Carência confirmada por produto em exemplos; ausente para vários produtos/classes | Carência ativa proibida sem evento + produto executado. Congelar snapshot de carência no evento. Nunca inferir por classe |
| `produto_autorizado` | `SRC_MAPA_PRODUTOS_VETERINARIOS`; bulas comerciais | Exemplos de produtos localizados, mas curadoria completa MAPA/SIPEAGRO/Athena não feita | Produto específico não fica fixado no protocolo, salvo exigência legal. Exigir `registro_mapa_status` antes de `approved_for_catalog` |
| `bubalino_autorizado` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; fontes estaduais quando aplicável | B19 tem base normativa; raiva precisa mapear bovídeos; maioria das bulas comerciais não cita bubalino | B19: bubalino permitido por norma, produto comercial ainda revisável. Demais: `blocked` ou `needs_review` sem menção explícita |
| `gestacao/lactacao` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN` | Algumas bulas permitem/contraindicam, mas não é generalizável por classe | Matrizes pré-parto `manual_only`; só liberar produto com campo explícito ou decisão auditável do MV |
| `obrigatoriedade_legal` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_PNEFA_MAPA` | Brucelose obrigatória com fluxo oficial/MV; raiva depende de foco/risco/estado; aftosa sem vacinação de rotina | Não criar agenda legal automática sem `legalOverlay`. B19 pode gerar alerta/elegibilidade; raiva `manual_only`; aftosa `blocked/archived` |
| `restricao_regional` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_EMBRAPA_VERMINOSE`; `SRC_PNEFA_MAPA` | Regionalidade é central: UF/classe PNCEBT, foco/área de raiva, Brasil Central/Cerrado para verminose e status PNEFA para aftosa | Criar `regionalApplicabilityRule` futuramente. Nesta fase: `preview_allowed` com aviso ou `manual_only`; sem `agenda_allowed` |

---

## 11. Bloqueios P0/P1/P2

P0:

- Nenhum protocolo ou item pode ser transformado em `agenda_allowed` na 12F0.
- Nenhuma carência ativa pode ser calculada sem evento executado + produto real + snapshot de bula/fonte.
- Nenhuma dose/via pode validar execução por `ProductClass` ou `ProductClassGroup`.
- Bubalino não pode herdar autorização de bovino sem fonte explícita ou regra legal auditável.
- Febre aftosa não pode virar protocolo operacional automático no contexto atual; permanece `archived/blocked`.
- Agenda continua intenção; evento continua fato; protocolo continua regra/configuração.

P1:

- ProductClassGroup de antiparasitários normalizados na 12F0; 12F1 deve converter esses grupos em artefato importável candidato, preservando membros, bloqueios, limitações, espécie, idade/peso, aptidão, gestação/lactação e carência por produto.
- Validar cadastro/registro MAPA/SIPEAGRO/Athena dos produtos usados como exemplos.
- Modelar `regionalApplicabilityRule` para PNCEBT, PNCRH/raiva, PNEFA e controle parasitário regional.
- Definir fluxo de MV/SVE/marcação para B19 antes de qualquer materialização de agenda.
- Definir política de aliases legados (`recria_mes_5/7/9`) para evitar interpretação como idade.

P2:

- Ruído residual conhecido em stdout/stderr de testes.
- Warnings conhecidos de build: Browserslist/caniuse-lite e chunks grandes.
- Padronizar acentuação e nomenclatura dos arquivos curatoriais na 12F1.

---

## 12. Critérios para sair de candidate/needs_review

Um protocolo ou item só pode sair de `candidate`/`needs_review` quando:

- todos os campos críticos tiverem `sourceRefs` explícitos por campo;
- bula/produto/norma cobrir espécie, dose, via, categoria, idade e carência quando aplicável;
- bubalino estiver explicitamente autorizado por bula/norma/regra legal auditável ou bloqueado;
- gestação/lactação estiver tratada por bula ou MV auditável;
- obrigatoriedade legal tiver norma vigente, jurisdição, validade e overlay regional;
- `productRequirementKind` estiver coerente com produto/classe/grupo;
- carência permanecer vinculada ao produto executado e não ao protocolo;
- produto tiver cadastro/registro validado em fonte oficial ou evidência curatorial equivalente;
- revisão veterinária aprovar a linha para catálogo;
- testes de regressão cobrirem execução sem produto, bubalino sem fonte, carência ausente e status regional indefinido.

---

## 13. Critérios para preview_allowed

`preview_allowed` exige:

- elegibilidade básica clara;
- janela operacional clara o suficiente para simular, sem persistir;
- fonte técnica sustentar recomendação básica;
- ausência de dependência legal/regional não resolvida que mude a decisão;
- ausência de risco de execução automática;
- nenhuma criação de agenda, evento, estoque ou carência ativa;
- bloqueio explícito de execução sem produto real.

Na 12F0, `preview_allowed` é aceito apenas para simulação futura documental em:

- clostridioses, para bovinos e produto compatível;
- IBR/BVD, para bovinos e produto compatível;
- controle parasitário de recria em maio/julho/setembro, com aviso regional e produto obrigatório na execução.

Mesmo nesses casos:

```ts
allowsAgendaAuto = false
```

Pré-desmama foi demovido para `manual_only` por ser situacional e não universal.

---

## 14. Critérios para agenda_allowed

`agenda_allowed` exige:

- `eligibilityRule` completa;
- `operationalWindowRule` completa;
- `completionRule` definida como evento executado compatível;
- `productRequirementRule` coerente;
- `sourceRefs` suficientes por campo crítico;
- risco regulatório controlado;
- espécie/sexo/idade/aptidão claros;
- overlay regional/fazenda quando legal ou epidemiológico;
- produto autorizado/cadastrado quando dose/via/carência forem necessárias;
- carência congelável no evento;
- nenhum `source_gap` crítico.

Decisão 12F0: nenhum protocolo ou item foi promovido a `agenda_allowed`.

---

## 15. Critérios para 12F1

12F1 pode iniciar como normalização em artefato importável/seed candidato, ainda sem ativação automática, se:

- este documento permanecer restrito a curadoria;
- nenhum P0 abrir após validações;
- as matrizes de evidência 12F0 estiverem revisadas;
- `ProductClassGroup` dos antiparasitários estiver definido com membros, bloqueios e limitações;
- aliases legados forem tratados sem quebrar compatibilidade;
- source gaps críticos estiverem classificados por prioridade;
- regras `blocked/archived` forem preservadas;
- artefato importável futuro continuar sem seed aplicado e sem agenda automática;
- houver testes de borda para produto ausente, bubalino sem fonte, carência ausente, aftosa bloqueada e B19 sem overlay legal.

Resultado esperado para 12F1:

- normalizar chaves e estrutura para importação candidata;
- manter status conservador;
- não ativar protocolo;
- não criar dados reais;
- não criar automação;
- produzir artefato auditável com `sourceRefs` por campo.

---

## 16. Invariantes para implementação futura

```ts
const protocol12F0Invariant = {
  approvedForCatalog: false,
  agendaAllowed: false,
  allowsAgendaAuto: false,
  activeWithdrawalWithoutProduct: false,
  bovinoToBubalinoInheritance: false,
  classDoseExecutionValidation: false,
  classWithdrawalExecutionValidation: false,
  agendaIsHistory: false,
  tagsAsCriticalRuleSource: false,
}
```

```ts
const executionRequires = {
  produto_real: true,
  dose_snapshot: true,
  via_snapshot: true,
  carencia_snapshot: true,
  source_ref_snapshot: true,
  mv_responsavel: 'when_required_by_protocol_or_product',
  regional_overlay: 'when_legal_or_epidemiological',
}
```

---

## Critérios de aceite da 12F0

- [x] Nenhum código funcional alterado.
- [x] Nenhuma migration criada.
- [x] Nenhum seed criado.
- [x] Nenhuma UI alterada.
- [x] Nenhuma agenda real criada.
- [x] Nenhum evento real criado.
- [x] Nenhuma carência ativa criada.
- [x] Nenhuma liberação operacional criada.
- [x] Protocolos candidatos classificados.
- [x] Itens candidatos estruturados.
- [x] ProductRequirement definido por item.
- [x] ProductClass/ProductClassGroup mapeado quando aplicável.
- [x] sourceRefs e source_gaps documentados.
- [x] status curatorial definido.
- [x] status de automação definido.
- [x] P0/P1/P2 registrados.
- [x] Critérios para 12F1 definidos.
- [x] B19, raiva, aftosa e controle parasitário recria atualizados com fontes fortes disponíveis.
- [x] Pré-desmama rebaixado para `manual_only` situacional.
- [x] Febre aftosa preservada como `archived/blocked`.

---

## Resultado final

Fase 12F0 concluída como catálogo curatorial candidato atualizado.

Protocolos Sanitários v2 permanecem conservadores: sem seed, migration, UI, agenda, evento, baixa de estoque, carência ativa ou liberação operacional.

Próxima fase autorizável: `12F1 — Normalização dos Protocolos Sanitários v2 em artefato importável/seed candidato, ainda sem ativação automática`.
