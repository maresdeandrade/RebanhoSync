# Semantic Colors — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato implementado na Fase 19 — recalibrado após a Fase 20**

## Regra central

`brand.*` identifica o produto. Ele não significa automaticamente sucesso, confirmação, sincronização, segurança ou autorização. Toda cor operacional precisa de texto e, quando crítica, ícone e ação associada.

## Estado atual

O tema produtivo contém famílias próprias para `brand`, neutros, `success`, `warning`, `error`, `info`, `offline`, `pending`, `conflict`, `unknown` e `not_permitted`, com foreground, muted e border em light/dark. Cores Tailwind literais ainda existem em telas legadas; a migração substitui papel por papel, sem busca e troca global.

Após a F20, a escala foi recalibrada para reduzir ofuscação no tema claro e densidade no escuro. Financeiro, Relatórios e os cockpits de Lote/Pasto passaram a consumir papéis semânticos em vez de valores `emerald`, `red`, `amber`, `blue`, `rose` e `slate` nos pontos migrados.

## Papéis alvo

Cada família expõe `foreground`, `background/muted`, `border` e, quando usada em ação sólida, `solid-foreground`. A calibração preserva significado e contraste entre os temas.

| Família | Significado | Usar em | Não usar em | Light/dark e associação |
|---|---|---|---|---|
| `brand.*` | identidade RebanhoSync | logo, ação primária, navegação ativa | confirmar fato ou sync | azul-petróleo com contraste AA; texto de ação obrigatório |
| `neutral.*` | estrutura sem julgamento | texto, borda, disabled, metadado | indicar risco ou sucesso | escala de superfície distinta em cada tema |
| `semantic.success.*` | operação aplicada sem ressalva factual | `APPLIED`, conclusão confirmada | “saudável”, “seguro” ou “autorizado” por inferência | check + texto; fundo suave, borda visível |
| `semantic.warning.*` | atenção antes de continuar | prazo, limitação recuperável, ajuste | erro irreversível ou mero destaque | triângulo + texto; não depender de amarelo |
| `semantic.error.*` | falha, rejeição ou destruição | `REJECTED`, erro, confirmação destrutiva | conflito ou ausência de dados | ícone de erro + causa/ação |
| `semantic.info.*` | informação contextual ou atividade neutra | ajuda, `SYNCING`, progresso | CTA de marca ou sucesso | info/spinner + texto |
| `semantic.offline.*` | sem conectividade, operação local | `OFFLINE`, dados no aparelho | pendência remota genérica | nuvem desconectada + alcance/limitação |
| `semantic.pending.*` | aguardando execução/processamento | `PENDING`, fila local | falha ou agenda futura genérica | relógio/fila + texto e contagem |
| `semantic.conflict.*` | duas versões exigem reconciliação | `CONFLICT` | rejeição técnica comum | bifurcação/alerta + CTA “Reconciliar” |
| `semantic.unknown.*` | fonte insuficiente ou estado não determinável | `UNKNOWN`, `AMBIGUOUS` | zero, normalidade ou erro | interrogação + explicação de cobertura |
| `semantic.not_permitted.*` | ação não autorizada pelo contrato/permissão | `NOT_PERMITTED` | controle simplesmente indisponível | bloqueio + motivo; não esconder a ação crítica |

## Aliases e migração

| Papel alvo | Fallback atual permitido até F19 | Observação |
|---|---|---|
| success | `success` | já existe; revisar contraste e uso semântico |
| warning | `warning` | já existe; separar de `accent` |
| error | `destructive` | manter `destructive` para ação e `error` para estado quando implementado |
| info | `info` | já existe |
| offline | `warning` + rótulo “Sem internet” | temporário, nunca só amarelo |
| pending | `warning` + rótulo de fila | temporário |
| conflict | `destructive`/`warning` + texto “Conflito” | temporário; não chamar de rejeição |
| unknown | `neutral` + ícone/texto | ausência de dado não é sucesso |
| not_permitted | `neutral` ou `destructive` conforme risco + motivo | não confundir com disabled técnico |

## Contraste e composição

- texto normal: mínimo 4,5:1; texto grande/ícone essencial: 3:1;
- borda de controle e foco contra fundo: 3:1 quando necessária para identificar o componente;
- badge crítico inclui rótulo; banner crítico inclui título, explicação e próxima ação;
- gráficos repetem significado em legenda, padrão, forma ou rótulo;
- estado não muda de sentido entre light e dark;
- `opacity` sozinha não comunica disabled ou read-only.

## Anti-patterns

- verde para “animal saudável” sem fonte factual explícita;
- azul de marca para “sincronizado”;
- laranja de marca para todo alerta;
- vermelho para conflito, rejeição, indisponível e destrutivo sem rótulo diferenciador;
- hardcoded `blue/green/amber/red` em telas quando existe papel semântico equivalente;
- background semântico saturado em grandes áreas de conteúdo.
