# Form Patterns — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir padrões para formulários, wizards, checklists, validação e revisão de dados no RebanhoSync.

Este documento orienta fluxos de registro operacional sem misturar UI com regra crítica de negócio.

---

## Princípios

- Formulário deve ser curto.
- Campo obrigatório deve ter motivo.
- Operação crítica deve ter revisão.
- Validação de domínio não deve existir só na UI.
- Offline deve ser considerado desde o início.
- Dados parciais devem ser salvos apenas quando fizer sentido operacional.

---

## Tipos de formulário

| Tipo | Uso |
|---|---|
| Formulário simples | Cadastro leve ou edição não crítica. |
| Wizard | Operação com múltiplas etapas ou risco operacional. |
| Checklist | Verificação operacional/contextual. |
| Registro rápido | Manejo de campo com baixa fricção. |
| Revisão final | Confirmação antes de fato crítico. |

---

## Formulário simples

Usar para:

- cadastro básico;
- edição de texto;
- metadados;
- filtros;
- preferências.

Deve ter:

- título claro;
- campos essenciais;
- botão salvar;
- feedback de sucesso/erro.

---

## Wizard

Usar quando houver:

- múltiplas etapas;
- registro sanitário;
- compra/venda;
- parto/cria;
- movimentação;
- risco de baixa de estoque;
- impacto financeiro;
- alteração de status do animal.

Etapas recomendadas:

```txt
Identificação → Dados operacionais → Itens/Detalhes → Revisão → Confirmação
```

Não usar wizard para operação trivial.

---

## Checklist

Checklist deve ser usado como apoio operacional.

Pode representar:

- biossegurança;
- ocorrência;
- inspeção;
- validação contextual;
- pendência corretiva específica.

Não deve ser usado como prova universal de conformidade.

### Regra

Checklist preenchido não é evento executado, salvo fluxo explicitamente modelado para criar evento.

---

## Campos obrigatórios

Campo obrigatório deve ser limitado ao mínimo necessário para preservar consistência.

Exemplos de campos geralmente críticos:

- animal/lote;
- data;
- tipo de evento;
- produto em evento sanitário, quando aplicável;
- dose/via, quando aplicável;
- origem/destino em movimentação;
- contraparte em compra/venda, quando aplicável;
- valor/custo quando a operação econômica depender disso.

---

## Campos opcionais

Campos opcionais devem ser permitidos quando:

- não bloqueiam rastreabilidade mínima;
- podem ser preenchidos depois;
- não geram falsa precisão;
- não comprometem sync.

---

## Valores padrão

Valores padrão podem reduzir fricção.

Permitido:

- data atual como sugestão;
- fazenda ativa;
- responsável atual;
- status padrão seguro;
- checklist pré-preenchido como “sem alteração”, quando a rotina for ocorrência por exceção.

### Atenção

Valor padrão não pode criar fato falso.

Exemplo:

```txt
Checklist sem alteração
```

não deve virar evento de inspeção, salvo confirmação explícita.

---

## Revisão final

Operações críticas devem ter revisão final.

Exemplos:

- venda;
- saída;
- óbito;
- evento sanitário com baixa;
- movimentação em lote;
- parto com criação de cria;
- alteração econômica.

Revisão deve mostrar:

- animal/lote;
- data;
- efeito esperado;
- estoque/custo, se houver;
- status que será alterado;
- sync/offline, se relevante.

---

## Validação

### UI pode validar

- campo vazio;
- formato;
- valor negativo;
- data inválida;
- seleção ausente;
- confirmação de ação perigosa.

### Domínio/backend deve validar

- permissão;
- `fazenda_id`;
- RLS;
- idempotência;
- duplicidade;
- status incompatível;
- cross-tenant;
- baixa de estoque;
- regra de evento;
- integridade de agenda/evento.

---

## Offline

Formulário offline deve deixar claro:

```txt
Registro será salvo neste dispositivo.
```

Se a operação exigir conexão:

```txt
Esta ação exige conexão.
```

---

## Sucesso

Se salvou localmente:

```txt
Registro salvo neste dispositivo.
```

Se sincronizou:

```txt
Registro sincronizado.
```

Se criou fato histórico:

```txt
Evento registrado.
```

Não usar “sincronizado” sem confirmação remota.

---

## Erro

Erro deve preservar contexto.

Exemplo:

```txt
Não foi possível concluir a baixa de estoque. O evento foi salvo com limitação.
```

Ou:

```txt
Não foi possível salvar. Revise os campos destacados.
```

---

## Formulários sanitários

Devem diferenciar:

- protocolo;
- agenda;
- evento;
- produto;
- dose;
- estoque;
- carência sanitária como sinal;
- liberação final como bloqueada.

Copy de carência:

```txt
Carência sanitária ativa até [data], conforme evento sanitário registrado.
```

ou:

```txt
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
```

Não usar:

```txt
Liberado para venda
Apto para abate
```

---

## Formulários de compra/venda

Devem destacar:

- animais/lote;
- contraparte;
- data;
- valor;
- custo;
- efeito no status;
- limitações.

Não permitir que venda seja baseada apenas em sinal sanitário.

---

## Formulários de movimentação

Devem destacar:

- origem;
- destino;
- animal/lote;
- data;
- motivo;
- impacto no estado atual.

Movimentação planejada é agenda.  
Movimentação executada é evento.

---

## Edge cases

Verificar:

- duplo clique;
- envio duplicado;
- offline durante envio;
- retry;
- validação local divergente da remota;
- animal vendido/morto;
- agenda já concluída;
- produto sem estoque;
- custo ausente;
- troca de fazenda durante formulário;
- sessão expirada durante registro.

---

## Critério de aceite

Um formulário é aceitável quando:

- coleta o mínimo necessário;
- preserva rastreabilidade;
- não transforma padrão em fato falso;
- mostra revisão em ação crítica;
- funciona offline quando aplicável;
- diferencia local salvo de remoto sincronizado;
- não coloca regra crítica apenas na UI;
- declara limitação quando dado está incompleto.