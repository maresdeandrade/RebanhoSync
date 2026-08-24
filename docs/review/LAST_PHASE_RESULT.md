# Resultado funcional mais recente — Fase 18 / Rebaseline Visual 360°

Atualizado em: 2026-08-24
Baseline documental de abertura: `ada8376b545b2ae3a3706de2f09305e0ad0ca848`
Decisão final: **READY — Fase 18 concluída**

## Resultado

A Fase 18 inventariou a superfície visual ativa, definiu o Design System alvo e consolidou a migração em uma matriz P0–P3. Foram confirmadas 47 entradas ativas no router, 58 primitives/arquivos compartilhados em `src/components/ui`, 63 arquivos com cores Tailwind hardcoded, 851 ocorrências dessas cores, 265 valores arbitrários e nove inline styles majoritariamente dinâmicos.

Os sete contratos documentais foram criados em `docs/design-system/`: foundations, cores semânticas, estados operacionais, padrões de componentes, padrões de telas, regras responsivas e plano de migração.

## Inspeção visual autenticada

Home, Animais, AnimalDetalhe, Registrar e Agenda foram inspecionadas com fixture local autenticada em desktop/mobile e light/dark. O único P0 confirmado estava no primeiro passo do Registrar: os controles de contexto sobrepunham e cortavam rótulos em 390 e 768 px.

O seletor passou a empilhar abaixo de `lg` e mantém duas colunas em 1024 px+. A revalidação em 390×844, 768×1024 e 1024×768, nos temas claro e escuro, confirmou:

- zero overlap e zero clipping;
- rótulos completos;
- controles com 48 px de altura;
- foco visível;
- seleção de contexto e avanço para a etapa 2 preservados.

**P0 aberto: 0.** Home, Animais, AnimalDetalhe, Registrar e Agenda permanecem P1 para a migração ampla da F20; dívidas P2/P3 seguem a matriz de migração.

## Guardrails confirmados

- branding permanece separado de semântica operacional;
- estados críticos não dependem somente de cor no contrato alvo;
- Agenda continua intenção futura, Evento continua fato e `state_*` continua estado/read model;
- peso observado não foi promovido automaticamente a peso atual confiável;
- nenhum writer, fonte factual, sync, Dexie, migration, RLS, RPC ou regra de domínio foi alterado;
- Fase 19 não foi implementada.

## Validação

- teste focado de `RegistrarSelectTargetStep`: 2/2 testes aprovados;
- matriz visual autenticada 390/768/1024 light/dark: aprovada;
- `pnpm run lint`: aprovado;
- `pnpm run build`: aprovado, mantendo apenas warnings conhecidos de Browserslist, importação mista de `db.ts` e tamanho de chunks;
- `pnpm run gates:docs`: aprovado;
- `git diff --check`: aprovado.

## Impacto arquitetural

O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) permanece **PRESERVADO**. A única mudança de produto foi de layout responsivo no seletor de contexto do Registrar.

## Próximo estado

O marcador foi avançado para a **Fase 19 — Foundations + Shell + Branding**, cuja implementação ainda não foi iniciada. A migração ampla de Home, Animais, AnimalDetalhe, Registrar e Agenda permanece reservada à F20.
