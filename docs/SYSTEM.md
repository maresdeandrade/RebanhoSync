# Sistema e Arquitetura do RebanhoSync

> **Status:** Normativo
> **Fonte de Verdade:** Código fonte e banco de dados (migrations)
> **Última Atualização:** 2026-04-12

Este documento consolida os princípios arquiteturais (Two Rails, Offline-First, Sincronização), de segurança (Tenant, RLS, RBAC), o modelo de persistência no PostgreSQL, e os contratos assumidos pelo servidor e cliente. Substitui os antigos relatórios de arquitetura fragmentados.

---

## 1. Princípios Arquiteturais e "Two Rails"

O sistema opera com persistência local pesada no frontend via IndexedDB (offline-first), e posterior sincronização transacional via worker com o Supabase/Edge Function (`sync-batch`).

### A Separação Two Rails
O núcleo de dados adota dois "trilhos" paralelos que não devem se fundir de forma estrita via integridade referencial:
1. **Rail 1 (Agenda):** Focado em ações pretendidas no futuro (tabela `agenda_itens`). **Mutável**. Deduplicação mantida via `dedup_key`. Pode ser reprogramado e alterado infinitamente.
2. **Rail 2 (Eventos):** Focado no registro de fatos transcorridos com base numa fotografia de momento (tabelas `eventos` e `eventos_*`). **Append-only**. Não permite remoção direta ou edição em colunas de balanço/negócio, forçando eventuais "contra-lançamentos" via `corrige_evento_id` se houver necessidade de revisão histórico. Triggers no próprio Postgres (ex: `prevent_business_update`) e policies atuam neste bloqueio.

Nenhuma Foreign Key da agenda subordina o evento. Modelos lógicos conectam as pontas se necessário, preservando a imutabilidade do fato e a flexibilidade da agenda.

### Taxonomia Canônica e Estado de Compliance
Classificações como *categoria zootécnica*, *fase de vida*, e *estado reprodutivo* mudam dinamicamente a partir dos fatos consumados pelo rebanho ao longo do tempo. Elas persistem de foma agregada restrita dentro de `animais.payload.taxonomy_facts` atendendo o escopo v1, garantindo que "vacas" possam virar "secas" por eventos do Trilho 2 de forma declarativa e orgânica sem atualizações procedurais duplas pelo frontend/backend.
Da mesma forma, o sistema gerencia o *estado de compliance sanitária* (`compliance_state`) e a dependência de milestones (`history_confidence`), derivando a necessidade de protocolos de catch-up se um animal entrar no rebanho sem histórico comprovado. Essa lógica transborda do Rail 1 para o bloqueio e triagem na UI de operação.

---

## 2. Abstração do Banco (Supabase/PostgreSQL)

O banco é blindado via **Multi-tenant**. Não existe possibilidade lógica ou de query simplória de vazar dados.
- Todo esquema operacional contém o `fazenda_id`.
- Chaves estrangeiras compostas com o `fazenda_id` cimentam o perímetro para evitar que entidades cruzem fazendas em ataques ou bugs locais (anti-cross-reference).
- Catálogos de dados (`produtos_veterinarios`, `catalogo_protocolos_oficiais`) são isentos de marcação tenant por consistirem em escopos públicos/globais, possuindo caches de leitura diretos pelo cliente para não atravessar chamadas de sincronismo pesado no batch do campo.

---

## 3. Seguranças Base (RLS e RBAC)

O **Row Level Security (RLS)** não perdoará conexões externas indevidas. Ele usa `has_membership(fazenda_id)` ou outras verificações contextuais vinculadas ao caller JWT `auth.uid()`.

Papéis (`farm_role_enum`):
- **Cowboy**: Read-only universal da fazenda com permissão exclusiva ao fluxo operacional: INSERT em eventos e UPDATEs limitidos a status de tarefas e manipulação diária dos animais. Sem controle estrutural ou delegação.
- **Manager**: Além de ser um "Cowboy+", cria ou suprime áreas topográficas (Lotes e Pastos), define cronogramas ou elabora cadastros. Delegação parcial sobre acessos.
- **Owner**: Operador Root sobre a configuração do tenant/estabelecimento, além de deter direitos privativos de exclusão administrativa dos dados.

Operações delicadas de membresia usam Remote Procedure Calls do postgres com escopo fechado (`SECURITY DEFINER`), garantido `search_path = public` e checagens explícitas parametrizadas, evitando elevações laterais por subqueries abertas nas policies do Auth.

---

## 4. Estado Offline Padrão (Dexie v4)

A conectividade no ambiente de rebanho é volátil e dada como indisponível como pressuposto. Tudo nasce offline via quatro grandes eixos em IndexedDB (`Store`):
1. **`state_*`**: Clone imediato das referências e saldos das entidades, sendo alvo da `UI Otimista`.
2. **`event_*`**: Histórico linear focado em timeline pregressa para visões e plotagens locais.
3. **`queue_*`**: Fila invisível transacional englobando o log de alteração (`before_snapshot`) e sua intenção (`ops` sob `client_tx_id`).
4. **`catalog_*`** / **`metrics_events`**: Base para telemetria rotineira (erro de worker, uso de tela, retenções locais em falta de rede persistente, flush periódicos) ou referências autônomas (medicamentos pre-definidos).

Se a API remota de integração rejeitar (erro de banco remonto, anti-teleporte mal calculado, timeout longo de processamento falho de batch), o Worker local encarregado de rodar num deamon leve em loop aplicará o **Rollback** local, desfazendo a operação no `state_*` com os registros puros isolados nos snaps capturados anteriormente e guardando os dejetos para o usuário ver/ajustar mais tarde via painel de diagnósticos da agenda (`queue_rejections` com TTL estipulado).

---

## 5. Endpoints de Sincronização e Triggers (Contrato REST)

A comunicação cliente/servidor essencial de produção bate sob `/functions/v1/sync-batch`.
- Recebe lote unitário englobado (o *gesture*).
- Devolve comitiva com flag (`APPLIED`, `APPLIED_ALTERED`, `REJECTED`).
- Intervenções anti-burlamento: *Configuração de perfil e delegação de fazendas inteiras são rejeitadas por padrão nesta via da máquina pesada do offline*. Esse ponto está isolado em endpoints RPC próprios e via Supabase JS default.
- Processos baseados em automação como reagendamentos do Rail 1 acionados por um novo protocolo do trilho 2 podem rodar *Server-side*, deflagrando requisição local do worker ao final ("Post-Sync Pull" obrigatório) para buscar novidades do Postgres induzidas lá mesmo e que ainda não batem com o local.
