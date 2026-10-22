# Ambientes de build e Preview — RebanhoSync

Atualizado em: 2026-10-21

## Fronteiras

`vite build` usa o modo `production` também em CI e Preview. O modo de otimização
não determina o ambiente de implantação. `vite.config.ts` chama
`validateBackendBuildEnvironment`, em `scripts/codex/backend-environment.mjs`.

| Contexto | Configuração exigida | Destino permitido |
| --- | --- | --- |
| Production | `VERCEL_ENV=production`, papel `production` explícito ou padrão | Projeto produtivo e hash da chave pública registrados |
| Preview | `VERCEL_ENV=preview`, `VITE_BACKEND_ENV=homologation` explícito | Projeto HTTPS exclusivo de homologação, separado de Production, com hash registrado |
| CI sintético | `CI=true`, `VITE_BACKEND_ENV=ci-synthetic`, sem contexto Vercel | Somente os três placeholders exatos definidos no validador e no passo Build |

O CI compila com URL `https://example.supabase.co`, Functions no mesmo destino e
o placeholder `example-publishable-key`. Esse artefato não é um Preview utilizável.
Qualquer outro destino/chave, ou contexto Vercel, é recusado nesse papel.
O override aplica-se somente ao passo Build; não substitui o ambiente dos testes.

Production mantém a validação de projeto, papel, endpoints e chave pública.
O preflight controlado existente continua disponível pela função
`validateBackendEnvironment`; ele não autoriza hospedar o aplicativo completo
contra Production em um Preview.

## Configuração pendente do Preview do PR #238

Na inspeção do deployment `dpl_CySEsD6e11Bq9qCbQRdTeCH8Wy4t`, a Vercel recusou
`BACKEND_PUBLIC_KEY_NOT_REGISTERED`. A variável
`VITE_SUPABASE_PUBLISHABLE_KEY` estava cadastrada somente em Production;
`VITE_SUPABASE_ANON_KEY` também existia em Preview, mas não é o nome consumido
por `src/lib/env.ts`. Nenhum valor de chave foi copiado ou registrado aqui.

Não copiar a chave produtiva para liberar o Preview: o registro atual
`config/backend-targets.json` não possui projeto de homologação isolado cadastrado.
A aplicação completa pode sincronizar e escrever; Preview não implica leitura apenas.

Após autorização e disponibilização de um projeto isolado, o responsável deve:

1. Registrar a referência em `homologation_project_refs`, sem incluí-la em
   `production_project_refs`, e seu SHA-256 em
   `homologation_publishable_key_sha256[referência]`. Não alterar os hashes produtivos.
2. Cadastrar na Vercel, no ambiente **Preview**, preferencialmente com override da
   branch `codex/worktree-consolidation-20261021`, as variáveis abaixo.

| Variável | Valor a fornecer |
| --- | --- |
| `VITE_BACKEND_ENV` | `homologation` |
| `VITE_SUPABASE_URL` | `https://<referência-isolada>.supabase.co` |
| `VITE_SUPABASE_FUNCTIONS_URL` | `https://<referência-isolada>.supabase.co/functions/v1` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto isolado, cadastrada diretamente no gestor de variáveis |

3. Disponibilizar schema, catálogo e identidade SuperAdmin no ambiente isolado por
   operações separadamente autorizadas. Não copiar sessões ou dados de produção.
4. Publicar as correções da branch, repetir os checks remotos e gerar novo Preview
   somente após a configuração aprovada. Production permanece com seu escopo atual.

A aba **Curadoria sanitária** já está implementada na área Admin, em
`src/pages/Admin/index.tsx`, com `AdminSanitaryReviewTab`. Sua utilização exige
sessão e autorização verificadas no próprio ambiente de homologação.

Esta correção não provisiona projeto, altera variáveis remotas, executa migrations,
concede papéis, aprova catálogo nem ativa gates. Sem um destino isolado registrado,
o Preview permanece bloqueado intencionalmente.
