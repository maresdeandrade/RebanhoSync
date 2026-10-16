# Sanitario Protocols v2 - Decision Record 12F10

> **Adendo de decisão 15/10/2026, sem substituir a decisão original:** a revisão das 18 pendências define **propostas por item** para consulta, sugestão e Agenda condicional. O artefato 12F10 ainda é a fonte canônica candidata e mantém `import_real_authorized=false`, `agenda_allowed=false`, `approved_for_catalog=false` e `allows_agenda_auto=false` nos 20 itens. A decisão **não autoriza** importar, promover `draft`, mudar produto/esquema ou executar. Ref.: [política de liberação progressiva](../SANITARIO_V2_POLITICA_AGENDA_CONDICIONAL_20261015.md) · [matriz de 20 itens](SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv). **Ajustes A–E incorporados:** restrição `no_agenda_auto` mantém **todos os três itens de raiva** sem automação até revisão **aprovada e versionada**; vacinas multivalentes (ex.: Fertiguard/Poliguard) exigem composição, janela e histórico compatíveis para **uma única aplicação/Evento** com cobertura multiprotocolo rastreável; B19 concilia períodos federais e somente os prazos estaduais de comprovação preserváveis pelo art. 3º; Agenda genérica não adquire esquema/dose por inferência; relatórios locais e os quatro achados Fallow permanecem **relatados, sem IDs brutos conferidos**. Revisar a [matriz por 20 itens](SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv) junto com a política.


Data: 2026-06-15
Decisao: `12F10_CONSOLIDAR_ARTEFATOS_CANONICOS_ANTES_DE_12G0`

## Decisoes finais

Revisao 2026-10-14: a fonte JSON corrente preserva 10 protocolos e 20 itens; contém 16 fontes, 71 coberturas, 8 classes, 4 grupos e 12 members, com 4 rejeicoes de associacoes. Tres itens candidatos possuem versao fisica 2 com ponteiro explicito para a versao anterior. As contagens 19/16 abaixo registram a decisao original de 12F10 e nao representam o payload atual. `execute_import=false`, ausencia de aprovacao curatorial e bloqueio de agenda automatica continuam vigentes. Resultado e limites atuais em `SANITARIO_V2_RESEARCH_REMEDIATION_20261014.md`.

- A fonte final de payload candidato passa a ser `SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.
- Os JSONs 12F9 permanecem como evidencia de origem, nao como fonte preferencial para 12G0.
- O pacote canonico preserva 10 protocolos, 19 itens, 4 ProductClassGroups e 16 rejeicoes de members.
- `execute_import=false` permanece obrigatorio ate fase explicita de dry-run/import.
- ProductClassGroup continua como `product_class_group` no item, com `product_class_group_id` por lookup, sem conversao para `product_class`, `specific_product` ou `none`.
- Members continuam bloqueados ate existir `class_id` real.
- `agenda_allowed` e `approved_for_catalog` permanecem falsos.

## Nao decidido

- Nenhum import real foi autorizado.
- Nenhum protocolo foi aprovado para catalogo operacional.
- Nenhuma agenda automatica foi autorizada.
- Nenhum member foi resolvido para `class_id`.

## Fonte final para execucao futura

12G0, se autorizada, deve consumir somente:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`
