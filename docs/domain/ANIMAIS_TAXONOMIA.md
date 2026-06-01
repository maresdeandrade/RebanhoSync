# Animais e Taxonomia — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir o contrato de domínio para cadastro animal, identidade, status, origem/destino, categoria zootécnica, estágio de vida e taxonomia canônica.

Este documento evita mistura entre classificação animal, estado atual, histórico, métrica e decisão operacional crítica.

---

## Escopo

Este documento cobre:

* cadastro do animal;
* identidade animal;
* sexo;
* raça;
* categoria zootécnica;
* estágio de vida;
* status atual;
* origem;
* destino;
* entrada;
* saída;
* compra;
* venda;
* óbito;
* lote/pasto atual como referência de estado;
* limites de inferência por idade, peso ou categoria.

---

## Contrato central

Animal é a unidade individual de gestão zootécnica, sanitária, reprodutiva e econômica.

Histórico do animal vem de eventos.

Estado atual vem de `state_*` ou read model equivalente.

Classificações auxiliam leitura, mas não autorizam decisão crítica isoladamente.

---

## Camadas

| Camada | Papel |
| --- | --- |
| **Cadastro base** | Identidade e atributos estáveis/descritivos. |
| **Taxonomia canônica** | Classificação padronizada para consistência do app. |
| **Categoria zootécnica** | Classificação operacional/produtiva. |
| **Estágio de vida** | Leitura atual de fase biológica/operacional. |
| **Status atual** | Situação corrente do animal. |
| **Eventos** | Histórico factual do animal. |
| **Agenda** | Tarefas futuras relacionadas ao animal. |

---

## Identidade animal

Identidade deve ser estável e rastreável.

Pode incluir: identificador interno, brinco, nome/código, sexo, raça, data de nascimento (se conhecida), origem, fazenda e lote/pasto atual (se aplicável).

### Regras

* Não duplicar identidade animal.
* Não mover animal entre fazendas sem regra explícita.
* Preservar `fazenda_id`.
* Não permitir relação cross-tenant.
* Não tratar alteração visual como correção histórica.

---

## Status atual

Status representa a situação corrente.

### Exemplos

* `ativo`
* `vendido`
* `morto`
* `descartado`
* `inativo`

> ⚠️ **Regra:** Status atual é estado corrente. Histórico da transição deve vir de evento quando for fato operacional.

### Exemplos de transição

| Transição | Fonte histórica esperada |
| --- | --- |
| ativo → vendido | evento de venda/saída |
| ativo → morto | evento de óbito |
| lote A → lote B | evento de movimentação |
| sem lote → lote definido | evento ou operação explicitamente modelada |

---

## Sexo

Sexo é dado base.

Pode influenciar: categoria, manejo, reprodução, relatórios e filtros.

> ⚠️ Não deve, sozinho, determinar: aptidão reprodutiva, aptidão comercial, status sanitário ou venda/abate.

---

## Raça

Raça é dado descritivo/técnico.

Pode apoiar: relatórios, filtros, manejo e análises zootécnicas futuras.

> ⚠️ Não deve substituir: categoria, estágio, peso, aptidão ou decisão comercial.

---

## Taxonomia canônica

Taxonomia canônica é a padronização interna usada pelo app para evitar nomes livres incompatíveis.

### Objetivo

* consistência;
* filtros confiáveis;
* relatórios;
* integrações;
* redução de ambiguidades.

> ⚠️ **Regra:** Taxonomia canônica deve ser usada como vocabulário controlado, não como prova operacional.

---

## Categoria zootécnica

Categoria zootécnica é classificação produtiva/operacional.

### Exemplos conceituais

* bezerro
* bezerra
* novilha
* garrote
* vaca
* touro
* boi
* matriz
* reprodutor

### Pode responder

* tipo produtivo do animal;
* agrupamento operacional;
* filtros de manejo;
* leitura zootécnica básica.

### Não pode responder sozinha

* peso atual confiável;
* pronto para venda;
* apto para abate;
* livre de carência;
* apto reprodutivo;
* status sanitário crítico.

---

## Estágio de vida

Estágio de vida representa fase biológica/operacional atual.

### Exemplos conceituais

* cria
* recria
* engorda
* matriz
* reprodutor
* desconhecido

> ⚠️ **Regra:** Estágio pode ser: explicitamente informado, derivado por regra validada (se existir), ou marcado como desconhecido quando a fonte for insuficiente. Não inferir estágio por idade/peso sem regra técnica definida e documentada.

---

## Categoria zootécnica vs estágio de vida

| Conceito | Papel | Exemplo |
| --- | --- | --- |
| **Categoria zootécnica** | Tipo produtivo/animal | novilha, vaca, touro |
| **Estágio de vida** | Fase operacional atual | cria, recria, engorda |
| **Status** | Situação corrente | ativo, vendido, morto |
| **Sexo** | Atributo base | macho, fêmea |
| **Raça** | Atributo descritivo | nelore, cruzado |

> ⚠️ **Decisão:** Não unificar automaticamente categoria zootécnica e estágio de vida.

### Motivo

* categoria pode ser mais estável;
* estágio pode mudar com o ciclo produtivo;
* status é outra dimensão;
* sexo/raça não substituem nenhum dos dois.

---

## Origem

Origem registra como o animal entrou no controle da fazenda.

### Exemplos

* nascimento;
* compra;
* transferência;
* importação/cadastro inicial;
* regularização de inventário.

### Fonte histórica esperada

| Origem | Fonte esperada |
| --- | --- |
| nascimento | evento de parto/cria |
| compra | evento/operação de compra |
| transferência | evento de movimentação/entrada |
| cadastro inicial | operação de cadastro com origem declarada |

---

## Destino

Destino registra como o animal saiu ou deixou determinada condição operacional.

### Exemplos

* venda;
* óbito;
* transferência;
* descarte;
* abate (se modelado);
* saída administrativa.

> ⚠️ **Regra:** Destino deve ter evento ou operação rastreável quando representar fato.

---

## Peso

Peso deve vir de evento de pesagem ou fonte técnica explícita.

### Permitido

* exibir último peso registrado;
* calcular histórico de pesagens;
* calcular ganho entre pesagens válidas;
* agrupar médias com limitação declarada.

### Proibido

* afirmar peso atual confiável sem regra própria;
* projetar peso atual como fato;
* decidir venda/abate apenas por peso;
* substituir pesagem por categoria/estágio.

---

## Aptidão comercial ou operacional

> ⚠️ Não inferir automaticamente: pronto para venda, apto para abate, apto para reprodução, apto para trânsito ou livre de restrição sanitária.

Essas decisões exigem fonte técnica explícita, normalmente composta por domínio sanitário, peso, status, idade, regra comercial e validação operacional.

---

## Lote/pasto atual

Lote e pasto atual são estado corrente.

### Histórico de permanência exige

* eventos de movimentação;
* datas de entrada/saída;
* vínculo com animal/lote;
* consistência temporal.

> ⚠️ Não calcular tempo de lotação ou ganho por período sem eventos suficientes.

---

## Eventos relacionados

Histórico animal pode envolver:

* cadastro/entrada;
* compra;
* parto/nascimento;
* sanitário;
* pesagem;
* nutrição;
* movimentação;
* reprodução;
* venda;
* óbito;
* financeiro.

---

## Edge cases

Verificar:

* animal sem data de nascimento;
* animal sem lote;
* animal sem categoria;
* estágio desconhecido;
* sexo ausente;
* duplicidade de brinco/código;
* animal vendido com agenda ativa;
* animal morto em lote ativo;
* animal comprado sem origem completa;
* cria sem vínculo mãe/parto;
* alteração manual que contradiz evento histórico.

---

## Critério de aceite

Uma mudança no domínio animal é aceitável quando:

* preserva identidade;
* preserva `fazenda_id`;
* separa categoria, estágio, status, sexo e raça;
* não usa classificação como decisão crítica;
* não usa `state_*` como histórico;
* não usa agenda como fato;
* declara limitação quando a fonte é insuficiente;
* mantém rastreabilidade por evento quando houver fato operacional.

```


```