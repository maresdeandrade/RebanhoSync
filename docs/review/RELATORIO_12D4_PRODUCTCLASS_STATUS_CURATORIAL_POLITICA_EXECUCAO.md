# RELATÓRIO 12D4 — ProductClass, Status Curatorial e Política de Execução

> **Escopo**: Documental e decisório.
> **Nenhum código TypeScript foi alterado.**
> **Nenhum schema SQL foi alterado.**
> **Nenhuma migration foi criada.**
> **Próxima etapa técnica bloqueada até validação deste relatório.**

---

## Diagnóstico local (pré-relatório)

```
Commit: 59d7b45  (merge main ← origin/main — worktree limpo)
repo_ok              ✅
sanitario_ok         ✅
rebaseline_12D3_ok   ✅
git diff --check     OK (trailing whitespace pré-existente em README_CURADORIA só)
Alterações TypeScript/SQL não relacionadas: nenhuma
```

---

## Referências consumidas

| Documento | Status |
|---|---|
| `docs/review/PLANO_FASE_12D3_REBASELINE_SRC_LIB_SANITARIO.md` | Lido — §5, §7, §12 consumidos como base |
| `src/lib/sanitario/rules/sanitaryProtocolV2.ts` | Lido — `ProductRequirementKindV2`, `SanitaryProtocolItemVersionV2`, `allowsAgendaAuto` |
| `src/lib/sanitario/rules/sanitaryProductV2.ts` | Lido — `SanitaryProductV2`, `SanitaryCuratorialStatusV2`, `WithdrawalRuleV2`, `SpeciesAuthorizationV2` |
| `src/lib/sanitario/rules/sanitarySnapshotsV2.ts` | Lido — `AgendaTechnicalSnapshot`, `EventTechnicalSnapshot` |
| `src/lib/sanitario/rules/sanitaryProtocolRule.ts` | Lido — contrato operacional legado |
| `src/lib/sanitario/rules/sanitarySourceV2.ts` | Lido — `SanitaryEvidenceStatusV2`, `hasStrongSourceCoveringFieldV2` |
| `src/lib/sanitario/catalog/products.ts` | Lido — `VeterinaryProductOrigin`, `CATEGORY_HINTS`, `hasStructuredProduct` (via exceptions) |
| `src/lib/sanitario/reconciliation/sanitaryExceptions.ts` | Lido — `hasStructuredProduct`, severidades, `SanitaryExceptionCode` |
| `src/lib/sanitario/AGENTS.md` | Lido — invariantes locais e regras de camada |

---

## 1. O que é ProductClass

### 1.1 Definição canônica

**ProductClass** é a **classe técnica sanitária** que satisfaz o requisito geral de um item de protocolo.

É um rótulo semântico que representa uma categoria de produto com perfil farmacológico equivalente para o fim declarado no protocolo — sem nomear produto comercial específico.

```
ProductClass = propriedade técnica coletiva de produtos intercambiáveis
               para o propósito declarado em um item de protocolo sanitário.
```

**Exemplos concretos:**

| ProductClass (key) | Significado técnico |
|---|---|
| `vacina_brucelose_b19` | Cepa B19 viva atenuada de *Brucella abortus* |
| `vacina_brucelose_rb51` | Cepa RB51 de *Brucella abortus* |
| `vacina_clostridial_multivalente` | Bacterinas/toxoides clostridianos (≥6 componentes habituais) |
| `vacina_antirrabica_inativada` | Raiva inativada (herbívoros) |
| `bacterina_leptospirose` | Bacterinas de sorovares de *Leptospira* |
| `antiparasitario_endoparasiticida_sistemico` | Endoparasiticida de ação sistêmica (geral) |
| `endectocida_lactona_macrocilica` | Ivermectina, Doramectina, Abamectina, Moxidectina |
| `benzimidazol_oral` | Albendazol, Fenbendazol, Ricobendazol oral |
| `eprinomectina_pour_on` | Eprinomectina pour-on (carência zero leite, SIM_BULA) |
| `vacina_diarreia_bovina_viral` | BVD tipo 1 e 2 — distinção de cepa crítica |
| `vacina_clostridiose_carbunculo` | Clostridiose + carbúnculo sintomático combinados |

### 1.2 O que ProductClass NÃO é

| Não é | Por quê |
|---|---|
| Produto comercial | Produto comercial tem nome, registro, fabricante, carência específica, bula auditada |
| Protocolo | Protocolo é programa sanitário macro com múltiplos itens |
| Item/fase | Item é a ação operacional versionada dentro do protocolo |
| Validador de carência ativa | Carência ativa somente nasce em evento executado com snapshot congelado |
| Autorizador de execução | Execução exige produto real + dose + via + fonte + snapshot |
| Substituto de fonte técnica | ProductClass não valida compliance sem produto e fonte auditados |
| Enumeração de produto | Não é lista curada de nomes comerciais — é classe de equivalência técnica |

---

## 2. ProductClassGroup

### 2.1 Quando usar

Usar **ProductClassGroup** quando um item de protocolo puder aceitar **múltiplas classes técnicas sem exigir uma única `productClass` fixa**, mas ainda precisar restringir a aceitação a um conjunto técnico coerente.

**Casos obrigatórios:**

| Caso | Motivo |
|---|---|
| Controle parasitário | Pode ser Lactona, Benzimidazol ou Eprinomectina dependendo da aptidão, resistência, estação |
| Clostridiose + carbúnculo | Pode ser `vacina_clostridial_multivalente` ou `vacina_clostridiose_carbunculo` |
| Polivalente bacteriana | Aceita diferentes combinações de bacterinas conforme disponibilidade regional |

**Não usar quando:**

- O item exige classe única (Brucelose B19 tem classe única por norma legal)
- O item exige produto específico por nome (vacina autógena registrada só para aquela fazenda)
- A intercambialidade não é tecnicamente fundamentada por fonte forte

### 2.2 Estrutura do ProductClassGroup

```ts
// DOCUMENTAL — não implementar ainda

type ProductClassGroup = {
  productClassGroupKey: string;        // ex: "antiparasitarios_permitidos_recria"
  allowedProductClasses: string[];     // ex: ["endectocida_lactona_macrocilica", "benzimidazol_oral", "eprinomectina_pour_on"]
  requiresMvForOtherClass: boolean;    // se true: classe fora da lista exige MV responsável
  description?: string;
  limitations?: string[];
};
```

**Exemplo — controle parasitário recria 5/7/9:**

```json
{
  "productClassGroupKey": "antiparasitarios_permitidos_recria",
  "allowedProductClasses": [
    "endectocida_lactona_macrocilica",
    "benzimidazol_oral",
    "eprinomectina_pour_on"
  ],
  "requiresMvForOtherClass": true,
  "limitations": [
    "Lactona macrocíclica é opção padrão; rotação de princípio ativo recomendada por resistência parasitária.",
    "Eprinomectina pour-on preferível em fêmeas lactantes (carência zero leite conforme bula).",
    "Uso de classe fora da lista exige MV responsável e fonte auditada."
  ]
}
```

### 2.3 Contrato `ProductRequirementKind` final

O contrato de exigência de produto em um item de protocolo deve aceitar:

```ts
// DOCUMENTAL — versão final consolidada para 12D5

type ProductRequirementKind =
  | "none"                 // exame, manejo, alerta — sem produto
  | "specific_product"     // produto comercial único por id
  | "product_class"        // classe técnica única
  | "product_class_group"; // grupo de classes aceitas
```

**Estado atual em código:**
- `sanitaryProtocolV2.ts` — `ProductRequirementKindV2 = "specific_product" | "product_class" | "none"` (sem `product_class_group`)
- `sanitaryProtocolRule.ts` — `productRequirement.kind: "specific_product" | "product_class"` (legado, sem `none`, sem `product_class_group`)

**Decisão**: adicionar `"product_class_group"` em `ProductRequirementKindV2` é escopo de 12D5.

---

## 3. Produto sanitário — quando mapear

### 3.1 Regra final

**Produto = particularidade, exceção ou execução real.**

Produto sanitário **não precisa ser mapeado para todo item de protocolo**.

Mapear produto quando houver:

| Critério | Exemplo |
|---|---|
| Bula auditada com dados verificáveis | Carência específica diferente do genérico da classe |
| Carência produto-específica distinta | Eprinomectina pour-on: carência zero leite (SIM_BULA) vs. Ivermectina: carência 28 dias leite |
| Dose/via produto-específica | Formatos injetável vs. pour-on no mesmo `productClass` |
| Autorização ou bloqueio por espécie | Produto autorizado para bovinos mas NAO_AUTORIZADO para bubalinos |
| Restrição gestação/lactação declarada em bula | Campo `lactacaoPermitida`, `gestacaoPermitida` em `SpeciesAuthorizationV2` |
| Uso provável em execução no MVP | Produto que o operador realmente selecionará no campo |
| Exceção relevante à regra geral da classe | Produto off-label exige MV, mesmo que classe esteja autorizada |
| Necessidade de snapshot de evento | Evento real exige `EventTechnicalSnapshot` com produto executado |

### 3.2 Quando NÃO mapear ainda

- Produto com apenas nome e categoria sem bula auditada
- Produto que só tem `status_curatorial = precisa_validar` e nenhuma carência ou dose específica
- Produto textual digitado manualmente sem equivalente no catálogo
- Produto histórico sem uso em eventos futuros previsíveis

---

## 4. Dose, via e carência — regras finais

### 4.1 Tabela de localização

| Campo | Onde fica | Condição |
|---|---|---|
| **Dose geral auditada** | Item de protocolo (`SanitaryProtocolItemVersion`) | Fonte forte auditada cobre dose para a classe como um todo |
| **Dose produto-específica** | Produto (`SanitaryProductV2.doseRules`) | Bula auditada com dose, via e peso distintos do genérico da classe |
| **Via geral auditada** | Item de protocolo | Fonte forte auditada cobre via para a classe como um todo |
| **Via produto-específica** | Produto (`ProductDoseRuleV2.route`) | Bula auditada com via distinta (ex.: pour-on vs. injetável na mesma classe) |
| **Carência geral auditada** | Item de protocolo (regra auditada) | Fonte forte; não gera carência ativa |
| **Carência produto-específica** | Produto (`SanitaryProductV2.withdrawalRules` → `WithdrawalRuleV2`) | Bula auditada por espécie, aptidão, via |
| **Carência aplicada (ativa)** | Evento executado (`EventTechnicalSnapshot.withdrawalSnapshot`) | Snapshot congelado no momento da execução — **nunca recalcular** |

### 4.2 Invariantes absolutas

```
✅ Agenda NUNCA libera carência ativa.
✅ Carência ativa nasce somente em evento executado com snapshot congelado.
✅ Carência pode existir como regra auditada no item ou no produto — é informação, não ação.
✅ Livre de carência não autoriza venda, abate, leite ou aptidão operacional por si só.
✅ Snapshot de evento é evidência histórica — nunca recalcular com regra atual.
✅ Produto planejado na agenda ≠ produto executado. Não propagar automaticamente.
```

### 4.3 Hierarquia de resolução na execução

Quando o operador executa um evento sanitário:

```
1. Produto real executado (selecionado ou informado pelo operador)
2. Dose: produto.doseRules[espécie, via, peso] ?? item.doseRule ?? operador informa
3. Via: produto.doseRules[...].route ?? item.routeRule ?? operador informa
4. Carência: produto.withdrawalRules[espécie, aptidão, via] congelada em snapshot
5. Snapshot congelado no evento — não reler produto depois
```

---

## 5. Status curatorial

### 5.1 Separação de conceitos

| Conceito | O que representa |
|---|---|
| `SanitaryCurationStatus` | Estado do processo de curadoria do dado/registro (protocolo, item, produto, fonte) |
| `SanitaryAutomationStatus` | O que o sistema pode fazer automaticamente com este dado em fluxo operacional |

São **independentes**. Um registro pode estar `approved_for_catalog` mas `blocked` para automação (ex.: Febre Aftosa).

### 5.2 `SanitaryCurationStatus` — enum documental final

```ts
// DOCUMENTAL — para 12D5

type SanitaryCurationStatus =
  | "candidate"            // registro candidato, ainda não validado
  | "needs_review"         // exige revisão técnica/regulatória antes de uso
  | "approved_for_catalog" // aprovado para catálogo; não necessariamente disponível para agenda
  | "blocked"              // não usar operacionalmente — norma, risco, erro detectado
  | "archived";            // histórico/contingência, sem uso ativo
```

### 5.3 Significado de cada status

| Status | Significado | Exemplo de uso |
|---|---|---|
| `candidate` | Dado existente mas não validado por curador técnico | Produto importado de catálogo externo sem bula verificada |
| `needs_review` | Fonte parcial, campo suspeito ou mudança regulatória pendente | Produto com `PRECISA_VALIDAR` em espécie ou carência nova |
| `approved_for_catalog` | Curador aprovou: dados consistentes e fontes verificadas | Produto com bula auditada, dose/via/carência declaradas |
| `blocked` | Não usar: norma veda, produto retirado, erro crítico detectado | Aftosa enquanto vacinação suspensa; produto adulterado |
| `archived` | Registro histórico preservado, sem uso operacional ativo | Aftosa após suspensão definitiva por erradicação; vacina descontinuada |

### 5.4 Relação com `SanitaryEvidenceStatusV2`

`SanitaryEvidenceStatusV2` (`SIM_BULA`, `SIM_NORMA`, `PRECISA_VALIDAR`, `NAO_AUTORIZADO`, `EXTRAPOLADO`) opera por **campo/fonte** e é guardião de governance de dados.

`SanitaryCurationStatus` opera por **registro inteiro** e é status de processo de curadoria.

Um produto pode ter `statusCuratorial = approved_for_catalog` mas ter um campo específico com `evidenceStatus = PRECISA_VALIDAR` (ex.: carência para uma aptidão específica ainda não confirmada em bula).

**Regra de bloqueio**: se qualquer `SpeciesAuthorizationV2.authorizationStatus = NAO_AUTORIZADO`, o produto não pode ter `SanitaryAutomationStatus = agenda_allowed` para aquela espécie, independentemente do `statusCuratorial`.

---

## 6. Status de automação

### 6.1 `SanitaryAutomationStatus` — enum documental final

```ts
// DOCUMENTAL — para 12D5

type SanitaryAutomationStatus =
  | "manual_only"      // apenas registro manual; sem preview, sem agenda automática
  | "preview_allowed"  // pode aparecer em preview operacional; sem criar agenda, evento, baixa, carência
  | "agenda_allowed"   // pode materializar intenção de agenda; não prova execução
  | "blocked";         // não pode aparecer em nenhum fluxo operacional padrão
```

### 6.2 Significado de cada status

| Status | O que permite | O que NÃO permite |
|---|---|---|
| `manual_only` | Registro retroativo de evento sem agenda prévia | Preview, agenda automática, sugestão proativa |
| `preview_allowed` | Aparecer em `SanitaryPreviewGroup` como sugestão | Criar `SanitaryAgendaMaterializationCommand`, evento, baixa de estoque |
| `agenda_allowed` | Criar `SanitaryAgendaMaterializationCommand` | Criar evento diretamente, baixa de estoque, carência ativa |
| `blocked` | Nada | Preview, agenda, evento gerado automaticamente |

### 6.3 `preview_allowed` — limite explícito

`preview_allowed` significa exclusivamente:

> O item pode aparecer na interface como sugestão operacional sem criar nenhum fato no sistema.
> Não cria agenda. Não cria evento. Não baixa estoque. Não libera carência. Não autoriza operação.

### 6.4 Quem decide `agenda_allowed`: item, não protocolo

**Regra obrigatória:**

```
agenda_allowed deve ser definido preferencialmente no ITEM (SanitaryProtocolItemVersionV2.allowsAgendaAuto),
não no protocolo inteiro.
```

**Motivação:** Um protocolo de biossegurança pode ter:
- Item A: `agenda_allowed` — vacina clostridiose anual (rotina operacional)
- Item B: `preview_allowed` — vacina polivalente opcional (decisão do MV)
- Item C: `blocked` — Aftosa enquanto suspensa

Bloquear o protocolo inteiro bloquearia A e B, impedindo funcionalidade operacional.

**Contrato em código atual:**
- `SanitaryProtocolItemVersionV2.allowsAgendaAuto: boolean` (existe em `sanitaryProtocolV2.ts` linha 75)
- Validação existente: `alert_or_blocked_item_cannot_auto_schedule` (linha 225) e `not_authorized_blocks_auto_schedule` (linha 236)

**Gap**: `allowsAgendaAuto` é `boolean` simples. O enum `SanitaryAutomationStatus` é mais expressivo. Mapear: `false → blocked | manual_only`, `true → agenda_allowed | preview_allowed`. Definição de granularidade: escopo de 12D5.

---

## 7. Política de execução

### 7.1 `ExecutionProductPolicy` — enum documental final

```ts
// DOCUMENTAL — para 12D5

type ExecutionProductPolicy =
  | "not_required"         // exame, manejo, alerta — sem produto
  | "required_at_execution" // produto real obrigatório no momento do evento executado
  | "required_at_agenda"   // produto específico deve ser planejado na agenda
  | "fixed_by_protocol";   // produto único fixado pelo protocolo (ex.: vacina autógena específica)
```

### 7.2 Regras por política

| Política | Quando usar | Produto na agenda | Produto no evento |
|---|---|---|---|
| `not_required` | Exame, pesagem, alerta sanitário, manejo sem produto | ❌ | ❌ |
| `required_at_execution` | Vacinação, antiparasitário — produto escolhido na hora | Opcional (planejamento) | ✅ obrigatório |
| `required_at_agenda` | Quando planejamento exige reserva de produto específico | ✅ obrigatório | ✅ obrigatório |
| `fixed_by_protocol` | Vacina autógena, produto único registrado, protocolo fechado | ✅ fixado | ✅ fixado |

### 7.3 Política padrão

**Para vacinação e antiparasitário**: `required_at_execution`, salvo exceção justificada com fonte.

**Exceção documentada**: Brucelose B19 pode ser `fixed_by_protocol` por norma (produto único pelo PNCEBT).

### 7.4 Relação com `ProductRequirementKind`

| `ProductRequirementKind` | `ExecutionProductPolicy` compatível |
|---|---|
| `none` | `not_required` |
| `product_class` | `required_at_execution` (produto da classe escolhido na hora) |
| `product_class_group` | `required_at_execution` (produto do grupo escolhido na hora) |
| `specific_product` | `required_at_execution` ou `fixed_by_protocol` |

---

## 8. Fluxo Protocolo → Item → ProductClass → Produto → Agenda → Evento

```
SanitaryProtocol (macro)
  programa sanitário — familyCode, legalStatus, speciesScope
  não é execução
  ↓

SanitaryProtocolItemVersion (item/fase operacional versionado)
  logicalItemKey, version, actionType
  eligibilityRule (espécie, sexo, idade, aptidão, aquisição)
  operationalWindowRule (âncora, offset, janela, hardWindow, missedWindowPolicy)
  sequenceRule (ordem, dependência, intervalo, recorrência)
  doseRule geral (se auditada para a classe como um todo)
  routeRule geral (se auditada)
  withdrawalRule geral (se auditada — não gera carência ativa)
  productRequirementRule (kind, productClass, productClassGroup, executionProductPolicy)
  allowsAgendaAuto → SanitaryAutomationStatus (decisão por item)
  ↓

ProductClass / ProductClassGroup (requisito técnico do item)
  classe técnica sanitária de equivalência
  não é produto comercial
  não valida carência sozinha
  ↓

SanitaryProductV2 (produto com particularidade, exceção ou execução real)
  nomeComercial, registroOrgao, classe, principioAtivo
  speciesAuthorizations (por espécie, aptidão, sexo, idade, lactação, gestação)
  doseRules (produto-específico: quantidade, unidade, via, peso)
  withdrawalRules (produto-específico: meatDays, milkDays, milkHours por espécie e aptidão)
  statusCuratorial
  ↓

Agenda (intenção futura)
  SanitaryAgendaMaterializationCommand (createsEvent: false)
  pode registrar produto planejado (optional)
  AgendaTechnicalSnapshot (não carrega carência ativa — validado em código)
  ↓

Evento (fato executado — append-only)
  produto real executado (produto_veterinario_id + produto_nome_snapshot)
  dose executada, via executada
  EventTechnicalSnapshot (congelado no momento da execução)
    → withdrawalSnapshot (carência congelada do produto executado)
    → não recalcular depois
  nasce carência aplicada ativa
```

---

## 9. Exemplos obrigatórios

### 9.1 Brucelose B19

```
Protocolo: brucelose_b19
Item: vacinacao_b19_novilha
  eligibilityRule:
    species: ["bovino"]          — bubalino exige autorização explícita separada
    sex: "F"
    ageStartDays: 90             — (3 meses)
    ageEndDays: 240              — (8 meses)
    aptitude: ["corte", "leite", "mista"]
    acquisitionMode: "all"
  productRequirementRule:
    kind: "product_class"
    productClass: "vacina_brucelose_b19"
    executionProductPolicy: "required_at_execution"
    — (pode ser fixed_by_protocol conforme PNCEBT — decisão regulatória local)
  doseRule geral: conforme item se bula de referência sustentar
  automationStatus: "agenda_allowed"
  curationStatus: "approved_for_catalog"

Produto mapeado se:
  - bula auditada disponível com carência específica
  - dose/volume de aplicação distinto do genérico da classe
  - espécie bubalino requer autorização separada (não herda bovino)

Invariante obrigatória:
  bubalino_requires_explicit_authorization — validado em sanitaryProductV2.ts (linha 158)
```

### 9.2 Clostridioses

```
Protocolo: clostridiose_carbunculo
Item: vacinacao_clostridial_anual
  eligibilityRule:
    species: ["bovino", "bubalino"]   — bubalino herança precisa ser validada explicitamente
    sex: "todos"
    ageStartDays: null               — neonatos conforme protocolo MV
    ageEndDays: null                 — recorrente; sem limite de idade
    aptitude: ["corte", "leite", "mista", "all"]
  productRequirementRule:
    kind: "product_class"
    productClass: "vacina_clostridial_multivalente"
    executionProductPolicy: "required_at_execution"
  doseRule geral:
    — pode ficar no item se bula de vacinas clostridienses geralmente sustenta 2 mL IM
    — (mas dose específica por produto pode variar: 1 mL vs 5 mL por produto)
    — decisão: dose geral no item apenas se fonte forte sustenta "para a classe"; senão deixar no produto

Produto mapeado quando:
  - bula tem carência leite específica (ex.: produto com carência 21 dias leite vs. zero da classe)
  - dose diferente da geral declarada no item
  - restrição de gestação ou lactação declarada em bula

Bubalino:
  - authorizationStatus deve ser declarado explicitamente por produto
  - "SIM_BULA" ou "SIM_NORMA" exigido — não herdar de bovino
```

### 9.3 Controle parasitário recria 5/7/9

```
Protocolo: controle_parasitario_recria
Item: antiparasitario_recria_5_meses   (também 7 e 9 meses com variação)
  eligibilityRule:
    species: ["bovino"]
    sex: "todos"
    ageStartDays: 150               — (≈5 meses)
    ageEndDays: null                — cada item tem sua janela
    aptitude: ["corte", "mista"]
  operationalWindowRule:
    triggerModel: "age_based"
    anchor: "birth_date"
    targetOffsetDays: 150
    windowStartOffsetDays: -14
    windowEndOffsetDays: 14
    hardWindow: false
    missedWindowPolicy: "allow_late_with_warning"
  productRequirementRule:
    kind: "product_class_group"     — NOVO (a implementar em 12D5)
    productClassGroup:
      productClassGroupKey: "antiparasitarios_permitidos_recria"
      allowedProductClasses:
        - "endectocida_lactona_macrocilica"
        - "benzimidazol_oral"
        - "eprinomectina_pour_on"
      requiresMvForOtherClass: true
    executionProductPolicy: "required_at_execution"
  automationStatus: "agenda_allowed"

Produto mapeado quando:
  - produto tem carência específica relevante (eprinomectina: zero leite vs. ivermectina: 28 dias)
  - produto tem restrição de gestação ou lactação
  - produto é off-label para bubalinos (exige MV e fonte explícita)
  - produto é bloqueado (retirado do mercado, falsificação, resistência confirmada)

Produto NÃO é obrigatório na agenda:
  - agenda registra grupo aceito; produto real escolhido na execução
  - produto planejado é opcional no ProductClassGroup

Sem criar classe fake:
  - não criar "antiparasitario_geral" como ProductClass única
  - usar ProductClassGroup para expressar intercambialidade controlada
  - cada classe do grupo continua sendo entidade técnica distinta
```

### 9.4 Febre aftosa

```
Protocolo: febre_aftosa
  legalStatus: "bloqueado"           — enquanto vacinação estiver suspensa por norma vigente
  — (foi obrigatorio_norma; passou a bloqueado após decisão de erradicação por zona)

Item (se existente):
  itemStatus: "bloqueado"
  allowsAgendaAuto: false
  automationStatus: "blocked"
  curationStatus: "archived"         — registros históricos preservados

Regra obrigatória:
  Não criar agenda automática de Febre Aftosa enquanto:
  - vacinação estiver suspensa pela norma vigente (OIE/MAPA)
  - UF/zona não tiver vacinação obrigatória ativa

Manutenção:
  - eventos históricos de vacinação: preservados em eventos/eventos_sanitario (append-only)
  - protocolo como referência histórica: archived
  - agenda nova: blocked

Invariante de código:
  src/lib/sanitario/AGENTS.md: "Não reintroduzir aftosa como calendário base default." (linha 100)
```

### 9.5 Alertas restritos — Toxocara, Bm86, Salmonella autógena

```
Categoria: alertas restritos / protocolos experimentais / uso investigacional

Toxocara:
  — prevalente em bezerros, mas sem protocolo operacional padrão regularizado
  — não entra como item de protocolo com agenda automática
  — automationStatus: "manual_only" ou "blocked"
  — curationStatus: "candidate" ou "needs_review"

Bm86 (vacina anti-carrapato):
  — registro histórico, disponibilidade variável, eficácia debatida
  — automationStatus: "preview_allowed" apenas com fonte forte auditada
  — curationStatus: "needs_review"
  — se fonte insuficiente: "blocked"

Salmonella autógena:
  — vacina de uso restrito, autorização específica por fazenda/lote
  — productRequirementKind: "specific_product" (produto único por autorização)
  — executionProductPolicy: "fixed_by_protocol"
  — requiresMvResponsavel: true obrigatório
  — automationStatus: "manual_only"
  — curationStatus: "approved_for_catalog" somente se produto específico auditado
  — não criar agenda automática sem autorização técnica explícita

Regra geral para alertas restritos:
  - não entrar em fluxo operacional padrão de agenda automática
  - automationStatus: "blocked" ou "manual_only"
  - preservar como referência técnica em catálogo, não como intenção operacional
```

---

## 10. Perguntas respondidas

| # | Pergunta | Resposta |
|---|---|---|
| 1 | O que é ProductClass? | Classe técnica sanitária de equivalência para o propósito de um item de protocolo. Ver §1.1 |
| 2 | O que não é ProductClass? | Produto comercial, protocolo, item/fase, validador de carência, autorizador de execução. Ver §1.2 |
| 3 | Quando usar ProductClassGroup? | Quando o item aceita múltiplas classes técnicas intercambiáveis sem exigir uma única. Caso obrigatório: controle parasitário. Ver §2.1 |
| 4 | Produto é obrigatório para agenda? | Não. `ExecutionProductPolicy = required_at_execution` não exige produto na agenda. Produto planejado é opcional quando `kind = product_class_group`. Ver §7.2 |
| 5 | Produto é obrigatório para evento? | Sim, quando `executionProductPolicy ∈ {required_at_execution, required_at_agenda, fixed_by_protocol}`. Ver §7.2 |
| 6 | Onde ficam dose e via gerais? | No item de protocolo, se fonte forte auditada cobre a classe como um todo. Ver §4.1 |
| 7 | Onde ficam dose e via produto-específicas? | No produto (`SanitaryProductV2.doseRules → ProductDoseRuleV2`), com bula auditada. Ver §4.1 |
| 8 | Onde fica carência geral auditada? | No item de protocolo como regra informacional. Não gera carência ativa. Ver §4.1 |
| 9 | Onde fica carência produto-específica? | No produto (`SanitaryProductV2.withdrawalRules → WithdrawalRuleV2`), por espécie e aptidão. Ver §4.1 |
| 10 | Quando nasce carência ativa? | Somente no evento executado, via `EventTechnicalSnapshot.withdrawalSnapshot` congelado. Ver §4.2 |
| 11 | Diferença entre curation_status e automation_status? | `curation_status` = estado do processo de curadoria do dado. `automation_status` = o que o sistema pode fazer com o dado em fluxo operacional. São independentes. Ver §5.1 |
| 12 | Quem decide agenda_allowed: protocolo ou item? | **Item** (`SanitaryProtocolItemVersionV2.allowsAgendaAuto`). Protocolo não deve bloquear todos os itens de uma vez. Ver §6.4 |
| 13 | Política padrão para vacinação e antiparasitário? | `required_at_execution`. Ver §7.3 |
| 14 | Como tratar controle parasitário sem criar classe fake? | Usar `ProductClassGroup` com lista de classes aceitas. Nunca criar `antiparasitario_geral` como classe única. Ver §9.3 |
| 15 | Como tratar produto textual legado? | `warning` para histórico antigo. `critical` para evento novo sem produto estruturado. `critical` para evento usado em carência/conformidade/exportação. Ver §11 |
| 16 | O que fica bloqueado para 12D5? | Tudo listado em §13. Ver §13 |

---

## 11. Produto textual legado — política futura

**Não implementar nesta fase.** Aplicar somente em 12D5 ou fase posterior.

```
Política futura para hasStructuredProduct:

CASO 1: Evento histórico (occurred_at < data de corte definida na operação)
  + produto textual (apenas campo produto: string, sem produto_veterinario_id)
  → SanitaryExceptionCode: "evento_sanitario_sem_produto"
  → severity: "warning"                     — histórico antigo; não bloquear
  → action: complemento_rastreabilidade (se desejado)

CASO 2: Evento novo (occurred_at >= data de corte)
  + produto textual sem produto_veterinario_id
  → SanitaryExceptionCode: "evento_sanitario_sem_produto"
  → severity: "critical"                    — novo: produto estruturado obrigatório

CASO 3: Evento (qualquer data)
  + usado para carência ativa OU conformidade OU exportação de GTA/rastreabilidade
  + sem produto_veterinario_id
  → SanitaryExceptionCode: "evento_sanitario_sem_produto"
  → severity: "critical"                    — carência/conformidade exige produto estruturado

Data de corte: definir operacionalmente (ex.: data de ativação do módulo v2 na fazenda).
```

**Estado atual em código** (`sanitaryExceptions.ts` linhas 370–379):
```ts
if (!hasStructuredProduct(detail)) {
  createException({
    code: "evento_sanitario_sem_produto",
    severity: "critical",              // atual: sempre critical
    ...
  })
}
```

Atualmente todos os eventos sem `produto_veterinario_id` geram `critical`. A política futura diferenciará por data e contexto de uso. Alterar apenas em 12D5+ com aprovação.

---

## 12. Diagrama de decisão — produto em item de protocolo

```
Item de protocolo sanitário
      │
      ▼
productRequirementKind?
      │
      ├── "none"
      │     → executionProductPolicy: "not_required"
      │     → Exame, alerta, manejo sem produto
      │     → Não mapear produto
      │
      ├── "product_class"
      │     → productClass: string (ex: "vacina_clostridial_multivalente")
      │     → executionProductPolicy: "required_at_execution"
      │     → Mapear produto se: bula específica, carência distinta, restrição espécie
      │     → Produto escolhido na execução pelo operador
      │
      ├── "product_class_group"
      │     → productClassGroup: ProductClassGroup
      │     → allowedProductClasses: string[]
      │     → executionProductPolicy: "required_at_execution"
      │     → Produto do grupo escolhido na execução
      │     → NÃO criar classe fake unificada
      │
      └── "specific_product"
            → productId: string
            → executionProductPolicy: "fixed_by_protocol" | "required_at_execution"
            → Produto único — mapear obrigatoriamente com bula auditada
```

---

## 13. Critérios de conclusão — checklist completo

| # | Critério | Status |
|---|---|---|
| 1 | ProductClass definido | ✅ §1.1 |
| 2 | ProductClassGroup definido | ✅ §2.1–2.2 |
| 3 | ProductRequirementKind (4 valores) definido | ✅ §2.3 |
| 4 | SanitaryCurationStatus (5 valores) definido | ✅ §5.2 |
| 5 | SanitaryAutomationStatus (4 valores) definido | ✅ §6.1 |
| 6 | ExecutionProductPolicy (4 valores) definido | ✅ §7.1 |
| 7 | Dose/via geral vs produto-específica resolvida | ✅ §4.1 |
| 8 | Carência geral vs produto-específica vs aplicada resolvida | ✅ §4.1–4.2 |
| 9 | Produto como particularidade/exceção/execução | ✅ §3.1–3.2 |
| 10 | `agenda_allowed` preferencialmente no item | ✅ §6.4 |
| 11 | Controle parasitário por ProductClassGroup | ✅ §9.3 |
| 12 | Febre aftosa bloqueada/arquivada | ✅ §9.4 |
| 13 | Alertas restritos fora do fluxo operacional padrão | ✅ §9.5 |
| 14 | Produto textual legado como política futura | ✅ §11 |
| 15 | Bloqueio de código até próxima fase | ✅ §14 |

**Todos os 15 critérios satisfeitos.** 12D4 concluída documentalmente.

---

## 14. Patches bloqueados até validação do relatório

```
NADA DO SEGUINTE PODE SER FEITO SEM VALIDAÇÃO EXPLÍCITA DO RELATÓRIO 12D4:

Código TypeScript:
  — não alterar sanitaryProtocolV2.ts (ProductRequirementKindV2, allowsAgendaAuto)
  — não alterar sanitaryProductV2.ts (SanitaryCuratorialStatusV2, WithdrawalRuleV2)
  — não alterar sanitarySnapshotsV2.ts
  — não alterar sanitarySourceV2.ts
  — não alterar sanitaryExceptions.ts (hasStructuredProduct, severidades)
  — não alterar eligibility, demand, preview, agenda, execution
  — não corrigir dedupKey
  — não criar bridge protocolRuleBridge.ts
  — não tipar operationalWindowRule

SQL / Schema / Supabase:
  — não criar tabela sanitary_product_classes
  — não criar tabela sanitary_product_class_groups
  — não alterar produtos_veterinarios
  — não criar coluna curation_status em nenhuma tabela
  — não criar coluna automation_status em nenhuma tabela
  — não alterar migration existente
  — não criar RLS, policies, RPCs

Dados:
  — não criar seed de ProductClass
  — não criar seed de ProductClassGroup
  — não importar catálogo de produtos com novos campos
  — não alterar agenda_itens
  — não alterar protocolos_sanitarios ou itens

Fluxos:
  — não criar agenda automática
  — não criar evento sanitário
  — não calcular carência ativa
  — não liberar venda, abate, leite, aptidão operacional
  — não criar UI nova para ProductClass
  — não marcar 12D5 como iniciada
  — não iniciar patch em rules/
```

---

## 15. Próxima etapa recomendada — 12D5

**12D5** pode ser iniciada somente após:
1. Validação deste relatório 12D4 pelo responsável.
2. Confirmação de que nenhum critério de §14 foi violado.

**Escopo de 12D5** (somente código TypeScript, sem SQL/migration/seed/UI):

```
Fase 12D5 — Schema/contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy

Arquivos alvo:
  - src/lib/sanitario/rules/sanitaryProtocolV2.ts
      → ProductRequirementKindV2: adicionar "product_class_group"
      → SanitaryProtocolItemVersionV2: adicionar executionProductPolicy e productClassGroup

  - NOVO: src/lib/sanitario/rules/sanitaryProductClassV2.ts
      → ProductClassV2, ProductClassGroupV2
      → SanitaryCurationStatus, SanitaryAutomationStatus, ExecutionProductPolicy

Arquivos NÃO tocados em 12D5:
  - eligibility, demand, preview, agenda, execution
  - sanitaryExceptions.ts
  - migrations/SQL
  - Dexie/offline

Smoke test obrigatório antes de 12D5: sanitarioRecomputeAgendaCore.test.ts
```

---

*Documento gerado: 2026-06-10*
*Commit de referência: 59d7b45*
*Nenhum código TypeScript foi alterado.*
*Nenhum schema SQL foi alterado.*
*Nenhuma migration foi criada.*
*12D4 concluída documentalmente. Próxima fase técnica: 12D5 (aguarda validação deste relatório).*
