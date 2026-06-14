# Mapa de Fontes e Gaps — Protocolos Sanitários v2 12F0

Atualizado em: 2026-06-14
Escopo: mapa curatorial de `sourceRefs`, cobertura de campos críticos e lacunas restantes.

## Decisão consolidada

Fonte de apoio não promove campo crítico.
Fonte de classe não autoriza execução.
Produto executado é a fonte primária de dose, via e carência.

Nenhum campo crítico abaixo autoriza `agenda_allowed` na 12F0.

## Mapa de `sourceRefs` e `source_gaps`

| campo crítico | fontes disponíveis | gaps 12F0 após revisão | decisão 12F0 |
|---|---|---|---|
| `especie` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_BULA_FORTRESS7`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Bubalino confirmado em norma para brucelose. Raiva usa bovídeos/equídeos, exigindo mapeamento operacional. Maioria das bulas comerciais segue restrita a bovinos ou não cita bubalinos. | Não herdar bovino → bubalino. `bubalino` só `covered/approved` quando norma/bula citar explicitamente ou quando regra legal mapear espécie/grupo de modo auditável. Default: `needs_review_bubalino`. |
| `sexo` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19` | B19 resolvido para fêmeas. Demais protocolos dependem de categoria operacional, não de sexo farmacológico isolado. | B19: `sexo_alvo=femea`; machos bloqueados para B19. Demais: usar sexo apenas quando categoria derivada exigir, ex.: matriz, touro, bezerra. |
| `idade_minima/maxima` | `SRC_PNCEBT_BRUCELOSE`; `SRC_BULA_ABORVAC_B19`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_BULA_POLIGUARD`; `SRC_BULA_SUPRAMEC`; `SRC_EMBRAPA_VERMINOSE` | B19 resolvido: 3–8 meses. Raiva: preferencialmente ≥3 meses em focos/áreas indicadas. Supramec: não recomendado <4 meses. Clostridioses e muitos antiparasitários ainda dependem de bula/produto. | Criar `ageRule` apenas por fonte forte. B19 pode gerar elegibilidade; agenda continua bloqueada sem UF/SVE/MV/marcação. |
| `janela_operacional` | `SRC_PNCEBT_BRUCELOSE`; `SRC_EMBRAPA_VERMINOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_PNEFA_MAPA` | Brucelose tem janela etária. Verminose recria usa meses maio/julho/setembro no contexto Cerrado/Brasil Central. Raiva depende de foco/risco/estado. Febre aftosa está suspensa. | `preview_allowed` limitado quando houver base técnica. `agenda_allowed` só com overlay regional/fazenda + MV. Febre aftosa permanece `blocked/archived`. |
| `dose` | `SRC_BULA_ABORVAC_B19`; `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Dose forte existe para produtos específicos, mas não para classe. Antiparasitários são por kg/peso e produto. | Não validar dose por `ProductClass`. Dose fica em `sanitario_produto_dose_rules_v2`. No evento, exigir produto real + peso quando dose for por kg. |
| `via` | Mesmas bulas/protocolos do campo `dose` | Via confirmada por produto/protocolo específico; não generalizável por classe. | `routeRule` por produto. Pode ser validável quando fonte forte; informativa quando origem for guideline/MV. |
| `reforco/intervalo` | `SRC_BULA_ABORVAC_B19`; `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_EMBRAPA_VERMINOSE` | Resolvido para alguns produtos: B19 sem revacinação; Fortress 7 4–6 semanas + anual; raiva reforço 30 dias + até 12 meses; Leptoferm anual; Poliguard/Bovigen 21–30 dias + anual. Ainda não vale para toda classe. | Trocar gap genérico por `intervalRule` produto-específico. Classe continua com gap. |
| `recorrencia` | `SRC_BULA_FORTRESS7`; `SRC_PNCRH_RAIVA`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_EMBRAPA_VERMINOSE` | Recorrência anual/semestral existe em fontes específicas, mas depende de risco, produto, aptidão e região. | Recorrência pode gerar elegibilidade/preview. Não materializar agenda automática sem configuração regional/fazenda/MV. |
| `carencia` | `SRC_BULA_FORTRESS7`; `SRC_BULA_LEPTOFERM5`; `SRC_BULA_EPRIFORT`; `SRC_BULA_SUPRAMEC`; `SRC_BULA_VALBAZEN` | Carência confirmada por produto: Fortress 7 21d abate; Leptoferm 5 21d abate; Eprifort zero abate/leite; Supramec 28d abate e sem carência leite; Valbazen 14d abate e restrição para fêmeas leiteiras para consumo humano. Continua ausente para vários produtos/classes. | Carência ativa proibida sem evento + produto executado. Congelar snapshot de carência no evento. Nunca inferir carência por classe. |
| `produto_autorizado` | `SRC_MAPA_PRODUTOS_VETERINARIOS`; bulas comerciais com registro/licença quando disponível | Exemplos de produtos foram localizados, mas curadoria completa de registro MAPA/SIPEAGRO/Athena não foi feita. | Produto específico não fica fixado no protocolo, salvo exigência legal. Exigir `registro_mapa_status` ou evidência equivalente antes de `approved_for_catalog`. |
| `bubalino_autorizado` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; fontes estaduais quando citarem bovídeos/bubalinos | B19 tem base normativa para fêmeas bovinas e bubalinas. Para a maioria dos produtos comerciais, bula não cita bubalino. Raiva precisa mapear bovídeos → espécie operacional. | B19: bubalino permitido por norma; produto comercial ainda precisa validação de cadastro/bula. Demais: `blocked` ou `needs_review` sem menção explícita. |
| `gestacao/lactacao` | `SRC_BULA_POLIGUARD`; `SRC_BULA_BOVIGEN`; `SRC_BULA_EPRIFORT`; `SRC_BULA_VALBAZEN` | Poliguard/Bovigen permitem uso em fêmeas gestantes conforme produto; Eprifort declara segurança em prenhes/lactantes; Valbazen contraindica primeiros 45 dias de gestação e não deve ser usado em fêmeas leiteiras para consumo humano. Falta para muitos produtos. | Matrizes pré-parto continuam `manual_only`. Só liberar produto com `gestation_allowed`/`lactation_allowed` explícito ou decisão auditável do MV. |
| `obrigatoriedade_legal` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_PNEFA_MAPA` | Brucelose obrigatória com execução por fluxo oficial/MV. Raiva depende de foco/risco e norma estadual. Febre aftosa: Brasil livre sem vacinação; rotina vacinal suspensa. | Não criar agenda legal automática sem `legalOverlay`. B19 pode gerar alerta/elegibilidade; raiva `manual_only`; aftosa `blocked/archived`. |
| `restricao_regional` | `SRC_PNCEBT_BRUCELOSE`; `SRC_PNCRH_RAIVA`; `SRC_MAPA_RAIVA_VACINA`; `SRC_EMBRAPA_VERMINOSE`; `SRC_PNEFA_MAPA` | Regionalidade é central: UF/classe PNCEBT, foco/área de raiva, Cerrado/Brasil Central para verminose, status PNEFA para aftosa. Overlay regional ainda não modelado. | Criar `regionalApplicabilityRule` futuramente. Nesta fase: `preview_allowed` com aviso ou `manual_only`; sem `agenda_allowed`. |

## Registro de fontes

| sourceRef | tipo | cobertura principal | força | URL |
|---|---|---|---|---|
| `SRC_PNCEBT_BRUCELOSE` | norma/programa oficial | brucelose; bovinos/bubalinos; fêmeas; 3–8 meses; obrigatoriedade; trânsito/eventos | forte | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/controle-e-erradicacao-da-brucelose-e-tuberculose-pncebt |
| `SRC_BULA_ABORVAC_B19` | bula comercial | B19; dose 2 mL; via SC; bezerras 3–8 meses; sem revacinação | forte para produto | https://www.zoetis.com.br/especies/bovinos/_assets/pdf/bula-aborvac-br.pdf |
| `SRC_PNCRH_RAIVA` | norma oficial | raiva dos herbívoros; vacina inativada; 2 mL; SC/IM; reforço 30 dias; recorrência até 12 meses | forte | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/qualidade-dos-servicos-veterinarios/arquivos/pncrh/in_05_2002_alt__n_41_2020_norma_tecnica_controle_rh.pdf |
| `SRC_MAPA_RAIVA_VACINA` | página oficial MAPA | vacinação recomendada em focos; bovídeos/equídeos preferencialmente ≥3 meses; caráter temporário da vacinação compulsória | forte contextual | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica |
| `SRC_BULA_FORTRESS7` | bula/página comercial | clostridioses bovinos; 5 mL SC; duas doses 4–6 semanas; reforço anual; abate 21 dias | forte para produto | https://www2.zoetis.com.br/especies/bovinos/fortress/ |
| `SRC_BULA_LEPTOFERM5` | bula/página comercial | leptospirose; bovinos/suínos; 2 mL IM; dose inicial única bovinos; anual; abate 21 dias | forte para produto | https://www.zoetis.com.br/especies/bovinos/leptoferm-52-ml.aspx |
| `SRC_BULA_POLIGUARD` | bula/página comercial | IBR/BVD/lepto bovinos; 5 mL SC; 2 doses 21–30 dias; reforço anual; bezerros >4m filhos de mães vacinadas; vacas prenhes | forte para produto | https://www.msd-saude-animal.com.br/produto/poliguard/ |
| `SRC_BULA_BOVIGEN` | bula/página comercial | IBR/BVD/lepto/campylobacteriose bovinos; fêmeas gestantes; reforço anual/semestral conforme risco/produto | forte para produto, revisar antes de execução | https://br.virbac.com/products/biologicos/bovigen-repro-total-se |
| `SRC_EMBRAPA_VERMINOSE` | recomendação técnica | controle estratégico de verminose: recria maio/julho/setembro; entrada em pastagem reservada/confinamento; vacas; restrição pré-desmama | apoio técnico forte, regional | https://www.infoteca.cnptia.embrapa.br/bitstream/doc/562842/1/rectec26.pdf |
| `SRC_BULA_EPRIFORT` | bula comercial | eprinomectina pour-on; bovinos; 1 mL/20 kg; prenhes/lactantes; zero abate/leite | forte para produto | https://www.bimeda.com.br/media/k2/attachments/Epriforte-Bula.pdf |
| `SRC_BULA_SUPRAMEC` | bula/página comercial | ivermectina pour-on; bovinos; 1 mL/10 kg; não recomendado <4 meses; abate 28 dias; leite sem carência | forte para produto | https://www.msd-saude-animal.com.br/produto/supramec-pour-on/ |
| `SRC_BULA_VALBAZEN` | bula comercial | albendazol; bovinos/ovinos; via oral; dose por kg; abate 14 dias; restrição leite; evitar primeiros 45 dias de gestação | forte para produto | https://www.zoetis.com.br/especies/bovinos/_assets/pdf/valbazen10_cobalto_i40013271.pdf |
| `SRC_PNEFA_MAPA` | programa/notícia oficial | suspensão da vacinação contra febre aftosa; Brasil livre sem vacinação; contingência/histórico | forte | https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/febre-aftosa/campanha-febre-aftosa |
| `SRC_MAPA_PRODUTOS_VETERINARIOS` | base institucional | validação futura de registro/cadastro/licenciamento de produtos veterinários | fonte de validação cadastral | https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/produtos-veterinarios |

## Gaps P1 para 12F1

1. Modelar `regionalApplicabilityRule`:
   - UF;
   - zona/status sanitário;
   - área de foco/perifoco/risco;
   - calendário regional;
   - aptidão produtiva;
   - regra por fazenda.

2. Converter `ProductClassGroup` de antiparasitários normalizados em artefato importável candidato:
   - `pcg_antiparasitarios_recria_estrategicos`;
   - `pcg_antiparasitarios_pre_confinamento`;
   - `pcg_antiparasitarios_matrizes_pre_parto`;
   - `pcg_antiparasitarios_bezerros_pre_desmama`;
   - membros comuns: `lactonas_macrociclicas`, `benzimidazois`, `imidazotiazoleis`, `associacoes_antiparasitarias`;
   - bloqueios comuns: carência exige produto real; dose exige peso + produto real; leite exige bula; gestação/lactação exige bula ou MV; bubalino exige fonte explícita; repetir classe exige justificativa/MV; combinação exige bula própria.

3. Criar `productExecutionPolicy` obrigatória:
   - produto real;
   - peso;
   - dose calculada;
   - via;
   - lote/validade se houver inventário;
   - carência congelada;
   - fonte snapshot.

4. Criar bloqueios explícitos:
   - febre aftosa rotina = `blocked`;
   - bubalino sem fonte = `needs_review`/`blocked`;
   - carência sem produto = erro;
   - dose por classe = erro;
   - leite sem bula = erro;
   - gestação/lactação sem bula ou MV = erro;
   - repetição de classe sem justificativa/MV = erro;
   - associação antiparasitária sem bula própria = erro;
   - pré-desmama universal = erro;
   - matriz pré-parto sem gestação/lactação validada = erro.

5. Completar curadoria:
   - confirmar cadastro/registro MAPA/SIPEAGRO/Athena por produto;
   - obter bula completa atualizada de cada produto realmente aceito no catálogo;
   - separar fonte normativa, fonte de bula, fonte técnica e decisão MV.
