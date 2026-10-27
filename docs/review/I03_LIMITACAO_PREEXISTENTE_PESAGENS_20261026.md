# I03 — Limitação preexistente: novo salvamento pode repetir pesagem neonatal

Status: limitação reproduzida; investigação posterior proposta. Não corrigida por I03.

Baseline inspecionada: `codex/sanitario-v2-functional-validation`, HEAD
`1a4a72c4fb65a448b628659fc341ca13fc8e0286`, referência histórica
`origin/main@6f1b8dcec93254d60be73757a6515193240e208c`.

## Reprodução e evidência

1. Registrar a ficha neonatal com peso de 32 kg e horário T1.
2. Após o commit local, fechar/reabrir a ficha ou reiniciar o cliente antes de
   reconhecer o resultado. O formulário repõe o peso de `neonatal_setup.initial_weight_kg`.
3. Salvar novamente sem nova medição. O handler produz um novo `occurredAt` T2.
4. O comando recebe outra identidade de transação e produz outro Evento de pesagem.

Na revisão independente, um ensaio em memória com os módulos reais, Dexie e
fake-indexeddb executou dois registros equivalentes, separados por fechamento e
reabertura do banco, variando `occurredAt` de `2026-04-01T12:00:00.000Z` para
`2026-04-01T12:00:01.000Z`. Resultado observado: **2 detalhes de pesagem e 2 gestures**.
Não foi realizada escrita remota. A reprodução direta na interface é um cenário
derivado do wiring inspecionado, não uma evidência de E2E executado.

## Mecanismo e impacto factual

- `AnimalPosParto.tsx` e `AnimalCriaInicial.tsx`: `getInitialDraft` preenche o peso já
  registrado; `handleSave` gera um horário novo em cada submissão.
- `registerPostPartum.ts`: a identidade inclui `occurredAt`; T1 e T2 não são replay
  da mesma entrada.
- `postPartum.ts`: peso parseável gera um novo Evento e detalhe de pesagem.

Uma mesma medição pode, portanto, aparecer como dois fatos, com horários e IDs
distintos, afetando o histórico e seus consumidores. Deduplicar intenções de Agenda
V2 não deduplica esses fatos. O padrão factual já existia antes de I03; esta rodada
preserva o writer de pesagens. A proteção de replay validada por I03 se limita à
reutilização da mesma entrada/identidade persistida; não certifica novo salvamento
com outro horário como repetição segura da mesma medição.

## Investigação posterior proposta

Separar edição cadastral de uma nova medição e definir a identidade da ação factual
que deve sobreviver a crash/restart. Investigar como reencontrar a ação já persistida
antes de criar outra. Não colapsar pesos iguais automaticamente: duas medições reais
podem legitimamente ter o mesmo valor. A solução exige testes próprios de repetição,
novo fato legítimo, rejeição, sucesso parcial e replay offline, antes de alterar o writer.

Sem backfill, remoção de fatos, migração de envelopes antigos ou certificação de
convergência remota.
