# Avaliação sanitária factual — plano de implementação

> **Encerramento vigente — 18/11/2026:** avaliação factual e correções integradas pela #302 (`main@175e9dee`); calendário/controle estratégico também integrado. Gate completo do head integrado aprovado. Compatibilidade com leitores antigos inexistentes não é critério de aceite. Checklist e NOT READY abaixo são registros históricos anteriores ao fechamento; não constituem tarefas atuais. [Evidências](../../review/CURRENT_PHASE_HANDOFF.md#consolidação-pós-302-e-validação-da-301--18112026).

> Registro histórico da execução de 16/11/2026. As tarefas e classificações abaixo refletem aquele momento; o calendário posteriormente recebeu implementação local e o critério atual de compatibilidade consta ao final deste documento.

Objetivo: registrar avaliação sem aplicação no sistema canônico de Eventos, integrá-la à Triagem e verificar a adesão por HTTP/Auth isolado. Referência: solicitação de retomada de 16/11/2026; HEAD `2d639cc3ad2f8fcc21372d82b1eef6321313cd7a` e patch não commitado da Fase 1 preservados.

- [ ] Validar a Fase 1 por serviços e banco exclusivos descartáveis, com identidades sintéticas e limpeza restrita aos recursos criados.
- [ ] Definir e implementar extensão factual aditiva sobre a admissão canônica, preservando os guards de aplicação, participantes reais, correções append-only, isolamento, replay e reconciliação. Provar contratos no PostgreSQL descartável.
- [ ] Adaptar writer local/fila e interface para os três resultados de avaliação, sem criar produto, estoque, carência ou Agenda automaticamente.
- [ ] Integrar os fatos à leitura e projeção da Triagem, distinguindo avaliação, indicação e aplicação; verificar ciclo, correção, dados insuficientes e concorrência.
- [ ] Documentar desenho futuro 5-7-9/5-6-9 sem implementá-lo; revisar o diff independente e aplicar o gate proporcional, com limitações explícitas.

Não aplicar migration remotamente, alterar dados reais, ativar a foundation V3, fazer commit, push, merge ou deploy. Uma ausência de suporte no contrato atual exige extensão fundamentada, não equivale por si só a bloqueio.

## Evidência parcial de 16/11/2026

- HTTP/Auth da adesão: `tests/codex/protocol-adoption-http.local.mjs` passou 1/1 com Auth, PostgREST, PostgreSQL e handler exclusivos. Fila Dexie até HTTP real/reconnect não foi exercitada em uma única prova.
- Extensão local V3 para `avaliacao`, sem produto farmacológico: `node --test tests/codex/sanitary-assessment-v1.local.mjs` passou 1/1 em PostgreSQL descartável, incluindo concorrência, participantes, RBAC, correção, replay, datas e efeitos farmacológicos. A flag de foundation não foi ativada fora da fixture.
- Vitest com oito arquivos de triagem, histórico, UI, fila e Edge: 99 testes passaram; ESLint focado e gates documentais passaram. Uma tentativa anterior com vários processos sofreu timeout e foi repetida com um worker.
- Revisão independente identificou e levou a corrigir replay de correção, data futura, correção anterior ao original, participantes e projeção de correção órfã. Conflitos entre avaliações independentes são exibidos e bloqueiam novo registro, mas ainda não possuem resolução na interface.
- Comparação TypeScript virtual com baseline encontrou um diagnóstico novo em `Eventos.tsx`; o consumidor foi ajustado para recusar complemento genérico de avaliação, e uma nova verificação dirigida não apresentou esse diagnóstico. O typecheck global permanece com erros preexistentes.
- `sanitaryAssessmentV1.test.ts` passou 7/7, incluindo ACK perdido com reinício, preservação de identidade e chamada de pull, além de sessão ausente antes do envio; rede e pull foram simulados. Ainda falta comprovar esses caminhos no percurso HTTP/Auth real e a compatibilidade integral de clientes anteriores. Portanto, a entrega factual permanece **NOT READY** para liberação.
- O desenho da Fase 3 está em `docs/superpowers/specs/2026-11-16-controle-estrategico-sequenciamento-design.md`, sem implementação de calendário.

## Fechamento técnico de 16/11/2026

- A revisão independente identificou inconsistência entre animal principal e participantes, avaliação fora da janela encerrando etapa, ano civil e métricas farmacológicas indevidas. As validações Edge/SQL, a projeção por janela do fato original e o relatório foram ajustados; testes dirigidos reproduziram os defeitos e passaram após as correções.
- A Triagem mostra cada evidência conflitante e permite correção vinculada ao Evento escolhido ou nova avaliação independente. Conclusões consensuais preservam todas as evidências, sem escolher registro por timestamp; cadeia incompleta permanece inconclusiva. O ano da janela é usado em consulta que atravessa a virada.
- Em stack Supabase exclusivo, `node tests/codex/sanitary-assessment-integrated.local.mjs` passou com Dexie, Auth, handler real e PostgreSQL: ACK perdido, reinício, farm-switch, ausência de sessão, fato posterior, replay, pull e correção. Uma interrupção HTTP deliberada de uma leitura do pull foi recuperada após reinício pela obrigação de reconciliação. Ausência de sessão foi exercitada com sign-out real; expiração real de JWT não foi reproduzida.
- `node scripts/codex/validate-supabase-baseline-functional.mjs` passou em banco exclusivo marcado descartável, com Functions locais, RLS, admissão V3 e sync-batch reais. `node --test tests/codex/sanitary-assessment-v1.local.mjs` passou com a cadeia integral e fixtures de identidade, replay, correção e proteção farmacológica; o teste do Edge cobre a virada de ano no fuso de São Paulo. O gate V3 foi habilitado somente em fixture descartável.
- `tests/codex/sanitary-assessment-legacy-compat.test.ts` executa código do HEAD anterior: a Central antiga classifica avaliação recebida como Evento executado/histórico externo sem identificar o subtipo; o histórico farmacológico não inferiu dose na fixture específica. O pull antigo usa `select('*')` sem negociação de versão e o validador antigo aceita o subtipo dentro do comando V3 conhecido. Compatibilidade integral com leitor anterior, portanto, não está demonstrada.
- Os serviços e volumes exclusivos usados nesta rodada foram descartados; não se alterou a foundation remota. Os diretórios temporários foram preservados, inclusive o diretório cuja remoção recursiva fora rejeitada anteriormente.
- Classificação permanece **NOT READY** para o patch completo enquanto o contrato de leitura/rollout de clientes anteriores não impedir ou sinalizar corretamente o novo subtipo. O funcionamento local demonstrado não autoriza implantação remota. Revisão independente identificou problemas corrigidos nesta sessão, mas a reinspeção independente completa do último delta não foi concluída.

## Critério atual de compatibilidade

O produto está em desenvolvimento, sem instalações antigas ou dados operacionais legados a preservar. Por decisão explícita do produto, compatibilidade com leitores anteriores e mecanismos de rollout para essas instalações não são critérios de aceite. Os registros anteriores permanecem como histórico da investigação; autorização, isolamento por fazenda e os guards factuais V3 continuam obrigatórios.
