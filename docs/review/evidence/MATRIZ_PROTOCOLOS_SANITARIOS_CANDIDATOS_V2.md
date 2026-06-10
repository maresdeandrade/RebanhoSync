# Matriz de SanitaryProtocol v2

Atualizado em: 2026-06-09
Fase: 12D4 — Rebaseline conceitual (ProductClass, status curatorial, política de execução)
Versão anterior: 12D3 (Extração curatorial)
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Esta matriz representa **entidades SanitaryProtocol** com estado curatorial.

"Candidato" não é um tipo — é um valor de `curation_status`. A entidade final é sempre `SanitaryProtocol`.

**Nenhuma linha é seed final. Nenhuma gera agenda automática. Nenhuma autoriza execução, carência, venda ou abate.**

Toda linha requer revisão humana (técnica, veterinária ou regulatória) antes de qualquer carga em banco.

---

## CurationStatus canônico (12D4)

| Status | Significado |
|---|---|
| `candidate` | Extraído/rascunho curatorial; ainda não revisado |
| `needs_review` | Falta fonte técnica, revisão veterinária ou decisão normativa |
| `approved_for_catalog` | Revisado e aprovado para compor catálogo curado/controlado |
| `blocked` | Não usar para carga, agenda ou execução sugerida |
| `archived` | Histórico/inativo |

## AutomationStatus canônico (12D4)

| Status | Significado |
|---|---|
| `manual_only` | Uso apenas manual/documental |
| `preview_allowed` | Pode aparecer em preview operacional; sem agenda automática |
| `agenda_allowed` | Pode gerar intenção futura após catálogo curado |
| `blocked` | Não pode gerar preview nem agenda operacional |

---

## Tabela de SanitaryProtocol

| family_code | protocol_name | species_scope | aptidao_scope | fase_produtiva | target_condition | sanitary_domain_area | legal_status | curation_status | automation_status | jurisdiction_scope | source_refs_snapshot | curation_gaps | observacoes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `febre_aftosa` | Febre Aftosa — histórico/contingência | `bovino`, `bubalino` | `corte`, `leite`, `mista` | todas | Febre aftosa | controle_doencas | `condicional` / suspenso conforme zona | `archived` | `blocked` | BR / UF / zona_sanitaria | `mapa_pnefa_portaria_665_2024`, `mapa_pnefa_portaria_678_2024`, `mapa_in_48_2020` | atualização territorial dinâmica; regra de contingência futura | Vacinação atualmente suspensa em áreas livres sem vacinação. Manter para histórico, bloqueio e contingência. |
| `brucelose` | Brucelose — PNCEBT | `bovino`, `bubalino` | `corte`, `leite`, `mista` | recria, reprodução | Brucelose | controle_doencas | `obrigatorio_norma` / `condicional` por item | `needs_review` | `preview_allowed` | BR / UF | `mapa_pncebt_in_sda_10_2017`, `mapa_pncebt_guia_medidas_sanitarias`, bulas B19/RB51 por produto | bula B19 por fabricante; regra regional para bubalinos; carência por produto | B19 e RB51 são itens/estratégias do mesmo protocolo. Não criar protocolo separado para bloqueio de bubalino. |
| `raiva_herbivoros` | Raiva dos Herbívoros — regional/foco/perifoco | `bovino`, `bubalino` | `corte`, `leite`, `mista` | todas | Raiva dos herbívoros | controle_doencas | `condicional` | `needs_review` | `preview_allowed` | UF / zona_risco / foco / perifoco | `mapa_pncrh_in_05_2002`, `mapa_pncrh_in_41_2020`, `mapa_pncrh_manual_tecnico_2022`, bula do produto | regra local por UF/foco/perifoco; produto executado | Protocolo único. Dose inicial, reforço 30 dias, anual e foco/perifoco são itens. |
| `clostridioses` | Clostridioses múltiplas — core técnico | `bovino`, `bubalino` | `corte`, `leite`, `mista` | cria, recria, engorda, reprodução, leite | Clostridioses | imunizacao | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR | bulas de produtos clostridiais; guideline como apoio | autorização bubalino por produto; carência por produto | Protocolo único. Dose 1, reforço 30 dias e revacinação anual são itens. |
| `leptospirose` | Leptospirose — core/reprodutivo | `bovino`, `bubalino` | `corte`, `leite`, `mista` | recria, reprodução, gestação | Leptospirose | controle_doencas | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / UF se houver norma específica | bula do produto; guideline como apoio | produto/sorogrupos; segurança em gestantes; carência por produto; norma estadual se houver | Protocolo único. Dose 1, reforço 30 dias, anual/semestral e pré-parto são itens. Não tratar SP como obrigatório universal sem fonte vigente. |
| `controle_parasitario_bezerros_pre_desmama` | Controle Parasitário — bezerros antes da desmama | `bovino`, `bubalino` | `corte`, `leite`, `mista` | cria | Endoparasitas / ectoparasitas conforme risco | controle_parasitario | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | guideline, Embrapa/boas práticas, bula do produto executado | classe adequada por idade/peso/espécie; carência por produto | Protocolo por categoria produtiva, não por produto. |
| `controle_parasitario_recria_estrategico_5_7_9` | Controle Parasitário — recria estratégica meses 5/7/9 | `bovino`, `bubalino` | `corte`, `leite`, `mista` | recria | Endoparasitas / ectoparasitas | controle_parasitario | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | Embrapa/boas práticas, bula do produto executado | confirmar calendário regional; resistência antiparasitária; rotação de classes | Itens nos meses 5, 7 e 9. Produto executado define dose/via/carência. |
| `controle_parasitario_engorda_pre_confinamento` | Controle Parasitário — engorda pré-confinamento/pasto vedado | `bovino`, `bubalino` | corte, mista | engorda, confinamento | Endoparasitas / ectoparasitas | controle_parasitario | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | bula do produto executado; orientação técnica | produto por categoria; carência crítica para abate | Não é protocolo por Ivomec/Supramec/Eprinex/Valbazen. Esses são produtos possíveis. |
| `controle_parasitario_matrizes_pre_parto` | Controle Parasitário — matrizes 30 dias antes do parto | `bovino `, `bubalino ` | `corte`, `leite`, `mista` | gestação, pré-parto | Endoparasitas / ectoparasitas | controle_parasitario | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | bula do produto executado; MV responsável quando necessário | segurança gestacional; lactação; carência leite/carne | Dose anual 30 dias antes do parto; produto executado precisa ser compatível com gestação/lactação. |
| `antraz_carbunculo_hematico` | Antraz / Carbúnculo Hemático — área de risco | `bovino `, `bubalino ` | `corte`, `leite`, `mista` | todas | Bacillus anthracis | controle_doencas | `condicional` | `needs_review` | `preview_allowed` | regional / propriedade de risco | bula anticarbunculosa, norma local/MV | contexto epidemiológico; produto específico | Protocolo distinto de clostridioses. Produto/fabricante define carência. |
| `ibr_bvd_pi3_brsv` | Complexo respiratório/reprodutivo viral | `bovino `| `corte`, `leite`, `mista` | recria, reprodução | IBR/BVD/PI3/BRSV | imunizacao | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | bula do produto específico; guideline apoio | tipo vivo/inativado; gestação; bubalino sem herança bovina | Usar classe/produto conforme bula. Não automatizar bubalino sem fonte explícita. |
| `campylobacteriose_reprodutores` | Campylobacteriose — reprodutores | `bovino `| corte, mista | reprodução | Campylobacter fetus venerealis | controle_doencas | `recomendado_tecnico` | `needs_review` | `preview_allowed` | BR / fazenda | bula do produto; MV responsável | produto registrado; estratégia reprodutiva; carência | Indicado conforme sistema de cria/reprodução. |
| `toxocara_vitulorum_alerta` | Toxocara vitulorum — alerta bubalino/neonatal | bubalino | `corte`, `leite`, `mista` | cria | Toxocara vitulorum | controle_parasitario | `bloqueado` para vacina | `blocked` | `blocked` | BR / fazenda | literatura/guideline apoio; registro inexistente | sem vacina registrada | Alerta documental. Controle por manejo/antiparasitário, sem agenda vacinal automática. |
| `bm86_restrito_alerta` | Vacina Bm86 / Gavac — uso restrito | `bovino `| `corte`, `leite`, `mista` | manejo | Carrapato | controle_parasitario | `experimental_alerta` / restrito | `blocked` | `blocked` | UF específica / pesquisa | registro/produto específico quando houver | restrição territorial/regulatória; eficácia local | Não incluir em protocolo padrão. |
| `salmonella_autogena_restrita` | Salmonella — vacina autógena restrita | `bovino `| `corte`, `leite`, `mista` | todas | Salmonella spp. | controle_doencas | `experimental_alerta` / restrito | `blocked` | `blocked` | fazenda / diagnóstico | diagnóstico, autorização, MV responsável | cepa, autorização, produto autógeno | Não automatizar. Exige diagnóstico e MV. |

---

## Notas de curadoria (12D4)

## Regras aplicadas

1. **Febre aftosa** é um único protocolo arquivado/contingencial, não dois protocolos por zona.
2. **Brucelose** é um único protocolo; B19 e RB51 são itens.
3. **Bubalino** nunca herda autorização bovina. Toda linha com `bubalino` em `species_scope` exige fonte forte explícita por produto e UF.
4. **Raiva, clostridioses e leptospirose** são protocolos únicos com itens de dose/reforço/anual.
5. **Controle parasitário** usa protocolos por estratégia/categoria produtiva, não por produto.
6. **Produto comercial** não aparece como coluna desta tabela. Produto satisfaz `ProductClass` no item, não no protocolo.
7. **Carência** não aparece nesta tabela. Carência é atributo de `WithdrawalRule` do `SanitaryProduct` executado.
2. **`blocked`** substituiu todos os status negativos fragmentados (12D3) — `blocked_missing_source`, `blocked_bubaline_unclear`, `blocked_off_label`, `blocked_experimental`, `not_automatable_alert`.

---

_Versão: 12D4 | SanitaryProtocol como entidade final | Sem seed | Sem agenda_
