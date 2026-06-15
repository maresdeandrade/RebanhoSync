# Criterios 12F7 — ProductClassGroup em Itens

## Decisao para iniciar 12F7

12F7 pode ser autorizada como migration controlada somente se o objetivo for representar `ProductClassGroup` no item sem executar import/seed real.

## Escopo permitido em 12F7

- migration SQL pequena e idempotente;
- enum `sanitario_product_requirement_kind_v2_enum`;
- coluna `product_class_group_id`;
- FK para `sanitario_product_class_groups_v2(id)`;
- CHECK de requisito de produto;
- testes SQL/TypeScript focados;
- adapter de validacao local, se necessario.

## Escopo proibido em 12F7

- seed/import real;
- aprovacao de catalogo;
- `agenda_allowed`;
- agenda real;
- evento real;
- estoque;
- carencia ativa;
- UI;
- Dexie/sync amplo;
- conversao de grupo para classe/produto/none;
- criacao de ProductClass ou `class_id` inventado.

## Criterios de aceite

- enum SQL representa `product_class_group`;
- item possui FK direta opcional `product_class_group_id`;
- CHECK garante exatamente uma modalidade de requisito;
- adapter resolve `productClassGroupKey -> product_class_group_id`;
- itens antiparasitarios antes rejeitados podem ser adaptados sem perda semantica;
- ProductClassGroup members continuam bloqueados se faltar `class_id`;
- `allows_agenda_auto=false` permanece;
- `approved_for_catalog=false` permanece;
- nenhum payload e importado.

## Bloqueios P0

Bloquear 12F7 se qualquer proposta:

- converter `product_class_group` em `product_class`;
- usar principios ativos como FK;
- criar UUID artificial;
- permitir `agenda_allowed`;
- calcular dose/carencia por grupo;
- liberar venda, abate, leite ou aptidao operacional;
- escrever catalogo global por caminho autenticado comum sem governanca.

## Proxima fase apos 12F7

Se 12F7 passar:

- 12F8 pode validar novamente o adapter 12F4/12F5 contra o schema atualizado;
- seed/import real continua proibido ate fase explicitamente autorizada;
- ProductClassGroup members continuam dependendo de ProductClass reais e `class_id` resolvido.
