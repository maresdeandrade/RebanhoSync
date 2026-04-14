# Guia de Protocolos Sanitários — Uso no Produto, Agenda e Fluxos Operacionais

**Versão:** 1.1  
**Data:** 13.04.2026  
**Público:** Managers, Owners e Usuários Avançados

---

## Escopo deste guia

Este documento explica **como o produto modela protocolos sanitários**, etapas, agenda automática, dependências, elegibilidade e registro operacional na fazenda.

Ele tem finalidade **funcional e operacional**. Não substitui legislação, instruções normativas, programas oficiais ou orientação veterinária. Quando houver temas regulatórios, o sistema deve considerar a **parametrização oficial aplicável à jurisdição da fazenda** e as configurações vigentes da plataforma.

### Como interpretar os exemplos deste guia
- Os exemplos abaixo são **ilustrativos**.
- Eles existem para mostrar **como o sistema funciona**.
- Quando o tema envolver obrigação oficial, a configuração real deve ser validada na camada regulatória da plataforma e nas normas aplicáveis.

---

## Índice

1. [O que são protocolos](#o-que-são-protocolos)
2. [Valor entregue pelo produto](#valor-entregue-pelo-produto)
3. [Camadas de protocolos](#camadas-de-protocolos)
4. [Como a agenda nasce](#como-a-agenda-nasce)
5. [Fluxo: criar um protocolo](#fluxo-criar-um-protocolo)
6. [Fluxo: editar um protocolo](#fluxo-editar-um-protocolo)
7. [Dicionário de campos](#dicionário-de-campos)
8. [Exemplos sanitários seguros](#exemplos-sanitários-seguros)
9. [Troubleshooting](#troubleshooting)
10. [Resumo executivo](#resumo-executivo)



---

## O que são protocolos

Um **protocolo sanitário** é uma definição estruturada de etapas que o sistema usa para calcular, registrar e acompanhar ações sanitárias aplicáveis à fazenda.

Cada protocolo responde a cinco perguntas:

1. **O que fazer**  
   Ex.: vacinar, testar, isolar, revisar, aplicar medicamento, notificar.

2. **Quando fazer**  
   Ex.: por janela etária, campanha, recorrência ou evento imediato.

3. **Para quem fazer**  
   Ex.: apenas fêmeas, apenas determinada categoria, apenas animais elegíveis.

4. **Sob quais condições a etapa se aplica**  
   Ex.: sempre, por jurisdição, por risco, por evento ou por perfil do animal.

5. **Como a execução deve ser registrada**  
   Ex.: produto, dose, responsável, documento, vínculo com evento ou etapa anterior.

### Estrutura básica

```text
PROTOCOLO
├─ define a intenção sanitária
├─ agrupa uma ou mais etapas
└─ aplica regras gerais de elegibilidade e compliance

ETAPA
├─ define uma ação atômica
├─ possui regra própria de agenda
├─ pode depender de outra etapa
└─ gera ou não gera pendência automática
```

### Regra de modelagem

Uma etapa deve representar **uma ação atômica**.

Exemplos:

* uma dose = uma etapa;
* um teste = uma etapa;
* um isolamento = uma etapa;
* um reforço = uma etapa própria.

---

## Valor entregue pelo produto

| Funcionalidade           | Valor para a fazenda                       | Resultado esperado                                                   |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------- |
| Agenda automática        | reduz esquecimento                         | o sistema calcula pendências elegíveis sem planilha manual           |
| Rastreabilidade          | preserva histórico operacional             | cada execução fica vinculada a data, produto, responsável e contexto |
| Conformidade operacional | ajuda a organizar rotinas sensíveis        | obrigações aplicáveis e processos críticos ficam visíveis            |
| Padronização             | reduz variação entre pessoas e turnos      | a equipe executa com mais consistência                               |
| Escalabilidade           | facilita expansão do rebanho e da operação | protocolos reutilizáveis com menos retrabalho                        |

### Exemplo simples

Sem sistema:

* alguém precisa lembrar manualmente de datas, janelas e reforços;
* tarefas dependem de memória, planilhas ou recados;
* é fácil perder o timing de uma etapa.

Com sistema:

* o protocolo descreve a regra;
* a agenda nasce a partir dessa regra;
* a execução gera histórico;
* relatórios mostram pendências, concluídos e atrasos.

---

## Camadas de protocolos

O produto organiza protocolos em três camadas.

### 1. Pack Oficial

Reúne **obrigações sanitárias oficiais aplicáveis à fazenda**, conforme jurisdição, contexto sanitário e parametrização da plataforma.

Pode incluir:

* vacinação obrigatória;
* testes oficiais;
* notificações obrigatórias;
* procedimentos imediatos de defesa sanitária;
* exigências documentais ou de trânsito.

**Função**

* tornar visíveis as obrigações oficiais aplicáveis;
* impedir lacunas operacionais em temas críticos;
* centralizar execução e evidência.

**O usuário pode**

* visualizar;
* aplicar à fazenda;
* acompanhar pendências;
* registrar execução.

**O usuário não pode**

* editar a obrigação oficial principal;
* duplicar a mesma obrigação oficial com protocolo paralelo equivalente.

> Importante: nem toda obrigação oficial é vacinação.
> Ex.: tuberculose bovina deve ser modelada como **teste/controle sanitário**, não como vacina.
> Para diagnóstico da tuberculose, o MAPA usa testes alérgicos de tuberculinização intradérmica realizados por médico veterinário habilitado ou oficial. ([Serviços e Informações do Brasil][1])

---

### 2. Templates Canônicos

São modelos recomendados pela plataforma para acelerar a adoção de boas práticas operacionais.

**Função**

* reduzir retrabalho;
* oferecer ponto de partida;
* facilitar adaptação para realidades locais.

**Fluxo**

1. visualizar template;
2. importar;
3. gerar cópia para a fazenda;
4. adaptar a cópia local.

---

### 3. Protocolos Customizados

São protocolos criados ou adaptados pela própria fazenda para cobrir:

* rotinas internas;
* estratégias locais;
* complementos operacionais;
* processos não cobertos pelo Pack Oficial.

**Função**

* transformar a estratégia da fazenda em execução rastreável;
* registrar "como fazemos aqui";
* complementar, mas não duplicar, a obrigação oficial principal.

---

## Como a agenda nasce

A agenda nasce a partir de **uma etapa** e do seu **modo de calendário**.

### Modos do calendário

#### 1. Janela etária

Use quando a etapa deve ficar pendente dentro de uma faixa de idade calculada a partir de uma âncora.

Exemplo:

* entre 90 e 240 dias desde o nascimento.

#### 2. Campanha

Use quando a etapa depende de competência temporal, como meses do ano, e pode ainda depender de elegibilidade territorial ou sanitária.

Exemplo:

* campanha sazonal parametrizada por região.

#### 3. Rotina recorrente

Use quando a etapa reaparece por intervalo fixo a partir de uma conclusão válida ou outra âncora recorrente.

Exemplo:

* reforço anual;
* revisão semestral;
* reaplicação 30 dias após uma etapa anterior.

#### 4. Procedimento imediato

Use quando a etapa não deve criar próxima agenda automática e deve ser executada a partir de um evento clínico, sanitário ou operacional.

Exemplo:

* isolamento;
* notificação;
* descarte;
* ação emergencial.

#### 5. Não estruturado

Valor reservado para legado, importação ou casos antigos.
Não deve ser o padrão para novos protocolos oficiais.

---

## Âncora do calendário

A âncora é a **data-base do cálculo**.

Âncoras suportadas:

* nascimento;
* entrada na fazenda;
* conclusão de etapa dependente;
* última conclusão da mesma família sanitária;
* desmama;
* parto previsto;
* movimentação;
* diagnóstico de evento;
* sem âncora.

### Regra operacional

Nos modos estruturados, a plataforma deve preferir **âncora explícita**.
"Sem âncora" deve ser exceção, não padrão.

---

## Elegibilidade, aplicabilidade e compliance

Essas três camadas são diferentes.

### Elegibilidade

Define **para quem** a etapa pode aparecer.

Exemplos:

* sexo;
* espécie;
* categoria;
* idade;
* lote;
* perfil animal.

### Aplicabilidade

Define **em quais condições** a etapa passa a valer.

Exemplos:

* sempre;
* por jurisdição;
* por risco;
* por evento;
* por perfil do animal.

### Compliance

Define **como a etapa deve ser tratada operacionalmente**.

Exemplos:

* obrigatória quando aplicável;
* obrigatória por risco;
* requer veterinário;
* exige documento;
* gera agenda automática.

---

## Deduplicação

O produto não depende apenas do texto digitado no código da etapa para evitar duplicidade.

A identidade funcional da pendência considera:

* família sanitária;
* milestone da etapa;
* escopo de aplicação;
* regra de agenda;
* origem temporal ou janela lógica.

### Em termos práticos

* o **código da etapa** serve para leitura humana, dependências e auditoria;
* a prevenção de duplicidade funcional usa também a **família sanitária** e o **milestone**;
* duas rotinas diferentes não devem abrir agendas paralelas para a mesma obrigação principal no mesmo escopo, salvo quando forem complementos operacionais distintos.

---

## Fluxo: criar um protocolo

### Pré-requisito

* perfil com permissão de gestão;
* acesso ao módulo de Protocolos Sanitários.

### Passo 1 — Escolher a camada correta

Antes de criar, decida:

* isso é obrigação oficial já coberta pelo Pack?
* isso é template reutilizável?
* isso é rotina interna da fazenda?

### Passo 2 — Preencher informações gerais

Campos típicos:

* nome;
* descrição;
* sexo alvo padrão;
* idade mínima e máxima padrão;
* classificação operacional;
* se exige veterinário;
* se exige documento.

### Passo 3 — Criar a primeira etapa

Uma etapa deve conter:

* produto ou procedimento;
* código da etapa;
* ordem ou dose;
* modo do calendário;
* âncora;
* regras operacionais;
* dependência, se existir.

### Passo 4 — Adicionar outras etapas

Use etapas adicionais quando houver:

* dose 2;
* reforço;
* teste confirmatório;
* retorno após evento;
* etapa que só nasce após outra ser concluída.

### Passo 5 — Ativar

Enquanto estiver em rascunho, o protocolo não precisa gerar agenda.
Ao ativar:

* o sistema recalcula elegibilidade;
* materializa as pendências aplicáveis;
* respeita deduplicação e dependências.

---

## Fluxo: editar um protocolo

### O que pode ser editado

Em protocolos customizados:

* nome;
* descrição;
* etapas;
* rótulo operacional;
* modo de agenda;
* intervalo;
* dependências;
* condições de aplicabilidade.

### Efeito esperado da edição

Ao editar um protocolo ativo, o sistema pode:

* recalcular datas previstas;
* reavaliar elegibilidade;
* atualizar pendências abertas;
* impedir duplicidade funcional;
* exigir nova versão lógica do regime, quando houver mudança material.

### Mudança material

Considere mudança material quando houver alteração em:

* sequência de doses;
* modo de calendário;
* dependência entre etapas;
* critério de elegibilidade;
* identidade funcional da obrigação.

---

## Dicionário de campos

### Nome do protocolo

Identificador legível do protocolo no produto.

### Descrição

Contexto operacional do protocolo.
Use para explicar intenção, escopo e observações internas.

### Família sanitária

Identificador canônico do tronco sanitário.

Exemplos:

* `brucelose`
* `raiva_herbivoros`
* `tb_controle`
* `vermifugacao_entrada`

### Versão do regime

Número lógico usado para indicar mudança semântica da sequência sanitária.

Use a mesma versão enquanto a identidade sanitária e a lógica principal permanecerem equivalentes.

### Código da etapa

Identificador legível e estável da etapa dentro do protocolo.

Funções:

* nomear o milestone;
* permitir dependências;
* facilitar auditoria e leitura.

### Ordem / dose

Número ordinal da etapa no fluxo.

### Modo do calendário

Define como a agenda nasce:

* janela etária;
* campanha;
* rotina recorrente;
* procedimento imediato;
* não estruturado.

### Âncora do calendário

Data-base do cálculo da agenda.

### Intervalo (dias)

Usado principalmente em rotina recorrente.

### Idade mínima / máxima

Usado principalmente em janela etária.

### Rótulo operacional

Instrução curta para execução em campo.

Exemplo:

* "SC, dose única, registrar lote da vacina"

### Notas do calendário

Campo de contexto operacional, não normativo.

Use para:

* alertas;
* observações internas;
* exceções operacionais;
* justificativas de parametrização.

### Gera agenda

Define se a etapa cria pendência automática futura.

### Obrigatório

Marca a etapa como mandatória quando aplicável.

### Obrigatório por risco

Marca a etapa como mandatória apenas quando uma condição epidemiológica, territorial ou de foco estiver ativa.

### Requer veterinário

A execução depende de responsabilidade técnica, habilitação ou presença veterinária conforme a configuração da fazenda e do protocolo.

### Exige documento

A conclusão exige anexo, comprovante, certificado, receita, laudo ou documento equivalente.

### Depende de

A etapa só pode nascer depois que outra etapa for concluída de fato.

---

## Exemplos sanitários seguros

Os exemplos abaixo são **ilustrativos**, mas foram escritos para ficar tecnicamente seguros.

### Exemplo 1 — Brucelose em janela etária

**Objetivo do exemplo:** mostrar janela etária + sexo alvo + obrigatoriedade.

```text
PROTOCOLO: Brucelose — execução oficial parametrizada
├─ Sexo alvo: apenas fêmea
├─ Aplicabilidade: oficial, conforme configuração vigente
└─ Etapa 1: vacinação em janela etária
   ├─ Modo: janela etária
   ├─ Âncora: nascimento
   ├─ Idade mínima: 90 dias
   ├─ Idade máxima: 240 dias
   ├─ Gera agenda: sim
   ├─ Obrigatório: sim
   └─ Exige documento: conforme configuração local
```

Esse exemplo está alinhado com a regra federal geral de vacinação de fêmeas bovinas e bubalinas entre 3 e 8 meses, em dose única, no âmbito do PNCEBT. A página oficial do MAPA também informa a marcação obrigatória das fêmeas vacinadas e a responsabilidade de médico-veterinário cadastrado, com possibilidade de vacinadores auxiliares sob sua responsabilidade técnica. ([Serviços e Informações do Brasil][2])

---

### Exemplo 2 — Raiva como protocolo condicional por risco

**Objetivo do exemplo:** mostrar aplicabilidade por risco e não como obrigação universal.

```text
PROTOCOLO: Raiva dos Herbívoros — zona de risco
├─ Sexo alvo: sem restrição
├─ Aplicabilidade: por risco / jurisdição
└─ Etapa 1: vacinação estratégica
   ├─ Modo: campanha ou rotina recorrente, conforme configuração
   ├─ Âncora: conforme estratégia local
   ├─ Gera agenda: sim
   ├─ Obrigatório por risco: sim
   └─ Notas: depende de área de risco, foco ou parametrização sanitária
```

Esse é o tratamento correto para o produto: o PNCRH trabalha com vigilância, investigação, diagnóstico e **vacinação estratégica** dos herbívoros domésticos, dirigida por risco e contexto epidemiológico, e não como vacinação universal fixa do país inteiro. ([Serviços e Informações do Brasil][3])

---

### Exemplo 3 — Tuberculose como teste/controle sanitário

**Objetivo do exemplo:** mostrar que nem toda obrigação oficial é vacina.

```text
PROTOCOLO: Controle sanitário de tuberculose
├─ Sexo alvo: sem restrição
├─ Aplicabilidade: oficial ou por programa sanitário
└─ Etapa 1: teste intradérmico
   ├─ Tipo: teste / controle sanitário
   ├─ Modo: procedimento programado ou por evento, conforme fluxo
   ├─ Requer veterinário: sim
   ├─ Exige documento: sim
   └─ Gera agenda: conforme configuração do programa
```

Esse exemplo é tecnicamente seguro porque o controle oficial da tuberculose bovina usa testes alérgicos de tuberculinização intradérmica, realizados por médico-veterinário habilitado ou oficial, e não vacinação de rotina. ([Serviços e Informações do Brasil][1])

---

### Exemplo 4 — Procedimento imediato após evento sanitário

**Objetivo do exemplo:** mostrar que procedimento imediato pode gerar tarefa operacional, mas não recorrência futura automática.

```text
PROTOCOLO: Fluxo de contenção após evento sanitário
├─ Aplicabilidade: por evento
├─ Etapa 1: isolamento
│  ├─ Modo: procedimento imediato
│  ├─ Âncora: diagnóstico de evento
│  ├─ Gera agenda: não
│  └─ Requer veterinário: conforme configuração
└─ Etapa 2: revisão posterior
   ├─ Modo: rotina recorrente
   ├─ Âncora: conclusão da etapa anterior
   ├─ Intervalo: 14 dias
   └─ Depende de: isolamento
```

---

### Exemplo 5 — Reforço recorrente simples

**Objetivo do exemplo:** mostrar recorrência sem misturar norma oficial.

```text
PROTOCOLO: Revisão sanitária semestral do lote de recria
├─ Aplicabilidade: customizada
└─ Etapa 1: revisão recorrente
   ├─ Modo: rotina recorrente
   ├─ Âncora: última conclusão da mesma família
   ├─ Intervalo: 180 dias
   ├─ Gera agenda: sim
   └─ Obrigatório: não
```

---

## Troubleshooting

### "Criei o protocolo, mas não apareceu agenda"

Verifique:

* protocolo está ativo;
* etapa gera agenda;
* animal ou lote é elegível;
* aplicabilidade está satisfeita;
* há dependência pendente;
* a data calculada ainda não chegou;
* deduplicação bloqueou criação paralela.

### "A etapa 2 apareceu antes da etapa 1"

Verifique:

* campo `depende de`;
* milestone da etapa anterior;
* conclusão real da etapa anterior;
* circularidade de dependência;
* mudança recente no protocolo.

### "Tenho dois protocolos parecidos. Vai duplicar?"

Não necessariamente.

O sistema compara:

* família sanitária;
* milestone;
* escopo;
* regra de agenda.

Códigos textuais diferentes ainda podem representar a mesma obrigação funcional.

### "Quero restringir por subset de animais"

Use:

* sexo;
* categoria;
* idade;
* aplicabilidade por perfil animal;
* aplicabilidade por risco ou jurisdição, quando fizer sentido.

### "Editei um protocolo e a agenda mudou"

Isso é esperado quando a mudança altera:

* modo do calendário;
* intervalo;
* dependência;
* janela etária;
* aplicabilidade;
* versão lógica do regime.

---

## Resumo executivo

| Tema                  | Como o produto trata                                              |
| --------------------- | ----------------------------------------------------------------- |
| Protocolo             | conjunto estruturado de etapas sanitárias                         |
| Etapa                 | ação atômica com agenda própria                                   |
| Agenda                | nasce por janela etária, campanha, recorrência ou evento imediato |
| Elegibilidade         | define para quem a etapa vale                                     |
| Aplicabilidade        | define em quais condições a etapa vale                            |
| Compliance            | define obrigatoriedade, documento e necessidade de veterinário    |
| Pack Oficial          | obrigações oficiais parametrizadas pela plataforma                |
| Template Canônico     | modelo importável e adaptável                                     |
| Protocolo Customizado | rotina própria da fazenda                                         |
| Deduplicação          | baseada em identidade semântica, não só no código textual         |

---

## Leitura complementar recomendada

* Documento de arquitetura do módulo
* Documento de status de implementação
* Contratos de sincronização e versionamento
* Regras de scheduler e deduplicação

---

**Versão:** 1.1  
**Última revisão:** 13.04.2026

[1]: https://www.gov.br/pt-br
[2]: https://www.gov.br/pt-br
[3]: https://www.gov.br/pt-br

**O Quê**
- Protocolos impostos por lei federal/estadual
- Não podem ser customizados
- Exemplo: Brucelose, Raiva, Tuberculose

**Função**
- Garantir conformidade regulatória
- Impossibilitar "esquecer" de cumprir a lei

**Quem Cria**
- Sistema (Gestão Agro, não você)

**O Que Você Pode Fazer**
- ✅ Visualizar
- ✅ Aceitar/Ativar para sua fazenda
- ❌ NOT: Editar ou remover

**Exemplo na UI**
```
[PACK OFICIAL] Vacinações Obrigatórias — GO
├─ Brucelose (bivalente)
├─ Raiva (completa)
└─ Tuberculose (intradermal)
Status: ✅ ATIVO (aplicável aos 247 animais)
```

---

### 2️⃣ Templateões Canônicos (Recomendados)

**O Quê**
- Modelos pré-feitos baseados em boas práticas
- Importáveis para sua fazenda como protocolos customizados
- Exemplos: "Vacinação Completa para Criação Extensiva", "Protocolo FIV-BVD para Leite Premium"

**Função**
- Acelerar criação de protocolos customizados
- Não reinventar a roda
- Aproveitar conhecimento consolidado

**Quem Cria**
- Sistema, mas baseado em protocols real-world

**O Que Você Pode Fazer**
- ✅ Visualizar
- ✅ Importar (cria cópia customizável em sua fazenda)
- ❌ NOT: Editar template principal (só a cópia local)

**Fluxo: Importar Template**
1. Abra"
2. Localize seção "Templateões Canônicos"
3. Clique "Importar" em "Vac "Protocolos Sanitáriosinação Completa para Criação Extensiva"
4. Sistema cria: "Vacinação Completa para Criação Extensiva (Importado 13.04.2026)"
5. Agora é seu, pode editar, adicionar/remover etapas

---

### 3️⃣ Protocolos Customizados (Flexíveis)

**O Quê**
- Protocolos que você cria ou importa e personaliza
- Podem cobrir aquilo que a lei NÃO cobre
- Exemplos: "Vermifugação 6/6m", "Terapia Probiótica Bezerros", "Nutrição Especializada"

**Função**
- Operacionalizar a estratégia específica de sua fazenda
- Rastrear atividades além da obrigação legal
- Manter registro de "como fazemos" na unidade

**Quem Cria**
- Você (ou importa template)

**O Que Você Pode Fazer**
- ✅ Criar do zero
- ✅ Editar (nome, etapas, campos, regras)
- ✅ Remover
- ✅ Aplicar ou desativar em sua fazenda

**Exemplo: Criando do Zero**
```
Novo Protocolo Customizado
├─ Nome: "Controle de Endoparasitas — Estação Seca"
├─ Descrição: "Vermifugação preventiva em rebanho leiteiro"
├─ Qual camada: [️Custom]
├─ Ativo: ☑️ Ativado
└─ Etapas a criar:
   ├─ Vermifugo 1 (Abendazol) — dose única
   ├─ Vermifugo 2 (Ivermectina) — 30 dias após etapa 1
   └─ Controle coproscópico — 14 dias após etapa 2
```

---

## Fluxo Completo: Criação de um Novo Protocolo

### Pré-requisito
- Role: **Manager** ou **Owner**
- Fazer: Acesse **Protocolos Sanitários** (menu lateral)

---

### Passo 1: Escolher o Tipo de Protocolo

**Tela: Protocolos Sanitários (página inicial)**

Você verá três seções:
1. **PACK OFICIAL** (apenas visualizar)
2. **TEMPLATEÕES CANÔNICOS** (importar)
3. **PROTOCOLOS CUSTOMIZADOS** (criar novo + gerenciar existentes)

**Ação:** Vá para seção de **PROTOCOLOS CUSTOMIZADOS** e clique botão **"+ Novo protocolo customizado"**

---

### Passo 2: Preencher Informações do Protocolo

**Tela: Criar Novo Protocolo Customizado — Aba "Informações Gerais"**

```
┌─────────────────────────────────────────────────────────────┐
│ NOVO PROTOCOLO SANITÁRIO CUSTOMIZADO                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ NOME* [_________________________________]                   │
│ Ex: "Vacinação Complementar Criação Extensiva"              │
│                                                               │
│ DESCRIÇÃO (opcional)                                        │
│ [_________________________________________________]          │
│ [_________________________________________________]          │
│ Ex: "Protocolos adicionais recomendados para fazendas"       │
│                                                               │
│ SEXO ALVO (aplica-se a todos os itens do protocolo)         │
│ ☐ Sem restrição                                             │
│ ☐ Apenas macho                                              │
│ ☐ Apenas fêmea                                              │
│                                                               │
│ IDADE MÍNIMA (dias) — opcional, risco zero                 │
│ [_____________]  (deixar vazio = aplicável desde nascimento)│
│                                                               │
│ IDADE MÁXIMA (dias) — opcional                              │
│ [_____________]  (deixar vazio = aplicável até morte)       │
│                                                               │
│ OBRIGATORIEDADE                                             │
│ ☐ Obrigatório (Lei/regulação)                               │
│ ☐ Obrigatório em zona de risco (sensível a jurisdição)     │
│ ☐ Recomendado (melhor prática)                              │
│                                                               │
│ REQUER RESPONSÁVEL TÉCNICO?                                 │
│ ☐ Sim (precisa assinar)  ☐ Não                              │
│                                                               │
│ REQUER DOCUMENTO DE COMPROVAÇÃO?                            │
│ ☐ Sim (GTA, NF, etc)     ☐ Não                              │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  [Cancelar]  [Salvar e Adicionar Etapas]                    │
└─────────────────────────────────────────────────────────────┘
```

**Preencher Exemplo: Protocolo "Reforço de Raiva"**

| Campo | Valor | Motivo |
| :--- | :--- | :--- |
| NOME | "Reforço anual de Raiva" | Identificar o protocolo |
| DESCRIÇÃO | "Dose de reforço para manutenção de imunidade em zona de risco" | Documentar intenção |
| SEXO ALVO | Sem restrição | Raiva afeta machos e fêmeas |
| IDADE MÍNIMA | (vázio) | Pode começar depois da dose inicial |
| IDADE MÁXIMA | (vázio) | Sem limite de idade |
| OBRIGATORIEDADE | Obrigatório em zona de risco | Seu estado (GO) tem risco |
| RESPONSÁVEL TÉCNICO | Não | Pode ser aplicado por técnico qualificado |
| DOCUMENTO | Não | Não é exigido documento separado |

**Ação:** Salvar → Prosseguir para próximo passo

---

### Passo 3: Criar Primeira Etapa (Item do Protocolo)

**Tela: Adicionar Primeira Etapa — Popup/Modal**

```
┌──────────────────────────────────────────────────────────┐
│ ADICIONAR ETAPA AO PROTOCOLO                             │
│ Protocolo: "Reforço anual de Raiva"                      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│ [1. IDENTIFICAÇÃO DA ETAPA]                              │
│                                                            │
│ PRODUTO *                   [Procurar: Raiva...] 🔍       │
│ (Previamente: "Vacina Raiva Inativada" selecionada)      │
│                                                            │
│ CÓDIGO DA ETAPA *           [Reforço_1]                  │
│ (Ex: "dose_1", "dose_2", "reforco_anual", etc)           │
│                                                            │
│ ORDEM/DOSE                  [1]                           │
│ (Sequência: 1ª dose, 2ª dose, reforço, etc)              │
│                                                            │
│ VERSÃO DO PROTOCOLO         [1]                          │
│ (Incrementado se você editar este item)                  │
│                                                            │
├──────────────────────────────────────────────────────────┤
│ [2. CALENDÁRIO (QUANDO E COMO)]                          │
│                                                            │
│ MODO DO CALENDÁRIO*                                      │
│ ☉ Janela etária      (por idade do animal)               │
│ ○ Campanha           (meses específicos: ex mai-jul)     │
│ ○ Rotina recorrente  (a cada X meses/dias)               │
│ ○ Procedimento imediato (ASAP, sem prazo)                │
│                                                            │
│ ÂNCORA DO CALENDÁRIO*  [Parto previsto ▼]                │
│ (Base de cálculo: nascimento? parto? entrada fazenda?)   │
│                                                            │
│   Opções disponíveis (depende do MODO):                  │
│   ☐ Sem âncora                                           │
│   ☐ Nascimento (idade = data_nasc + dias)                │
│   ☐ Desmama (idade = data_desmama + dias)                │
│   ☐ Parto previsto (p/ vacinas pré-parto)                │
│   ☐ Entrada em fazenda (p/ animais importados)           │
│   ☐ Necessidade clínica (diagnóstico de evento)          │
│   ☐ Conclusão de etapa anterior (dependência)            │
│                                                            │
│ INTERVALO (dias)*          [365]  (dias entre reforços)  │
│ (Deixar vazio se dose única)                              │
│                                                            │
│ IDADE MÍNIMA (dias)         [0]    (se modo janela_etaria)│
│ IDADE MÁXIMA (dias)         [3650] (se modo janela_etaria)│
│                                                            │
├──────────────────────────────────────────────────────────┤
│ [3. OPERACIONAL (COMO FAZER)]                            │
│                                                            │
│ RÓTULO OPERACIONAL (como treinar staff)                  │
│ [Injetar IM,1x/ano, notificar produtor 30d antes]       │
│                                                            │
│ NOTAS DO CALENDÁRIO                                      │
│ [Se raiva endemica em GO, obrigatorio todo ano]         │
│                                                            │
├──────────────────────────────────────────────────────────┤
│ DEPENDÊNCIAS (opcional)                                  │
│                                                            │
│ Esta etapa depende de:                                   │
│ [Selecione etapa anterior...] (ou deixar vazio)          │
│                                                            │
├──────────────────────────────────────────────────────────┤
│ [Cancelar]  [Salvar Etapa]  [Salvar + Adicionar Próxima] │
└──────────────────────────────────────────────────────────┘
```

**Preencher Exemplo: Reforço de Raiva**

| Campo | Valor | Explicação |
| :--- | :--- | :--- |
| **PRODUTO** | "Vacina Raiva Inativada" | Procurar no catálogo ou criar novo |
| **CÓDIGO DA ETAPA** | "raiva_reforco" | Identificador único neste protocolo |
| **ORDEM/DOSE** | "1" | É a 1ª (ou única) etapa de reforço |
| **MODO CALENDÁRIO** | Rotina recorrente | Repete a cada ano |
| **ÂNCORA** | "Parto previsto" | Se houver, dar reforço antes do parto |
| **INTERVALO** | "365" dias | Anual, a cada 365 dias |
| **IDADE MÍNIMA** | "120" dias | Poder aplicar *antes* do parto |
| **IDADE MÁXIMA** | "2500" dias | Aplicável até animais adultos |
| **RÓTULO OPERACIONAL** | "Injetar IM, 2ml, 1x/ano" | Instrução para aplicador |
| **NOTAS** | "Obrigatório em GO por risco de raiva endemica" | Justificativa |
| **DEPENDÊNCIAS** | (vazio) | Não depende de outra etapa |

**Ação:** Clique "Salvar Etapa"

---

### Passo 4: Adicionar Próximas Etapas (Opcional)

Se protocolo tem 2+ etapas (ex: dose 1 + reforço 12 meses depois):

**Ação:** Clique "Salvar + Adicionar Próxima"

Preencher Etapa 2 (mesmo padrão), mas agora:
- **ORDEM/DOSE:** "2"
- **DEPENDÊNCIAS:** Selecionar "raiva_reforco" (depende da etapa 1)
- **INTERVALO:** deixar vazio (ou colocar se for ciclo)

Exemplo: Protocolo de Brucelose com 2 doses

```
ETAPA 1: Dose Inicial
├─ Produto: Brucelose RB51
├─ Código: "brucelose_dose1"
├─ Ordem: 1
├─ Modo: Janela etária
├─ Âncora: Nascimento
├─ Intervalo: (vazio — dose única)
├─ Idade mín: 120 dias
├─ Idade máx: 240 dias
└─ Dependências: nenhuma

ETAPA 2: Dose de Reforço (opcional, jurisdição)
├─ Produto: Brucelose S19
├─ Código: "brucelose_reforco"
├─ Ordem: 2
├─ Modo: Rotina recorrente
├─ Âncora: Conclusão da etapa anterior
├─ Intervalo: 365 dias
├─ Idade mín: 240 dias (após dose 1)
├─ Idade máx: 1095 dias (até 3 anos)
└─ Dependências: "brucelose_dose1" ← IMPORTANTE
```

---

### Passo 5: Publicar / Ativar Protocolo

**Tela: Gerenciador de Protocolos Customizados**

Após criar protocolo + etapas:

```
┌─────────────────────────────────────────────────────────────┐
│ PROTOCOLO CRIADO: "Reforço anual de Raiva"                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Status: ✏️ RASCUNHO (não gera agenda ainda)                  │
│                                                               │
│ Etapas:                                                      │
│ ✅ (1) Raiva Inativada — Reforço 1x/ano — 365 dias           │
│                                                               │
│ Ações:                                                       │
│ [Editar]  [Duplicate]  [Ativar]  [Deletar]                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Ação:** Clique **"Ativar"**

Resultado: Protocolo passa a **✅ ATIVO** → Sistema começa a gerar itens de agenda automaticamente para animais elegíveis.

---

## Fluxo Completo: Edição de um Protocolo Existente

### Cenário
Você criou "Reforço anual de Raiva" há 2 meses, mas agora quer:
1. Mudar intervalo de 365 para 270 dias (reduzir frequência)
2. Adicionar 2ª etapa (dose reforço dupla em zona de risco)

---

### Passo 1: Localizar Protocolo

**Tela: Protocolos Sanitários**

Abaixo de "PROTOCOLOS CUSTOMIZADOS", veja lista:

```
┌─────────────────────────────────────────────────────────────┐
│ PROTOCOLOS CUSTOMIZADOS                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ✅ Vacinação Complementar Criação Extensiva (Importado)      │
│    3 etapas | Ativo | [Editar] [Deletar]                    │
│                                                               │
│ ✅ Reforço anual de Raiva                                    │
│    1 etapa | Ativo | [Editar] [Deletar]  ← CLIQUE AQUI       │
│                                                               │
│ ⏸️  Protocolo Teste (desativado)                              │
│    2 etapas | Inativo | [Editar] [Ativar] [Deletar]         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Ação:** Clique **"Editar"** no protocolo "Reforço anual de Raiva"

---

### Passo 2: Editar Informações do Protocolo

**Tela: Editar Protocolo — Abas**

Você verá 2 abas:
1. **Informações Gerais** (nome, descrição, sexo alvo, obrigatoriedade, etc)
2. **Etapas** (editar, adicionar, remover etapas)

**Ação:** Se quiser mudar nome, descrição, sexo alvo, idade mín/máx → faça na aba "Informações Gerais"

**Exemplo: Mudar nome**

```
NOME: [Reforço anual de Raiva — Dose Dupla em Risco]
               ↑ EDITADO
```

---

### Passo 3: Editar Etapa Existente

**Tela: Editar Protocolo — Aba Etapas**

```
┌─────────────────────────────────────────────────────────────┐
│ ETAPAS DO PROTOCOLO: "Reforço anual de Raiva"               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ETAPA 1: Raiva Inativada — Reforço 1x/ano                   │
│ ├─ Produto: Vacina Raiva Inativada                          │
│ ├─ Intervalo: 365 dias                                      │
│ ├─ Modo: Rotina recorrente                                  │
│ └─ Ações: [Editar] [Deletar]                                │
│                                                               │
│ [+ Adicionar Próxima Etapa]                                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Ação:** Clique **"Editar"** na etapa

**Modal:** Mesmo formulário de criação, mas com valores já preenchidos

Fazer mudanças:
- INTERVALO: `365` → `270` (dias)
- NOTAS: adicionar "Reduzido para 270 dias em 2026 para otimizar cobertura"

**Ação:** Salvar → confirmar

---

### Passo 4: Adicionar Etapa 2 (Reforço Duplo em Risco)

**Ação:** Clique **"+ Adicionar Próxima Etapa"**

Preencher:

| Campo | Valor |
| :--- | :--- |
| **PRODUTO** | "Vacina Raiva Inativada — Dose Dupla" |
| **CÓDIGO** | "raiva_reforco_duplo_risco" |
| **ORDEM** | "2" |
| **MODO** | Campanha (aplicar em período específico) |
| **ÂNCORA** | Sem âncora |
| **MESES** | "9,10" (setembro/outubro) |
| **INTERVALO** | (vazio) |
| **NOTAS** | "Aplicar apenas em agosto/setembro, zona de risco" |
| **DEPENDÊNCIAS** | "raiva_reforco" ← depende de etapa 1 |

**Ação:** Salvar

---

### Passo 5: Salvar Protocolo Editado

**Tela: Topo do modal**

Você verá feedback:
- **"Etapa sanitária atualizada"** (para cada mudança)
- **"Protocolo atualizado"** (para informações gerais)

**Resultado:**
- Changes são salvos **imediatamente**
- Agenda é **recalculada** automaticamente
- Animais elegíveis já mostram **nova data prevista** no Dashboard

**Exemplo:** 
- Antes: "Raiva reforço — 15.04.2026" (365 dias da última dose)
- Depois: "Raiva reforço — 25.02.2026" (270 dias — anteriormente!)

---

## Dicionário de Campos

### Seção: Identificação (PROTOCOLO)

#### NOME*
- **O que é:** Identificador do protocolo que você vai ler no Dashboard
- **Exemplo:** "Vacinação Essencial Primeiros 6 Meses"
- **Requisito:** Máxz 100 caracteres, não podem ser iguais em mesma fazenda
- **Dica:** Seja específico. Não use "Protocolo 1" ou "Customizado"

#### DESCRIÇÃO (opcional)
- **O que é:** Contexto, justificativa, links para legislação
- **Exemplo:** "Lei 1234/2015 do Estado + OIE recomendação para rebanho leiteiro"
- **Requisito:** Até 500 caracteres
- **Dica:** Documente o *porquê*, não apenas o *o quê*

#### SEXO ALVO
- **O que é:** Restrição de gênero (aplica-se a TODAS as etapas do protocolo)
- **Opções:**
  - ☐ **Sem restrição:** Machos E fêmeas
  - ☐ **Apenas macho:** Só touros, bois, bezerros
  - ☐ **Apenas fêmea:** Só vacas, novilhas, bezerras
- **Exemplo:** Brucelose = "Apenas fêmea" (machos não vacinam)
- **Dica:** Se uma etapa é "só fêmea" e outra "sem restrição", considere split em 2 protocolos

#### IDADE MÍNIMA (dias)
- **O que é:** Animal só é elegível A PARTIR dessa idade
- **Padrão:** Deixar vazio = desde nascimento (idade 0)
- **Exemplo:** Brucelose = "120 dias" (não vacinar bezerro de 30 dias)
- **Cálculo:** Sistema usa `data_nascimento + idade_minima` = data earliest elegibilidade

#### IDADE MÁXIMA (dias)
- **O que é:** Animal só é elegível ATÉ essa idade
- **Padrão:** Deixar vazio = sem limite
- **Exemplo:** Brucelose = "240 dias" (depois é tarde demais)
- **Cálculo:** Sistema usa `data_nascimento + idade_maxima` = data latest elegibilidade

---

### Seção: Identificação (ETAPA)

#### PRODUTO*
- **O que é:** O medicamento/vacina/procedimento que será aplicado
- **Fonte:** Catálogo compartilhado de Produtos Veterinários
- **Operação:** Procure por nome (ex: "Brucelose") ou crie novo
- **Resultado:** Vincula automaticamente código de produto, lote, custo, fornecedor
- **Dica:** Se produto não existe, crie na seção "Catálogo de Produtos"

#### CÓDIGO DA ETAPA*
- **O que é:** Identificador único desta etapa DENTRO deste protocolo
- **Formato:** Sem espaços, lowercase, ex: `dose_1`, `reforco_anual`, `brucelose_risco`
- **Função:** Usado para:
  - Referência em dependências ("esta etapa depende de: dose_1")
  - Deduplicação (não criar agenda 2x para mesmo animal)
  - Relatórios ("Quantos fizeram dose_1?")
- **Exemplo:** 
  - Protocolo "Vacinação Brucelose" tem etapas: `brucelose_inicial`, `brucelose_reforco`
  - Protocolo "Vacinação Raiva" tem etapas: `raiva_dose_unica`, `raiva_reforco_anual`

#### ORDEM/DOSE
- **O que é:** Sequência ordinal desta etapa no protocolo
- **Valores:** 1, 2, 3, ...
- **Função:** Mostra progressão (Dose 1 → Dose 2 → Reforço)
- **Exemplo:**
  - Etapa 1 (Dose inicial): "1"
  - Etapa 2 (Reforço 30 dias depois): "2"
  - Etapa 3 (Reforço 365 dias depois): "3"

#### VERSÃO DO PROTOCOLO
- **O que é:** Número de versão desta etapa
- **Padrão:** "1" para nova, incrementa se você editar
- **Função:** Rastreamento de mudanças ao longo do tempo
- **Exemplo:** Se você editar esta etapa em 2026-06-01, versão vai para "2"

---

### Seção: Calendário (QUANDO)

#### MODO DO CALENDÁRIO*
- **O que é:** Lógica usada para calcular QUANDO a etapa fica pendente
- **4 Opções:**

##### 1. JANELA ETÁRIA
- **Funciona Por:** Idade do animal (dias desde nascimento)
- **Usa Campos:** Idade Mínima + Idade Máxima + Âncora
- **Exemplo:** "Entre 120-240 dias de nascimento"
- **Caso Real:** Brucelose: "Aplicar se animal tem entre 120-240 dias"
  - Animal nasce 01.01
  - Elegível a partir: 01.01 + 120 = 01.05
  - Deixa de ser elegível: 01.01 + 240 = 29.08
  - Status: PENDENTE (em verde) = 01.05-29.08
  - Status: ATRASADO (em vermelho) = depois 29.08

##### 2. CAMPANHA
- **Funciona Por:** Meses do calendário (específicos do ano)
- **Usa Campos:** Meses + Âncora
- **Exemplo:** "Todos os anos em set-out-nov" (estação de vacinação)
- **Caso Real:** Campanha de Brucelose municipal
  - Aplicar em: set(9), out(10), nov(11)
  - Animal precisa estar elegível (idade OK) E estar no mês certo
  - Se animal nasce em dez → próxima campanha é set-out-nov do ano seguinte
  - Status: PENDENTE = set-out-nov
  - Status: CONCLUÍDO = depois de nov (até set do ano que vem)

##### 3. ROTINA RECORRENTE
- **Funciona Por:** Intervalo fixo de dias desde última conclusão
- **Usa Campos:** Intervalo (dias) + Âncora
- **Exemplo:** "A cada 365 dias" (reforço anual de Raiva)
- **Caso Real:** Raiva com reforço anual
  - Animal vacinado em 15.03.2025
  - Próxima dose elegível: 15.03.2025 + 365 = 15.03.2026
  - Status: PENDENTE = 15.03.2026 em diante
  - Status: ATRASADO = se hoje é 01.04.2026 (ainda não fez)

##### 4. PROCEDIMENTO IMEDIATO
- **Funciona Por:** Tem que fazer AGORA
- **Usa Campos:** Nenhum específico (ou Âncora = diagnóstico)
- **Exemplo:** "Isolamento por diagnóstico de tuberculose"
- **Caso Real:** Animal testou TB positivo
  - Sistema gera: "ISOLAMENTO — DUE NOW"
  - Cor: VERMELHO (crítico)
  - Status: Concluir quando isolamento foi realizado

---

#### ÂNCORA DO CALENDÁRIO*
- **O que é:** Data base de cálculo para quando a etapa fica pendente
- **Depende do MODO:**

| Modo | Âncoras Disponíveis | Exemplo |
| :--- | :--- | :--- |
| **Janela Etária** | Nascimento; Desmama; Parto; Entrada Fazenda | "Janela entre 120-240 dias de NASCIMENTO" |
| **Campanha** | Sem âncora; Mes/ano | "Campanha set-out todo ano, sem importar née" |
| **Rotina Recorrente** | Conclusão Etapa Anterior; Última Conclusão Mesma Família | "A cada 365 dias desde ÚLTIMO REFORÇO" |
| **Procedimento Imediato** | Diagnóstico Evento; Sem Âncora | "ASAP Quando diagnóstico de X" |

**Caso 1: Brucelose em Janela Etária**
- Âncora: **Nascimento**
- Idade mín: 120, máx: 240
- Significa: "120-240 dias desde o nascimento"
- Animal nasce 01.01 → elegível 01.05-29.08

**Caso 2: Reforço Raiva em Rotina Recorrente**
- Âncora: **Conclusão da Etapa Anterior** (Dose Inicial)
- Intervalo: 365 dias
- Significa: "365 dias após concluir Dose Inicial"
- Animal recebe Dose Inicial em 15.03.2025 → Reforço elegível 15.03.2026

**Caso 3: Campanha Estadual em Campanha**
- Âncora: **Sem Âncora** (ou Mês/Ano)
- Meses: set, out, nov
- Significa: "Todos os anos em set-out-nov, qualquer animal elegível"
- Campanha começa 01.09 todo ano

---

#### INTERVALO (dias)
- **O que é:** Número de dias entre repetições (aplica-se em Rotina Recorrente)
- **Padrão:** Deixar vazio se dose única
- **Valores Típicos:**
  - `30` = mensal
  - `180` = semestral
  - `270` = 9 meses
  - `365` = anual
- **Cálculo:** Data próxima etapa = Data conclusão atual + Intervalo
- **Exemplo:** Vermifugo a cada 180 dias
  - Aplicado: 15.01.2026
  - Próximo elegível: 15.01.2026 + 180 dias = 14.07.2026

---

#### IDADE MÍNIMA / MÁXIMA (Modo Janela Etária)
- **Função Especial em "Janela Etária":** Define a janela etária exata
- **Padrão:** 
  - Mínima: 0 (desde nascimento)
  - Máxima: 3650 (até 10 anos)
- **Exemplo: Brucelose Bivalente**
  - Idade mín: 120 dias
  - Idade máx: 240 dias
  - Significa: "Animal deve ter entre 120-240 dias"
  - Acima de 240: "fora da janela" (use outra etapa ou protocol)

---

### Seção: Operacional (COMO)

#### RÓTULO OPERACIONAL
- **O que é:** Instrução resumida de como executar (para staff)
- **Quem Lê:** Técnico, produtor, aide na aplicação
- **Exemplo:** "Injetar IM profundo, 2ml, se sem histórico vacinal aplicar 2x com intervalo 21 dias"
- **Tamanho:** Até 200 caracteres
- **Dica:** Seja específico. Inclua:
  - Via (IV, IM, Oral, Tópica)
  - Dose (volume, quantidade)
  - Frequência (1x, 2x com intervalo)
  - Restrições (cuidado com prenhes, amamando, etc)

#### NOTAS DO CALENDÁRIO
- **O que é:** Contexto, legislação, recomendação, ou exceção
- **Quem Lê:** Manager, auditor, veterinário
- **Exemplo:** "Lei Federal exige antes do transito. Se já fez há <12 meses, dispensado. Verificar testes rápidos em SO."
- **Tamanho:** Até 500 caracteres
- **Dica:** Use para:
  - Justificar intervalo incomum
  - Documentar base legal
  - Avisar exceções (ex: "Não aplicar em lactação")
  - Referência: resol. ANS 123/2015

---

### Seção: Dependências

#### DEPENDE DE (ETAPA ANTERIOR)
- **O que é:** Esta etapa SÓ fica pendente DEPOIS que outra foi concluída
- **Exemplo:** Raiva Reforço depende de "Raiva Dose Inicial"
  - Não gera agenda até que Dose Inicial seja do
  - Uma vez concluída, contador de `intervalo` começa do zero
- **Uso:** Vincular séries de doses (dose 1 → dose 2 → reforço)
- **Dica:** Deixar vazio se não há dependência (dose única, ou não sequencial)

---

## Exemplos Práticos

### Exemplo 1: Protocolo Simples (Dose Única)

#### Cenário
Você quer criar um protocolo customizado de "Vacinação contra Clostridiose (Blackleg)".

#### Protocolo
```
PROTOCOLO: Vacinação contra Clostridiose
├─ Descrição: Prevenção de blackleg (Clostridium chauvoei) — recomendado OIE
├─ Sexo alvo: Sem restrição (machos e fêmeas)
├─ Idade mín: 60 dias
├─ Idade máx: 180 dias
├─ Obrigatoriedade: Recomendado
└─ Requer vet: Não
└─ Requer documento: Não

ETAPA 1: Vacina Blackleg (dose única)
├─ Produto: Vacina Clostridiose Bivalente
├─ Código: "blackleg_inicial"
├─ Ordem: 1
├─ Modo: Janela etária
├─ Âncora: Nascimento
├─ Intervalo: (vazio — dose única)
├─ Idade mín: 60
├─ Idade máx: 180
├─ Rótulo: "IM, 2ml, protocolo único"
├─ Notas: "Completa imunidade com dose única. Iniciar aos 60 dias."
└─ Depende de: (nenhuma)
```

#### Resultado na Agenda
Bezerro "Brás" nasce **01.03.2026**:
- Elegível para Clostridiose: **01.03 + 60 = 30.04.2026** (PENDENTE)
- Deixa de ser elegível: **01.03 + 180 = 29.08.2026** (FORA DA JANELA)
- Se não feito até 29.08 → **ATRASADO e BLOQUEADO**

---

### Exemplo 2: Protocolo com 2 Doses (com Intervalo)

#### Cenário
Protocolo de "Vacinação contra FIV-BVD" (2 doses, 21 dias depois).

#### Protocolo
```
PROTOCOLO: Proteção Reprodutiva — FIV-BVD
├─ Descrição: Proteção permanente contra Rinotraqueíte e Diarreia Viral
├─ Sexo alvo: Sem restrição
├─ Idade mín: 120 dias
├─ Idade máx: 365 dias (recomendado no primeiro ano)
├─ Obrigatoriedade: Recomendado para rebanho genético
├─ Requer vet: Sim
├─ Requer documento: Não

ETAPA 1: Dose Inicial
├─ Produto: Vacina FIV-BVD Inativada
├─ Código: "fivbvd_dose1"
├─ Ordem: 1
├─ Modo: Janela etária
├─ Âncora: Nascimento
├─ Intervalo: (vazio — não há repetição desta etapa)
├─ Idade mín: 120
├─ Idade máx: 365
├─ Rótulo: "IM profundo, 5ml, responsável técnico assina"
├─ Notas: "Primeira dose do protocolo 2-dose"
└─ Depende de: (nenhuma)

ETAPA 2: Dose Reforço (21 dias depois)
├─ Produto: Vacina FIV-BVD Inativada (mesma)
├─ Código: "fivbvd_dose2"
├─ Ordem: 2
├─ Modo: Rotina recorrente
├─ Âncora: Conclusão da Etapa Anterior (DOSE 1)
├─ Intervalo: 21 dias (exatamente)
├─ Rótulo: "IM profundo, 5ml, mesmo braço da dose 1"
├─ Notas: "Reforço — OBRIGATÓRIO para imunidade completa. Se >30d depois dose1, reiniciar protocolo."
└─ Depende de: "fivbvd_dose1"
```

#### Resultado na Agenda
Novilha "Linda" nasce **01.02.2026**:

**Dose 1:**
- Elegível: 01.02 + 120 = 01.06.2026 (PENDENTE)
- Última data: 01.02 + 365 = 02.02.2027 (FORA DA JANELA)
- Se não feito: **ATRASADO**

**Dose 2 (apareça APÓS Dose 1 concluída):**
- Assumindo Dose 1 concluída em 15.06.2026
- Elegível Dose 2: 15.06 + 21 = 06.07.2026 (PENDENTE)
- Se não feito por 06.08 (30+ dias): **ATRASADO — reiniciar do zero**
- Uma vez Dose 2 concluída em 06.07 → **COMPLETO**

---

### Exemplo 3: Protocolo com Campanha (Estacional)

#### Cenário
"Campanha Anual de Brucelose" — todos os anos em set-out-nov (16 semanas, conforme portaria estadual).

#### Protocolo
```
PROTOCOLO: Campanha de Brucelose — GO
├─ Descrição: Campanha estatal obrigatória de brucelose 2025-2026
├─ Sexo alvo: Apenas fêmea (macho não precisa)
├─ Idade mín: 240 dias
├─ Idade máx: 8000 dias (até morte)
├─ Obrigatoriedade: Obrigatório (Resol. SEAGRO GO 2025)
├─ Requer vet: Não (aplicável por técnico)
├─ Requer documento: Sim (Certificado de vacinação estadual)

ETAPA 1: Brucelose Campanha 2026
├─ Produto: Vacina Brucelose S19 (campanha)
├─ Código: "brucelose_campanha_2026"
├─ Ordem: 1
├─ Modo: Campanha
├─ Âncora: Sem âncora
├─ Meses: 9 (set), 10 (out), 11 (nov)
├─ Intervalo: (vazio)
├─ Rótulo: "Aplicar conforme pólo regional. Documento obrigatório."
├─ Notas: "Campanha 2025-2026 conforme Portaria SEAGRO 123/2025. Exigido para transito."
└─ Depende de: (nenhuma)
```

#### Resultado na Agenda
Vaca "Bessie" elegível para campanha:
- Status: PENDENTE durante **set-out-nov** (01.09 até 30.11)
- Status: CONCLUÍDO se vacinada em 15.10
- Status: ATRASADO se hoje é 15.12 sem ter feito

Próxima campanha **2027:** mesmo período (set-out-nov), nova etapa/código

---

### Exemplo 4: Protocolo com Dependência de Evento (Procedimento Imediato)

#### Cenário
"Isolamento e Teste para Tuberculose" — quando diagnóstico é positivo.

#### Protocolo
```
PROTOCOLO: Manejo de TB Positivo
├─ Descrição: Fluxo de isolamento, revacinação e teste confirmatory
├─ Sexo alvo: Sem restrição
├─ Idade mín: (vazio)
├─ Idade máx: (vazio)
├─ Obrigatoriedade: Obrigatório (Lei Federal sanidade)
├─ Requer vet: Sim
├─ Requer documento: Sim (Laudo MAPA, registro de descarte)

ETAPA 1: Isolamento Preventivo
├─ Produto: Procedimento — Isolamento
├─ Código: "tb_isolamento"
├─ Ordem: 1
├─ Modo: Procedimento Imediato
├─ Âncora: Diagnóstico Evento (TB positivo)
├─ Intervalo: (N/A)
├─ Rótulo: "Separar animal em piquete isolado. Informar veterinário."
├─ Notas: "Fazer no mesmo dia do diagnóstico. Evitar contato com rebanho."
└─ Depende de: (nenhuma)

ETAPA 2: Teste Confirmatorio (14 dias depois)
├─ Produto: Teste Intradérmico TB
├─ Código: "tb_teste_confirmatorio"
├─ Ordem: 2
├─ Modo: Rotina recorrente
├─ Âncora: Conclusão da Etapa Anterior
├─ Intervalo: 14 dias
├─ Rótulo: "Teste intradérmico conforme técnica MAPA"
├─ Notas: "Se negativo → reintegrar rebanho. Se positivo → descartar (legal)."
└─ Depende de: "tb_isolamento"
```

#### Resultado na Agenda
Vaca "Malhada" testa **TB POSITIVO** em 01.03.2026:

- **Etapa 1 (Isolamento):** Status = **CRÍTICO — DUE NOW** (vermelho)
  - Animal deve ser isolado HOJE
  
- **Etapa 2 (Teste Confirmatorio):** Fica PENDENTE após isolamento ser marcado concluído
  - Se isolamento concluído em 01.03 → Teste elegível 01.03 + 14 = 15.03
  - Status: PENDENTE a partir de 15.03

---

## Troubleshooting

### P1: "Criei um protocolo, mas não aparece na Agenda"

**Causa 1: Protocolo está em RASCUNHO**
- Solução: Clique "Ativar" no gerenciador

**Causa 2: Animal não é elegível**
- Exemplos:
  - Protocolo é "apenas fêmea", mas animal é touro
  - Protocolo exige idade mín 120 dias, animal tem 45 dias
  - Protocolo é "zona de risco", mas animal não está em zona de risco
- Solução: Abra Animal, veja idade, gênero, localização. Confira regras do protocolo.

**Causa 3: Data calculada é futura**
- Exemplo: Protocolo "Brucelose 120-240 dias", animal nascido ontem
- Solução: Volte em 120 dias e verá pendente

---

### P2: "Editar protocolo, depois reabrir — mostra valores antigos"

**Causa: Cache não foi atualizado**
- Solução: Já foi corrigido (veja Bugs Corrigidos acima)
- Workaround: Feche aba e reabra

---

### P3: "Tenho 2 protocolos com mesma etapa — criar duplicação"

**Exemplo:**
- Protocolo A: "Vacinação Essencial" — tem etapa "brucelose_dose1"
- Protocolo B: "Vacinação Complementar" — tem etapa "brucelose_dose1" (mesmo código)
- Animal "Brás": ambos protocolos ativos → gera 2 agendas pra brucelose?

**Causa: Código de etapa não é único globalmente**
- Solução: Renomee um para "brucelose_dose1_essencial" e outro para "brucelose_dose1_complementar"
- Dedup: Sistema também usa `dedup_key` para evitar exatamente isso

---

### P4: "Quero aplicar protocolo em SUBSET de animais (ex: só leiteiras)"

**Causa: Protocolos não suportam aplicação seletiva (ainda)**
- Workaround 1: Criar 2 protocolos (um para leiteiras, um para pecuária)
- Workaround 2: Usar dependência de evento ("só se diagnóstico X")
- Planejado (Fase 6+): Filtro de elegibilidade por categoria zootécnica

---

### P5: "Dependência não está funcionando — Etapa 2 aparece antes de Etapa 1"

**Causa 1: Etapa 1 foi deletada**
- Solução: Recrere Etapa 1 ou quebra dependência em Etapa 2

**Causa 2: Dependência foi quebrada na edição**
- Solução: Abra Etapa 2, confirme campo "Depende de" está preenchido

---

## Resumo Executivo

| Aspecto | Detalhe |
| :--- | :--- |
| **O Que São** | Conjunto estruturado de etapas (vacinas, testes, procedimentos) com quando/para quem |
| **Camadas** | Pack Oficial (lei), Templates (recomendados), Customizados (sua estratégia) |
| **Propósito** | Gerar agenda automática, garantir conformidade, rastrear execução |
| **Criação** | Nome + Descrição → Etapas (Produto, Modo Calendário, Âncora, Intervalo) → Ativar |
| **Edição** | Editar info geral OU editar/adicionar/remover etapas → Sistema recalcula agenda |
| **Calendário** | 4 modos: Janela Etária, Campanha, Rotina Recorrente, Procedimento Imediato |
| **Dependências** | Etapa 2 só gera agenda após Etapa 1 ser concluída |
| **Campos Críticos** | Modo, Âncora, Intervalo, Idade mín/máx, Dependências |

---

**Próximas Leituras:**
- `docs/SYSTEM.md` — Arquitetura end-to-end de protocolos
- `docs/IMPLEMENTATION_STATUS.md` — Features implementadas vs. roadmap
- `AGENTS.md` — Contratos de sincronização
  
**Versão:** 1.0 | **Última Revisão:** 13.04.2026
