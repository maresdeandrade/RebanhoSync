# Nota Técnica — Resolução e Hardening (Fase 1A)
**Módulo de Sanitário e Protocolos de Manejo**

Este documento detalha o hardening lógico e de apresentação efetuado na **Fase 1A** do Hotspot Sanitário/Protocolos de Manejo do RebanhoSync. As mudanças foram guiadas pelas suites de testes unitários e de integração convertidos a partir da Fase 0.

---

## 🔍 Resumo de Riscos Resolvidos

### Risco A: Protocolo Ativo/Inativo e Cobertura de Família
* **Causa Raiz**: O indexador de coberturas de família sanitária e o calculador de precedência computavam e validavam protocolos mesmo se estes tivessem a flag `ativo === false` ou se estivessem marcados logicamente como deletados via `deleted_at`.
* **Mitigação**: As funções cruciais `buildSanitaryFamilyCoverageIndex`, `findSanitaryFamilyConflict`, `resolveProtocolPrecedence` e `resolveEffectiveProtocolsByFamily` foram atualizadas para desconsiderar de forma consistente qualquer protocolo inativo (`ativo === false`) ou logicamente excluído (`deleted_at !== null`).

### Risco C: Divergência de chaves de complemento operacional
* **Causa Raiz**: O catálogo oficial persistia complementos operacionais customizados com a chave `is_operational_complement` no payload, enquanto a engine sanitária de precedência esperava a chave `operational_complement`.
* **Mitigação**: Criada a função de fallback `readOperationalComplement` tolerante a ambas as grafias na leitura e classificação dos protocolos, eliminando qualquer risco de inconsistência em tenants antigos.

### Risco D: Edição direta de Protocolos Oficiais
* **Causa Raiz**: As funções e telas do sistema permitiam que usuários finais editassem de forma destrutiva etapas ou cabeçalhos de protocolos de origem `"catalogo_oficial"`.
* **Mitigação**:
  1. Bloqueios estritos a nível de negócio foram inseridos nos builders `buildProtocolUpdateRecord`, `buildProtocolItemUpdateRecord` e `buildProtocolItemInsertRecord` disparando erros preventivos imediatos se a origem for oficial.
  2. A interface de usuário em `FarmProtocolManager.tsx` foi blindada para desativar a edição/salvamento e lançar mensagens de alerta (`showError`) caso haja qualquer tentativa de bypass.

### Risco E: Deduplicação Sanitária Oficial
* **Causa Raiz**: O catálogo oficial criava etapas de protocolos sanitários com o campo `dedup_template` como `null`, gerando duplicidades de agendamento em itens da mesma família (ex: Brucelose).
* **Mitigação**: O construtor de operações `buildOfficialSanitaryPackOps` foi atualizado para preencher automaticamente o `dedup_template` a partir do regime sanitário da etapa, prevenindo tarefas zumbis redundantes no banco do cliente.

### Risco F: Defaults Seguros em Rascunhos
* **Causa Raiz**: Rascunhos de etapas sanitárias criavam itens com agendamento ativo por padrão (`geraAgenda = true`) e intervalo padrão de `1 dia`, induzindo preenchimentos incorretos.
* **Mitigação**: 
  - `createEmptyProtocolItemDraft` inicializa campos com `geraAgenda = false` e `intervaloDias = ""`.
  - `validateProtocolItemDraft` exige de forma flexível mas segura que etapas com agenda ativa possuam regras resolvíveis de agendamento (calendário estruturado, dependência sequencial ou código da etapa) e impede intervalos inválidos ou nulos em rotinas recorrentes.

### Risco H: Exclusão Física vs Preflight de Segurança
* **Causa Raiz**: O botão de exclusão de protocolos excluía fisicamente os registros sem validar vínculos com tarefas pendentes ou históricas, causando orfandade de dados no IndexedDB.
* **Mitigação**: 
  - Encapsulamos a lógica na função pura e testável `checkSanitaryProtocolDeletionSafety`.
  - Antes de executar a deleção física, a interface em `FarmProtocolManager.tsx` lê a agenda local (`state_agenda_itens`) e os eventos históricos (`event_eventos`) e invoca o helper de segurança. Caso haja vínculos ativos, o usuário recebe um toast preventivo e a operação é abortada.

---

## 📈 Conclusão e Prontidão para PR

Todas as blindagens foram exaustivamente validadas sob testes unitários e de build integrados, sem alterações de schema estrutural no Supabase, preparando um ambiente extremamente robusto e confiável para as próximas iterações.
