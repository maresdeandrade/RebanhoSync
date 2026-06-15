# Matriz de Opcoes ProductClassGroup — 12F6

| Criterio | Opcao A: coluna direta | Opcao B: tabela ponte | Opcao C: fora do import | Opcao D: converter para classe |
|---|---|---|---|---|
| Preserva semantica de grupo | Sim | Sim | Sim, mas sem import | Nao |
| Complexidade SQL | Media | Alta | Baixa | Baixa |
| Complexidade RLS | Media | Alta | Baixa | Baixa |
| Complexidade adapter | Media | Alta | Baixa | Baixa, mas incorreta |
| Suporte a item com um grupo | Forte | Forte | Nenhum | Incorreto |
| Suporte a multiplos grupos por item | Nao imediato | Sim | Nao | Nao |
| FK auditavel | Sim, `product_class_group_id` | Sim, via ponte | Nao | Nao preserva grupo |
| Risco de perda semantica | Baixo | Baixo | Baixo | Alto |
| Risco de overengineering | Medio | Alto | Baixo | Medio |
| Desbloqueia 6 itens antiparasitarios | Sim, apos migration | Sim, apos migration | Nao | Bloqueado por criterio sanitario |
| Recomendacao | Recomendada | Nao para 12F7 | Fallback temporario | Rejeitada |

## Opcao A — enum + FK direta no item

Decisao: recomendada.

Forma futura:

```txt
sanitario_protocolo_itens_versions_v2.product_requirement_kind = product_class_group
sanitario_protocolo_itens_versions_v2.product_class_group_id -> sanitario_product_class_groups_v2.id
```

Vantagens:

- menor superficie que uma tabela ponte;
- FK direta facilita auditoria;
- adapter consegue resolver `group_key` para `id`;
- evita conversao indevida para classe unica;
- compativel com os 6 itens rejeitados da 12F4.

Riscos:

- exige migration de enum e tabela;
- exige CHECK novo;
- exige validacao de escopo entre protocolo e grupo;
- nao resolve members sem `class_id`.

## Opcao B — tabela ponte item -> grupos

Decisao: nao recomendada para 12F7.

Vantagens:

- suporta multiplos grupos por item;
- preserva item sem nova FK direta.

Riscos:

- cria nova tabela, RLS, policies, indices e sync futuro;
- aumenta joins e adapter;
- amplia superficie antes de existir necessidade real de multiplos grupos;
- nao resolve members sem `class_id`.

## Opcao C — manter fora do import

Decisao: fallback temporario aceitavel.

Vantagens:

- zero schema;
- risco operacional minimo.

Riscos:

- mantem 6 itens antiparasitarios fora do import;
- nao resolve rotacao quimica no contrato persistido;
- impede evolucao do lote 12F.

## Opcao D — converter para ProductClass

Decisao: rejeitada.

Motivo:

`ProductClassGroup` expressa um conjunto de classes intercambiaveis e uma politica de rotacao. Converter para classe unica, produto especifico ou `none` remove informacao tecnica critica e pode induzir execucao incorreta.
