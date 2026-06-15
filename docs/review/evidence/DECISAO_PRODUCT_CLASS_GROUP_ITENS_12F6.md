# Decisao ProductClassGroup em Itens — 12F6

Decisao: `OPCAO A RECOMENDADA`.

## Resumo

O schema SQL real de `sanitario_protocolo_itens_versions_v2` nao representa atualmente `product_class_group`. O contrato TypeScript ja reconhece esse tipo de requisito, mas o enum SQL e o CHECK do item ainda bloqueiam a importacao segura dos 6 itens antiparasitarios rejeitados na 12F4.

## Decisao final

Recomendar para 12F7 uma migration controlada que adicione suporte direto no item:

- enum SQL: incluir `product_class_group`;
- coluna: incluir `product_class_group_id uuid null`;
- FK: `product_class_group_id -> sanitario_product_class_groups_v2(id)` com `on delete restrict`;
- CHECK: exatamente uma referencia preenchida conforme `product_requirement_kind`;
- adapter: lookup `productClassGroupKey -> product_class_group_id`.

## Justificativa

Esta opcao preserva a semantica original: um item antiparasitario pode exigir um grupo de classes quimicas intercambiaveis, sem escolher uma classe unica e sem escolher produto comercial. Isso e necessario para rotacao quimica, resistencia parasitaria e execucao com produto real.

## Decisoes negativas

Rejeitado:

- converter `product_class_group` em `product_class`;
- converter `product_class_group` em `specific_product`;
- converter `product_class_group` em `none`;
- usar principios ativos como FK;
- inventar `class_id`;
- criar seed/import nesta fase.

## Itens impactados

Continuam bloqueados ate 12F7:

- `recria_maio`;
- `recria_julho`;
- `recria_setembro`;
- `pre_desmama_situacional`;
- `pre_confinamento_dose_unica`;
- `matrizes_pre_parto_antiparasitario`.

## Grupos impactados

Grupos preservados:

- `pcg_antiparasitarios_recria_estrategicos`;
- `pcg_antiparasitarios_bezerros_pre_desmama`;
- `pcg_antiparasitarios_pre_confinamento`;
- `pcg_antiparasitarios_matrizes_pre_parto`.

## Limite da decisao

A decisao autoriza apenas a preparacao da 12F7. Ela nao aprova catalogo, nao ativa protocolo, nao gera agenda, nao cria evento e nao libera carencia.
