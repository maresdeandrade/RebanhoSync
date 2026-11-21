# Bloco 1 — Consolidação J01–J05

Baseline: `codex/j04-invites-members-auth@157376d9`, patch J04 não commitado preservado. Somente validação e correções locais; sem J06, push, merge, deploy ou migration remota.

A matriz JSON contém causa, cenário, evidência original, consequências para usuário e integridade, intervenção mínima, banco e aceite de cada linha. IDs de cenários são aliases e não somam defeitos.

| Grupo | Origens | Problema | Situação | Banco | Aceite |
|---|---|---|---|---|---|
| B1-01 | J05-06 | Autoridade e gravação concorrente das flags | corrigido localmente | Nova migration 20261121023104; J04 preservada. | block1-security.local.test.mjs; block1-concurrency.local.test.mjs; Chromium: owner desatualizado rejeitado, recarga e gravação válidas preservam chaves. |
| B1-02 | J05-01 | Persistência do perfil complementar | corrigido localmente | Sem SQL: PK/FK e RLS self existentes são suficientes. | PerfilPersistence; SQL RLS; Chromium primeiro save, update, reload, nova sessão, identidade estrangeira, rede; zero linha simulado na fronteira. |
| B1-03 | J05-03 | Horário de silêncio inválido | corrigido localmente | Nenhuma. | PerfilPersistence; sanitaryReminders; Chromium: intervalo inválido sem save e 22:00–06:00 persistido/recarregado. |
| B1-04 | J02-01 | Validação da área da fazenda | corrigido localmente | Preservar constraint atual. | CriarFazendaValidation: zero/negativo não chamam RPC; Chromium negativo. |
| B1-05 | J02-02 | Conclusão coerente do onboarding | corrigido localmente | Nenhuma; nenhum novo campo obrigatório. | OnboardingInicial.e2e.test.tsx e Chromium MG sem município; navegação já existente preservada. |
| B1-06 | J04-CUX01 | Ações financeiras oferecidas ao cowboy | corrigido localmente | Sem alteração de RLS/permissão. | FinanceiroSubmit (owner/cowboy); Chromium; policies ativas verificadas. |
| B1-07 | J04-F06, J05-02 | Tratamento de erros estruturados | corrigido localmente | Nenhuma. | PerfilPersistence erro estruturado e rede; regressão J04 de mensagem/retry. |
| B1-08 | J04-F01 | Carregamento da equipe sem perfil | corrigido localmente | Nenhuma. | Membros.test.tsx |
| B1-09 | J04-F02 | Prévia e contexto de aceite | corrigido localmente | J04 acrescenta fazenda_id à prévia. | AcceptInvite e InviteAuthContinuity |
| B1-10 | J04-F03 | Contato inválido no convite | corrigido localmente | Migration J04. | InviteMemberDialog e member-invites SQL |
| B1-11 | J04-F04 | Atualização da lista de convites | corrigido localmente | Nenhuma. | Membros.test.tsx |
| B1-12 | J04-F05 | Contador de convites | corrigido localmente | Nenhuma. | Membros.test.tsx |
| B1-13 | J04-SC01 | Destinatário, replay e reingresso | corrigido localmente | Migration J04. | member-invites.local.test.mjs + prova Auth/concorrência original J04 preservada |
| B1-14 | J04-SC02 | Proteção de proprietário e último owner | corrigido localmente | Migration J04. | member-invites.local.test.mjs + concorrência real original J04; integração com trigger retestada |
| B1-15 | J05-04 | Tema Sistema durante mudança do SO | aberto; não bloqueante neste recorte | Nenhuma. | Futuro: alternar prefers-color-scheme com página aberta; evidência J05 preservada, sem repetir agora. |
| B1-16 | J02-04, J03-U01, J03-S07, J05-05 | Descarte de rascunhos entre navegação, recarga e fazenda | candidato; consolidado sem implementação | Não necessária para aviso. | Futuro: navegar/voltar/trocar fazenda, manter edição ou descartar explicitamente, sem submissão/duplicação. |
| B1-17 | J03-U02, J03-U05, J04-U02 | Fazenda ativa e alcance do salvamento | candidato | Nenhuma nova fonte. | Futuro: duas propriedades e papéis diferentes, duas abas e viewport mobile. |
| B1-18 | J02-05, J03-U03, J04-U01 | Terminologia, obrigatoriedade e básico/avançado | candidato | Nenhuma. | Futuro: tarefa de primeiro acesso e entendimento de controles indisponíveis. |
| B1-19 | J03-U04 | Estado local e confirmação remota | candidato | Nenhuma. | Futuro: fila vazia, pendente, offline e confirmação desconhecida. |
| B1-20 | J02-06 | Estados vazios e primeiros passos | candidato | Nenhuma. | Futuro: fazenda vazia versus rebanho filtrado. |
| B1-21 | J04-U03 | Aviso de convite duplicado ou membro existente | candidato | Não aprovar constraint nova por hipótese. | Futuro: dois convites, contato por email/telefone, expirado/cancelado e membro ativo. |
| B1-22 | J04-U04 | Continuidade na recuperação do convite | corrigido localmente na continuidade implementada; ajuda adicional candidata | Nenhuma adicional. | InviteAuthContinuity vigente. |
| B1-23 | J04-U05 | Entrega de convite e informação de equipe | parcialmente corrigido na J04; evolução candidata | Nenhuma. | InviteMemberDialog; futuro: clareza de compartilhamento/data de ingresso. |
| B1-24 | J02-03 | Etapas produtivas e ciclo completo | candidato dependente de validação | Somente se modelo futuro for aprovado; não implementado. | Futuro: requisito de produto validado; não confundir Corte, Mista ou modo Completo. |
| B1-25 | J01 (observations.recovery_available) | Recuperação de senha não exposta | aberto; fora das correções autorizadas | Não determinada. | J01 original preservada; nenhum recovery novo executado. |
| B1-26 | J01 (observations.failed_requests) | Request de logout abortado | não reproduzido como defeito funcional | Nenhuma. | Evidência J01 original; nenhuma repetição de jornada. |

## Melhorias recomendadas, sem implementação automática

| Prioridade | Tema e proposta | Benefício | Fonte existente | Custo | Risco |
|---|---|---|---|---|---|
| P1 | Contexto e escopo: Nome/código da fazenda, papel e salvamento pessoal ou da fazenda | Evitar alteração no contexto errado. | fazendas, user_fazendas.role, active_fazenda_id e user_settings | baixo | baixo; não derivar autorização da apresentação |
| P1 | Rascunhos: Confirmação única de descarte e retorno à edição | Reduzir retrabalho sem salvar automaticamente. | Estado do formulário e rotas existentes; chave por usuário/fazenda se houver rascunho | médio | médio; bloqueio de navegação e vazamento entre fazendas |
| P1 | Notificações: Explicar canal in-app, categorias, opções indisponíveis e horário local | Permitir configurar efeitos que existem. | user_settings.notifications, Agenda e SanitaryNotificationManager | baixo | baixo; não prometer push/SMS/email |
| P2 | Obrigatoriedade e mobile: Marcar campos obrigatórios/opcionais e organizar seções longas | Reduzir tentativas e scroll sem novos campos obrigatórios. | Formulários e componentes atuais | baixo a médio | baixo a médio; foco, teclado e navegação inferior |
| P2 | Terminologia e controles avançados: Traduzir papéis por capacidades e explicar efeito dos parâmetros | Melhorar compreensão e evitar mudanças acidentais. | Membership, metadata e contratos implementados | baixo a médio | médio; preservar valores e dimensões de classificação |
| P2 | Primeiros passos: Distinguir vazio real de recorte e destacar ação inicial | Ajudar a iniciar operação sem criar registros automaticamente. | Contagens e atalhos existentes | baixo | baixo; isolamento e leitura consistente |
| P2 | Sync e confirmação: Explicar pendência local versus confirmação remota e recuperação | Permitir continuar trabalhando e reconhecer pendências. | Fila, saúde de sync e reconciliação atuais | médio | médio; não emitir confirmação fictícia |
| P2 | Equipe e multi propriedade: Exibir código/identificação e informação factual de ingresso | Distinguir propriedades e compreender equipe. | fazendas.codigo, membership.accepted_at; contagens existentes | baixo | baixo a médio; não derivar histórico do estado atual |
| P3 | Convites repetidos: Avisar vínculo/convite existente antes de nova emissão | Reduzir links redundantes sem impor unicidade incorreta. | farm_invites e user_fazendas já protegidos | médio | médio; email/telefone, expiração, cancelamento e concorrência |
| P3 | Tema Sistema: Acompanhar mudança do SO com listener e cleanup | Evitar necessidade de recarregar. | matchMedia e preferência theme existente | baixo | baixo; cleanup e modos claro/escuro |
| Validação | Etapas produtivas e área pecuária: Validar necessidade de atributos opcionais antes de modelar | Benefício depende de decisão operacional demonstrada. | Cadastro atual não determina etapas nem área efetivamente pecuária | médio a alto | alto se inferido ou tornado obrigatório |
| Validação | Indicadores e informações derivadas: Priorizar informação já calculável conforme decisão do usuário | Benefício precisa de validação de uso e cobertura. | Read models e indicadores atuais; sem nova fonte factual | médio | médio; escopo observado não é contabilidade completa |

## Rejeitadas neste recorte ou dependentes de validação

- Novos campos obrigatórios sem necessidade operacional comprovada.
- Ciclo completo inferido de Corte, Mista ou modo Completo.
- Unidade pessoal concorrente com unidade da fazenda.
- Push, SMS ou email novos neste recorte.
- Parâmetros técnicos de fila/background expostos por rotina.
- Nova fonte de identidade/autorização no perfil ou user_metadata.
- Regra de unicidade de convite sem semântica de contato/replay aprovada.

Etapas produtivas, área pecuária, novas preferências de indicadores e dados derivados permanecem hipóteses dependentes de validação de uso/fonte. Não foram modelados nem implementados.

## Evidências e limites

- SQL: `security-red.txt`, `security-green.txt`, `security-j04-final.txt` e `concurrency.txt`.
- UI: `profile-red.txt`, `functional-red.txt`, `unit-final.txt`; Chromium: `browser-result.json`, `browser-final.txt` e `screens/`.
- Reversão por owner desatualizado reproduzida em `browser-stale-red.txt`; rejeitada após gravação condicional.
- Baseline funcional: `baseline-functional.txt`, somente backend descartável 54421/54422.
- Lint: `lint.txt`; governança documental: `docs-gates.txt`; preservação: `preservation-final.json`.
- Resultado e classificação finais: `final-result.json`. Suíte global/build/aparelho físico não executados; evidência focal conforme contratos alterados.
- Sem upload de avatar e sem novos canais de notificação.
- J04 e a nova migration estão aplicadas somente localmente neste recorte; integração/publicação remota continuam pendentes de autorização.
