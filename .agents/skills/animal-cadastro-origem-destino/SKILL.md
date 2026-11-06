---
name: animal-cadastro-origem-destino
description: Protege identidade, cadastro-base, edição, identificação, taxonomia, proveniência, origem/destino cadastral, entrada, compra, venda, saída, óbito e estado atual do animal no RebanhoSync. Usar quando a tarefa criar, corrigir, importar, sincronizar ou auditar dados-base e transições de ciclo de vida do animal. Não usar para parto/cria, execução sanitária, movimentação física entre lote/pasto/fazendas, KPI financeiro isolado ou ajuste apenas visual/copy; combinar com a skill específica quando os fluxos se cruzarem.
role: domain
---

# Animal Cadastro Origem Destino

## Missão

Preservar identidade estável, proveniência, isolamento por fazenda e separação entre cadastro-base, fatos históricos, estado atual e intenções futuras.

## Coordenação

Durante implementação, esta é a skill principal quando identidade/estado cadastral for o risco dominante. Escolher no máximo uma das skills abaixo como apoio quando houver interseção técnica concreta:

- `reproducao-parto-posparto-cria`: nascimento, cria e vínculo mãe–Evento–cria;
- `movimentacao-transito-conformidade`: deslocamento, lote/pasto, trânsito ou GTA;
- `sanitario-registro-operacional`: execução sanitária;
- `sync-offline-rollback`: gesto, fila, retry, rollback ou reconcile;
- `migrations-rls-contracts`: schema, RLS, constraint ou RPC;
- `rebanhosync-verification-gate`: usar depois do patch, como fase lifecycle separada, não como apoio simultâneo.

Quando competências adicionais forem necessárias, alternar sequencialmente as skills dentro da mesma entrega autorizada, mantendo uma principal e no máximo uma skill de apoio por subetapa e preservando decisões e evidências entre elas. Interromper somente se houver ampliação real de escopo, autorização insuficiente ou risco crítico não resolvido.

Compra ou venda pode exigir também o contrato comercial; usar esta skill para identidade/estado do animal e a skill de movimento quando houver deslocamento físico.

## Leitura inicial

Reutilize o bootstrap único de `AGENTS.md`; não releia rules já carregadas por referência nesta skill. Leia o `AGENTS.md` local da área afetada, arquivos-alvo e testes diretamente relacionados.

Carregar conforme o caso:

- `docs/domain/ANIMAIS_TAXONOMIA.md`: cadastro, identificação ou taxonomia;
- `docs/context/SOURCE_OF_TRUTH.md`: fato, estado ou proveniência;
- `docs/domain/COMPRA_VENDA.md`: compra, venda, entrada ou saída comercial;
- `docs/domain/LOTES_PASTOS.md`: consistência de lote/pasto atual;
- `docs/technical/OFFLINE_SYNC.md`: persistência, retry ou rollback;
- `.agents/rules/rtk.md`: comandos e validação.

Não carregar todas as fontes por padrão.

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Esta skill não substitui código, migrations ou documentos normativos ativos.

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

Se houver deslocamento físico, cadastro originado de parto ou execução sanitária, decidir qual domínio é principal e, no máximo, qual será a única skill de apoio.

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

Selecionar testes focados e lint/build conforme o delta, risco e `.agents/rules/rtk.md`; domínio crítico, por si só, não torna build obrigatório. Suíte ampla/E2E somente quando o escopo e o risco justificarem e houver autorização pertinente. Se o contrato remoto Supabase/RLS/RPC/migration/sync-batch for efetivamente afetado, executar a validação funcional de baseline indicada em `rtk.md`.

Não executar reset, deploy, push ou habilitação de gate sem autorização explícita.

## Saída obrigatória

Resumir a operação e os arquivos afetados, fatos confirmados e contratos pertinentes (identidade, proveniência, Evento/estado, isolamento, idempotência e rollback), distinguindo inferências e recomendações. Registrar comandos/testes executados e resultados, verificações não executadas com motivo e até três riscos residuais. Omitir categorias não afetadas.

Separar fato, inferência e recomendação. Não inferir peso, aptidão comercial, origem, destino ou estado a partir de Agenda, tags, sinais ou defaults.
