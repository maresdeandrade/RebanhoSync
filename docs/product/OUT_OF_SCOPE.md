```md
# Out of Scope — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Registrar o que não deve ser implementado, inferido ou tratado como suportado no MVP atual.

Este documento reduz a expansão indevida de escopo e evita que agentes implementem funcionalidades úteis, mas prematuras ou perigosas.

---

## Regra central

```txt
Se uma funcionalidade exige fonte técnica ainda não consolidada, decisão crítica, contrato de domínio próprio ou complexidade fiscal/contábil avançada, ela deve ficar fora do MVP até contrato explícito.

```

---

## Fora de escopo imediato

### ERP fiscal completo

* NF-e;
* NFS-e;
* SPED;
* escrituração fiscal;
* obrigações contábeis;
* integração contábil completa;
* apuração tributária.

> ⚠️ **Motivo:** Desvia o produto do foco operacional e aumenta a complexidade regulatória.

### Contabilidade completa

* plano de contas contábil completo;
* DRE formal;
* balanço patrimonial;
* conciliação bancária;
* folha de pagamento;
* centro de custo contábil avançado.

> 💡 **Nota:** Permitido apenas como gestão operacional/custos simples quando a fonte existir.

### Motor automático de venda/abate

* “pronto para venda” automático;
* “apto para abate” automático;
* recomendação automática de venda;
* ranking automático de descarte;
* decisão comercial autônoma;
* liberação comercial baseada apenas em sanidade;
* liberação comercial baseada apenas em carência.

> ⚠️ **Motivo:** Exige composição de peso, sanidade, carência, mercado, documentação, sociedade, regra comercial e decisão humana.

### Liberação sanitária/comercial automática

As seguintes ações estão **fora do MVP como autorização final**:

* data segura para abate como decisão automática;
* data segura para venda como decisão automática;
* liberação sanitária final;
* liberação comercial;
* aptidão para venda;
* aptidão para abate.

As seguintes ações estão **permitidas no MVP**:

* carência ativa como sinal sanitário quando derivada de evento estruturado;
* livre de carência como sinal sanitário quando derivado de evento estruturado;
* aviso de limitação quando a fonte estiver ausente.

> ⚠️ **Regra obrigatória:**
> * `sanitario:livre_carencia` $\neq$ `comercial:apto_venda`
> * `sanitario:livre_carencia` $\neq$ `comercial:apto_abate`
> 
> 

### Peso atual confiável

Fora do MVP como afirmação automática. Não basta ter a última pesagem. Exige política técnica sobre:

* validade temporal;
* método;
* margem;
* projeção;
* contexto;
* fonte.

### Compliance regulatório universal

* bloqueio regulatório universal;
* interpretação automática completa por UF;
* decisão legal automática;
* substituição de avaliação técnica;
* checklist como prova universal de conformidade;
* ausência de ocorrência como prova de conformidade.

> 💡 **Permitido:** Compliance sanitário contextual, checklist regulatório como orientação, ocorrência de biossegurança, pendência corretiva específica, e alerta com fonte e limitação declaradas.

### Motor reprodutivo amplo

* IATF ampla;
* IA completa;
* cobertura;
* diagnóstico de gestação;
* reconcepção;
* estação de monta completa;
* taxa de prenhez automatizada;
* motor universal de calendário reprodutivo.

> 📌 **Escopo confirmado principal:** Parto, pós-parto, cria e vínculo mãe-cria.

### Analytics preditivo

* previsão automática de ganho;
* predição de peso;
* previsão de lucro;
* risco sanitário preditivo;
* recomendação autônoma por IA;
* otimização automática de lote/pasto.

> 💡 **Nota:** Permitido apenas cálculo histórico com fonte explícita.

### Marketplace e integrações comerciais

* marketplace de animais;
* cotação automática;
* integração com frigorífico;
* integração bancária;
* compra automática de insumos;
* venda automatizada.

### Automação clínica/veterinária autônoma

* diagnóstico automático;
* prescrição automática;
* protocolo terapêutico autônomo;
* recomendação veterinária sem validação;
* decisão sanitária crítica por IA.

> 💡 **Permitido:** Registro de suspeita, registro de ocorrência, checklist contextual, alerta, organização de informação e pendência corretiva específica.

---

## Fora de escopo técnico

Não fazer sem tarefa explísica:

* refatoração ampla;
* reescrever arquitetura;
* trocar Dexie;
* trocar Supabase;
* enfraquecer RLS;
* remover offline-first;
* criar fonte paralela de verdade;
* mover regra crítica para UI;
* migrar schema sem plano;
* alterar `sync-batch` sem baseline.

---

## Fora de escopo documental

Não usar como fonte ativa:

* auditorias antigas;
* handoffs substituídos;
* `docs/archive/`;
* prompts antigos;
* README desatualizado;
* documentação duplicada;
* documentos sem relação com o código atual.

---

## Itens permitidos como sinal parcial

Podem aparecer como **bloqueados/parciais**:

* “peso confiável não confirmado”;
* “apto para venda não calculado”;
* “apto para abate não calculado”;
* “liberação sanitária final não calculada”;
* “compliance depende de validação”;
* “dados financeiros incompletos”;
* “ganho de peso indisponível por falta de pesagens”;
* “caso notificável por lote registrado apenas no evento/payload”;
* “tempo até resolução indisponível por falta de data estruturada”.

**Não usar mais como bloqueio absoluto quando houver fonte estruturada**:

* “carência ativa”;
* “livre de carência”.

> ⚠️ Esses dois podem aparecer como sinal sanitário, não como autorização comercial.

---

## Critério para retirar algo do out-of-scope

Uma capacidade pode sair deste documento quando houver:

* fonte técnica explícita;
* modelo de dados definido;
* regra documentada;
* testes;
* validação de edge cases;
* impacto em sync/RLS avaliado;
* UX clara;
* aceite de produto;
* atualização em `docs/product/CAPABILITY_MAP.md` e `ROADMAP.md`.

---

## Checklist antes de implementar algo sensível

* [ ] Existe fonte técnica explícita?
* [ ] Existe contrato de domínio?
* [ ] Existe fonte de verdade definida?
* [ ] O dado é fato, intenção, estado ou regra?
* [ ] Há risco de decisão crítica falsa?
* [ ] Offline/sync/rollback foram avaliados?
* [ ] RLS/`fazenda_id` foram preservados?
* [ ] O usuário entenderá a limitação?
* [ ] A funcionalidade pertence ao MVP?

```

```