# RebanhoSync — AGENTS.md

Dispatcher principal para agentes que atuam no RebanhoSync.
Objetivo: executar tarefas com o menor contexto necessário, preservar contratos do domínio e impedir ampliação implícita de escopo, autorização ou superfície de mudança. Este arquivo é a única autoridade interna de roteamento de contexto e skills.

---

## 1. Bootstrap obrigatório

Antes de atuar:
1. Leia `.agents/rules/CORE_RULES.md`.
2. Leia `.agents/rules/CONTEXT_LOADING.md`.
3. Leia `.agents/rules/no-broad-context.md`.
4. Leia o `AGENTS.md` local da pasta afetada, se existir.
5. Determine:
   - objetivo real;
   - tipo da tarefa;
   - arquivos/áreas provavelmente afetados;
   - fonte de verdade aplicável;
   - validação proporcional esperada.

Não carregue todo o repositório, todos os documentos, rules, skills ou outros `AGENTS.md` por padrão.
`.agents/archive/**`, `docs/archive/**` e scripts arquivados são históricos. Não são fontes operacionais, salvo solicitação explícita ou necessidade comprovada.

---

## 2. Classifique a tarefa antes de agir

Use um único modo principal:
- `DISCOVERY` — localizar contratos, arquivos, dependências ou causa provável;
- `DIAGNOSIS` — analisar comportamento sem alterar arquivos;
- `IMPLEMENTATION` — modificar somente o escopo autorizado;
- `VERIFICATION` — validar uma entrega já implementada;
- `DOCUMENTATION` — alterar documentação sem mudar runtime;
- `PR_PREPARATION` — preparar entrega já validada.

Revisão, diagnóstico ou auditoria não autorizam implementação.
Descoberta não autoriza correção automática.
Validação não autoriza ampliar escopo.
Preparação de PR não autoriza merge.

---

## 3. Precedência

Respeite a hierarquia de instruções do runtime.
Dentro do repositório, aplique:
1. tarefa atual;
2. `AGENTS.md` aplicável ao diretório;
3. `.agents/rules/CORE_RULES.md`;
4. demais rules obrigatórias;
5. skill principal;
6. no máximo uma skill de apoio;
7. prompts/templates pertinentes.

`CONTEXT_LOADING.md` é a autoridade interna para roteamento de contexto e skills.

Uma camada inferior nunca pode:
- ampliar autorização;
- relaxar segurança;
- transformar diagnóstico em implementação;
- autorizar operação destrutiva;
- substituir contrato implementado por documentação ou prompt.

Rules, skills e prompts orientam execução; não comprovam comportamento do produto.

---

## 4. Invariantes globais

Preserve:
- offline-first;
- idempotência;
- retry/replay seguro;
- reconciliação;
- recuperação após falha;
- RLS;
- multi-tenant;
- isolamento por `fazenda_id`;
- auditabilidade;
- compatibilidade local-remota.

Não:
- crie fonte paralela de verdade;
- coloque regra crítica de negócio em componente React;
- use UI como única barreira de autorização;
- exponha `service_role` no client;
- Não imprimir, persistir nem incorporar credenciais, tokens ou segredos em URLs, scripts, logs ou documentação.
- grave segredos, tokens ou credenciais em código, URL, log ou documentação;
- altere schema, migrations, seed, RLS, policies ou RPCs sem escopo explícito;
- refatore por conveniência;
- declare teste, validação ou comportamento que não tenha sido observado.

Prefira patches pequenos, reversíveis e testáveis.

---

## 5. Contratos do domínio

`CORE_RULES.md` é a referência mínima obrigatória.
Consulte `docs/context/SOURCE_OF_TRUTH.md` somente quando a tarefa exigir determinação explícita de fonte de verdade.

Antes de alterar:
- writers;
- Eventos;
- Agenda;
- `state_*`;
- sync;
- retry;
- reconciliação;
- read models;
- operações bulk;
- fluxos operacionais;

consulte `docs/architecture/OPERATIONAL_FLOWS.md`.

Contratos fundamentais:
- Agenda = intenção/tarefa futura.
- Evento = fato executado e fonte histórica.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração, não execução.
- Tags, sinais e insights = auxiliares de UX/consulta, nunca fonte primária ou regra crítica.
- Carência, venda/abate, peso confiável e aptidão operacional exigem fonte técnica explícita.

Não derive fato histórico de estado atual quando houver fonte factual apropriada.
Não transforme previsão, simulação ou recomendação em execução real.

---

## 6. Contexto mínimo por tipo de tarefa

Siga `.agents/rules/CONTEXT_LOADING.md`.
Use como referência prática:

### Tarefa localizada
Carregue:
- arquivos-alvo;
- testes relacionados;
- `AGENTS.md` local.

### UX/UI
Carregue:
- tela/componente afetado;
- primitives/tokens necessários;
- contrato UX pertinente.

Não mova regra de negócio para UI.

### Domínio
Carregue:
- contrato normativo aplicável;
- implementação existente;
- testes diretamente relacionados.

### Sync/offline
Carregue:
- persistência local;
- fila/operações;
- retry/replay;
- idempotência;
- rollback/compensação;
- reconciliação;
- autenticação quando relevante.

Considere obrigatoriamente:
- concorrência;
- duplicidade;
- sucesso parcial;
- interrupção de rede;
- fechamento/reabertura;
- reprocessamento;
- conflito local-remoto.

### Supabase/RLS
Carregue:
- migration ou objeto ativo;
- policies/RPCs relacionadas;
- contrato multi-tenant;
- callers relevantes.

Não trate permissão de UI como segurança.

### Documentação
Carregue primeiro as fontes de maior precedência e somente depois os documentos derivados.

### Auditoria transversal
Use índices e buscas dirigidas antes de expandir contexto.

---

## 7. Mobile

Ao tocar código compartilhado com Android/iOS, preserve a base React/TypeScript sempre que tecnicamente viável.

Diretrizes:
- priorizar Capacitor antes de considerar reescrita em React Native/Flutter;
- preservar Dexie/IndexedDB inicialmente;
- não introduzir storage nativo alternativo sem evidência técnica;
- manter regra de negócio independente de APIs específicas do Capacitor;
- não depender de execução contínua em background para consistência;
- tratar app suspendido, kill/restart, reconnect e autenticação expirada como casos normais;
- preservar o mesmo contrato de idempotência e sync utilizado pela aplicação web;
- separar development, staging e production;
- impedir build de produção apontando para backend não produtivo.

Mudança mobile não autoriza alterar domínio compartilhado sem necessidade demonstrada.

---

## 8. Skills e lifecycle

Use `.agents/rules/CONTEXT_LOADING.md` para seleção.
Em implementação:
- escolha uma skill principal;
- use no máximo uma skill de apoio quando existir interseção técnica concreta;
- não carregue skill apenas porque a tarefa contém termo relacionado.

Se o ponto de intervenção estiver incerto, use `repository-context-retrieval`.

Lifecycle:
```text
discovery/diagnosis
        ↓
implementation
        ↓
verification gate
        ↓
PR preparation
```
Essas etapas não devem ser confundidas.
Após implementação, use rebanhosync-verification-gate quando aplicável.
Use prepare-pr somente após a entrega estar tecnicamente validada e classificada como pronta.

---

## 9. Comandos e validação

Para comandos, pnpm, Graphify, WSL/Windows ou validação local, siga .agents/rules/rtk.md.

Não invente:
- scripts;
- flags;
- parâmetros;
- arquivos;
- comandos disponíveis.

Antes de executar comando desconhecido, confirme sua existência quando necessário.

### Validação deve ser proporcional:
- mudança localizada
→ testes diretamente relacionados
- mudança compartilhada relevante
→ validação ampliada do escopo afetado
- fechamento de fase
→ bateria definida pelos critérios de aceite

`scripts/codex/validate.ps1` exige perfil explícito:
- `focused` → mudança localizada;
- `standard` → alteração compartilhada relevante;
- `full` → somente quando escopo/risco exigirem e houver autorização.

### Quando aplicável:
- pnpm run audit:agents → governança de agentes;
- pnpm run gates:docs → contratos documentais atuais.

Não repita testes se nenhuma alteração puder modificar o resultado.
Não execute regressão global, build completo ou E2E por rotina.
Inspecione tracked, staged e untracked ao revisar ou fechar uma entrega.

---

## 10. Graphify

Use Graphify somente nos casos definidos em .agents/rules/GRAPHIFY_USAGE.md.

Não:
- gere ou atualize grafo para tarefa local sem impacto estrutural;
- trate o grafo como fonte superior ao código;
- use resultado de Graphify como prova isolada de comportamento.

---

## 11. Banco, migrations e operações remotas

Antes de alterar banco:
1. identifique a fonte de verdade;
2. determine impacto local/remoto;
3. avalie compatibilidade com clientes offline e versões anteriores;
4. preserve RLS e isolamento por fazenda;
5. prefira evolução forward-only;
6. considere operações pendentes de clientes antigos.

Não execute sem autorização explícita:
- migration remota;
- db push remoto;
- deploy;
- merge;
- reset destrutivo;
- limpeza de dados;
- alteração de produção;
- operação irreversível.

Criação de migration local não implica autorização para aplicá-la remotamente.

---

## 12. Condições de parada

Pare e reporte antes de modificar quando:
- o baseline necessário não puder ser confirmado;
- a fonte de verdade estiver ambígua;
- houver conflito entre contratos;
- a mudança exigir ampliar o escopo autorizado;
- a tarefa exigir operação destrutiva não autorizada;
- o repositório ou ambiente necessário não estiver acessível;
- a correção depender de comportamento não comprovado;
- houver risco de alterar produção, staging ou dados reais sem autorização.

Não substitua evidência ausente por suposição silenciosa.

---

## 13. Evidência e conclusão

Diferencie claramente:
- FATO CONFIRMADO;
- INFERÊNCIA;
- RECOMENDAÇÃO.

Uma entrega só pode ser declarada concluída quando existir evidência compatível com seus critérios de aceite.

Não declare:
- PASS;
- READY;
- CLOSED;
- problema corrigido;
- teste aprovado;

sem resultado efetivamente observado.

Falha de ambiente deve ser relatada como falha de validação, não convertida em sucesso presumido.

---

## 14. Resposta final

Use .agents/rules/RESPONSE_FORMATS.md quando houver formato específico.

Na ausência de formato obrigatório, seja conciso e registre:

decisão/veredito;
1. fatos confirmados e escopo real;
2. arquivos afetados;
3. impacto funcional/domínio/banco, quando aplicável;
4. validações executadas;
5. validações não executadas relevantes;
6. até 3 riscos ou pendências principais.

Não reproduza contexto carregado que não seja necessário para justificar a decisão.

---
