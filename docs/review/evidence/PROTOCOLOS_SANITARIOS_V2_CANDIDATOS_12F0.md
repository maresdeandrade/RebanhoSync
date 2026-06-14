# Protocolos Sanitários v2 Candidatos — 12F0

Atualizado em: 2026-06-14
Escopo: documento curatorial. Não é seed, migration, regra automática, agenda materializada nem autorização operacional.

Este arquivo deriva do plano 12F0 e das matrizes 12D4. Evidencia decisão curatorial dos protocolos candidatos após atualização de fontes.

## Decisão consolidada

Nenhum protocolo 12F0 foi promovido a `agenda_allowed` ou `approved_for_catalog`.

Motivo: mesmo quando há fonte forte para parte dos campos, ainda faltam overlay regional, produto executado, carência produto-específica, cadastro/registro do produto, decisão MV quando exigida e trilha operacional.

## Matriz atualizada de protocolos

| protocol_key | curationStatus | automationStatus | fontes fortes atualizadas | gaps remanescentes | decisão 12F0 atualizada |
|---|---|---|---|---|---|
| `brucelose_b19` | `needs_review` | `manual_only` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | UF/classe PNCEBT, fluxo SVE/MV habilitado, marcação, produto comercial/cadastro e trilha legal. | Entra no lote. Elegibilidade por fêmea 3–8 meses pode ser calculada, mas agenda automática segue bloqueada. |
| `clostridioses` | `needs_review` | `preview_allowed` | `SRC_BULA_FORTRESS7` | Fonte forte é produto-específica; não cobre toda classe; bubalino não confirmado; carência depende do produto executado. | Entra para preview conservador em bovinos. Sem validação de execução por classe. |
| `raiva_herbivoros` | `needs_review` | `manual_only` | `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA` | Foco/perifoco, área de risco, norma estadual, calendário local e mapeamento espécie/grupo. | Entra como regional/condicional. Manual only até existir `regionalApplicabilityRule`. |
| `leptospirose` | `needs_review` | `manual_only` | `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Produto muda esquema: dose única em alguns, 2 doses em combinadas; sorovar/sorogrupo e risco regional; bubalino não confirmado. | Entra no lote. Não criar primovacinação genérica única para leptospirose. |
| `ibr_bvd` | `needs_review` | `preview_allowed` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | Fonte para bovinos; bubalino bloqueado sem fonte; produto vivo/inativado e gestação dependem de bula. | Entra para preview em bovinos. Execução exige produto real e snapshot. |
| `controle_parasitario_recria_5_7_9` | `needs_review` | `preview_allowed` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | “5/7/9” são meses maio/julho/setembro, não idade. Regionalidade Cerrado/Brasil Central; produto, peso e carência obrigatórios. | Entra no lote com `ProductClassGroup` obrigatório. Renomear itens para `recria_maio`, `recria_julho`, `recria_setembro`. |
| `vermifugacao_pre_desmama` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE` | Não é recomendação universal; Embrapa aponta pouca eficácia em bezerros zebu extensivos antes da desmama; pode variar em leite/intensivo. | Entra apenas como candidato situacional. Demovido de preview genérico para manual only. |
| `vermifugacao_pre_confinamento_pasto_vedado` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Proximidade de abate torna carência crítica; produto/peso/aptidão exigidos; risco de erro operacional alto. | Entra no lote, mas execução só com produto real e carência congelada. |
| `matrizes_pre_parto` | `needs_review` | `manual_only` | `SRC_EMBRAPA_VERMINOSE`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN` | “30 dias antes do parto” não é regra universal; gestação/lactação variam por produto; MV obrigatório em cenários de risco. | Entra no lote como situacional. Sem agenda pré-parto automática. |
| `febre_aftosa` | `archived` | `blocked` | `SRC_PNEFA_MAPA` | Vacinação de rotina suspensa; uso operacional somente em contingência normativa oficial/SVO. | Manter histórico/contingência. Bloquear campanha, agenda, produto oficial e execução rotineira. |

## Mudanças relevantes versus versão anterior

| ponto | antes | atualizado |
|---|---|---|
| B19 | gap de norma completa | PNCEBT resolve espécie/sexo/idade/obrigatoriedade; ainda bloqueia agenda por UF/SVE/MV/marcação/produto. |
| Raiva | fonte candidata | PNCRH/MAPA confirmam dose/via/idade/recomendação por foco; continua regional/condicional. |
| Febre aftosa | campanha/zona de vacinação como item candidato | rotina vacinal suspensa; protocolo operacional fica `archived/blocked`. |
| Recria 5/7/9 | risco de interpretar como idade 5/7/9 meses | corrigido para maio/julho/setembro. |
| Pré-desmama | `preview_allowed` genérico | demovido para `manual_only` situacional. |
| Leptospirose | risco de esquema único | esquema varia por produto; dose única não vale para todos. |
| Carência | carência parcialmente em protocolo | carência só por produto executado/evento. |
| Bubalino | risco de herança bovina | não herdar bovino; exigir fonte explícita. |

## Invariantes para 12F0

```ts
const protocol12F0Invariant = {
  approvedForCatalog: false,
  agendaAllowed: false,
  allowsAgendaAuto: false,
  activeWithdrawalWithoutProduct: false,
  bovinoToBubalinoInheritance: false,
  classDoseExecutionValidation: false,
  classWithdrawalExecutionValidation: false,
}
```

## Critérios mínimos para promoção futura

Um protocolo só pode sair de `needs_review` quando cumprir:

1. fonte normativa/técnica completa;
2. fonte por produto quando houver dose/via/carência;
3. espécie explícita;
4. regra de sexo/idade quando aplicável;
5. regra regional quando legal ou epidemiológica;
6. produto autorizado e cadastro validado;
7. carência congelável no evento;
8. regra de MV/responsável quando aplicável;
9. testes de edge cases;
10. rollback seguro sem criar histórico falso.

## Referências

As URLs e detalhes completos ficam centralizados em:

- `MAPA_FONTES_PROTOCOLOS_SANITARIOS_V2_12F0.md`
