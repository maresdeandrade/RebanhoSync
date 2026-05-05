## 1. Diagnóstico do modelo atual

O modelo atual, consubstanciado na baseline `00000000000000_rebuild_base_schema_sanitario.sql` e nos tipos canônicos em `src/lib/offline/types.ts`, apresenta uma base estrutural sólida para a expansão do catálogo e geração de agenda sanitária. As tabelas principais que ancoram esse domínio são:

- `catalogo_protocolos_oficiais` e `catalogo_protocolos_oficiais_itens`: Suportam corretamente o `status_legal` (`obrigatorio`, `recomendado`, `boa_pratica`), `gatilho_tipo` (`idade`, `risco`, `calendario`, etc.), `gera_agenda` (booleano crucial) e dependências (`requires_vet`, `requires_gta`).
- `catalogo_doencas_notificaveis`: Provê uma tabela isolada para a vigilância de síndromes e doenças, apartada do agendamento de rotina.
- `fazenda_sanidade_config`: Guarda os qualificadores da propriedade (`zona_raiva_risco`, `pressao_carrapato`, `pressao_helmintos`, `modo_calendario`) que agem como _gates_ para ativação de protocolos.
- `produtos_veterinarios`: Entidade base e desvinculada para seleção de insumos.

**Conclusão:** Os campos disponíveis no banco de dados e nos read models do TypeScript são *suficientes*. A base está aderente e preparada para escalar, sem riscos arquiteturais maiores.

## 2. Lacunas para finalizar sanitário/agenda

As lacunas mapeadas não são estruturais (Schema), mas operacionais e de preenchimento (Seed/Contratos):

1.  **Falta de deliberação sobre `gera_agenda`:** A lógica atual precisa ser alimentada com quais gatilhos acionam a inserção em agenda vs quais apenas disparam a vigilância/notificação (aftosa).
2.  **Calibração dos Gatilhos de Risco e Calendário:** Os JSONs de gatilho (`gatilho_json`) precisam parametrizar o cruzamento entre as políticas do produtor (`modo_calendario`) e os protocolos que são apenas "boa prática" ou "recomendados", impedindo flood na agenda.
3.  **Vigilância Desvinculada de Rotina:** Clarificar, no seed e nos helpers do catálogo, que a PNEFA e as doenças da IN MAPA 50/2013 populam eventos/alertas, mas não geram doses rotineiras.
4.  **Produtos sem granularidade extrema:** O catálogo atual (com 8 itens) precisa crescer, mantendo a diretriz de classes/princípios ativos (ex: Ivermectina 1%, Vacina Polivalente) ao invés de atrelar marcas comerciais.

## 3. Matriz proposta de expansão do catálogo

| `family_code` | `protocol_slug` | `nome` | `status_legal` | `area` | `categoria_animal` | `gatilho_tipo` | `gatilho_json` | `frequencia_json` | `gera_agenda` | `requires_vet` | `requires_gta` | `tipo_evento_sanitario` | `dedup_strategy` | `bloqueia_movimentacao` | `fonte_base` | `observacao` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `brucelose` | `brucelose-bezerras` | Brucelose (B19/RB51) | `obrigatorio` | `vacinacao` | `bezerra` | `idade` | `{"sexo_alvo":"F","age_start_days":90,"age_end_days":240}` | `{"dose_num":1}` | **SIM** | SIM | NÃO | `vacinacao` | `milestone_code` | SIM (>8m) | PNCEBT | Obrigatório fêmeas 3-8m. |
| `raiva_herbivoros` | `raiva-risco` | Raiva dos Herbívoros | `recomendado` | `vacinacao` | `todos` | `risco` | `{"risk_field":"zona_raiva_risco","risk_values":["medio","alto"]}` | `{"interval_days":365}` | **SIM** (se risco) | NÃO | NÃO | `vacinacao` | `sequence_order` | NÃO | PNCRH | Apenas áreas de risco. |
| `aftosa` | `aftosa-vigilancia` | Febre Aftosa (Vigilância) | `obrigatorio` | `notificacao` | `todos` | `movimento` | `{"alert_symptoms":["vesiculas"]}` | `{}` | **NÃO** | NÃO | SIM | `notificacao` | N/A | SIM | PNEFA | Não gera vacinação. Suspeita bloqueia trânsito. |
| `clostridiose` | `clostridiose-padrao`| Vacina Polivalente Clostridioses | `boa_pratica` | `vacinacao` | `todos` | `calendario` | `{"fase":"padrao"}` | `{"interval_days":365}` | **SIM** (se ativado) | NÃO | NÃO | `vacinacao` | `annual_ref` | NÃO | Técnico | Recomendado. 1ª dose + reforço + anual. |
| `ibr_bvd` | `reprodutivo-ibr-bvd` | Vacina IBR/BVD | `recomendado` | `vacinacao` | `reprodutores` | `calendario` | `{"fase":"pre-estacao"}` | `{"interval_days":365}` | **SIM** (se ativado) | NÃO | NÃO | `vacinacao` | `annual_ref` | NÃO | Técnico | Reprodutores. |
| `endo_ectoparasitas`| `controle-parasitario`| Vermifugação/Carrapaticida | `boa_pratica` | `parasitas` | `todos` | `risco` | `{"risk_field":"pressao_helmintos", "risk_values":["alto"]}`| `{"interval_days":180}` | **SIM** (se ativado) | NÃO | NÃO | `vermifugacao` | `temporal` | NÃO | Técnico | Depende de `pressao_helmintos/carrapato`. |

## 4. Itens que geram agenda vs não geram

**Geram agenda (`gera_agenda: true`):**
- Brucelose em fêmeas de 3 a 8 meses (automático por idade).
- Raiva dos herbívoros (condicionado a zona de médio/alto risco).
- Rotinas técnicas (Clostridiose, IBR/BVD) apenas se a fazenda ativou o `modo_calendario` correspondente.
- Controle parasito (Vermifugação, carrapaticidas) se houver protocolo ativo pela fazenda.

**Não geram agenda automática (`gera_agenda: false`):**
- Vacinação rotineira de Febre Aftosa.
- Doenças da IN MAPA 50/2013 (apenas monitoramento e notificação).
- Checklist e inspeções de GTA.
- Alertas de suspeitas clínicas.

## 5. Itens que exigem configuração por fazenda

A geração de agenda destes itens é derivada do estado do `fazenda_sanidade_config` e da escolha de _opt-in_:
- **Raiva:** Gatilho atrelado diretamente à variável `zona_raiva_risco`.
- **Controle parasitário:** Condicionado à `pressao_carrapato` e `pressao_helmintos`.
- **Rotinas recomendadas (Clostridioses, etc.):** A matriz só avança para agenda se o `modo_calendario` estiver setado como `tecnico_recomendado` ou `completo`.

## 6. Itens que exigem validação normativa posterior

- **Brucelose (`requires_vet`):** A execução demanda validação de supervisão por Médico Veterinário.
- **Movimentação e GTA (`requires_gta`):** As notificações ou restrições geram impedimento para embarque.
- **Carência:** Uso de certos medicamentos veterinários e a validação do `carencia_regra_json` influenciará o status do animal para restrições temporárias para abate/ordenha.

## 7. Migration ou código/seed?

O diagnóstico é taxativo: **Não é necessária nenhuma migration.**
O schema atual em `00000000000000_rebuild_base_schema_sanitario.sql` já contempla todos os campos da matriz (booleans, enums de gatilho, campos JSON e relacionamentos). O esforço consiste apenas na inserção no arquivo `supabase/seed.sql` e ajustes lógicos nos helpers de catálogos e customizações em `src/lib/sanitario/catalog/`.

## 8. Plano de implementação em 3 etapas

1.  **Etapa de Infraestrutura de Dados (Seed):**
    - Atualizar e expandir o `supabase/seed.sql` para abranger a matriz completa.
    - Assegurar a conversão da Aftosa de protocolo rotineiro para doença de notificação.
    - Inserir a nova lista conservadora de princípios ativos e classes em `produtos_veterinarios`.
2.  **Etapa de Frontend e Regras (Catálogos e Configurações):**
    - Atualizar a delegação do `gera_agenda` no parseamento em `src/lib/sanitario/catalog/officialCatalog.ts`.
    - Ajustar a configuração por fazenda em `src/lib/sanitario/customization/` para mapear corretamente os novos `risk_fields` na materialização.
3.  **Etapa de Testes e Compatibilidade:**
    - Ajustar fixtures e golden tests que talvez esperassem a materialização forçada de aftosa.
    - Validar o idempotency do payload sanitário das doenças remapeadas e garantir a resiliência dos engines locais.

## 9. Riscos principais

- **Regressão nos Testes:** Testes focados no comportamento legado (que pressupõe Aftosa universal) irão quebrar e precisam ser readaptados à nova norma.
- **Gatilhos Complexos:** Os JSONs em `gatilho_json` e `frequencia_json` podem ser silenciosamente falhos se não houver um _schema validation_ estrito em tempo de execução para os novos cenários (`risk_field`, `fase`).
- **Idempotência do Seed:** Alterar radicalmente o comportamento dos itens do Seed no meio do ciclo de testes pode impactar o fluxo de desenvolvedores com bancos locais desatualizados caso as PKs (slugs/codigos) colidam.
