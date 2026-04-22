# RebanhoSync — Contexto Operacional do Projeto

## Objetivo do projeto
RebanhoSync é uma plataforma offline-first para gestão pecuária, mobile-first, com foco operacional.
O objetivo atual NÃO é expandir escopo de forma oportunista.
O objetivo atual é preservar coerência arquitetural, reduzir deriva semântica e sustentar uso real com segurança.

## Estado atual assumido
- MVP funcional já existe.
- O projeto está em transição para SLC operacional inicial.
- O risco principal já não é "falta de feature".
- O risco principal é regressão arquitetural, semântica ou operacional.

## Princípios inegociáveis
1. Offline-first não é detalhe de implementação; é restrição de produto.
2. Two Rails é obrigatório:
   - Rail 1: agenda mutável / intenções operacionais.
   - Rail 2: eventos append-only / fatos ocorridos.
3. Não misturar agenda mutável com trilha factual.
4. Não misturar UI, regra de domínio, montagem de payload, efeitos colaterais e reconciliação no mesmo módulo.
5. Rollback deve ser determinístico.
6. Sync deve preservar idempotência.
7. RLS e fronteiras multi-tenant não podem ser enfraquecidas.
8. Não introduzir abstrações novas sem justificativa concreta de hotspot repetido.
9. Não criar nomenclaturas novas se já existir taxonomia consolidada no projeto.
10. Não alterar regra sanitária, reprodutiva ou semântica operacional sem declarar impacto explicitamente.

## Regras de trabalho
Ao receber uma tarefa:
1. Ler primeiro os arquivos e testes relevantes.
2. Explicitar entendimento do problema antes de propor patch.
3. Mapear áreas afetadas.
4. Identificar riscos arquiteturais, operacionais e de regressão.
5. Preferir patch mínimo, seguro e reversível.
6. Validar com testes/lint/build quando aplicável.
7. Atualizar somente documentação impactada.
8. Registrar claramente o delta real da iteração.

## Formato esperado de resposta
Responder preferencialmente nesta ordem:
1. Entendimento
2. Áreas afetadas
3. Riscos
4. Recomendação
5. Patch proposto
6. Validação
7. Delta documental

## O que evitar
- Refatoração ampla sem necessidade explícita.
- Reescrever módulos estáveis só por estética.
- Introduzir dependência nova sem motivo forte.
- Duplicar regra canônica em mais de uma camada.
- Espalhar regra de domínio por componentes, páginas ou hooks.
- Alterar contratos silenciosamente.
- "Melhorar UX" quebrando semântica operacional.
- Gerar agenda histórica impossível para animal inelegível.
- Tratar protocolo oficial, template canônico, custom e overlay como a mesma camada.

## Hotspots do projeto
Dar atenção extra quando a tarefa tocar:
- agenda / agenda_itens
- eventos append-only
- protocolos sanitários e geração de agenda
- taxonomia animal
- reprodução / pós-parto / cria
- sync, fila, optimistic update, rollback
- Dexie / PowerSync / reconciliação
- RLS / fronteiras tenant
- documentação canônica do estado atual

## Critérios de aceite arquiteturais
Uma mudança só é aceitável se:
- preserva comportamento offline-first;
- preserva coerência Two Rails;
- não enfraquece rollback ou idempotência;
- não cria duplicação semântica;
- não aumenta acoplamento indevido;
- mantém ou melhora testabilidade;
- documenta o delta real se houve impacto estrutural.

## Critérios de documentação
Ao atualizar docs:
- comparar código atual vs docs atuais;
- atualizar só os arquivos impactados;
- registrar avanço real, pendência, regressão, risco e dívida;
- não reescrever a árvore documental inteira sem necessidade.

## Quando houver dúvida
Na dúvida:
- perguntar menos;
- inspecionar mais;
- assumir menos;
- preferir solução conservadora e explícita.

## Linguagem operacional
Preservar consistência nos verbos e superfícies do produto.
Distinguir claramente:
- abrir fluxo completo
- concluir direto
- rotina guiada
- configurar/gerenciar
- retorno contextual

Nunca colapsar essas classes de ação em rótulos ambíguos.

## Guardiões especializados adicionais
Quando a tarefa envolver protocolos, usar o protocol-surface-reviewer.
Quando a tarefa envolver taxonomia canônica animal, usar o taxonomy-reviewer.

## Regras específicas de protocolos
- Catálogo oficial, template canônico, customização por fazenda e overlay runtime são camadas distintas.
- A superfície principal não deve exibir duplicação confusa para a mesma family_code.
- Geração de agenda deve passar por gate único.
- Elegibilidade deve anteceder expansão de agenda.
- Reaplicação de packs deve ser idempotente.

## Regras específicas de taxonomia
- taxonomy_facts persistidos não devem ser duplicados como eixos derivados independentes.
- Derivação deve permanecer centralizada.
- Writer precedence e ownership por fato não podem ficar implícitos.
- Reporting SQL apoia inspeção; não deve virar fonte paralela de verdade sem decisão explícita.