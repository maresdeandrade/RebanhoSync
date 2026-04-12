# Estado Atual do Repositorio

> **Status:** Derivado (Snapshot Operacional)
> **Fonte de Verdade:** `src/`, `supabase/`, `package.json`
> **Ultima Atualizacao:** 2026-04-12

## Resumo

O repositorio esta em **beta interno** - MVP completo e operacional. A base tecnica principal esta funcional e testada: aplicacao React 19, banco local Dexie v11, sync offline-first com rollback, schema Supabase com RLS endurecida, taxonomia canonica bovina, automacao de build/test/lint e conjunto relevante de testes automatizados.

Todos os TDs da lista original foram fechados via migrations de marco/2026. Nao ha bloqueadores para uso interno controlado.

## Camadas Consolidadas

- Home orientada a operacao diaria com alertas sanitarios priorizados por criticidade.
- Onboarding inicial da fazenda.
- Importacao CSV para animais, lotes e pastos.
- Registro rapido de manejos principais em `Registrar`.
- Dashboard administrativo com leitura de sanitario critico.
- Dashboard reprodutivo dedicado.
- Agenda com badges de resumo por agrupamento: tipos e buckets de prazo por animal, composicao de animais por evento.
- Agrupamento por evento na agenda endurecido com assinatura canonica por protocolo, marco ou combinacao operacional mais rica.
- Agenda ordena grupos por urgencia real do card, priorizando atrasados, hoje e proximos antes de grupos sem pendencias abertas.
- Agenda permite filtros rapidos clicando nos badges de resumo dos cards, refletindo o atalho ativo no topo da tela.
- Agenda usa os badges-resumo como navegacao contextual, rolando e destacando as linhas relevantes do grupo clicado.
- Agenda agora recolhe grupos por padrao, autoexpande o grupo contextual e mostra quantos itens seguem visiveis dentro do total do card.
- Agenda permite comparar o recorte rapido com o contexto completo do grupo via `Ver grupo completo` sem perder os filtros globais.
- Agenda destaca a proxima acao recomendada no cabecalho de cada grupo e permite abrir o fluxo direto sem expandir o card.
- Agenda persiste por usuario/fazenda o modo de agrupamento, filtros, grupos expandidos e recorte contextual da triagem.
- Agenda agora tem testes de interacao cobrindo rehidratacao do estado salvo e o fluxo `badge -> foco -> expandir -> revelar grupo completo`.
- Agenda reduz densidade no mobile com overflow `+N` nos badges e concentra acoes secundarias do grupo em um menu compacto.
- Agenda oferece atalhos para saltar entre grupos atrasados do recorte atual, reaproveitando o foco contextual e a autoexpansao do card alvo.
- Ficha reprodutiva por matriz.
- Pos-parto neonatal para crias recem-geradas.
- Cria inicial pos-parto com identificacao final e pesagem neonatal.
- Transicoes do rebanho com historico consolidado.
- Ficha do animal com vinculos mae/cria e curva de peso.
- Lista de animais agrupando matriz e cria na mesma leitura.
- Badges visuais por estagio de vida com icone base + modificadores.
- Regra de elegibilidade reprodutiva por categoria.
- Relatorios operacionais com exportacao/impressao e prioridade sanitaria contextual.
- Automacao local de lembretes sanitarios com preferencia por criticidade, follow-up e horario de silencio.
- Editor de protocolos sanitarios por fazenda com customizacao de cabecalho, etapas, deduplicacao, `calendario_base` explicito e vinculo ao catalogo `produtos_veterinarios`.
- Biblioteca canonica de protocolos sanitarios padrao extraida da UI, com `calendario_base` estruturado por protocolo e por etapa.
- `Registrar`, `ProtocolosSanitarios` e editor da fazenda agora descrevem a agenda sanitaria a partir do `payload.calendario_base`, em vez de depender apenas de `intervalo_dias`.
- O motor server-side da agenda sanitaria agora le `payload.calendario_base` e gera pendencias declarativas por campanha, janela etaria, intervalo recorrente e ancoras operacionais, inclusive para itens nao vacinais com `gera_agenda = true`.
- O recompute sanitario agora reconstrui as pendencias automaticas do escopo recalculado antes de reaplicar o motor declarativo, evitando drift quando risco, protocolo, item ou payload do animal mudam.
- Agenda e relatorios agora projetam o rotulo do `calendario_base` na leitura operacional das pendencias sanitarias, evitando reduzir toda periodicidade a um simples `X dias`.
- A agenda agora tambem projeta `mode` e `anchor` do `calendario_base` como sinal operacional e filtro persistido, enquanto os relatorios/exportacoes exibem o tipo declarativo da agenda (`campanha`, `janela etaria`, `recorrente`, `uso imediato` ou `protocolo clinico`).
- `Home` e `Dashboard` agora reutilizam a mesma leitura declarativa do sanitario, exibindo cortes por tipo de calendario e abrindo a agenda ja filtrada por `calendarMode`.
- A agenda agora tambem aceita `calendarAnchor` como filtro persistido e deep-link, enquanto o `Dashboard` expoe recortes por ancora operacional (`Nascimento`, `Desmama`, `Calendario`, `Secagem`, `Necessidade clinica`).
- `Animais` e `AnimalDetalhe` agora tambem projetam `mode`, `anchor` e rotulo do `calendario_base` na leitura animal-centric do proximo manejo, e a listagem aceita recortes por `calendarMode` / `calendarAnchor`.
- Fundacao regulatoria do sanitario com catalogo global versionado (`catalogo_protocolos_oficiais*`, `catalogo_doencas_notificaveis`) e `fazenda_sanidade_config` tenant-scoped.
- Selecao do pack oficial agora suporta nucleo federal + overlay estadual + ajuste por risco da fazenda.
- `ProtocolosSanitarios` agora expoe uma superficie de ativacao do pack oficial por fazenda, com preview da selecao regulatoria, configuracao de risco e reaplicacao controlada para owner/manager.
- A aba de protocolos agora separa explicitamente tres camadas: base regulatoria oficial, overlay operacional do pack e protocolos operacionais da fazenda, reduzindo a leitura de cards aparentemente repetidos.
- A biblioteca padrao da UI deixou de expor aftosa como calendario vacinal base.
- `Registrar` agora diferencia movimentacao interna de transito externo e aplica checklist GTA/e-GTA com bloqueio documental e pre-check PNCEBT para reproducao interestadual.
- `AnimalDetalhe` agora abre e encerra suspeita sanitaria a partir do catalogo oficial de doencas notificaveis, gravando evento append-only e bloqueando movimentacao/venda enquanto a suspeita permanecer aberta.
- Bloqueio local por suspeita sanitaria agora tambem fecha os atalhos de movimentacao fora do `Registrar`, incluindo ficha do animal, adicao em lote e mudanca de lote em massa.
- O overlay regulatorio oficial agora tambem roda no runtime com um gerenciador de conformidade para `feed-ban` de ruminantes e checklists operacionais de agua/limpeza, quarentena, atualizacao documental e boas praticas.
- O dominio append-only `conformidade` passou a registrar verificacoes regulatorio-operacionais no historico sem exigir alvo animal/lote, enquanto `fazenda_sanidade_config.payload.overlay_runtime` guarda o estado mutavel dessas checagens por fazenda.
- A agenda agora projeta o `overlay_runtime` de conformidade com badges de restricao no topo e nos grupos, alerta operacional para `feed-ban` e checklists criticos pendentes, e segue visivel mesmo quando `agenda_itens` ainda estiver vazia.
- `Registrar` agora transforma o `overlay_runtime` de conformidade em bloqueios contextuais reais para nutricao e movimentacao, impedindo continuidade quando `feed-ban`, quarentena ou exigencias documentais criticas estiverem em aberto.
- Os fluxos auxiliares de movimentacao tambem passaram a respeitar o overlay regulatorio ativo, bloqueando mover animal, adicionar animais em lote e transicoes em massa quando houver risco de conformidade aberto.
- A leitura regulatoria da fazenda agora passa por um read model compartilhado (`regulatoryReadModel`), que centraliza overlay ativo, atencao de conformidade e bloqueios por contexto antes de projetar isso nas telas.
- `Home`, `Dashboard`, `Financeiro` e `Relatorios` agora exibem a mesma leitura regulatoria da agenda, com pendencias abertas, badges de restricao, impacto em nutricao/transito/venda e CTA coerente para o overlay oficial.
- O `Financeiro` tambem deixou de tratar `venda` como acao neutra: a superficie passou a destacar bloqueios do overlay e separar `Nova compra` de `Nova venda`, desabilitando a venda quando houver restricao regulatoria aberta.
- `Eventos` agora projeta o mesmo read model regulatorio, destacando conformidade aberta, bloqueios de nutricao/venda-transito e CTA direto para abrir o overlay ou filtrar o dominio `conformidade`.
- `LoteDetalhe` agora antecipa restricoes internas de movimentacao a partir do overlay oficial, sinaliza revisao/bloqueio no cabecalho do lote e desabilita `Adicionar animais` quando houver impeditivo regulatorio aberto.
- O `Dashboard` agora projeta recortes analiticos regulatorios por subarea (`feed-ban`, quarentena, documental e agua/limpeza) e por impacto operacional (nutricao, lote e transito/venda), sempre derivados do mesmo `regulatoryReadModel`.
- O `RegulatoryOverlayManager` agora aceita recortes analiticos por query string e abre o overlay oficial ja filtrado por subarea ou impacto, permitindo que os CTAs do dashboard levem o usuario direto ao subconjunto correto.
- `Relatorios` agora expande esses mesmos recortes analiticos no resumo operacional, exporta as linhas de subarea/impacto em CSV e oferece CTA direto para overlay oficial ou historico ja filtrado.
- `Eventos` agora honra `dominio`, `overlaySubarea` e `overlayImpact` via query string, abrindo o historico operacional ja recortado para a frente regulatoria correta sem reinterpretar o overlay fora do read model compartilhado.
- `Animais` agora tambem aceita `overlaySubarea` e `overlayImpact`, projeta badges de restricao por linha, permite recorte animal-centric por impacto/subarea e exporta CSV dedicado com os animais afetados pela restricao operacional atual.
- `Dashboard` e `Relatorios` agora apontam tambem para a lista animal-centric recortada, fechando a navegacao entre painel analitico, overlay oficial, historico e rebanho impactado.
- Telemetria de piloto com buffer local em `metrics_events`, flush remoto periodico por Edge Function e painel de saude do sync por fazenda.
- Modo de experiencia por fazenda (`essencial` vs `completo`).
- Taxonomia canonica bovina (3 eixos, contrato v1, SQL view, teste de paridade).
- RBAC de animais restrito a owner/manager (TD-003 CLOSED).
- FKs compostas em movimentacao e reproducao (TD-019, TD-020 CLOSED).
- View `vw_animal_gmd` para calculo de GMD server-side (TD-015 CLOSED).
- Catalogo `produtos_veterinarios` integrado ao fluxo sanitario com cache local, sugestoes no `Registrar` e referencia estruturada em protocolos/eventos.

## Estado Tecnico

- `pnpm exec eslint` (arquivos alterados): verde
- `pnpm exec tsc --noEmit`: verde
- `pnpm run build`: verde
- `pnpm exec vitest run` (sanitario + relatorios): verde
- `pnpm run lint`: verde
- `pnpm run test:e2e`: cobre onboarding, importacoes, relatorios e o fluxo parto -> pos-parto -> cria inicial
- Unitarios: 25+ arquivos de teste em `src/lib/` e `src/pages/`

## Lacunas Residuais

- Nenhuma lacuna aberta de observabilidade nesta revisao; a telemetria de piloto agora sobe periodicamente para o backend e alimenta o painel remoto de sync.
- Aviso conhecido de `caniuse-lite` desatualizado no build (cosmetico).

## Leitura Recomendada para Retomada

1. `README.md`
2. `ARCHITECTURE.md`
3. `OFFLINE.md`
4. `STACK.md`
5. `ROUTES.md`
6. `TECH_DEBT.md`
