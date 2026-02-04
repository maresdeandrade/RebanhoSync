# Roteiro de Testes E2E (MVP)

## Fluxo A: Sanitário Offline
1.  Abra o app e garanta que os dados foram carregados (TopBar Online).
2.  Desligue a internet (Modo Avião).
3.  Vá em **Registrar** -> Selecione Lote -> Selecione 3 animais.
4.  Escolha **Sanitário** -> Vacinação -> "Febre Aftosa".
5.  Confirme. Verifique o contador de "Pendentes" na TopBar.
6.  Ligue a internet. Verifique o contador zerar.
7.  Vá em **Animais** -> Selecione um dos animais -> Aba **Timeline** e veja o evento.

## Fluxo B: Movimentação (Anti-Teleporte)
1.  Vá em **Registrar** -> Selecione um animal.
2.  Escolha **Mover** -> Selecione um lote destino diferente.
3.  Confirme.
4.  Verifique no detalhe do animal se o lote foi atualizado instantaneamente (Otimista).
5.  Se o sync falhar (simule erro no servidor), o animal deve voltar ao lote original (Rollback).

## Fluxo C: Dashboard
1.  Navegue para **Dashboard**.
2.  Verifique se os cards refletem o total de animais e pendências do Dexie local.