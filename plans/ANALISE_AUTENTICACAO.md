# Análise do Fluxo de Autenticação do RebanhoSync

## 1. Resumo Executivo
A análise do fluxo de autenticação identificou que o RebanhoSync possui um fluxo funcional, mas que mistura responsabilidades no `AuthProvider`. O gerenciamento da sessão do Supabase, o carregamento do perfil do usuário, o carregamento das permissões/configurações da fazenda (membership) e a gestão de temas estão todos centralizados no `useAuth`. Isso cria um estado de "loading" abrangente que bloqueia a interface até que as verificações de fazenda sejam concluídas.

Há um risco potencial de vazamento de dados locais entre usuários no mesmo dispositivo, pois o `signOut` limpa os cookies e IDs ativos, mas não apaga ativamente os dados locais no Dexie. As tabelas do Dexie têm a estrutura `fazenda_id` na chave ou índices, mitigando a exibição cruzada para a mesma conta, mas usuários diferentes no mesmo dispositivo podem teoricamente acessar resíduos pelo console.

## 2. Fluxograma Atual

```mermaid
flowchart TD
  A[App Inicia] --> B[AuthProvider Inicializa]
  B --> C[Busca Sessão Supabase]
  C --> D{Sessão Existe?}
  D -->|Não| E[setSession(null) e applyTheme(system)]
  D -->|Sim| F[refreshSettings]

  F --> G[Busca user_settings active_fazenda_id]
  G --> H{Tem active_fazenda_id?}
  H -->|Sim| I[Verifica role na user_fazendas]
  H -->|Não| J[fetchFirstAccessibleFarmId]

  I --> K{Role Válido?}
  K -->|Sim| L[Carrega config da fazenda e salva]
  K -->|Não| J

  J --> M{Achou fazenda?}
  M -->|Sim| N[Seta nova fazenda ativa e persiste]
  M -->|Não| O[Limpa dados de fazenda]

  E --> P[AuthGate / RequireAuth]
  L --> P
  N --> P
  O --> P

  P --> Q{Sessão em RequireAuth?}
  Q -->|Não| R[Redirect para /login]
  Q -->|Sim| S{activeFarmId em AuthGate?}
  S -->|Não| T[Redirect para /select-fazenda]
  S -->|Sim| U[Renderiza App Shell]
```

## 3. Arquivos Inspecionados
- `src/hooks/useAuth.tsx`
- `src/components/auth/AuthGate.tsx`
- `src/components/auth/RequireAuth.tsx`
- `src/components/auth/RequireFarm.tsx`
- `src/pages/Login.tsx`
- `src/pages/SignUp.tsx`
- `src/App.tsx`
- `src/lib/offline/db.ts`
- `src/lib/offline/reset.ts`
- `src/pages/SelectFazenda.tsx`
- `src/lib/supabase.ts`

## 4. Matriz de Riscos

| Risco | Severidade | Evidência no código | Impacto | Correção sugerida |
| ----- | ---------: | ------------------- | ------- | ----------------- |
| **Falta de limpeza total do Dexie no Logout** | Alto | `signOut` em `useAuth.tsx` chama `removeActiveFarmId()` mas não chama um método para limpar o banco (como `db.delete()` ou limpar tabelas) | Dados de um usuário podem ficar no cache do navegador (IndexedDB) para um próximo usuário. RLS impede sync, mas não acesso offline se houver bypass. | Adicionar `clearAllOfflineData()` no fluxo de `signOut`. |
| **Mistura de Estado (Auth vs Contexto de Fazenda)** | Médio | `useAuth` lida com sessão e preferências de fazenda | Componentes re-renderizam ou ficam bloqueados por "loading" quando o usuário está autenticado mas esperando a fazenda carregar. | Separar em `SessionProvider` e `FarmProvider`. |
| **Loading Infinito Silencioso / Condições de Corrida** | Médio | `refreshSettings` lida com múltiplos awaits e states | Se uma API do Supabase falha (e.g. timeout), o estado pode ficar inconsistente. | Máquina de estados explícita (`status: 'loading' | 'authenticated' | ...`) |
| **Redirecionamento em Login já autenticado** | Baixo | `Login.tsx` usa `<Navigate>` no render se houver sessão | Causa um "flash" se o usuário acessar `/login` com a sessão ainda sendo carregada, além de re-render. | Aprimorar o roteamento ou proteger a rota `/login` contra usuários já autenticados adequadamente. |

## 5. Diagnóstico de Arquitetura

* **O AuthProvider está fazendo responsabilidades demais?**
Sim. O `AuthProvider` atual mescla: 1. Estado da sessão de autenticação. 2. Fetch de configurações do usuário (`user_settings`). 3. Resolução e fallback de fazenda ativa. 4. Obtenção do role do membro. 5. Obtenção das preferências (medição, experiência).
* **Existe uma máquina de estados clara?**
Não. Usa booleanos (`loading: true/false`, `session`, `activeFarmId`) que levam a combinações implícitas.
* **A restauração de sessão é determinística?**
Depende de respostas do banco de dados (via `.maybeSingle()`) dentro de `refreshSettings`, o que a torna dependente da rede no carregamento inicial se não estiver cacheado perfeitamente.
* **O app diferencia autenticação de autorização?**
Parcialmente. Autenticação é sessão (`RequireAuth`), autorização é Membership/Role (`AuthGate` com `requiredRole`). Contudo, ambos vivem juntos no mesmo contexto.
* **O app diferencia usuário logado de usuário com fazenda ativa?**
Sim, na interface (ex: `/select-fazenda` caso `!activeFarmId`), mas ambos estão no mesmo provider.
* **O app limpa corretamente dados locais ao sair?**
Não. O `signOut` atual só remove a sessão do Supabase, o ID da fazenda no `localStorage` e limpa as variáveis de estado. O Dexie mantém os dados.
* **A proteção de rota está robusta?**
É aceitável, usando `<RequireAuth>` e `RequireFarm` / `AuthGate`, porém como dependem do mesmo `loading`, o usuário pode experienciar uma tela branca considerável.
* **Há risco de dados cross-tenant?**
Sim no cache local se a mesma máquina for usada. O RLS do lado do servidor mitiga o risco on-line, e o app usa Dexie buscando sempre por `fazenda_id`, mas a falta de limpeza no logout é um vazamento local.

## 6. Proposta de Arquitetura Otimizada

### Estrutura
```
SupabaseAuthClient
  ↓
SessionProvider (Fornece apenas User, Session, 'loading'/'authenticated'/'unauthenticated')
  ↓
SettingsProvider / UserProfileProvider (Fornece configurações como tema)
  ↓
FarmMembershipProvider (Fornece activeFarmId, role, configs da fazenda)
  ↓
Rotas Protegidas / AppShell
```

### Máquina de Estados Simplificada para o Session
```ts
type AuthStatus = "loading" | "authenticated" | "unauthenticated";
```

### Limpeza no Logout
A rotina de `signOut` deve garantir que o banco local (Dexie) seja deletado ou limpo quando o usuário encerra a sessão ativamente.

## 7. Plano de Execução

**Fase 1 - Correções Críticas (Ações Imediatas)**
- Implementar limpeza completa do Dexie no evento de `signOut` para mitigar o risco de vazamento de dados no dispositivo (segurança obrigatória).
- Melhorar o redirecionamento no `Login.tsx` e centralizar a lógica.

**Fase 2 - Melhorias no Provider Atual (Refatoração Suave)**
- Em vez de dividir todos os providers de uma vez (o que quebraria a compatibilidade do `useAuth` em mais de 50 arquivos), introduziremos uma state machine dentro do provider atual para gerenciar de forma mais previsível o fluxo.
- Isso previne re-renderizações infinitas e "tela em branco".

**Fase 3 - Preparação para o App Offline-First**
- Melhorar o fallback offline na inicialização para que o app permita acesso com as credenciais previamente salvas sem travar no `refreshSettings`.

*Recomendação para esta tarefa:*
Aplicar os patches da Fase 1 (limpeza do IndexedDB no logout e ajuste no direcionamento) como a melhoria prioritária focada em segurança.
