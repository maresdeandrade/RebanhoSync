# Relatório de Diagnóstico Arquitetural: Domínio Sanitário Offline-First (RebanhoSync)

## 1. Resumo Executivo
A auditoria no domínio sanitário confirmou que a fundação offline-first e a separação entre *Agenda* e *Eventos* estão conceitualmente mantidas, porém existem quebras localizadas na integridade transacional, idempotência de sync e rastreabilidade que comprometem a consistência. A chamada de RPCs síncronas após gestures e atualizações destrutivas (`UPDATE`) em definições de protocolo (em vez de versionamento semântico) são os maiores riscos. A otimização não exige reescrever a engine, mas sim um "aperto de parafusos" (hardening) rigoroso no data contract, isolando configurações operacionais das execuções históricas. Recomendação final: **Corrigir antes** de expandir as features visuais do sanitário.

## 2. Matriz de Validação dos Achados

| # | Achado Preliminar | Status | Evidência (Arquivo/Função) | Risco/Impacto | Severidade | Recomendação Mínima Segura |
|---|---|---|---|---|---|---|
| 1 | `ativo=false` não respeitado em conflitos | **Confirmado** | `resolveProtocolPrecedence` (`protocolLayers.ts`) não pondera `ativo=false` vs exclusão definitiva e overlay custom ativo. | Agenda zumbi baseada em protocolo inativo. | **P1** | Incluir flag `ativo` na lógica de tie-break de precedência. |
| 2 | Resolução única de protocolo por família falha | **Parcialmente Confirmado** | `protocolLayers.ts`: `resolveProtocolPrecedence` existe mas falha no tie-break (`standard` vs `custom` sem complement). | Camadas órfãs e dupla materialização. | **P2** | Centralizar resolução e usar `familyCode` com fallback rígido. |
| 3 | Edição usa `UPDATE` em vez de versionamento | **Confirmado** | `buildProtocolItemUpdateRecord` (`customization.ts`) sobrescreve registro em `protocolos_sanitarios_itens`. | **Quebra de histórico e reprodução de agendas passadas.** | **P0** | Implementar `INSERT` (version bumping) ou Soft Delete nas edições operacionais. |
| 4 | Divergência `is_operational_complement` | **Confirmado** | `officialCatalog.ts` (lê `is_operational_complement`) vs `protocolLayers.ts` (lê `operational_complement`). | Fallback do catálogo falha, criando silos paralelos da mesma família. | **P1** | Uniformizar para `operational_complement` em todo o parser de payload. |
| 5 | Materialização de pack quebra offline-first (RPC) | **Confirmado** | `activateOfficialSanitaryPack` (`officialCatalog.ts`) chama `supabase.rpc` logo após `createGesture`. | Quebra a promessa offline e falha parcialmente em interrupções de rede. | **P0** | Mover materialização standard para operações de `gesture` encadeadas via transação Dexie. |
| 6 | `dedup_template` salvo apenas no JSON | **Falso Positivo** | Migrations e `rebuild_base_schema_sanitario.sql` mostram coluna formal. | Nenhum. | - | Nenhuma ação. |
| 7 | Falta rastreabilidade mínima no evento sanitário executado | **Confirmado** | A tabela `eventos_sanitario` tem foreign key transacional, mas produto, lote e dose só existem no JSON `payload` do evento, dificultando consultas de carencia/compliance em SQL puro. | Dificulta reports de carência leite/corte (withdrawals). | **P1** | Adicionar colunas `produto`, `dose` e `protocol_item_version_id` na migration de payload explícito. |
| 8/9| Doenças notificáveis / Checklists misturados com protocolos | **Confirmado** | Itens notáveis como Raiva e Brucelose estão materializando agendas diárias (zumbis) se não curados, tratados pelo catálogo como itens agendáveis. | Poluição visual da agenda e fadiga de alerta do produtor. | **P2** | Separar semanticamente `checklist`/`surveillance` de `protocolo_agendavel`. |
| 10 | `geraAgenda=true` e `intervalo=1` | **Confirmado** | `calendar.ts` tem fallbacks inseguros e `geraAgenda=true` hardcoded para itens imediatos que não deveriam renderizar tasks operacionais no Dexie. | Explosão no tamanho do BD local (O(N) * Animais diarios). | **P1** | Tornar fallbacks explícitos (`gera_agenda = false` para clínica). |
| 11 | Edição direta de protocolo oficial | **Parcialmente Confirmado** | `buildProtocolUpdateRecord` não bloqueia mutações se `source_origin === "official"`. | Quebra o _checksum_ do catálogo base. | **P1** | Exigir `fork` (overlay customizado) na UI antes de salvar. |
| 12 | Delete não avalia agenda aberta/eventos | **Confirmado** | Componente de UI dispara `action="DELETE"` do item. Histórico não tem garantias de FK referencial forte de versão se deletado. | Eventos históricos ficam "soltos". | **P1** | `DELETE` sanitário deve ser sempre Soft Delete (`deleted_at = now()`), cancelando agendas pendentes. |


## 3. Mapa dos Fluxos Atuais (Hotspots)
- **Configuração de Protocolo:** Baseia-se no `customization.ts`. Atualmente realiza `UPDATE` destrutivo (Hotspot R/R - Reprodutibilidade Quebrada).
- **Geração de Agenda (`recompute_agenda`):** Baseada no `scheduler.ts` e SQL. Sofre com itens zumbis por causa dos fallbacks de `gera_agenda=true` para tratamentos clínicos.
- **Materialização de Pack Oficial:** Ocorre em `officialCatalog.ts`. Quebra a arquitetura Two-Rails (offline) chamando RPC assíncrono síncrono. (Hotspot E - Effects).
- **Registro Sanitário / Finalização:** Resolve na UI em `Registrar`. Transfere IDs para `eventos_sanitario`, mas omite colunas concretas de `product`, `dose` e `version`.

## 4. Riscos P0 / P1 Listados
1. **[P0]** `UPDATE` direto em `protocolos_sanitarios_itens` (Destrói o vínculo semântico de eventos passados com o protocolo que estava ativo na época).
2. **[P0]** Chamada `supabase.rpc` para `materialize_standard` fora de uma transação local de _gesture_, quebrando offline.
3. **[P1]** Chave `is_operational_complement` (divergência de typo), falhando o merge da árvore de precedência.
4. **[P1]** Omissão de `protocol_item_version_id` como FK explícita na materialização de `eventos_sanitario`.
5. **[P1]** Agenda massiva (`intervalo=1` e `gera_agenda=true` pra doenças de vigilância).

## 5. Plano de Execução Seguro em Fases (Não-Implementado)

### Fase 0: Inventário e Testes de Caracterização
- **Arquivos:** `src/lib/sanitario/__tests__/*`
- **Mudanças:** Adicionar testes na `protocolLayers.test.ts` falhando na chave de divergência de nome, e garantindo versionamento.
- **Rollback:** `git reset` (Testes puros, sem risco de prod).

### Fase 1: Padronização do Data Contract
- **Arquivos:** `officialCatalog.ts`, `protocolLayers.ts`
- **Mudanças:** Uniformizar `readBoolean(..., "operational_complement")`. Remover strings soltas como `is_operational_complement`. Padronizar `gera_agenda=false` para itens com modo `imediato`/`notificável`.
- **Aceite:** Testes de precedência e merges da família custom com a oficial passam perfeitamente.

### Fase 2: Versionamento de Itens Operacionais (P0)
- **Arquivos:** `customization.ts` (`buildProtocolItemUpdateRecord`)
- **Mudanças:** Converter de `UPDATE` transacional para `INSERT` com versão incrementada (`prev.version + 1`). Desativar (soft-delete) o item anterior.
- **Aceite:** Alterar a dose de vacina não muda a dose renderizada no UI de um evento do ano passado.

### Fase 3: Rastreabilidade de Execução (P1)
- **Arquivos:** `supabase/migrations/` (criar nova), `agendaOps.ts`, schema TypeScript de `EventosSanitario`.
- **Mudanças:** Expor `produto`, `dose`, `via` (opcional) e `protocol_item_version_id` como colunas físicas. Garantir o bypass transacional correto da agenda pro evento.
- **Rollback:** Downgrade da migration via rollback SQL.

### Fase 4: Otimização Offline do Oficial (P0)
- **Arquivos:** `officialCatalog.ts`
- **Mudanças:** Mapear os registros `standard` diretamente em memória e despachá-los no mesmo array de operações pro `createGesture` local, e deletar a chamada manual ao `rpc`.
- **Aceite:** Ao ativar pack oficial com "airplane mode", todas as edições são persistidas no indexedDB Dexie e sincronizadas no próximo ping de rede.

### Fase 5: Cleanups de Regras MAPA e Zumbis
- **Mudanças:** Doenças notificáveis nunca ativam flags de `gera_agenda`. Fallbacks de idade e intervalo explícitos.
- **Aceite:** A visualização do `Pasto` melhora de performance após recálculo, dado que agendas zumbis não poluem mais o cache de views locais.

## 6. Checklist de Testes Antes da Refatoração
- [ ] `protocolLayers`: Teste com `operational_complement: true` e oficial ativo (deve resolver pro custom).
- [ ] `officialCatalog`: Offline gesture deve conter +10 operations (do pack oficial e do materializer padrão embutido).
- [ ] `customization`: Edição de dose -> garante array de ops com 1 UPDATE (desativando prev) e 1 INSERT (nova versão).
- [ ] `compliance`: Verificar não-emissão de agendas para IN MAPA 50.

## 7. Recomendação Final
**CORRIGIR ANTES.** As falhas listadas (principalmente updates semânticos e quebra offline por RPC) comprometem a confiabilidade e reprodutibilidade do sistema (a promessa de "Livro-razão apend-only"). O plano em Fases (1 a 5) deve ser implementado de forma granular, garantindo que o núcleo não "apodreça" com dados mal estruturados antes que novas funcionalidades (como relatórios avançados ou integrações de estoque) sejam construídas em cima.
