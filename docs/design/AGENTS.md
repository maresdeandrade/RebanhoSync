# AGENTS.md — RebanhoSync Design/UX

Status: Normativo para agentes de implementação e revisão visual/UX  
Escopo: RebanhoSync — app offline-first para gestão simples de pecuária de corte  
Última atualização: 2026-05-08

## 1. Identidade do projeto

RebanhoSync é um app operacional, mobile-first e offline-first para gestão simples de pecuária de corte, voltado a pequeno e médio produtor rural.

O produto deve priorizar:

- uso em campo;
- baixa fricção;
- operação com conexão instável;
- registro seguro de manejos;
- separação entre intenção, estado atual e fato histórico;
- clareza sobre sincronização local/remota;
- evolução incremental sem reescrever o app.

Não tratar o RebanhoSync como:

- ERP agro completo;
- sistema fiscal;
- marketplace;
- BI avançado;
- app veterinário hospitalar;
- motor de IA preditiva.

## 2. Contratos arquiteturais obrigatórios

### 2.1 Offline-first

Preservar o modelo offline-first existente.

Não alterar sem escopo explícito:

- Supabase;
- Dexie;
- queue de sincronização;
- workers de sync;
- RLS;
- migrations;
- seed;
- edge functions;
- contratos de rollback/rejeição.

### 2.2 Separação de fontes

Preservar a separação conceitual:

| Camada | Papel |
|---|---|
| `state_*` | estado atual mutável/read model atual |
| `event_*` | fatos históricos append-only |
| agenda | intenção/pendência operacional aberta |
| protocolo | regra/configuração de geração/orientação |
| insights | composição read-only, sem criar fato/regra/autorização |
| marcadores/sinais | auxiliares visuais, nunca fonte primária |

Regras:

- Agenda não é histórico factual.
- Protocolo sanitário não é execução.
- Marcador/sinal não comprova fato.
- Insight não cria regra crítica.
- UI não deve inferir carência, venda, abate ou aptidão comercial.

## 3. Limites duros

Não criar ou alterar sem autorização explícita:

- banco de dados;
- migrations;
- seed;
- RLS;
- Supabase;
- Dexie;
- sync;
- regra sanitária crítica;
- carência ativa/livre de carência;
- pronto para venda;
- apto para abate;
- peso atual confiável;
- protocolo executado;
- agenda concluída como fato histórico;
- IA preditiva ou decisória.

## 4. Direção visual vigente

A direção visual documentada está em `docs/design/`.

Fonte de orientação:

- `docs/design/README.md`
- `docs/design/BRAND_DIRECTION.md`
- `docs/design/UI_VISUAL_REFERENCES.md`
- `docs/design/STITCH_PROMPTS.md`
- `docs/design/HANDOFF_VISUAL_UX_20260508.md`

Direção vigente: **Azul Sync Técnico / Campo Operacional**.

Direção aplicada no app:

- tokens globais alinhados ao azul petróleo;
- correções de contraste em light/dark mode;
- Bottom Navigation mobile;
- SideNav desktop/tablet preservada;
- cards brancos/neutros com bordas visíveis;
- estados semânticos para sucesso, aviso, erro, informação, offline e rejeição.

As referências visuais não são pixel-perfect e não substituem o código atual.

## 5. Logo e ilustrações

### 5.1 Logo

Referência visual principal:

- animal adulto + bezerro;
- movimento circular/sincronização;
- wordmark `RebanhoSync`;
- aplicação monocromática/negativa;
- uso em fundo escuro;
- possível uso como logo horizontal, favicon e app icon.

Status: **referência visual aprovada**.

Não tratar como asset final se o arquivo final de produção não estiver confirmado.

### 5.2 Perfis visuais de animal

Perfis nas referências:

- Touro Reprodutor;
- Boi Engorda;
- Vaca Seca / Solteira;
- Vaca Parida;
- Novilha;
- Bezerro.

Regras visuais:

- Novilha não deve ter úbere proeminente.
- Vaca Parida deve representar matriz com bezerro ao pé.
- Touro Reprodutor deve sugerir robustez/cupim.
- Boi Engorda deve sugerir volume/terminação.
- Bezerro deve ser menor/esguio.

Essas ilustrações não criam regra automática de domínio. Não inferir categoria, reprodução, aptidão comercial, peso confiável ou status sanitário a partir do ícone.

## 6. Direção UX vigente

A refatoração UX deve ser incremental e orientada ao uso em campo.

Hipótese operacional:

> O uso real tende a ser contextual e reativo, partindo de pendência, lote, pasto ou animal, não apenas de um fluxo centralizado e linear.

Essa hipótese deve ser validada por código/teste/uso real. Não tratá-la como regra absoluta.

### 6.1 Navegação mobile

Implementado:

- Bottom Navigation em mobile;
- SideNav preservada em desktop/tablet.

Estrutura vigente:

```txt
Hoje | Rebanho | Manejo | Estrutura | Mais
```

Regras:

- não remover rotas existentes;
- não remover SideNav desktop;
- não duplicar navegação de forma confusa;
- item Manejo navega para Registrar;
- manter Agenda completa acessível.

### 6.2 Home como Central Operacional

Home atua como `Hoje / Central Operacional`.

Função da Home:

- mostrar o que exige ação hoje;
- destacar atrasadas e pendências críticas;
- manter status de sync/offline visível;
- apontar próximos manejos;
- dar contexto de rebanho;
- facilitar acesso rápido ao registro.

Separação recomendada:

```txt
Home / Hoje = execução diária e priorização
Agenda = visão completa, filtros e gestão ampla das pendências
```

### 6.3 Registro contexto-primeiro

Contexto pode pré-preencher o alvo, mas nunca salvar automaticamente.

Fluxos vigentes:

```txt
Lote → Manejar este lote → Registrar com lote pré-preenchido → Revisar → Salvar
Pasto → Manejar neste pasto → Registrar com contexto informativo → Revisar → Salvar
Animal → Registrar manejo deste animal → Revisar → Salvar
Agenda item → Registrar execução da pendência → Revisar → Salvar
```

Invariantes:

- revisão obrigatória antes de salvar;
- alvo sempre visível;
- usuário pode alterar alvo;
- salvar exige confirmação explícita;
- respeitar fazenda atual;
- não registrar para animais inativos/deletados;
- não inferir animais se a fonte estiver inconsistente;
- `pastoId` é contexto informativo e não infere lote/animais;
- não transformar agenda em histórico.

### 6.4 Bandeja de seleção

Bandeja global de seleção multi-animal é proposta futura, não implementada.

Só considerar após:

1. Bottom Navigation mobile;
2. Home/Central Operacional;
3. manejo contextual básico;
4. validação de risco operacional.

Regras mínimas futuras:

- bandeja visível enquanto houver seleção;
- contador persistente;
- botão limpar seleção;
- confirmação forte antes de ação em massa;
- seleção restrita à fazenda atual;
- limpar seleção após finalizar/cancelar;
- não persistir seleção como dado de negócio.

## 7. Estratégia de prompts para agentes

Use prompts curtos e escopados.

Estrutura recomendada:

```txt
Contexto fixo → docs/AGENTS/skills
Tarefa → curta e objetiva
Escopo permitido → arquivos/áreas
Fora do escopo → explícito
Critérios de aceite → testáveis
Validação → comandos
```

Checklist antes de executar:

```txt
O prompt tem uma única tarefa?
Define arquivos permitidos?
Define fora do escopo?
Cita docs/skills relevantes?
Tem critérios de aceite?
Tem validação?
Evita reexplicar o projeto inteiro?
```

## 8. Padrões de execução

Antes de alterar código:

1. leia arquivos relevantes;
2. confirme estado real;
3. separe achado confirmado, inferência e hipótese;
4. proponha patch pequeno;
5. implemente somente o escopo pedido;
6. rode validação proporcional ao risco;
7. reporte arquivos alterados, testes e riscos remanescentes.

## 9. Validação recomendada

Para documentação:

```bash
git status --short --untracked-files=all
git diff --stat
```

Para patches visuais/UX:

```bash
pnpm run lint
pnpm run build
pnpm test
```

Para revisão corretiva visual pequena, `test:smoke` pode ser usado antes da suíte completa, mas não substitui `pnpm test` antes de PR/merge.
