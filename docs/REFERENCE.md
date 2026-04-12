# Referência Rápida (RebanhoSync)

> **Status:** Derivado (Inventário)
> **Última Atualização:** 2026-04-12

Este documento consolida referências vitais para o ambiente de desenvolvimento, facilitando o descobrimento de caminhos-chave do projeto e a navegação da stack.

---

## 1. Stack Tecnológico Principal

- **Interface:** React ^19.2.3, Vite ^6.4.1, Tailwind CSS, Radix UI & shadcn/ui. Form/Validação via react-hook-form e zod. Gráficos com recharts.
- **Ambiente de Dados Remotos:** Supabase JS (Auth, Postgres, Edge Functions) & TanStack React Query ^5.56.2 para ponte de rede.
- **Armazenamento e Offline:** Dexie ^4.3.0 e dexie-react-hooks para armazenamento e visualização reativa client-side permanente (IndexedDB).
- **Testes e Qualidade:** Vitest e Testing Library (testes de DOM com fake-indexeddb). ESLint e Prettier para controle estático de qualidade.
- *Nota:* Sem renderização SSR pesada via Next.js. O app baseia-se em Code Splitting rigoroso e Padrões Lazy em cliente.

## 2. Mapa do Repositório (`/src` e Backend)

### Rotinas e Serviços Locais (`/src`)
- `components/`: Bibliotecas de reuso UI (`ui/`), cards organizacionais por domínio (`animals/`, `manejo/`, `events/`), navegação estática de tela (`layout/`).
- `lib/`: Toda a força lógica. Subfolders críticos:
    - `offline/`: Mecanismo do Dexie, Loop do Worker, Gerador da Fila e controle de Rollback Otimista.
    - `domain/` & `animals/` & `reproduction/`: Agrupadores de Regra de Negócio (ex: Taxonomia, Anti-teleport, vínculos de cria).
    - `telemetry/`: Buffer em memória com Indexed para diagnóstico de uso silencioso em betas limitados.
- `pages/`: Arquitetura visual roteada com proteções (`RequireAuth`, `RequireFarm`).
- `supabase/functions/`: Backend remoto pontual. Endpoint `sync-batch` consolida a maior parte pesada da comunicação de persistência. Endpoints auxiliares agem sem mexer no local first.

## 3. Topologia e Mapa de Rotas

Superfícies públicas limitam-se ao engajamento inicial (`/login`, `/signup`, `/invites/:token`). Rotas autenticadas aguardando contexto forçam o produtor ao `/select-fazenda` ou `/criar-fazenda`.

Rotas operativas (`RequireAuth` + `RequireFarm`):
- **Painéis Base:** `/home`, `/agenda`, `/dashboard`, `/eventos`.
- **Topologia Animal:** Ponto central de vida. `/animais/:id` bifurcando para módulos adjacentes de evento como `/animais/:id/reproducao`, `/animais/:id/pos-parto`, `/animais/:id/cria-inicial`.
- **Topologia Demográfica:** `/lotes`, `/pastos` acoplados nas dinâmicas de movimentação em blocos.
- **Topologia de Domínio Auxiliar:** Protocolos base de catálogo de sanitário (`/protocolos-sanitarios`), Financeiro (`/financeiro`), e Perfils Demográficos/Admin de Pessoal (`/admin/membros`).

## 4. Roteiro E2E (Fluxos Críticos MVP)
O ciclo completo ideal é mapeado para segurança transacional em cada deploy:
1. **Implantação & Autenticação:** Wizard que preenche os pastos e restringe lotes antes de trazer o primeiro rebanho, seja manual ou via injetor CSV, amarrando o `fazenda_id`.
2. **Ciclo Sincronização e Anti-teleporte:** Geração pura com status OFFLINE -> worker envia lote de fatos pro batch -> backend rejeita magic movements e força Rollbacks (rollback revertendo as telas de interface e as referências sem deixar rastro de bug visual local).
3. **Dinâmicas Naturais de Vida:** Fluxo 9 (Partos). O animal (mãe) desencadeia eventos locais compostos e autônomos que geram crias pré-amarradas localmente numa única intenção (`client_tx_id`), convertendo a mãe em Lactante e vinculando as novas vidas na mesma aba, sem falhas lógicas de rede.
4. **Agendas e Recidivas Financeiras/Nutricionais:** Trabalhos com preenchimento via `dedup_key`. Múltiplos avisos locais agrupados como única operação na rede central em repetição natural (Vacina 2º Dose) sem duplicidade local visível.

## 5. Scripts Relevantes

Para desenvolvimento, rode:
- `pnpm dev`: Inicia ambiente dinâmico cliente com Vite.
- `pnpm test`: Cobertura Vitest local. Testes de paridade taxonomia e lógica estão garantidos.
- `pnpm run test:e2e`: Avalia as rotinas descritas no item acima batendo de ponta a ponta sem internet na simulação IndexedDB local.
- `pnpm run gates`: Analises de integridade da própria documentação via automações para evitar ruídos textuais (Antigravity validation).
