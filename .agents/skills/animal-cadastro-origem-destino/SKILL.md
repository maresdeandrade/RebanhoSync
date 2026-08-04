---
name: animal-cadastro-origem-destino
description: Protege identidade, cadastro-base, edição, identificação, taxonomia, proveniência, origem/destino cadastral, entrada, compra, venda, saída, óbito e estado atual do animal no RebanhoSync. Usar quando a tarefa criar, corrigir, importar, sincronizar ou auditar dados-base e transições de ciclo de vida do animal. Não usar para parto/cria, execução sanitária, movimentação física entre lote/pasto/fazendas, KPI financeiro isolado ou ajuste apenas visual/copy; combinar com a skill específica quando os fluxos se cruzarem.
---

# Animal Cadastro Origem Destino

## Missão

Preservar identidade estável, proveniência, isolamento por fazenda e separação entre cadastro-base, fatos históricos, estado atual e intenções futuras.

## Coordenação

Combinar quando necessário com:

- `reproducao-parto-posparto-cria`: nascimento, cria e vínculo mãe–Evento–cria;
- `movimentacao-transito-conformidade`: deslocamento, lote/pasto, trânsito ou GTA;
- `sanitario-registro-operacional`: execução sanitária;
- `sync-offline-rollback`: gesto, fila, retry, rollback ou reconcile;
- `migrations-rls-contracts`: schema, RLS, constraint ou RPC;
- `rebanhosync-verification-gate`: validação final.

Compra ou venda pode exigir também o contrato comercial; usar esta skill para identidade/estado do animal e a skill de movimento quando houver deslocamento físico.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `AGENTS.md` local, se existir;
6. arquivos-alvo e testes diretamente relacionados.

Carregar conforme o caso:

- `docs/domain/ANIMAIS_TAXONOMIA.md`: cadastro, identificação ou taxonomia;
- `docs/context/SOURCE_OF_TRUTH.md`: fato, estado ou proveniência;
- `docs/domain/COMPRA_VENDA.md`: compra, venda, entrada ou saída comercial;
- `docs/domain/LOTES_PASTOS.md`: consistência de lote/pasto atual;
- `docs/technical/OFFLINE_SYNC.md`: persistência, retry ou rollback;
- `.agents/rules/rtk.md`: comandos e validação.

Não carregar todas as fontes por padrão.

## Hierarquia em conflito

1. código + migrations ativas;
2. `docs/context/PROJECT_STATUS.md`;
3. docs normativos ativos;
4. docs derivados;
5. histórico em `docs/archive/**`;
6. esta skill.

## Separação canônica

| Estrutura | Papel |
|---|---|
| Cadastro-base do animal | Identidade estável e atributos descritivos |
| Evento | Compra, entrada, venda, saída, óbito, pesagem ou outra mudança factual |
| `state_*` ou read model equivalente | Status, lote, categoria ou condição atual, conforme o modelo existente |
| Agenda | Intenção futura; não é histórico do animal |
| Tags/sinais/insights | Apoio de UX/consulta; não são fonte primária |

## Invariantes

- Gerar e preservar identidade estável; retry/importação não pode duplicar o mesmo animal.
- Preservar `fazenda_id` e impedir vínculos cross-tenant.
- Não editar o cadastro-base para simular fato histórico.
- Mudança factual de ciclo de vida deve ter Evento compatível quando o contrato existente assim definir.
- Estado atual deve derivar ou reconciliar com os fatos, sem competir com o histórico.
- Não usar Agenda, tag, sinal ou insight como prova de estado ou histórico.
- Não inferir peso atual confiável, aptidão de venda/abate ou destino sem fonte explícita.
- Não preencher sexo, raça, categoria, lote, pasto, origem ou propriedade por default não auditável.
- Preservar offline-first, idempotência, correção auditável e rollback.

## Procedimento

### 1. Classificar a operação

Identificar: criação, edição descritiva, importação, identificação, taxonomia, proveniência, compra/entrada, venda/saída, óbito, leitura de estado atual ou correção.

Se houver deslocamento físico, cadastro originado de parto ou execução sanitária, incluir a skill de domínio correspondente.

### 2. Confirmar fontes e vínculos

Localizar no código:

- tabela/entidade de identidade-base;
- Evento e detalhes que sustentam mudanças factuais;
- read model que sustenta o estado atual;
- gesto/fila/RPC responsáveis pela persistência, se houver.

Não presumir nomes ou comportamento somente pela documentação.

### 3. Validar identidade e duplicidade

Confirmar:

- UUID/ID definido antes de persistir ou enfileirar;
- identificadores únicos dentro do escopo correto;
- chave de idempotência estável para retry/importação;
- vínculo com nascimento, compra ou entrada quando aplicável;
- colisão e merge tratados conforme contrato explícito, sem sobrescrita silenciosa.

### 4. Validar transição de estado

Verificar transições compatíveis, como ativo → vendido, ativo → morto e entrada → ativo. Confirmar que venda/óbito não deixam o animal indevidamente ativo em lote/pasto e que correção não destrói o fato original.

Agenda pendente só deve ser alterada se houver regra explícita e vínculo correspondente; não apagar tarefas por inferência.

### 5. Validar proveniência e origem/destino

Preservar o que é conhecido, declarado, importado ou documentado conforme o modelo. Ausência de origem/destino deve permanecer desconhecida ou pendente; não converter ausência em valor factual.

### 6. Validar offline e correção

Confirmar retry sem duplicação, ordem segura dos efeitos, sucesso parcial explícito, rollback e reconcile local/remoto. Correção de fato confirmado deve ser auditável e preferencialmente append-only conforme o contrato do domínio.

## Casos mínimos

- identificador ausente ou duplicado;
- importação repetida;
- animal de outra fazenda;
- nascimento/compra já vinculados;
- venda ou óbito repetido;
- animal vendido/morto ainda em lote ativo;
- agenda pendente após mudança de estado;
- origem externa incompleta;
- falha entre Evento e read model;
- duplo submit, retry offline e conflito concorrente;
- correção após sincronização.

## Validação

Seguir `.agents/rules/rtk.md` e executar no mínimo:

```bash
git status --short --untracked-files=all
git diff --check
```

Executar testes focados do fluxo animal. Para mudança de domínio crítico, usar lint e build; para entrega ampla, executar a suíte completa. Se tocar Supabase, RLS, RPC, migration ou sync-batch, executar também a validação funcional de baseline indicada nas regras.

Não executar reset, deploy, push ou habilitação de gate sem autorização explícita.

## Saída obrigatória

Informar:

1. fatos confirmados;
2. operação animal afetada;
3. identidade, proveniência e risco de duplicação;
4. Evento e estado atual envolvidos;
5. isolamento, idempotência e rollback;
6. impacto em lote/pasto, Agenda e fluxos relacionados;
7. testes e resultados;
8. riscos residuais, até três.

Separar fato, inferência e recomendação. Não inferir peso, aptidão comercial, origem, destino ou estado a partir de Agenda, tags, sinais ou defaults.
