---
name: repository-context-retrieval
description: Localiza o ponto mínimo de intervenção, os arquivos, fluxos, documentos e testes relevantes do RebanhoSync sem leitura ampla. Usar quando os arquivos afetados não estiverem claros, houver possível impacto entre módulos, divergência entre código e documentação ou necessidade de orientação antes do planejamento. Não usar quando o arquivo já for conhecido, o ajuste for local/microcopy, o patch estiver pronto para validação ou o objetivo for preparar PR.
---

# Repository Context Retrieval

## Missão

Produzir um mapa mínimo e verificável do contexto necessário para uma tarefa. Esta skill é apenas de descoberta: não implementar patch nem transformar hipótese em plano fechado.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `.agents/rules/rtk.md`, se houver comandos.

Depois, carregar somente o `AGENTS.md` local, os arquivos candidatos e o contrato específico exigido pela dúvida.

## Limites

- Não ler o repositório, todos os docs, todos os `AGENTS.md` ou todas as skills.
- Não usar `docs/archive/**` como fonte operacional.
- Não propor implementação antes de localizar a fonte correta.
- Não tratar documentação como superior a código e migrations ativas.
- Preferir `rg --files`, busca por caminho e `rg` com termo específico.
- Usar Graphify somente quando a relação entre módulos continuar incerta e `graphify-out/` existir.

## Procedimento

### 1. Classificar a tarefa

Escolher uma categoria principal:

- UI/componente local;
- fluxo de domínio;
- sync/offline;
- Supabase/RLS/migration;
- documentação;
- teste/validação;
- arquitetura/cross-module.

### 2. Escolher uma âncora

Começar por apenas uma entrada concreta:

- caminho fornecido;
- feature, rota ou tela;
- termo de domínio;
- teste;
- migration, RPC ou função;
- símbolo exportado.

### 3. Inspecionar a vizinhança mínima

Verificar, nesta ordem:

1. arquivo ou símbolo candidato;
2. `AGENTS.md` local;
3. imports, chamadores ou dependências diretas;
4. testes relacionados;
5. um documento normativo/técnico específico, somente se necessário.

Se precisar expandir, registrar a dúvida ainda não respondida, o que já foi verificado e o próximo arquivo necessário.

### 4. Identificar a camada de verdade

Classificar o ponto encontrado como:

- Agenda: intenção futura;
- Evento: fato executado;
- `state_*`: estado atual/read model;
- Protocolo: regra/configuração;
- tags/sinais/insights: apoio de UX/consulta;
- Supabase/RLS/migrations: contrato remoto;
- Dexie/sync: contrato offline/local-remoto;
- UI/adaptador: apresentação, sem regra crítica própria.

### 5. Encerrar a descoberta

Parar quando houver evidência suficiente para indicar:

- arquivos prováveis e responsabilidade de cada um;
- testes associados;
- documento estritamente necessário;
- camada de verdade;
- até três riscos de contexto incorreto;
- próxima ação ou skill adequada.

## Saída obrigatória

Separar fatos confirmados, inferências e recomendações e retornar:

1. classificação da tarefa;
2. arquivos/diretórios a inspecionar e motivo;
3. docs relevantes, somente se necessários;
4. testes relacionados;
5. camada de fonte de verdade;
6. riscos de expansão incorreta, até três;
7. próxima ação recomendada.

Não implementar patch nesta etapa.
