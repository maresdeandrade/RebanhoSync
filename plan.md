1. **Resumo executivo**
A análise confirmou vários achados arquiteturais importantes: há quebra de idempotência em ativação (mistura `UPDATE`/`INSERT` sem versionamento formal), `is_operational_complement` diverte de `operational_complement`, faltam colunas de rastreabilidade na execução sanitária (só salvo no payload do evento), há geração indevida de agenda (`gera_agenda` defaults), e exclusões não lidam bem com agendas ativas. Não bloqueia expansão, mas exige um path seguro de correções.

2. **Matriz de validação dos achados**
- 1. `ativo=false` pode não ser respeitado: *Parcialmente confirmado* (A engine valida ativação oficial, mas o histórico em deduplicação e materialização direta pode bypassar flags).
- 2. Resolução única de protocolo efetivo: *Confirmado* (`resolveProtocolPrecedence` existe, mas não cobre a junção com exclusões duras e falha em tie-breaks complexos).
- 3. Edição em vez de versionamento: *Confirmado* (A função `buildProtocolItemUpdateRecord` usa `UPDATE` em vez de criar versão nova no banco de dados). Risco: P0, quebra histórico.
- 4. Divergência `is_operational_complement`: *Confirmado* (`is_operational_complement` em `officialCatalog.ts` vs `operational_complement` em `protocolLayers.ts`). Risco: P1, cria orphan layers.
- 5. Chamada RPC/Supabase direta após `createGesture`: *Confirmado* (RPC `materialize_standard_sanitary_protocols` chamado direto no `activateOfficialSanitaryPack`). Risco: P1, quebra offline-first.
- 6. `dedup_template` ausente na coluna: *Falso Positivo* (`dedup_template text` existe no DDL).
- 7. Rastreabilidade no registro sanitário: *Confirmado* (Não tem colunas fortes pra `protocol_item_id`, `version`, produto, dose na DDL `eventos_sanitario`, ficam soltos no JSON). Risco: P1.
- 8/9. Checklists oficiais misturados/doenças notificáveis: *Confirmado* (Tratados como protocolos que geram agenda em alguns casos).
- 10. `geraAgenda=true` / `intervaloDias=1` como defaults: *Confirmado* (DDL default é `false`, mas UI/Draft tem default `1` e `true` em vários locais).
- 11. Edição de oficial: *Confirmado* (UI permite editar `UPDATE` num protocolo oficial sem separar o overlay).
- 12. Delete sem validação de agenda: *Confirmado*.

3. **Plano seguro de otimização (Em fases)**
- **Fase 0**: Adição de testes de caracterização para as funções afetadas (versionamento e resolução de precedência).
- **Fase 1**: Uniformizar `operational_complement` em todo o código para garantir RLS e resolução correta.
- **Fase 2**: Implementar lógica correta de versão no `customization.ts` (ao invés de `UPDATE` na tabela `protocolos_sanitarios_itens`, fazer _soft delete_ ou inserir nova versão `version = prev + 1`).
- **Fase 3**: Refatorar `activateOfficialSanitaryPack` para retornar as operações da standard materialization via gesture/offline em vez de chamar RPC (ou usar trigger no DB de forma síncrona com gesture).
- **Fase 4**: Ajustar defaults de draft e limpar agendas zumbis geradas indevidamente com `geraAgenda=true` e intervalo=1. Adicionar colunas `produto`, `dose`, `via` e referencias estruturadas na `eventos_sanitario`.
