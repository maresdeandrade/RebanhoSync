# Scripts — RebanhoSync

Catálogo operacional. Scripts complementam `AGENTS.md` e `.agents/rules/*`; não ampliam autorização nem substituem contratos do produto.

## Governança permanente

- `codex/bootstrap.ps1`: confirma bootstrap mínimo de agentes.
- `codex/preflight.ps1`: valida escopo e paths antes do patch.
- `codex/validate.ps1`: validação proporcional por perfil explícito.
- `codex/prepare-pr.ps1`: produz narrativa somente após gate `READY`.
- `antigravity/data_contract_audit.sh`: auditoria estática de rules, skills e prompts.
- `antigravity/check_clean_tree.sh`: valida árvore Git limpa.
- `antigravity/run_bash.mjs`: launcher Bash restrito ao repositório.

## Continuidade documental

- `antigravity/docs_gates.sh`: agrega explicitamente headers, continuidade e auditoria.
- `antigravity/validate_docs_scope.sh`: allowlist de uma reconciliação documental controlada.
- `antigravity/validate_docs_headers.sh`: headers e baselines atuais.
- `antigravity/validate_docs_continuity.sh`: transição entre plano, handoff, status e roadmap.

Entry points `validate_scoped_changes.sh`, `validate_rev_d_headers.sh` e `validate_derivation_td.sh` são wrappers temporários de compatibilidade; não definem contratos próprios.

## Validação funcional permanente

- `codex/validate-supabase-baseline-functional.mjs`: baseline autoritativo; exige banco local explicitamente descartável porque persiste fatos.
- `codex/validate-dry-cow-therapy-functional.mjs`: validação transacional da Terapia de Vaca Seca.
- `codex/prepare-dry-cow-ui-smoke.mjs` e `run-dry-cow-ui-smoke-cdp.mjs`: fixture identificada, manifesto em `tmp/`, cleanup dirigido e screenshot descartado por padrão.

## Ferramentas restritas ou históricas

- `codex/import-sanitario-protocols-v2.mjs`: importador excepcional 12F10; não é gate obrigatório.
- Validadores sanitários 12F5, 12F8, 12F9, sync-expand e RPC duplicidade: cobertura histórica exclusiva, execução manual e não obrigatória.
- `fix-docs-encoding.mjs`: manutenção manual; write restrito ao repositório e archive excluído por padrão.
- Protótipos destrutivos ou automações sem consumidor ficam em `.agents/archive/scripts/**`, fora da superfície operacional.

## Aliases

- `pnpm run gates:docs`: estrutura e continuidade documental.
- `pnpm run gates:docs-scope`: escopo documental, quando aplicável.
- `pnpm run audit:agents`: auditoria estática de `.agents`.
- `gates`, `gates:scope`, `gates:headers`, `gates:derivation` e `audit:data` são aliases temporários de compatibilidade.

Operações externas, destrutivas, `full`, imports, ambientes descartáveis e preservação de screenshots exigem autorização explícita da tarefa atual.
