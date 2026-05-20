---
name: repository-context-retrieval
description: Use when a task requires understanding repository architecture, locating the correct intervention point, mapping cross-module impact, or producing a grounded technical analysis before planning or implementation.
---

# Repository Context Retrieval

## Missão
Recuperar o **mínimo contexto suficiente** do RebanhoSync para analisar, planejar ou orientar uma tarefa com segurança, sem abrir o repositório inteiro nem concluir a partir de suposições frágeis.

Use esta skill para:
- entender arquitetura e fluxos entre módulos;
- localizar o melhor ponto de intervenção;
- mapear impacto transversal;
- preparar análise, refatoração ou prompt técnico baseado no repositório.

---
## Quando usar
Use quando for preciso:
- analisar módulo, fluxo, tela ou subsistema;
- entender relação entre partes do repositório;
- descobrir onde implementar algo;
- avaliar impacto ainda não delimitado;
- verificar o que já existe antes de sugerir mudança.

Não use para:
- typo, copy ou ajuste visual local;
- correção pontual em arquivo já conhecido;
- fechamento de PR;
- execução já coberta por skill de domínio;
- hardening de hotspot já identificado.

Nesses casos, usar `prepare-pr`, `harden-module` ou a skill de domínio correspondente.

---
## Ler primeiro
Antes de abrir implementação:
1. `AGENTS.md`
2. `README.md`
3. `docs/CURRENT_STATE.md`
4. `docs/PROCESS.md`
5. `docs/AGENT_CONTEXT.md`
6. `graphify-out/GRAPH_REPORT.md`

Se existir, usar também:
```
graphify-out/wiki/index.md
```
---

## Graphify-first
Usar Graphify como mapa primário antes de busca textual ampla:
```bash
graphify query "<pergunta>"
graphify path "<conceito A>" "<conceito B>"
graphify explain "<conceito>"
```
Usar `rg`, busca textual ou leitura direta apenas para confirmar detalhe concreto ou preencher lacuna que o grafo não resolveu.
---

## Método em 3 ciclos

### 1. Enquadrar
Definir:
* problema técnico;
* domínios candidatos;
* hipóteses iniciais;
* riscos de interpretação.

Checar se a tarefa toca UI, regra de domínio, agenda/eventos, sync/offline, sanitário, reprodução, schema/RLS ou docs/governança.
---

### 2. Localizar fontes

Antes de ler código em profundidade:
* procurar `AGENTS.md` local no caminho afetado;
* verificar se há skill especializada aplicável;
* localizar arquivos centrais e testes relevantes.

AGENTS locais mais prováveis:
* `src/pages/AGENTS.md`
* `src/pages/Registrar/AGENTS.md`
* `src/pages/Agenda/AGENTS.md`
* `src/pages/ProtocolosSanitarios/AGENTS.md`
* `src/lib/offline/AGENTS.md`
* `src/lib/sanitario/AGENTS.md`
* `src/lib/reproduction/AGENTS.md`
* `supabase/functions/sync-batch/AGENTS.md`
* `supabase/migrations/AGENTS.md`

Classificar fontes:
* **Alta**: comportamento, regra, contrato ou teste central;
* **Média**: tipo, helper, adapter ou doc atual que esclarece a borda;
* **Baixa**: histórico, duplicado ou periférico.
Não abrir fontes de baixa relevância por padrão.
---

### 3. Fechar lacunas

Ler apenas:
* fontes de alta relevância;
* poucos arquivos médios indispensáveis;
* testes que esclareçam comportamento esperado.

Encerrar com:
* contexto confirmado;
* lacunas resolvidas e remanescentes;
* arquivos que sustentam a conclusão.
---

## Critério de suficiência

Só concluir análise, propor arquitetura, indicar implementação ou montar prompt técnico depois de confirmar:
* fonte de verdade;
* módulos que governam o comportamento;
* arquivos centrais;
* AGENTS locais aplicáveis;
* invariantes relevantes;
* se a mudança é local, transversal, arquitetural ou documental.

Se isso não estiver claro, explicitar a incerteza em vez de ampliar a leitura sem controle.
---

## Invariantes a preservar

Quando aplicável:
* agenda = intenção futura mutável;
* eventos = fatos append-only;
* UI não carrega regra de negócio forte;
* `fazenda_id` permanece fronteira de isolamento;
* sync/offline preserva gestures, retries, rollback e idempotência;
* sanitário operacional não se mistura com catálogo/regulatório;
* insights permanecem read-only;
* migrations, seed, RLS ou RPCs não são alterados sem pedido explícito.
---

## Escalonamento

Depois da recuperação:
* `harden-module`: hotspot localizado com mistura de responsabilidades;
* skill de domínio: borda já ficou clara;
* `prepare-pr`: implementação concluída e precisa de revisão final;
* skill documental: análise revela drift entre docs e estado real.

Skills de domínio mais prováveis:
* `sanitario-registro-operacional`
* `sanitario-catalogo-regulatorio-compliance`
* `animal-cadastro-origem-destino`
* `reproducao-parto-posparto-cria`
* `movimentacao-transito-conformidade`
* `sync-offline-rollback`
* `migrations-rls-contracts`
---

## Formato de entrega

Responder com:
```
## Conclusão executiva
- síntese curta
## O que foi confirmado
- ponto 1
- ponto 2
- ponto 3

## Arquivos centrais
1. `path/file` — motivo
2. `path/file` — motivo
3. `path/file` — motivo

## Melhor ponto de intervenção
- onde agir
- por que ali
- o que fica fora de escopo

## Riscos
1. risco 1
2. risco 2
3. risco 3

## Próximo passo recomendado
- skill ou trilha seguinte
```
---

## Regras finais

* Não abrir arquivos “por garantia”.
* Não usar documentação histórica como autoridade operacional.
* Não transformar hipótese em fato.
* Não recomendar arquitetura antes de localizar a responsabilidade atual.
* Não inventar módulo, contrato ou comportamento ausente.
* Não ampliar escopo para limpeza oportunista.
---

## Definition of done

A skill foi bem aplicada quando:
* o problema técnico foi enquadrado;
* o domínio correto foi delimitado;
* os arquivos centrais foram identificados;
* as bordas arquiteturais foram preservadas;
* a resposta ficou sustentada pelo estado real do repositório;
* o próximo passo ficou claro.
