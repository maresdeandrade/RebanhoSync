```markdown
# Sanitário — Local Agent

Atualizado em: 2026-06-01  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/sanitario/**

```

Também pode tocar, somente se necessário:

* `src/components/sanitario/`
* `src/pages/Registrar/`
* `src/pages/Agenda/`
* `src/pages/ProtocolosSanitarios/`
* `src/pages/Eventos.tsx`
* `src/lib/events/`
* `src/lib/reports/`
* `src/lib/insights/`
* `src/features/operationalInsights/`

Não abrir outros domínios sem motivo explícito.

### Leitura mínima

* `AGENTS.md` da raiz.
* `.agents/rules/CORE_RULES.md`.
* `.agents/rules/CONTEXT_LOADING.md`.
* `docs/domain/SANITARIO.md`.
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`.

### Ler apenas se necessário:

| Situação | Ler |
| --- | --- |
| Offline/cache/sync | `src/lib/offline/AGENTS.md`, `docs/technical/OFFLINE_SYNC.md` |
| RLS/migration/RPC | `docs/technical/SUPABASE_RLS.md` |
| Status do projeto | `docs/context/PROJECT_STATUS.md` |
| UX/copy sanitário | `docs/ux/COPY_GUIDELINES.md` |
| Manual do usuário | `docs/manuals/screens/SANITARIO.md`, se a tarefa for suporte/manual |
| Insights/sinais | `src/lib/insights/AGENTS.md`, `src/lib/insights/README.md` |
| Relatórios | `src/lib/reports/**`, se a tarefa tocar resumo operacional |
| Eventos | `src/lib/events/**`, se a tarefa criar/corrigir fatos |

## Foco deste diretório

* Biblioteca canônica de protocolos.
* `calendario_base`.
* Catálogo oficial regulatório.
* Overlay operacional/compliance.
* Produtos veterinários.
* Materialização operacional em protocolo, agenda e evento.
* Read models sanitários compartilhados.
* Ocorrências de biossegurança.
* Suspeitas/doenças notificáveis.
* Exceções e reconciliação sanitária.
* Sinais sanitários limitados por fonte.

## Modelo mental obrigatório

Existem camadas distintas:

* base regulatória oficial;
* overlay operacional do pack;
* protocolos operacionais da fazenda;
* agenda sanitária;
* evento sanitário;
* compliance/checklist contextual;
* ocorrência clínica/biossegurança;
* sinais/read models auxiliares.

Essas camadas não devem competir como se fossem a mesma coisa.

### Regras centrais:

* `calendario_base` é semântica declarativa; não reduzir tudo a `intervalo_dias`.
* catálogo global pode ser cacheado localmente, mas não vira fonte tenant-scoped.
* pendência futura vive na agenda.
* evento passado continua append-only.
* protocolo é regra/configuração, não execução.
* carência sanitária exige evento sanitário estruturado.
* checklist regulatório disponível é contexto, não pendência.
* biossegurança é ocorrência contextual, não checklist obrigatório geral.
* doença notificável exige suspeita/caso vinculado a animal/lote/evento.
* correção sanitária é novo fato vinculado, não update destrutivo.
* livre de carência não autoriza venda/abate.

## Invariantes obrigatórias

* Não quebrar semântica de `calendario_base`: `mode`, `anchor`, `label`, `campanha`, `janela`, `recorrência`.
* Não voltar protocolo padrão para dentro da UI hardcoded.
* Não duplicar regra entre Registrar, Agenda, Relatórios e overlays.
* Preservar `produtos_veterinarios` como referência estruturada.
* Não quebrar read model regulatório compartilhado.
* Não misturar documento/checklist regulatório com evento sanitário bruto sem motivo claro.
* Não reintroduzir aftosa como calendário base default.
* Não tratar agenda/protocolo/checklist como evento sanitário.
* Não usar ausência de runtime de compliance como não conformidade.
* Não usar ausência de suspeita clínica como tarefa pendente.
* Não criar pendência geral de fazenda para confirmar ausência de doença.
* Não transformar carência sanitária em: liberação sanitária final, aptidão comercial, pronto para venda, apto para abate.

## Protocolos e versionamento

* `logical_item_key` identifica etapa lógica.
* `protocolos_sanitarios_itens.id` identifica versão física.
* `protocol_item_version_id` deve ser usado por agenda/evento.
* `protocol_item_snapshot` preserva regra histórica.
* Não reabrir fallback operacional para `protocol_item_id` legado.
* Mudança semântica em etapa de protocolo deve gerar nova versão.
* Evento antigo nunca deve ser reinterpretado pela versão ativa atual.

## Agenda

Agenda é intenção.

Pode representar:

* próxima tarefa sanitária;
* pendência materializada;
* pendência corretiva específica vinculada a ocorrência/evento.

Agenda não representa:

* histórico;
* execução;
* prova de conformidade;
* ausência de doença;
* checklist regulatório disponível.

## Evento sanitário

Evento sanitário é fato append-only.

Deve ser fonte primária para:

* produto aplicado;
* lote/validade;
* dose;
* via;
* responsável;
* carência;
* custo;
* baixa de estoque;
* rastreabilidade;
* histórico.

Correções devem gerar novo evento vinculado ao evento original. Não editar evento histórico destrutivamente para corrigir passado.

## Compliance, checklists e biossegurança

* Catálogo regulatório ativado = contexto.
* Overlay contextual ≠ pendência.
* Checklist disponível ≠ tarefa obrigatória.
* Ausência de runtime ≠ não conformidade.
* Runtime pendente/ajuste necessário = acionável.
* Biossegurança padrão = `sem_ocorrencia_informada`.
* `sem_ocorrencia_informada` não significa “conforme”.
* Biossegurança vira formulário apenas se usuário registrar ocorrência.
* Pendência corretiva nasce apenas de ocorrência real com `gera_pendencia=true` e prazo.
* `feed_ban` pode manter tratamento específico se houver regra técnica explícita.

## Doenças notificáveis

* Doença notificável não é pendência geral.
* Suspeita notificável exige `animal_id`, `animal_ids` ou `lote_id`.
* Com animal, pode seguir `alerta_sanitario` + `sanitario_casos`.
* Com lote sem animal, registrar em evento/payload até existir caso coletivo por lote.
* Nunca criar tarefa para usuário confirmar ausência de doença.
* Notificação pendente só nasce de ocorrência real.

## Exceções e reconciliação

A Fase 5 deve preservar o histórico.

Exceções podem incluir:

* evento sem produto;
* evento sem lote de estoque;
* evento sem custo;
* evento sem dose/via;
* estoque vencido na data do evento;
* baixa ausente/duplicada;
* custo inconsistente;
* carência incompleta;
* ocorrência aberta;
* pendência corretiva vencida.

Correções permitidas:

* complemento de rastreabilidade;
* correção de custo;
* correção de lote;
* estorno de baixa;
* contra-lançamento;
* resolução/cancelamento de ocorrência;
* encerramento de pendência corretiva.

Regra: correção é novo fato vinculado.

## Checagens antes de alterar

* A mudança é regulatória, operacional, evento, agenda, compliance, insight ou relatório?
* A regra deveria viver em `baseProtocols`, `officialCatalog`, `compliance`, `attention`, read model ou evento?
* A agenda resultante continua explicável?
* A mudança afeta filtros, labels ou superfícies read-only?
* Há impacto em offline cache do catálogo?
* Há evento sanitário estruturado suficiente para qualquer sinal de carência?
* Existe risco de duplicar lógica entre página, agenda e evento?
* Existe risco de usar protocolo como execução?
* Existe risco de usar ausência de pendência como prova sanitária?
* Existe risco de checklist contextual virar pendência operacional?
* Existe risco de editar destrutivamente evento histórico?
* Existe risco de reabrir `protocol_item_id` legado?

## Evitar

* Duplicar lógica entre `Registrar/`, `Agenda/` e relatórios.
* Salvar campo derivado que deveria ser projeção.
* Criar texto livre quando já existe referência estruturada.
* Usar ausência de pendência como prova sanitária.
* Usar protocolo isolado como execução.
* Usar checklist como conformidade universal.
* Criar regra sanitária crítica dentro da UI.
* Inferir aptidão comercial por carência.
* Criar pendência geral para biossegurança.
* Criar pendência geral para doença notificável.
* Corrigir evento histórico por update destrutivo.
* Usar tag/sinal como fonte primária.

## Entrega esperada

* Diff mínimo.
* Regra alterada em uma frase.
* Até 3 riscos.
* Testes focados por superfície afetada.
* Fonte primária declarada quando envolver carência, agenda, evento, compliance ou ocorrência.
* Limitação explícita se a fonte for parcial.
* Veredito claro se a mudança afeta: agenda, evento, protocolo, compliance, ocorrência, insight, relatório, Supabase/RLS.

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build

```

Se tocar migration, RLS, RPC, seed, sync ou materialização remota:

```bash
supabase db reset
node scripts/codex/validate-supabase-baseline-functional.mjs

```

Se tocar áreas sanitárias críticas:

```bash
powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/sanitario","src/lib/events","src/pages/Registrar","src/pages/Agenda","src/lib/insights","src/features/operationalInsights","src/lib/reports","src/components/sanitario","supabase/migrations"
graphify update .
git diff --check

```

## Quando escalar

* Se mudar seleção do pack oficial, contrato regulatório ou modelo de materialização: revisar migration/DB.
* Se mudar invariante de agenda automática: revisar `supabase/migrations/`.
* Se mudar contrato normativo do domínio: avaliar ADR.
* Se tocar sync, rollback ou cache offline: consultar `src/lib/offline/AGENTS.md`.
* Se tocar sinais de carência, biossegurança ou exceções: consultar `src/lib/insights/AGENTS.md`.
* Se tocar correção histórica: validar se o evento original permanece preservado.

---

```

```