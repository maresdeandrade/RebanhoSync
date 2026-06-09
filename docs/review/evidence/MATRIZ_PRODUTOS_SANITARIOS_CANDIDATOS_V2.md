# Matriz de Produtos Sanitários Candidatos v2

Atualizado em: 2026-06-09
Fase: 12D3 — Extração curatorial de protocolos candidatos
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Produtos abaixo são **candidatos curatoriais** para revisão técnica e veterinária.

**Nenhum produto está ativo, nenhuma carência foi liberada, nenhum dado de fabricante ou registro foi inventado.** Onde o guideline cita classe sem produto comercial, `nome_comercial = NÃO_DEFINIDO`. Onde a carência depende de bula, `carencia_carne/leite = CONFIRMAR_BULA`.

---

## Regras de carência nesta matriz

- **CONFIRMAR_BULA**: guideline cita um valor de referência, mas a carência final exige confirmação por bula do produto executado.
- **ZERO_FONTE_BULA**: carência zero é candidata somente porque o guideline afirma explicitamente zero e indica que a bula confirma — mas exige validação de bula antes de seed.
- **NAO_AUTORIZADO**: produto/contexto não autorizado para o uso declarado.
- **VARIAVEL_POR_BULA**: varia entre fabricantes; somente bula do produto executado pode definir.
- **DESCONHECIDO**: guideline não informa; fonte ausente.

---

## Tabela de Produtos Candidatos

| product_candidate_key | classe | nome_comercial | principio_ativo | fabricante | registro | especie_autorizada | bubalino_status | dose | via | carencia_carne | carencia_leite | fonte_dose | fonte_via | fonte_carencia | status_curatorial | lacunas | observacoes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `vacina_fmd_inativada_multipla` | vacina inativada (FMD) | NÃO_DEFINIDO (produto aprovado MAPA para zona) | Aftovirus inativado múltiplo | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA/PNEFA) | bovino, bubalino | `SIM_NORMA` (PNEFA — bovídeos) | 2 mL (guideline) | SC ou IM (guideline) | ZERO_FONTE_BULA (IN-48/2020 eliminou carência) | ZERO_FONTE_BULA (IN-48/2020) | guideline_apoio | guideline_apoio | norma_oficial (IN-48/2020, MAPA) — candidato para confirmação | `needs_product_label` | Produto específico não definido; fabricante não definido; registro MAPA por produto; carência zero confirmada por IN-48/2020 (candidata) | Carência zero é candidata robusta por norma citada no guideline; produto específico precisa de curadoria |
| `vacina_brucelose_b19` | vacina viva atenuada (Brucella) | NÃO_DEFINIDO (produto aprovado PNCEBT) | Brucella abortus cepa 19 (B19) | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA/PNCEBT) | bovino fêmea (3–8 meses); bubalino fêmea (condicional por UF) | `PRECISA_VALIDAR` — PNCEBT pode incluir bubalinas em alguns estados; verificar norma estadual | 2 mL (guideline) | SC (guideline) | VARIAVEL_POR_BULA (~30 dias carne — varia por fabricante) | CONFIRMAR_BULA (~30 dias afastamento leite por bula) | guideline_apoio | guideline_apoio | guideline_apoio + bula_fabricante (PRECISA_VALIDAR) | `needs_product_label` | Produto específico não definido; fabricante não definido; carência leite por fabricante; situação bubalino por UF | Dose única na vida; fêmeas apenas; marcação obrigatória; in-48/2020 citada para aftosa, não para brucelose — bula confirma carência |
| `vacina_brucelose_rb51_bovilis` | vacina viva atenuada (Brucella RB51) | Bovilis® RB-51 (nome citado no guideline como exemplo) | Brucella abortus cepa RB51 | NÃO_DEFINIDO (MSD Animal Health — dedução; NÃO INVENTAR) | NÃO_DEFINIDO | bovino fêmea (sem leite) | `NAO_AUTORIZADO` — bula cita apenas "fêmeas bovinas"; bubalinas não autorizadas | 2 mL (guideline) | SC (guideline) | CONFIRMAR_BULA (~3 semanas por instrução genérica no guideline) | `NAO_AUTORIZADO` — vacina não autorizada em lactantes | guideline_apoio | guideline_apoio | guideline_apoio (genérico — confirmar bula) | `needs_product_label` | Fabricante e registro não confirmados; carência por bula do produto vigente; bubalino bloqueado | Alternativa técnica a B19; não obrigatória; não usar em machos; não usar em lactantes; bubalinas: NAO_AUTORIZADO |
| `vacina_raiva_inativada_herbivoros` | vacina inativada (Raiva) | NÃO_DEFINIDO (ex: PastiVida, Raiva-Vac — exemplos no guideline) | Lyssavirus inativado | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA/PNCRH) | bovino, bubalino (condicional por programa estadual) | `PRECISA_VALIDAR` — alguns estados incluem bubalinos em campanhas; verificar programa estadual | 2 mL (guideline) | SC (guideline) | ZERO_FONTE_BULA (guideline: "geralmente 0 dias — vacina inativada; verificar bula") | ZERO_FONTE_BULA (guideline — confirmar bula específica) | guideline_apoio | guideline_apoio | guideline_apoio (genérico — confirmar bula de produto específico) | `needs_product_label` | Produto específico não definido (PastiVida e Raiva-Vac citados apenas como exemplos — NÃO confirmar como fabricante oficial); bubalino por programa estadual | Carência zero candidata por bula inativada — EXIGE confirmação; produto específico necessário |
| `vacina_clostridial_7v_8v` | vacina toxoide multivalente (Clostridioses) | NÃO_DEFINIDO (múltiplos fabricantes registrados) | Toxoides: Cl. chauvoei, novyi, septicum, haemolyticum, sordellii + outros | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA — múltiplos) | bovino, bubalino (verificar bula) | `PRECISA_VALIDAR` — geralmente mesmo calendário; produto deve citar bubalinos | 2 mL (guideline) | SC (guideline) | ZERO_FONTE_BULA (guideline: "0 dias — vacina inativada" — confirmar bula por produto) | ZERO_FONTE_BULA (guideline — confirmar bula) | guideline_apoio | guideline_apoio | guideline_apoio (genérico — confirmar bula) | `needs_product_label` | Produto específico não definido; carência zero por bula a confirmar; fabricante e registro por produto | Core técnica; não é obrigação legal universal; não confundir com antraz (carbúnculo hemático) |
| `bacterina_leptospirose_5_6_soros` | bacterina (Leptospirose) | NÃO_DEFINIDO (múltiplos fabricantes) | Leptospira spp. (Hardjo bovis, Canicola, Icterohaemorrhagiae, Pomona, etc.) | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA — múltiplos) | bovino, bubalino (produto adaptado se disponível) | `PRECISA_VALIDAR` — bubalinos mais suscetíveis a alguns sorogrupos; produto adaptado recomendado | 2 mL (guideline) | SC (guideline) | VARIAVEL_POR_BULA (guideline: "Hardjo ~14–21d carne — confirmar bula do produto específico") | VARIAVEL_POR_BULA (guideline: "0–72h leite — confirmar bula") | guideline_apoio | guideline_apoio | guideline_apoio + bula_fabricante (PRECISA_VALIDAR) | `needs_product_label` | Produto específico não definido; carência altamente variável por produto; bubalino: produto adaptado | Carência mais crítica desta matriz — varia por fabricante e por sorogrupo; confirmar sempre por bula |
| `vacina_viral_respiratorio_inativada` | vacina inativada combinada viral (IBR/BVD/PI3/BRSV) | NÃO_DEFINIDO (ex: CattleMaster 4+L5 — citado no guideline como exemplo de classe) | BoHV-1 (IBR), BVDV (BVD), BPIV3 (PI3), BRSV inativados | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA) | bovino (bula do produto); bubalino: sem bula específica conhecida | `NAO_AUTORIZADO` — sem bula específica para bubalino no Brasil | 2 mL (guideline) | IM (guideline) | ZERO_FONTE_BULA (guideline: "0 dias — inativada sem antibióticos — confirmar bula") | ZERO_FONTE_BULA (guideline) | guideline_apoio | guideline_apoio | guideline_apoio (genérico — confirmar bula do produto) | `needs_product_label` | Produto específico não definido (CattleMaster citado apenas como exemplo de classe); bubalino bloqueado; fabricante e registro por produto | Vacinas vivas contraindicadas em gestantes; inativadas seguras; reforço anual/semestral |
| `endectocida_ivermectina_1pct_injetavel` | endectocida injetável (Avermectina) | NÃO_DEFINIDO (múltiplos fabricantes) | Ivermectina 1% | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA — múltiplos) | bovino, bubalino (verificar bula) | `PRECISA_VALIDAR` — dose geralmente idêntica por peso; verificar bula do produto para bubalino | 1 mL/50kg = 200 µg/kg (guideline) | SC (guideline) | CONFIRMAR_BULA (guideline: "35 dias carne") | `NAO_AUTORIZADO` — guideline: "não usar; leite não consumir" | guideline_apoio | guideline_apoio | guideline_apoio (carência carne 35d — CONFIRMAR_BULA; leite NAO_AUTORIZADO) | `needs_product_label` | Produto específico não definido; fabricante e registro por produto; bubalino por bula | Não usar em lactantes; carência carne 35 dias — confirmar por bula; rotacionar classes para resistência |
| `endectocida_ivermectina_0_5pct_pour_on` | endectocida tópico/pour-on (Avermectina) | NÃO_DEFINIDO (múltiplos fabricantes) | Ivermectina 0,5% | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA — múltiplos) | bovino, bubalino (verificar bula) | `PRECISA_VALIDAR` | 1 mL/10kg linha dorsal (guideline) | tópica/pour-on (guideline) | CONFIRMAR_BULA (guideline: "28 dias carne") | ZERO_FONTE_BULA (guideline: "0 dias leite") — confirmar bula | guideline_apoio | guideline_apoio | guideline_apoio (28d carne, 0 leite — CONFIRMAR_BULA) | `needs_product_label` | Produto específico não definido; carência leite zero por guideline — confirmar bula | Não misturar com outros por não administrar < 42 dias; aplicação cutânea dorsal |
| `endectocida_eprinomectina_0_5pct_pour_on` | endectocida tópico/pour-on (Avermectina lactante) | NÃO_DEFINIDO (ex: Eprinex — nome de princípio ativo; NÃO é nome comercial definitivo) | Eprinomectina 0,5% | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA) | bovino, bubalino (verificar bula — citado para leiteiros) | `PRECISA_VALIDAR` — guideline cita para bubalinos leiteiros; verificar bula | 1 mL/10kg linha dorsal (guideline) | tópica/pour-on (guideline) | ZERO_FONTE_BULA (guideline: "0 dias carne e leite") | ZERO_FONTE_BULA (guideline: "0 dias") — EXIGE bula explícita | guideline_apoio | guideline_apoio | guideline_apoio — carência zero EXIGE bula explícita; zero não é inferido por ausência | `needs_product_label` | Nome comercial candidato não confirmado; fabricante e registro por produto específico; carência zero EXIGE bula | Produto ideal para lactantes por guideline; carência zero exige fonte bula explícita — NUNCA inferida |
| `benzimidazol_albendazol_10pct` | benzimidazol oral (Antelmíntico) | NÃO_DEFINIDO (múltiplos fabricantes) | Albendazol 10% | NÃO_DEFINIDO | NÃO_DEFINIDO (MAPA — múltiplos) | bovino, bubalino (verificar bula) | `PRECISA_VALIDAR` | 10 mg/kg = 1 mL/10kg (guideline) | oral/PO (guideline) | CONFIRMAR_BULA (guideline: "14 dias carne") | CONFIRMAR_BULA (guideline: "72h leite") | guideline_apoio | guideline_apoio | guideline_apoio (14d carne, 72h leite — CONFIRMAR_BULA) | `needs_product_label` | Produto específico não definido; carência por bula; contra indicado em gestantes | Hepatotóxico; contraindicado em gestantes; 14d carne e 72h leite — confirmar bula |
| `bacterina_campylobacter_bovino` | bacterina (Campylobacteriose) | NÃO_DEFINIDO (produto registrado MAPA para bovinos) | Campylobacter fetus venerealis (bacterina dupla) | NÃO_DEFINIDO | NÃO_DEFINIDO | bovino | `NAO_AUTORIZADO` (não há vacina para bubalinos; não aplicável) | 2 doses 30 dias (guideline) | SC (guideline — inferido) | DESCONHECIDO (guideline não informa carência) | DESCONHECIDO | guideline_apoio | guideline_apoio | DESCONHECIDO — bula necessária | `needs_product_label` | Produto específico não definido; carência não informada no guideline; bubalino não aplicável | Recomendado para fazendas de cria; touros: dose única anual antes da estação |
| `vacina_rb51_bovino_bloqueio_bubalino` | vacina viva atenuada (Brucella RB51) — registro bloqueio bubalino | Bovilis® RB-51 (citado no guideline) | Brucella abortus cepa RB51 | NÃO_DEFINIDO | NÃO_DEFINIDO | bovino fêmea (sem leite) | `NAO_AUTORIZADO` — bula cita apenas fêmeas bovinas | 2 mL (guideline) | SC (guideline) | CONFIRMAR_BULA | `NAO_AUTORIZADO` (lactantes) | guideline_apoio | guideline_apoio | guideline_apoio | `blocked_alert_only` | Fabricante e registro por bula vigente; bubalino bloqueado; carência por bula | Este produto é o mesmo que `vacina_brucelose_rb51_bovilis` — linha duplicada com foco no status de bloqueio bubalino para evidência |
| `toxocara_vitulorum_pesquisa_bubalino` | antelmíntico (experimental/pesquisa — sem vacina registrada) | NÃO_DEFINIDO (sem vacina comercial) | NÃO_DEFINIDO (estudos iniciais em bubalinos — sem formulação comercial) | NÃO_DEFINIDO | NÃO_DEFINIDO | bubalino (estudos preliminares) | `PRECISA_VALIDAR` (sem vacina registrada; uso de antiparasitários orais como controle) | NÃO_DEFINIDO | NÃO_DEFINIDO | DESCONHECIDO | DESCONHECIDO | NÃO_DISPONIVEL | NÃO_DISPONIVEL | NÃO_DISPONIVEL | `blocked_alert_only` | Sem produto comercial; sem vacina registrada; sem dose; sem via; sem carência — tudo ausente | Controle atual por antiparasitários orais (não por vacina); somente alerta documental |

---

## Resumo de lacunas críticas por campo

| Campo | Produtos afetados | Ação necessária |
|---|---|---|
| `nome_comercial` | Todos exceto Bovilis® RB-51 (citado como exemplo) | Curadoria de produtos registrados MAPA por classe |
| `fabricante` | Todos | Curadoria via MAPA/SINDAN |
| `registro` | Todos | Consulta ao MAPA para número de registro por produto |
| `carencia_carne` | Leptospirose, Ivermectinas, Brucelose, Raiva | Bula do produto executado |
| `carencia_leite` | Leptospirose, Ivermectinas, Albendazol | Bula do produto executado |
| `bubalino_status` | Clostridioses, IBR/BVD, Leptospirose, Ivermectinas, Brucelose | Revisão de bulas específicas por espécie |
| `carencia_zero_confirmada` | Eprinomectina, Aftosa (por IN-48/2020) | Bula e/ou norma explícita — jamais inferida |
| `especie_bubalino_forte` | RB51 (bloqueado), IBR/BVD (bloqueado) | Fonte forte ausente; bloqueio confirmado |

---

## Notas gerais

1. **Eprinomectina**: é o único produto onde a carência zero pode ser candidata robusta, pois o guideline cita "carência zero carne e leite" e "vacas leiteiras" — mas mesmo assim exige confirmação de bula antes de qualquer seed.
2. **Febre aftosa**: carência zero candidata robusta por IN-48/2020 citada no guideline — a mais próxima de `validated_for_review` nesta categoria.
3. **Brucelose RB51**: bubalino bloqueado confirmado por bula citada no guideline — único produto com evidência de `NAO_AUTORIZADO` disponível no guideline.
4. **Toxocara bubalino**: sem produto comercial; sem dose; sem via; sem carência — entrada apenas documental/alerta.
5. **Campylobacteriose**: carência desconhecida — guideline não informa; bula necessária antes de qualquer dado.

---

_Versão: 12D3 | Produtos candidatos para revisão | Nenhuma carência liberada | Não são seed_
