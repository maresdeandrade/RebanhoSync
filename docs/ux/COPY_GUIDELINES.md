# Copy Guidelines — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir padrões de linguagem, microcopy, alertas, badges e termos seguros para a interface do RebanhoSync.

Este documento evita mensagens ambíguas que possam transformar dados parciais em decisões operacionais críticas.

---

## Tom

A linguagem do app deve ser:

- simples;
- direta;
- operacional;
- sem excesso técnico;
- sem promessa indevida;
- adequada ao campo.

---

## Regras centrais de copy

### Agenda

Agenda é intenção/tarefa futura.

Usar:

```txt
Pendente
Previsto
Vence hoje
Atrasado
Agendado
A fazer
```

Evitar quando a fonte for agenda:

```txt
Realizado
Executado
Aplicado
Concluído como fato
Histórico
```

---

### Evento

Evento é fato executado.

Usar:

```txt
Registrado
Executado
Aplicado
Movimentado
Vendido
Comprado
Pesado
Nascimento registrado
```

Apenas usar esses termos quando houver evento/fato registrado.

---

### Estado atual

Para `state_*` ou read model:

Usar:

```txt
Status atual
Lote atual
Pasto atual
Situação atual
Última leitura consolidada
```

Evitar tratar estado atual como histórico completo.

---

### Protocolo

Protocolo é regra/configuração.

Usar:

```txt
Protocolo configurado
Regra do protocolo
Manejo previsto pelo protocolo
```

Evitar:

```txt
Protocolo executado
Animal cumpriu protocolo
Aplicação feita
```

sem evento.

---

### Sinais e insights

Usar:

```txt
Sinal auxiliar
Leitura operacional
Fonte declarada
Dados parciais
Fonte obrigatória ausente
```

Evitar:

```txt
Autorizado
Liberado
Garantido
Apto
Seguro
```

quando for apenas sinal.

---

## Carência sanitária

### Regra

Carência sanitária pode aparecer como sinal sanitário se vier de evento sanitário estruturado.

Não deve aparecer como autorização comercial.

### Usar

```txt
Carência sanitária ativa até [data], conforme evento sanitário registrado.
```

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
```

```txt
Sinal sanitário. Não equivale a liberação para venda ou abate.
```

```txt
Fonte insuficiente para avaliar carência sanitária.
```

### Evitar

```txt
Livre de carência
Liberado
Liberado para venda
Apto para abate
Sem restrição
Sanitário ok
```

### Alias legado

Se existir `sanitario:livre_carencia`, a UI deve exibir copy cautelosa:

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
```

Não exibir:

```txt
Livre de carência.
```

---

## Venda e abate

Venda/abate não devem ser autorizados por sinal isolado.

Usar:

```txt
Aptidão comercial não calculada.
```

```txt
Venda/abate exigem validação operacional própria.
```

```txt
Carência sanitária é apenas uma dimensão da decisão.
```

Evitar:

```txt
Pronto para venda
Apto para abate
Pode vender
Pode abater
```

sem contrato próprio.

---

## Peso

Usar:

```txt
Último peso registrado
Pesagem registrada em [data]
Peso atual confiável não calculado
```

Evitar:

```txt
Peso atual
Peso confiável
Peso estimado como fato
```

sem regra técnica.

---

## Estados de dados

### Vazio

```txt
Fonte carregada, sem itens.
```

### Parcial

```txt
Fonte carregada com limitação.
```

### Bloqueado

```txt
Fonte obrigatória ausente.
```

### Erro

```txt
Não foi possível carregar esta informação.
```

### Offline

```txt
Você está offline. A ação será salva localmente quando permitido.
```

### Sync pendente

```txt
Alteração salva neste dispositivo. Sincronização pendente.
```

---

## CTAs

### CTAs principais

Devem indicar ação clara:

```txt
Registrar manejo
Salvar registro
Concluir registro
Abrir registro
Revisar dados
```

### CTAs perigosos

Devem ser específicos:

```txt
Confirmar venda
Confirmar saída
Registrar óbito
Excluir rascunho
Cancelar operação
```

Evitar CTA genérico em operação crítica:

```txt
OK
Confirmar
Finalizar
```

sem contexto.

---

## Badges

Usar badges curtos:

```txt
Pendente
Hoje
Atrasado
Parcial
Bloqueado
Offline
Sync pendente
Fonte ausente
Sinal sanitário
```

Evitar badges definitivos sem fonte:

```txt
Liberado
Apto
Seguro
Conforme
```

---

## Mensagens de erro

Erro deve explicar:

1. o que falhou;
2. o que foi preservado;
3. o que o usuário pode fazer.

Exemplo:

```txt
Não foi possível sincronizar agora. O registro foi salvo neste dispositivo e será reenviado automaticamente.
```

---

## Mensagens de sucesso

Sucesso deve indicar fato real.

Se salvou localmente:

```txt
Registro salvo neste dispositivo.
```

Se sincronizou:

```txt
Registro sincronizado.
```

Não usar:

```txt
Registro concluído com sucesso
```

se ainda há sync pendente e risco de falha remota.

---

## Critério de aceite

A copy é aceitável quando:

- não promete decisão crítica sem fonte;
- diferencia agenda, evento, estado e protocolo;
- diferencia sinal sanitário de autorização comercial;
- explica limitações;
- é curta;
- é compreensível no campo;
- reduz risco de interpretação errada.