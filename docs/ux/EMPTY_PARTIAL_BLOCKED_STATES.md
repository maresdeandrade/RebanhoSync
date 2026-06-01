# Empty, Partial and Blocked States — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir como exibir estados de carregamento, vazio, parcial, bloqueado, erro, offline e sincronização pendente.

Este documento padroniza a UX de dados ausentes ou incompletos sem inventar informação.

---

## Estados

| Estado | Uso |
|---|---|
| Carregando | Fonte ainda não foi carregada. |
| Vazio | Fonte carregada, sem itens. |
| Parcial | Fonte carregada, mas incompleta ou limitada. |
| Bloqueado | Fonte obrigatória ausente ou decisão não permitida. |
| Erro | Falha técnica ao carregar/processar. |
| Offline | Sem conexão no momento. |
| Sync pendente | Alteração local ainda não sincronizada. |
| Conflito | Dados locais/remotos divergentes. |

---

## Carregando

Usar quando ainda não há certeza sobre os dados.

Copy padrão:

```txt
Carregando informações da fazenda.
```

Evitar mostrar zero antes da fonte carregar.

### Regra

Não renderizar “vazio” enquanto a fonte ainda está carregando.

---

## Vazio

Usar quando a fonte carregou corretamente e não há itens.

Copy padrão:

```txt
Fonte carregada, sem itens.
```

Exemplos:

```txt
Nenhuma pendência para hoje.
Nenhum evento registrado no período.
Nenhum animal neste lote.
```

### Regra

Vazio não é erro.

---

## Parcial

Usar quando há dados, mas a resposta tem limitação.

Copy padrão:

```txt
Fonte carregada com limitação.
```

Exemplos:

```txt
Alguns eventos não têm produto informado.
Algumas pesagens não têm data válida.
Custo parcial: há registros sem valor.
```

### Regra

Parcial deve informar a limitação principal.

---

## Bloqueado

Usar quando a resposta não pode ser dada com segurança.

Copy padrão:

```txt
Fonte obrigatória ausente.
```

Exemplos:

```txt
Peso atual confiável não calculado.
Aptidão para venda não calculada.
Liberação sanitária final não calculada.
```

### Regra

Bloqueado deve dizer qual fonte falta ou qual decisão não é suportada.

---

## Erro

Usar quando houve falha técnica.

Copy padrão:

```txt
Não foi possível carregar esta informação.
```

Complementar quando útil:

```txt
Tente novamente ou verifique a conexão.
```

### Regra

Erro técnico não deve apagar dado local já salvo.

---

## Offline

Usar quando não há conexão.

Copy padrão:

```txt
Você está offline.
```

Para fluxo permitido offline:

```txt
Você está offline. A ação será salva neste dispositivo.
```

Para fluxo que exige conexão:

```txt
Esta ação exige conexão.
```

---

## Sync pendente

Usar quando o registro foi salvo localmente, mas ainda não chegou ao servidor.

Copy padrão:

```txt
Alteração salva neste dispositivo. Sincronização pendente.
```

### Regra

Não exibir como sincronizado antes de confirmação remota.

---

## Conflito

Usar quando dado local e remoto divergem.

Copy padrão:

```txt
Há conflito entre dados locais e remotos.
```

Ação esperada:

```txt
Revisar conflito
```

### Regra

Conflito não deve ser resolvido silenciosamente quando houver risco operacional.

---

## Estados para insights

Cards de insight devem exibir:

| Estado | Copy |
|---|---|
| Completo | Fonte carregada, leitura completa. |
| Vazio | Fonte carregada, sem itens. |
| Parcial | Fonte carregada com limitação. |
| Bloqueado | Fonte obrigatória ausente. |

---

## Estados sanitários

### Carência sanitária ativa

Permitido quando fonte estruturada existir.

Copy:

```txt
Carência sanitária ativa até [data].
```

Subcopy:

```txt
Sinal sanitário baseado em evento registrado.
```

### Sem carência vigente

Copy:

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
```

Subcopy obrigatória quando houver risco de interpretação comercial:

```txt
Não equivale a liberação para venda ou abate.
```

### Fonte insuficiente

Copy:

```txt
Fonte insuficiente para avaliar carência sanitária.
```

---

## Estados comerciais

### Pronto para venda

No MVP, quando não houver contrato próprio:

```txt
Aptidão para venda não calculada.
```

### Apto para abate

No MVP, quando não houver contrato próprio:

```txt
Aptidão para abate não calculada.
```

### Liberação sanitária final

```txt
Liberação sanitária final não calculada.
```

---

## Prioridade visual

Ordem de severidade:

1. Erro crítico.
2. Bloqueado.
3. Conflito.
4. Sync pendente.
5. Parcial.
6. Offline informativo.
7. Vazio.
8. Completo.

---

## Critério de aceite

Um estado está correto quando:

- não mostra vazio antes de carregar;
- não confunde parcial com completo;
- não transforma bloqueio em sucesso;
- explica a limitação;
- indica fonte ausente quando necessário;
- diferencia sinal sanitário de autorização comercial;
- preserva segurança operacional.