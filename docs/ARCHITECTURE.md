# Arquitetura: Two Rails & Event Sourcing

O sistema opera sob o paradigma de **Two Rails** para conciliar a necessidade de um estado atual rápido com a rastreabilidade total de fatos passados.

## Rail 1: Agenda (Mutável)
A Agenda representa o **futuro**. É uma lista de intenções que podem ser alteradas, adiadas ou canceladas.
- **Status:** `agendado -> concluido | cancelado`.
- **Deduplicação:** Essencial para evitar ruído em protocolos automatizados.

## Rail 2: Eventos (Append-Only)
Os Eventos representam o **passado**. São fatos imutáveis que ocorreram no campo.
- **Imutabilidade:** Garantida por triggers de banco (`prevent_business_update`) que bloqueiam qualquer `UPDATE` em colunas de negócio.
- **Correções:** Se um peso foi digitado errado, não se edita o evento. Lança-se um novo evento de "Contra-lançamento" ou "Correção" que referencia o original.

## Por que "Sem FK dura" entre Agenda e Evento?
Não existe uma Foreign Key rígida ligando `agenda_itens` a `eventos`.
- **Motivo:** Um evento pode ocorrer sem ter sido agendado (manejo de emergência). Uma tarefa agendada pode ser concluída por múltiplos eventos ou por um evento que cobre várias tarefas.
- **Referência Lógica:** Usamos `source_evento_id` na agenda apenas para rastreabilidade, permitindo que o sistema de sync seja desacoplado e resiliente a falhas parciais.