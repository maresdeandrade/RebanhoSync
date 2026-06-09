# README — Curadoria Sanitária v2

Atualizado em: 2026-06-09
Fase: 12D3 — Extração curatorial de protocolos candidatos
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## O que são estas matrizes

As matrizes curatoriais v2 foram produzidas na **Fase 12D3** do RebanhoSync como artefatos de revisão técnica e veterinária.

Elas **não são seed, não são código, não geram agenda automática e não autorizam execução** de nenhuma ação sanitária. São documentos para que um comitê humano (técnico, veterinário ou regulatório) revise e valide antes de qualquer carga real em banco.

---

## Arquivos desta pasta

| Arquivo | Conteúdo |
|---|---|
| `MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md` | Lista de protocolos candidatos com status curatorial e de automação |
| `MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md` | Lista de itens versionáveis por protocolo com dose, via, janela e espécie |
| `MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | Lista de produtos/classes candidatos com carências e status de autorização |
| `MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md` | Lista de fontes identificadas ou necessárias, com força e lacunas |
| `Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md` | Guideline curatorial — fonte de apoio, NÃO fonte forte |

---

## Como revisar as matrizes

### Passo 1 — Revisar protocolos candidatos

Leia `MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md`.

Para cada linha, verifique:

1. A doença-alvo está correta para o contexto da fazenda?
2. O status curatorial está adequado?
3. A fonte mínima necessária está disponível?
4. As lacunas são superáveis (você tem bula, norma ou pode acionar MV)?

### Passo 2 — Revisar itens versionáveis

Leia `MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md`.

Para cada item, verifique:

1. Dose e via estão corretos para o produto que será usado?
2. A janela operacional faz sentido para o calendário da fazenda?
3. O status de bubalino está correto para o rebanho?
4. O item pode gerar agenda no futuro (ou deve ficar bloqueado)?

### Passo 3 — Revisar produtos candidatos

Leia `MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md`.

Para cada produto, verifique:

1. O produto existe no mercado com registro MAPA vigente?
2. A bula autoriza a espécie e aptidão pretendida?
3. A carência está correta para o produto que será efetivamente utilizado?
4. A carência zero (onde candidata) é confirmada pela bula?

### Passo 4 — Revisar fontes técnicas

Leia `MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md`.

Para cada fonte, verifique:

1. A norma existe e está vigente?
2. O texto da norma confirma o campo coberto?
3. A bula está disponível e é do produto que será utilizado?
4. A fonte é forte (bula/norma oficial) ou apenas apoio (guideline)?

---

## O que pode virar protocolo

Um protocolo pode ser elevado de candidato a ativo somente quando:

- [ ] A fonte forte (norma oficial ou bula de produto vigente) estiver disponível para **todos** os campos críticos (legal_status, species_authorization, dose, via, carência);
- [ ] A revisão veterinária responsável tiver aprovado o protocolo para a fazenda;
- [ ] O bubalino, se incluído, tiver autorização explícita na bula ou norma (não herança bovina);
- [ ] Carência zero, se aplicável, estiver explicitamente declarada na bula/norma (nunca inferida);
- [ ] O protocolo não for experimental, alerta ou de uso restrito por MV.

---

## O que precisa de fonte oficial

Os seguintes campos **exigem norma oficial MAPA ou órgão estadual vigente**:

- `legal_status = obrigatorio_norma` → norma federal ou estadual vigente
- `legal_status = condicional` por UF/zona → portaria específica por UF ou zona sanitária
- `species_authorization` para obrigatoriedade legal → programa oficial que inclua a espécie

---

## O que precisa de bula

Os seguintes campos **exigem bula do produto que será efetivamente utilizado**:

- `dose` e `via` → bula do produto executado
- `carencia_carne` e `carencia_leite` → bula do produto executado
- `carencia_zero` → bula **afirmando explicitamente zero** (nunca inferida)
- `species_authorization = SIM_BULA` → bula citando a espécie
- Contraindicações (gestantes, lactantes, machos) → bula

---

## O que precisa de MV responsável

Os seguintes casos **exigem decisão documentada do médico-veterinário responsável pela fazenda**:

- Qualquer uso marcado como `EXTRAPOLADO` (fora de bula/norma)
- Qualquer protocolo marcado como `blocked_off_label`
- Vacinas autógenas (Salmonella, etc.)
- Uso de produto em espécie não contemplada na bula

A decisão do MV deve ser auditável por fazenda (`scope = fazenda`, `requiresMvResponsavel = true`).

---

## O que é proibido automatizar

Os seguintes itens **jamais podem gerar agenda automática**, mesmo após revisão:

| Item | Motivo |
|---|---|
| Toxocara vitulorum em bubalinos | Sem vacina registrada; somente pesquisa |
| Vacina carrapato Bm86 (Gavac) | Aprovação parcial/restrita; custo; eficiência variável |
| Salmonella autógena | Diagnóstico obrigatório; autorização MAPA |
| RB51 em bubalinas | NAO_AUTORIZADO por bula |
| Qualquer item `somente_alerta` ou `bloqueado` | Contrato v2 proíbe agenda automática |
| Febre aftosa em zona livre sem vacinação | Proibido por norma |
| Carência liberatória sem produto executado | Protocolo sem evento não tem carência |
| Venda/abate automático | Bloqueio permanente do modelo |

---

## Sequência sugerida para curadoria

1. **Normas federais**: localizar e ler Portaria 665/2024 (aftosa), IN-21/2008 (PNCEBT), IN-48/2020 (carência aftosa), IN 28/2005 (bubalinos PNCEBT) e PNCRH.
2. **Normas estaduais**: por UF do rebanho — portaria SP para leptospirose; programa estadual de raiva; situação de bubalinos por UF.
3. **Bulas de produtos**: por ordem de prioridade — clostridioses (core), aftosa (produto aprovado MAPA), brucelose B19 (PNCEBT), eprinomectina (carência zero), ivermectinas (carência carne/leite), albendazol, leptospirose, raiva.
4. **Revisão veterinária**: MV responsável valida campos de dose, via, janela operacional e quaisquer casos EXTRAPOLADO ou PRECISA_VALIDAR.
5. **Elevação para `validated_for_review`**: somente após itens 1–4 para os campos críticos do protocolo/produto.
6. **Seed controlado**: somente após aprovação humana explícita e com os campos obrigatórios preenchidos por fonte forte.

---

## Relação com o modelo canônico v2

Estas matrizes são a entrada para o modelo canônico v2 definido nas fases 12D0–12D2:

| Matriz | Alimenta |
|---|---|
| Protocolos candidatos | `sanitario_protocolos_v2` + `SanitaryProtocolV2` |
| Itens versionáveis | `sanitario_protocolo_itens_versions_v2` + `SanitaryProtocolItemVersionV2` |
| Produtos candidatos | `sanitario_produtos_v2` + `SanitaryProductV2` + `WithdrawalRuleV2` |
| Fontes técnicas | `sanitario_fontes_tecnicas_v2` + `SanitarySourceRefV2` |

---

## Próxima fase recomendada

Após revisão humana das matrizes:

- **12D4 — Revisão técnico-veterinária das matrizes curatoriais**: revisar cada linha com MV responsável, confirmar bulas e normas, elevar candidatos para `validated_for_review`.
- **12E — Curadoria assistida e carga inicial controlada**: seed dos candidatos aprovados em ambiente de homologação, com validação de RLS e multi-tenant.
- **12F — Offline/sync da Agenda Sanitária v2**: conectar Dexie, sync-batch e UI aos contratos v2 estabilizados.

---

_Versão: 12D3 | Guia de revisão | Não é código | Não é seed_
