# Visual Tokens — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir diretrizes visuais, uso de tokens, badges, densidade, estados e responsividade do RebanhoSync.

Este documento orienta consistência visual sem substituir implementação em CSS/Tailwind.

---

## Direção visual

A identidade visual deve transmitir:

- confiança;
- operação;
- clareza;
- campo;
- tecnologia discreta;
- segurança.

Evitar visual:

- excessivamente corporativo;
- excessivamente rural decorativo;
- denso demais;
- com muitos alertas simultâneos;
- com cores críticas usadas sem critério.

---

## Prioridade visual

Elementos visuais devem ajudar o usuário a distinguir:

1. ação necessária;
2. risco;
3. limitação;
4. informação;
5. detalhe técnico.

---

## Badges

Badges devem ser curtos e consistentes.

Exemplos:

```txt
Hoje
Atrasado
Pendente
Parcial
Bloqueado
Offline
Sync pendente
Sinal sanitário
Fonte ausente
```

Evitar:

```txt
Liberado
Apto
Seguro
Conforme
```

sem contrato próprio.

---

## Severidade

| Severidade | Uso |
|---|---|
| Crítico | Ação bloqueada, erro grave, risco operacional. |
| Alerta | Pendência, atraso, limitação relevante. |
| Informativo | Fonte, status, observação, sinal auxiliar. |
| Sucesso | Ação concluída com confirmação real. |
| Neutro | Metadado ou informação complementar. |

---

## Cores

Cores devem ser usadas por significado, não por estética isolada.

Regras:

- vermelho/erro apenas para risco real;
- amarelo/alerta para pendência ou atenção;
- verde/sucesso apenas para confirmação real;
- azul/informativo para orientação;
- cinza/neutro para metadados.

### Atenção

Não usar verde para “sem carência sanitária vigente” se isso puder parecer liberação comercial.

Preferir badge informativo/neutro com subcopy.

---

## Carência sanitária

Sinal de carência deve ser visualmente informativo, não autorizativo.

Exemplo:

```txt
Sinal sanitário
Sem carência sanitária vigente nas fontes estruturadas disponíveis
```

Subcopy:

```txt
Não equivale a liberação para venda ou abate.
```

Evitar selo visual de aprovação, como:

```txt
Liberado
OK
Apto
```

---

## Cards

Cards devem ter:

- título curto;
- valor principal;
- explicação curta;
- fonte/limitação quando necessário;
- ação somente se segura.

Evitar card muito denso.

---

## Listas

Listas devem ser legíveis em celular.

Preferir:

- título;
- subtítulo;
- badge;
- data;
- ação contextual.

Evitar:

- tabela larga;
- muitos ícones sem legenda;
- badges excessivos.

---

## Formulários

Formulários devem usar:

- labels claros;
- ajuda curta;
- erros próximos ao campo;
- seções por etapa;
- revisão final em ação crítica.

Evitar:

- placeholder como única label;
- múltiplos campos técnicos visíveis por padrão;
- scroll longo sem agrupamento.

---

## Estados visuais

Estados obrigatórios:

- loading;
- empty;
- partial;
- blocked;
- error;
- offline;
- sync pending;
- conflict.

Referência:

- `docs/ux/EMPTY_PARTIAL_BLOCKED_STATES.md`

---

## Detalhes técnicos

Detalhes técnicos devem ser colapsáveis.

Usar:

```txt
Ver detalhes técnicos
```

Não expor UUIDs e payloads no fluxo principal, salvo necessidade de debug/suporte.

---

## Mobile

Em mobile:

- CTA principal deve ficar acessível;
- botões devem ter área confortável;
- listas devem ser card-based;
- navegação inferior deve priorizar rotina;
- detalhes técnicos devem ficar escondidos;
- formulários longos devem ser quebrados em etapas.

---

## Desktop

Em desktop:

- SideNav pode expor mais áreas;
- listas podem ter mais colunas;
- painéis podem ter layout em grid;
- não aumentar densidade sem necessidade.

---

## Ícones

Ícones devem apoiar texto, não substituir texto em ação crítica.

Não usar apenas ícone para:

- venda;
- óbito;
- exclusão;
- sync;
- erro;
- bloqueio.

---

## Critério de aceite

Visual está adequado quando:

- severidade é clara;
- cor não comunica autorização indevida;
- badge não promete decisão crítica;
- mobile é legível;
- estados são distinguíveis;
- fonte/limitação aparece onde necessário;
- detalhes técnicos não poluem a operação;
- interface parece operacional, não decorativa.