# F22A.2B — Política técnica de intervalo para GMD

Atualizado em: 2026-08-30
Baseline: `main@27f89e9d58ab8bc8ece9372d118897dc3e28ed1f`
Decisão: **POLÍTICA CONTEXTUAL DEFINIDA**

```ini
UNIVERSAL_MIN_INTERVAL = CONTEXT_DEPENDENT
F22A_GMD_POLICY = DEFINED_CONTEXTUAL
F22A_GMD_CALCULATION = READY_WITH_POLICY_CONSTRAINTS
```

## 1. Problema

O contrato factual F22A.2 forma um intervalo entre duas pesagens observadas, mas não autoriza interpretar o quociente entre variação de peso e dias como desempenho confiável. Esta decisão separa:

- `CALCULABLE`: duas observações factuais compatíveis e `intervalDays > 0`;
- `RELIABLE`: estimativa obtida sob protocolo de medição conhecido e comparável;
- `OPERATIONALLY_ACTIONABLE`: uso autorizado por política contextual explícita para uma finalidade definida.

Intervalo positivo resolve somente a matemática. Não prova confiabilidade zootécnica nem adequação para decisão.

## 2. Evidências

| Fonte | Contexto | Evidência efetivamente suportada | Limitação |
|---|---|---|---|
| [Embrapa Pecuária Sudeste — Tullio et al. (2010)](https://www.embrapa.br/busca-de-publicacoes/-/publicacao/859567/desempenho-de-bovinos-machos-e-femeas-filhos-de-vacas-cruzadas--angus---nelore-e--simental---nelore-acasaladas-com-touros-das-racas-angus-e-wagyu-terminados-em-confinamento) | experimento de terminação em confinamento | pesagens a cada 28 dias após 16 horas de jejum hídrico e alimentar para avaliar desempenho | protocolo experimental específico; não estabelece 28 dias como mínimo universal |
| [Beef Improvement Federation — Feed Intake Guidelines](https://guidelines.beefimprovement.org/index.php/Feed_Intake) | prova controlada de consumo/ganho e avaliação genética | precisão de ADG aumenta entre 28, 42 e 56 dias; recomenda ao menos duas pesagens no início e no fim e prefere pesagens quinzenais com regressão | população, dieta, equipamento, grupo contemporâneo e finalidade são controlados; não é regra geral de manejo |
| [Mahler et al. (2024), Animals, DOI 10.3390/ani14142044](https://pmc.ncbi.nlm.nih.gov/articles/PMC11273504/) | prova de eficiência alimentar de novilhas Brangus | 14 e 28 dias tiveram baixa correspondência de ADG com 70 dias; 56 dias apresentou maior concordância; animais foram pesados quinzenalmente e em dois dias consecutivos nas extremidades | uma população e um protocolo de RFI; não valida threshold para pasto, comércio ou pesagem ocasional |
| [Ahlberg et al. (2018), Journal of Animal Science, DOI 10.1093/jas/sky209](https://pubmed.ncbi.nlm.nih.gov/29790937/) | bovinos confinados, dieta constante e pesagens a cada 14 dias | pelo critério de correlação maior que 0,95 com o teste completo, a duração mínima encontrada para ADG foi 70 dias; consumo e água tiveram durações diferentes | resultado dependente do critério estatístico, população e sistema experimental |
| [Oklahoma State University Extension — Managing Shrink and Weighing Conditions](https://extension.okstate.edu/fact-sheets/managing-shrink-and-weighing-conditions-in-beef-cattle.html) | manejo, transporte e comercialização | alimento/água, horário, tipo de dieta, coleta, manejo, transporte e tempo sem acesso a alimento/água alteram peso vivo; mudanças de fill podem ser recuperadas rapidamente | trata shrink e condição de pesagem, não define duração mínima para GMD |

### Fato da fonte

- Protocolos de desempenho não usam apenas `intervalDays`: controlam ou registram dieta, equipamento, manejo, população e frequência de pesagem.
- O peso vivo varia com conteúdo gastrointestinal, água, horário, jejum, manejo e transporte.
- Durações diferentes produzem precisões diferentes e os valores publicados variam conforme objetivo e desenho experimental.

### Inferência limitada

- Um threshold isolado não torna comparáveis duas pesagens com condições desconhecidas.
- Valores como 28, 42, 56 ou 70 dias não podem ser transportados automaticamente entre confinamento, pasto, prova genética e monitoramento ocasional.
- Sem `source`, `method` e condições de pesagem, o RebanhoSync pode provar as observações e o intervalo, mas não a confiabilidade do GMD.

### Decisão do produto

Não haverá mínimo universal hard-coded. A duração exigida para classificar confiabilidade ou autorizar decisão deve pertencer a uma política contextual identificada e versionada. Enquanto essa cobertura não existir, o produto pode calcular somente uma derivação matemática com confiabilidade não classificada e uso operacional não autorizado.

## 3. Limitações atuais

O contrato atual conhece animal, fazenda, Evento, peso em kg e instante factual. Não conhece:

- origem e método da medição;
- identidade/condição da balança;
- jejum ou acesso a alimento e água;
- horário/momento de alimentação;
- manejo, transporte ou shrink;
- categoria animal, contexto produtivo (por exemplo, confinamento ou pasto) e finalidade da análise.

Portanto, a ausência de `source`/`method` não impede a aritmética, mas impede classificar o resultado atual como `RELIABLE` ou `OPERATIONALLY_ACTIONABLE`.

## 4. Alternativas avaliadas

| Política | Base técnica | Risco de falsa precisão | Complexidade/auditabilidade | Impacto UX | Adequação offline-first | Recomendação |
|---|---|---|---|---|---|---|
| threshold único `intervalDays >= X` | não há valor universal nas fontes | alto | simples, porém falsamente conclusiva | selo binário induziria confiança indevida | fácil de reconstruir, mas incorreta como regra universal | rejeitada |
| qualquer intervalo positivo sem qualificação | suficiente apenas para matemática | muito alto na apresentação | simples e auditável, mas semanticamente insegura | número isolado pareceria desempenho confiável | alta tecnicamente, inadequada semanticamente | proibida |
| intervalo positivo + coverage explícita | compatível com a separação entre cálculo e confiabilidade | baixo se limitações forem preservadas | moderada | exige status e limitações junto ao valor | alta; deriva somente de fatos locais disponíveis | adotada como base |
| threshold dependente do contexto | sustentado pela diversidade de protocolos | baixo quando política/finalidade são explícitas | maior; exige política identificada e dados ainda ausentes | deve identificar finalidade, policy e coverage | adequada se policy versionada estiver disponível localmente | adotada para classificação futura |
| cálculo disponível, confiabilidade não classificada | compatível com as fontes e com o contrato atual | controlável com nomenclatura estrita | baixa e auditável | precisa exibir `UNCLASSIFIED` e impedir CTA operacional | alta; cálculo puro e reconstruível, sem nova fonte de verdade | adotada para F22A.3 |

## 5. Decisão

```text
UNIVERSAL_MIN_INTERVAL = CONTEXT_DEPENDENT
```

Não existe evidência para um número único aplicável a toda pesagem bovina. A política temporal é:

1. `intervalDays > 0` permite somente `CALCULABLE`;
2. sem protocolo contextual e coverage de medição comparável, `reliability = UNCLASSIFIED`;
3. sem `RELIABLE`, `operationalUse = NOT_AUTHORIZED`;
4. uma futura política contextual poderá definir duração e condições próprias para uma finalidade, sem alterar o fato em `FactualGmdInterval`.

## 6. Política recomendada para F22A.3

A implementação futura deve consumir `FactualGmdInterval` em uma camada separada de policy/evaluation e somente depois calcular:

```text
FactualGmdInterval
        ↓
GmdPolicyEvaluation
        ↓
GmdCalculation
        ↓
Presentation
```

Para o contrato atual, a avaliação deve produzir conceitualmente:

```ini
calculability = CALCULABLE
reliability = UNCLASSIFIED
operationalUse = NOT_AUTHORIZED
policyBasis = OBSERVED_WEIGHTS_WITH_UNKNOWN_MEASUREMENT_CONDITIONS
```

O valor futuro deve ser nomeado como GMD matemático derivado de duas pesagens observadas, acompanhado das duas datas, `intervalDays` e limitações. A F22A.3 não deve inventar configuração ou persistir uma política contextual.

## 7. Política proibida

- Não usar `const MIN_GMD_DAYS = 28|42|56|70` como regra universal.
- Não declarar `RELIABLE`, “ganho real”, “desempenho confiável” ou aptidão produtiva a partir apenas de `intervalDays`.
- Não assumir condições iguais de jejum, horário, água, balança ou manejo quando não registradas.
- Não substituir pesagem zootécnica por peso atual inferido, peso comercial, `state_*`, tag, insight ou estimativa.
- Não usar GMD matemático como autorização operacional, projeção ou recomendação automática.

## 8. Impacto arquitetural

`FactualGmdInterval` permanece fato/read model puro e não recebe regra zootécnica silenciosa. Política é uma camada separada e reconstruível; cálculo não persiste nova fonte de verdade; apresentação deve preservar status e coverage. Uma futura política contextual pode ser configuração versionada, mas isso exige incremento e contrato próprios.

## 9. Gate para F22A.3

```ini
F22A_GMD_POLICY = DEFINED_CONTEXTUAL
F22A_GMD_CALCULATION = READY_WITH_POLICY_CONSTRAINTS
GMD_CALCULATION_GATE = READY_WITH_CONSTRAINTS
```

A liberação vale exclusivamente para cálculo matemático com `reliability = UNCLASSIFIED` e `operationalUse = NOT_AUTHORIZED`. Classificar confiabilidade ou uso operacional continua bloqueado por `MEASUREMENT_COVERAGE_REQUIRED` e por uma política contextual aplicável.
