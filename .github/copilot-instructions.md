# RebanhoSync — GitHub Copilot Instructions

Use português do Brasil nas respostas, revisões e descrições de pull request.

Antes de propor ou alterar código, siga o `AGENTS.md` da raiz e o `AGENTS.md` local da área afetada, quando existir. Não amplie escopo, autorização ou contexto sem necessidade.

## Contexto técnico

RebanhoSync é um app agropecuário offline-first em React/TypeScript, Dexie/IndexedDB e Supabase/Postgres com RLS e sincronização local-remota.

Preserve:
- offline-first;
- RLS, multi-tenant e isolamento por `fazenda_id`;
- idempotência, retry/replay, rollback, reconciliação e auditabilidade;
- separação entre UI e regra de negócio;
- compatibilidade local-remota.

Contratos centrais:
- Agenda = intenção/tarefa futura; não é histórico.
- Evento = fato executado e fonte histórica.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração; não é execução.
- Tags, sinais e insights = auxiliares; nunca fonte primária nem regra crítica.
- Carência, venda/abate, peso confiável e aptidão operacional exigem fonte técnica explícita.

## Alterações e validação

Prefira patches pequenos, reversíveis e testáveis. Evite refatoração ampla sem necessidade.

Validação deve ser proporcional ao delta:
- alteração localizada → testes diretamente relacionados;
- bloco compartilhado relevante → validação ampliada do escopo afetado;
- fechamento de fase → bateria definida pelos critérios de aceite.

Não execute nem recomende suíte global, E2E ou build completo por rotina. Não repita teste sem alteração capaz de mudar o resultado. Nunca declare PASS, READY ou teste executado sem evidência.

## Pull requests

Ao gerar, revisar ou atualizar uma descrição de PR:
- baseie-se no diff real, arquivos alterados e evidências disponíveis;
- não invente comportamento, risco, teste, issue, `capability_id` ou `infra_id`;
- seja conciso e evite repetir o título;
- preserve as seções do template do repositório;
- destaque mudanças, impacto de domínio, validações realmente executadas e riscos/caveats;
- diferencie fato confirmado, inferência e recomendação quando houver incerteza;
- não declare área como “não afetada” sem suporte no diff.

Priorize uma descrição auditável e útil para revisão, não uma narrativa extensa.
