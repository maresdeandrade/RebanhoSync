---
name: repository-verification-gate
description: Use when a change is complete and you need to verify repository state, diff scope, applicable validation commands, warnings, and delivery readiness before handoff or PR preparation.
---

# Repository Verification Gate
## Missão
Fechar uma tarefa com **evidência objetiva de validação**, confirmando:
- estado real do diff;
- arquivos rastreados e untracked;
- comandos executados;
- falhas, warnings e pendências;
- prontidão ou não para handoff / PR.
Esta skill não escreve narrativa de PR.
Para isso, usar `prepare-pr` depois que o gate estiver concluído.
---

## Quando usar
Use quando:
- a implementação terminou;
- uma refatoração foi concluída;
- houve alteração em código, docs normativos, skills, scripts ou governança;
- a tarefa tocou área crítica;
- for necessário declarar objetivamente se a entrega está pronta;
- você pretende escalar para `prepare-pr`.
---

## Quando NÃO usar
Não use para:
- exploração de contexto;
- planejamento antes de alterar arquivos;
- análise arquitetural sem patch;
- escrever corpo de PR sem revisar o estado técnico;
- investigação ainda aberta.
Nesses casos, usar:
- `repository-context-retrieval`;
- `harden-module`;
- skill de domínio correspondente.

---
## Ler primeiro
1. `AGENTS.md`
2. `README.md`
3. `docs/CURRENT_STATE.md`
4. `docs/PROCESS.md`
Se a tarefa tocou caminho crítico, ler também o `AGENTS.md` local aplicável.

---
## Regra central
Nunca declarar uma entrega como:
- “pronta”;
- “validada”;
- “sem pendências”;
- “safe to merge”;
sem verificar:
1. estado do repositório;
2. escopo real do diff;
3. validações aplicáveis;
4. pendências remanescentes.

---
## Procedimento
### 1. Confirmar escopo da entrega
Registrar:
- capability principal ou trilha `infra.*`, quando aplicável;
- objetivo da alteração;
- caminhos intencionalmente tocados;
- caminhos que deveriam permanecer fora de escopo.

### 2. Inspecionar estado do repositório
Executar:
```
git status --short --untracked-files=all
git diff --name-only
git diff --stat
``` 

Usar esses comandos para confirmar:
- arquivos modificados;
- arquivos novos ainda não rastreados;
- presença de mudanças fora do escopo;
- se o diff real corresponde ao objetivo declarado.
Se houver arquivos untracked, não assumir que `git diff` vazio significa ausência de mudança.

### 3. Classificar o tipo de entrega
Determinar se a alteração é:
- código funcional
- refatoração sem mudança de comportamento
- docs/governança
- schema/RLS/Supabase
- infraestrutura de validação
- mista
Essa classificação define quais validações são obrigatórias.

### 4. Executar validação aplicável
Código ou refatoração
Executar:
``` 
pnpm run lint
pnpm test
pnpm run build
```

Área crítica
Se tocar uma área crítica listada no `AGENTS.md`, executar também:
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
Baseline Supabase / sync-batch / migrations
Se a tarefa tocar baseline, função ou fluxo explicitamente coberto:
```
node scripts/codex/validate-supabase-baseline-functional.mjs
``` 

Docs, skills ou governança sem impacto executável
Pode dispensar lint/test/build somente quando:
- nenhum código executável foi alterado;
- isso for declarado explicitamente;
- o diff tiver sido inspecionado;
- o motivo da dispensa for registrado.
---

## Leitura dos resultados
Classificar cada validação como:
- PASS
- FAIL
- NOT RUN — justified
Para warnings:
- não chamar de “conhecido” sem base recente;
- registrar se foi: previamente conhecido, novo ou não investigado.
Nunca esconder:
- falha de comando;
- comando não executado;
- warning relevante;
- mudança fora de escopo.
---

## Critério de prontidão
READY
Quando:
- diff corresponde ao escopo;
- não há arquivo esquecido/untracked relevante;
- validações aplicáveis passaram;
- warnings foram classificados;
- pendências restantes são inexistentes ou explicitamente aceitas.
READY WITH CAVEAT
Quando:
- a entrega está tecnicamente consistente;
- mas há aviso, limitação ou validação dispensada com justificativa objetiva.
NOT READY
Quando:
- há falha de validação;
- há diff fora de escopo;
- há arquivos não analisados;
- há incerteza técnica relevante;
- faltou rodar gate obrigatório.
---

## Escalonamento
Depois do gate:
- usar `prepare-pr` se a entrega estiver pronta para revisão/PR;
- voltar para a skill de domínio se o gate revelar bug funcional;
- usar `harden-module` se surgir dívida estrutural não tratada;
- usar `docs-reconciliation` se a alteração exigir atualização documental formal.
---

## Formato de entrega
Responder com:
```
## Verification gate

### Escopo revisado
- objetivo:
- capability / infra:
- caminhos principais:

### Estado do repositório
- modified:
- untracked:
- fora de escopo:

### Validações
| Comando | Status | Observação |
|---|---|---|
| `pnpm run lint` | PASS / FAIL / NOT RUN | ... |
| `pnpm test` | PASS / FAIL / NOT RUN | ... |
| `pnpm run build` | PASS / FAIL / NOT RUN | ... |

### Warnings
- warning 1:
- warning 2:

### Riscos ou pendências
1. ...
2. ...
3. ...

### Veredito
- READY / READY WITH CAVEAT / NOT READY
``` 
---

## Regras finais
- Não confundir git diff vazio com ausência de arquivo novo.
- Não substituir comando real por inferência.
- Não chamar validação de completa sem evidência.
- Não absorver escopo extra durante o fechamento.
- Não preparar PR “verde” se o gate terminou como NOT READY.
---

## Definition of done
- o escopo real do diff foi confirmado;
- modified e untracked foram explicitados;
- as validações corretas foram executadas ou justificadamente dispensadas;
- warnings e pendências foram registrados;
- o veredito final ficou claro;
- o próximo passo ficou evidente.
