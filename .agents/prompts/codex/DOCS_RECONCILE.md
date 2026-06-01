```markdown
# Codex Prompt — Reconciliar Documentação

Use para alinhar documentação ao estado real do código.

## Objetivo

Reconciliar documentação com o estado atual do repositório sem criar documentação redundante.

## Escopo

### Documentos-alvo:
```txt
[LISTAR_DOCS]

```

### Código ou áreas de referência:

```txt
[LISTAR_AREAS_DE_CODIGO]

```

## Regras

* Não alterar código de produto.
* Não alterar migrations, seed, RLS, RPCs ou testes.
* Não usar `docs/archive/` como fonte operacional.
* Não tratar documentação antiga como verdade se contradizer código/migrations atuais.
* Não duplicar contratos já presentes em `CORE_RULES.md` ou `SOURCE_OF_TRUTH.md`.
* Arquivar documentos substituídos em vez de apagar.

## Fontes de Verdade

Seguir a ordem de precedência:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico/archive.

## Verificar

* Docs obsoletos.
* Docs duplicados.
* Prompts longos que devem virar template compacto.
* Auditorias antigas ainda referenciadas como fonte ativa.
* Manuais completos usados como contexto padrão.
* Regras repetidas entre `AGENTS.md`, `.agents/rules`, docs e skills.

## Saída Esperada

Aplicar patch documental contendo:

* **Arquivos criados:** [Lista de novos documentos]
* **Arquivos alterados:** [Lista de documentos modificados]
* **Arquivos movidos para archive:** [Lista de caminhos arquivados]
* **Conteúdo extraído antes do arquivamento:** [Sumário de trechos reaproveitados]
* **Links/referências atualizados:** [Mapeamento de links internos corrigidos]
* **Riscos/pendências:** [No máximo 3 pontos identificados]

## Validação

Executar comandos para checagem local:

```bash
git status --short --untracked-files=all

```

Buscar duplicidade das invariantes:

```bash
rg -n "Agenda = intenção|Evento = fato|state_\\*|Protocolo = regra|Tags, sinais e insights|fonte primária" AGENTS.md docs .agents -g "!docs/archive/**"

```

Listar maiores markdowns ativos:

```powershell
Get-ChildItem -Recurse -File AGENTS.md,*.md |
  Where-Object { $_.FullName -notmatch "docs\\archive|node_modules" } |
  Select-Object FullName, Length |
  Sort-Object Length -Descending

```

## Critério de Aceite

* `AGENTS.md` permanece como um dispatcher curto.
* `.agents/rules/*` concentra centralizadamente as regras de agente.
* Docs longos ficam disponíveis estritamente sob demanda.
* Arquivos históricos ficam contidos em `docs/archive/`.
* Nenhuma fonte operacional aponta para o diretório `archive`.

```

```