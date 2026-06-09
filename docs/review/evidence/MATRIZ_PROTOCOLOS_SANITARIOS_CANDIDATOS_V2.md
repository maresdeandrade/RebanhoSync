# Matriz de Protocolos Sanitários Candidatos v2

Atualizado em: 2026-06-09
Fase: 12D3 — Extração curatorial de protocolos candidatos
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Protocolos abaixo são **candidatos curatoriais** para revisão técnica e veterinária.

**Não são seed, não geram agenda, não autorizam execução, não liberam carência e não substituem bula, norma oficial, registro MAPA ou decisão do médico-veterinário responsável.**

Toda linha precisa de revisão humana antes de qualquer carga em banco.

---

## Estados de status curatorial

| Status | Significado |
|---|---|
| `draft_from_guideline` | Candidato extraído do guideline; ainda não validado por fonte forte |
| `needs_official_source` | Depende de norma oficial MAPA/órgão estadual vigente |
| `needs_product_label` | Depende de bula/registro/produto específico |
| `needs_mv_validation` | Depende de decisão do médico-veterinário responsável |
| `validated_for_review` | Estruturado suficientemente para revisão humana — não para seed final |
| `blocked_alert_only` | Apenas alerta; não deve virar protocolo automático |
| `not_automatable` | Não deve gerar agenda automática em hipótese alguma |

## Estados de automação

| Status | Significado |
|---|---|
| `candidate_only` | Candidato documental; nenhuma automação liberada |
| `review_required` | Requer revisão veterinária antes de qualquer automação |
| `blocked_missing_source` | Bloqueado por ausência de fonte forte |
| `blocked_bubaline_unclear` | Bloqueado por ausência de fonte para bubalino |
| `blocked_off_label` | Bloqueado por uso fora de bula/norma |
| `blocked_experimental` | Bloqueado por ser experimental/pesquisa |
| `not_automatable_alert` | Nunca automatizar; somente alerta documental |

---

## Tabela de Protocolos Candidatos

| protocol_family | protocol_name | species_scope | categoria | aptidao | fase_produtiva | doenca_alvo | acao_sanitaria | obrigatoriedade | status_curatorial | fonte_minima_necessaria | fonte_disponivel_no_guideline | lacunas | automation_status | observacoes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `febre_aftosa` | Febre Aftosa — Zona com Vacinação | `bovino`, `bubalino` | bovídeos em zonas com campanha | `corte`, `leite`, `mista` | todos | Febre Aftosa (FMD) — Aftovirus | vacinacao | `obrigatorio_norma` (condicional por UF/zona) | `needs_official_source` | Portaria MAPA 665/2024; PNEFA vigente; norma estadual de zona | Sim — guideline cita PNEFA, Portaria 665/2024, campanhas mai/nov, zonas com e sem vacinação | Texto exato das portarias vigentes por UF; lista atualizada de zonas livres sem vacinação | `blocked_missing_source` | Proibido vacinar em UF "livre sem vacinação" (ex: SP, MT, MG, RS, SC e listadas em Portaria 665/2024); requer curadoria de norma vigente por UF antes de qualquer seed |
| `febre_aftosa` | Febre Aftosa — Zona Livre sem Vacinação | `bovino`, `bubalino` | bovídeos em UF livre sem vacinação | `corte`, `leite`, `mista` | todos | Febre Aftosa (FMD) — Aftovirus | bloqueio_uso_vacina | `NAO_AUTORIZADO` (uso proibido) | `blocked_alert_only` | Portaria MAPA 665/2024 vigente com lista de UFs | Sim — guideline cita proibição explícita | Lista exata de UFs e datas de reconhecimento atualizadas | `not_automatable_alert` | Vacina proibida em zona livre sem vacinação; protocolo deve registrar bloqueio, não ação |
| `brucelose` | Brucelose B19 — Fêmeas 3–8 meses | `bovino` | fêmeas bovinas 3–8 meses | `corte`, `leite`, `mista` | recria | Brucelose — Brucella abortus cepa B19 | vacinacao | `obrigatorio_norma` (PNCEBT) | `needs_official_source` | PNCEBT (IN-21/2008); IN 48/2020; bula do fabricante para carência e bubalino | Sim — guideline cita PNCEBT, dose única SC, faixa etária 3–8m, marcação obrigatória | Bula específica de fabricante; carência leite por fabricante; situação de bubalinas por UF | `blocked_missing_source` | Dose única na vida; fêmeas apenas; marcar com ferro; não reaplicar; carência carne ~30d varia por bula |
| `brucelose` | Brucelose B19 — Bubalinas (condicional) | `bubalino` | fêmeas bubalinas onde norma permite | `leite`, `mista` | recria | Brucelose — Brucella abortus cepa B19 | vacinacao | `condicional` (depende de UF/norma) | `needs_official_source` | PNCEBT; norma estadual específica para bubalinos; bula autorizando bubalinos | Sim — guideline cita "se bula/norma permitir vacinação de bubalinas (varia conforme UF)" | Norma estadual específica; bula de fabricante cobrindo bubalinos; confirmação MAPA | `blocked_bubaline_unclear` | Bubalino não herda autorização bovina; exige fonte forte explícita por produto e UF |
| `brucelose` | Brucelose RB51 — Bovinas (alternativa técnica) | `bovino` | fêmeas bovinas ≥ 3 meses negativas ao teste | `corte`, `leite`, `mista` | recria/reprodução | Brucelose — Brucella abortus cepa RB51 | vacinacao | `recomendado_tecnico` (alternativa a B19) | `needs_product_label` | Bula do produto (ex: Bovilis® RB-51 — cita apenas bovinos); MAPA | Sim — guideline cita RB51 como alternativa a B19; proíbe uso em bubalinas e lactantes | Bula com registro vigente; carência carne (~3 semanas); registro MAPA | `blocked_missing_source` | Não aplicar em bubalinas; não usar em lactantes; não é obrigatória |
| `raiva` | Raiva dos Herbívoros — Área de Risco | `bovino`, `bubalino` | vacas em gestação tardia, touros em zonas endêmicas | `corte`, `leite`, `mista` | reprodução, gestação | Raiva — Lyssavirus | vacinacao | `condicional` (campanhas estaduais em zonas endêmicas) | `needs_official_source` | PNCRH; normas estaduais; bula do fabricante para carência e bubalino | Sim — guideline cita vacinação anual em áreas de risco de morcego vampiro, campanhas estaduais | Programa estadual aplicável; lista de zonas de risco atualizadas; bula específica por produto | `blocked_missing_source` | Não obrigatório em todo o país; carência geralmente zero por vacina inativada, mas verificar bula; bubalino depende de programa estadual |
| `clostridioses` | Clostridioses Múltiplas — Core Rebanho | `bovino`, `bubalino` | todos (cria, engorda, leite) | `corte`, `leite`, `mista` | todas as fases | Clostridioses — Cl. chauvoei, novyi, septicum, haemolyticum, sordellii e outros | vacinacao | `recomendado_tecnico` (core técnica) | `needs_product_label` | Bulas dos produtos multivalentes (7V, 8V); nenhuma norma obrigatória federal universal | Sim — guideline cita como essencial/core em todas as categorias; dose 2mL SC; esquema 2 doses + reforço anual | Bula por produto específico (7V vs 8V); fabricante; carência confirmada por bula | `review_required` | Não é obrigação legal universal; carência zero citada no guideline depende de bula do produto; bubalinos seguem mesmo protocolo se bula mencionar |
| `leptospirose` | Leptospirose — Vacinas Bacterinas (5–6 sorogrupos) | `bovino`, `bubalino` | fêmeas, novilhas; rebanhos em áreas úmidas | `corte`, `leite`, `mista` | reprodução, gestação | Leptospirose — Leptospira spp. (Hardjo, Canicola, Icterohaemorrhagiae, Pomona, etc.) | vacinacao | `recomendado_tecnico` / `obrigatorio_norma` (SP e outros estados) | `needs_official_source` | Norma estadual (SP e outros); bula do produto específico para carência | Sim — guideline cita esquema 2 doses, reforços semestrais; SP exige; carência variável por bula | Portaria SP e outros estados; bula do produto específico; carência carne 14–21d e leite variável | `blocked_missing_source` | Carência variável (ex: Hardjo 14–21d carne, 72h leite) — depende da bula do produto; bubalinos podem precisar de vacina adaptada |
| `leptospirose` | Leptospirose — Reforço Pré-Parto (Matrizes) | `bovino` | matrizes gestantes (último trimestre) | `corte`, `leite`, `mista` | gestação | Leptospirose — Leptospira spp. | vacinacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto para segurança em gestantes e carência | Sim — guideline cita aplicação 6–8 semanas antes do parto para anticorpos colostrais | Bula do produto confirmar segurança em gestantes; carência por produto | `review_required` | Inativadas geralmente seguras em gestantes avançadas; não aplicar vivas no 1º trimestre |
| `ibr_bvd_pi3_brsv` | Complexo Respiratório Viral (IBR/BVD/PI3/BRSV) — Rebanho Intensivo | `bovino` | rebanhos intensivos, leiteiros, recria | `leite`, `corte`, `mista` | recria, reprodução | IBR (BoHV-1), BVD, PI3, BRSV | vacinacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto (inativadas ou vivas modificadas); instrução de uso em gestantes | Sim — guideline cita esquema 2 doses 4 semanas, reforço anual; inativadas mais seguras em gestantes | Bula por produto comercial (ex: CattleMaster 4+L5 ou equivalente); fabricante | `blocked_bubaline_unclear` | Bubalinos: usar somente se produto citar espécie; vacinas vivas contraindicadas em gestantes; carência 0 para inativadas por guideline — confirmar por bula |
| `clostridioses` | Clostridioses — Primovacinação em Bezerros | `bovino`, `bubalino` | bezerros a partir de 1–2 meses | `corte`, `leite`, `mista` | cria | Clostridioses múltiplas | vacinacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto para bezerros; bula confirmar bubalinos | Sim — guideline cita 2 doses com 30 dias de intervalo, iniciando após colostro | Bula específica do produto para bezerros; resposta vacinal depende de colostro vacinal | `review_required` | Iniciar após colostragem; 1ª dose 1–2 meses; 2ª dose +30 dias; reforço anual |
| `brucelose` | Pré-parto — Revisão de Fêmeas de 1ª Cria | `bovino` | matrizes de 1ª cria antes do 1º parto | `corte`, `leite`, `mista` | reprodução | Brucelose | vacinacao_verificacao | `recomendado_tecnico` | `needs_official_source` | PNCEBT; bula do fabricante | Sim — guideline cita revacinar 60d antes do parto em fêmeas de 1ª cria | Interpretação oficial do PNCEBT para revacinar; clareza sobre B19 dose única vs reforço | `blocked_missing_source` | Interpretação controversa: B19 é dose única na vida; verificar se orientação de reforço tem base normativa explícita |
| `campylobacteriose` | Campylobacteriose — Reprodutores | `bovino` | matrizes e touros em estação de monta | `corte`, `mista` | reprodução | Campylobacteriose — Campylobacter fetus venerealis | vacinacao | `recomendado_tecnico` (fazendas de cria) | `needs_product_label` | Bula do produto (bacterina dupla); MV responsável para protocolo de IA | Sim — guideline cita 2 doses 30 dias para matrizes e touros; dose anual antes da estação | Produto comercial disponível no Brasil; bula com registro MAPA | `review_required` | Touros: dose única SC 45 dias antes da estação; não há vacina registrada para Tricomonose |
| `controle_parasitario` | Ivermectina Injetável — Controle Antiparasitário | `bovino`, `bubalino` | rebanho geral (preferência novilhos/adultos) | `corte`, `mista` | engorda, confinamento | Endoparasitas, Ectoparasitas — Nematódeos, Carrapatos, Berne | vermifugacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto (princípio ativo: ivermectina 1%) com carência por espécie | Sim — guideline cita 1mL/50kg SC; carência 35 dias carne; leite não usar | Bula do produto específico; carência por espécie; posição para bubalino | `blocked_missing_source` | Carência carne 35 dias; leite: não autorizado para vacas lactantes — confirmar por bula; bubalinos: verificar bula |
| `controle_parasitario` | Ivermectina Pour-On — Controle Antiparasitário | `bovino`, `bubalino` | rebanho geral | `corte`, `mista`, `leite` | engorda | Endoparasitas, Ectoparasitas | vermifugacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto (ivermectina 0,5% pour-on) | Sim — guideline cita 1mL/10kg; carência 28 dias carne; leite 0 | Bula do produto específico; fabricante; posição bubalino | `review_required` | Carência carne 28 dias; leite 0 dias por guideline — confirmar por bula do produto |
| `controle_parasitario` | Eprinomectina Pour-On — Carência Zero | `bovino`, `bubalino` | vacas leiteiras e rebanho em geral | `leite`, `corte`, `mista` | lactação, engorda | Endoparasitas, Ectoparasitas | vermifugacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto (ex: Eprinex) para carência zero confirmada | Sim — guideline cita 1mL/10kg; carência 0 dias carne e leite (vacinas leiteiras) | Bula do produto específico; carência zero exige fonte explícita de bula | `blocked_missing_source` | Carência zero NÃO é inferida por ausência; exige bula que afirme explicitamente zero; produto ideal para lactantes segundo guideline |
| `controle_parasitario` | Albendazol 10% — Endectocida Oral | `bovino`, `bubalino` | rebanho geral | `corte`, `leite`, `mista` | engorda | Endoparasitas | vermifugacao | `recomendado_tecnico` | `needs_product_label` | Bula do produto (albendazol 10%) | Sim — guideline cita 10mg/kg (1mL/10kg) PO; carência 14d carne, 72h leite | Bula do produto específico; posição bubalino | `review_required` | Carência carne 14 dias; leite 72h — confirmar por bula; evitar em gestantes (hepatotóxico) |
| `rb51_bubalino` | Brucelose RB51 — Bubalinas (bloqueio/alerta) | `bubalino` | fêmeas bubalinas | `leite`, `mista` | recria | Brucelose — Brucella abortus cepa RB51 | alerta_bloqueio | `NAO_AUTORIZADO` (sem bula para bubalinos) | `blocked_alert_only` | Bula do produto (Bovilis® RB-51 cita apenas bovinas) | Sim — guideline afirma: "Não aplicar em bubalinas sem bula específica autorizando" | Nenhuma — bula não autoriza bubalinos | `not_automatable_alert` | Uso proibido sem bula específica; marcar como NAO_AUTORIZADO para bubalino; somente alerta documental |
| `toxocara_bubalino` | Toxocara vitulorum — Bubalinos Neonatos (alerta) | `bubalino` | bubalinos neonatos | `leite`, `mista`, `corte` | cria | Toxocara vitulorum | alerta_pesquisa | `not_automatable` (experimental/alerta) | `blocked_experimental` | Literatura veterinária — estudos iniciais em bubalinos; sem vacina registrada | Sim — guideline cita "estudos em bubalinos; falta formulação vacina; uso atual antiparasitários orais" | Nenhuma fonte forte; sem registro MAPA; sem protocolo comercial | `not_automatable_alert` | Sem vacina registrada; controle atual por antiparasitários orais; não criar protocolo automático; somente alerta de pesquisa |
| `carrapato_bm86` | Vacina Carrapato Bm86 — Uso Restrito | `bovino` | rebanho em estados com uso parcial | `corte`, `leite`, `mista` | engorda | Carrapato — Boophilus microplus | vacinacao_experimental | `not_automatable` (experimental restrito) | `blocked_experimental` | Registro parcial em estados específicos; bula do produto comercial (ex: Gavac) | Sim — guideline cita aprovação parcial (ex: MT); eficácia moderada; custo alto | Registro MAPA nacional; bula por estado; eficácia local | `not_automatable_alert` | Uso restrito a estados específicos; eficácia dependente de parasitismo; não incluir em protocolo padrão |
| `salmonella_autogena` | Salmonella — Vacina Autógena | `bovino` | rebanhos com diagnóstico confirmado de Salmonella | `corte`, `leite`, `mista` | todas | Salmonella spp. | vacinacao_experimental | `not_automatable` (uso restrito por MV) | `blocked_experimental` | Autorização MAPA para uso de autógena; diagnóstico confirmado; MV responsável | Sim — guideline cita "uso restrito por MV com autorização MAPA; diagnóstico prévio obrigatório" | Autorização específica MAPA; diagnóstico confirmado por cepa | `not_automatable_alert` | Eficácia variável; diagnóstico obrigatório antes de seleção de cepa; somente uso clínico restrito |

---

## Notas gerais de curadoria

1. **Nenhuma linha desta matriz é seed final.** Toda linha é candidato para revisão.
2. **Carência zero** somente pode aparecer como candidata onde o guideline cita fonte explícita (bula/norma). Onde não há citação explícita, foi marcado `blocked_missing_source`.
3. **Bubalinos** não herdam autorização bovina. Toda linha com `bubalino` em `species_scope` deve ter validação de fonte por espécie antes de qualquer seed.
4. **Itens experimentais/alerta** (Toxocara, Bm86, Salmonella autógena) estão bloqueados como `not_automatable_alert`. Não devem gerar agenda automática.
5. **Febre aftosa em zona livre sem vacinação** é caso especial de bloqueio total — protocolo existe apenas como alerta de proibição.
6. **Obrigatoriedade legal** (aftosa, brucelose B19, raiva em alguns estados) exige norma oficial vigente antes de qualquer campo `legal_status = obrigatorio_norma`.
7. **Clostridioses** e **raiva** são os dois candidatos com estrutura mais completa disponível no guideline — ainda assim precisam de bula de produto para carência e autorização de espécie.

---

## Lacunas sistêmicas identificadas

| Lacuna | Protocolos afetados | Ação necessária |
|---|---|---|
| Portaria 665/2024 com lista completa de UFs e zonas | Febre aftosa | Curadoria normativa MAPA |
| Bulas de produtos específicos (fabricante, registro, carências) | Clostridioses, Leptospirose, IBR/BVD, Ivermectina, Eprinomectina, Albendazol | Curadoria de bulas por produto candidato |
| Normas estaduais de vacinação por UF | Leptospirose (SP+), Raiva, Brucelose bubalino | Curadoria estadual por UF |
| Autorização explícita de bubalinos por produto | Clostridioses, IBR/BVD, Leptospirose, Ivermectinas | Revisão de bulas para bubalinos |
| Confirmação carência zero por bula | Eprinomectina, Febre aftosa | Bula do produto candidato |
| MV responsável documentado | RB51, Toxocara, todos os EXTRAPOLADO | Decisão veterinária por fazenda |

---

_Versão: 12D3 | Candidatos para revisão | Não são seed | Não geram agenda_
