# Análise de Campos: Fazenda

> **Status:** Derivado (Análise)
> **Fonte de Verdade:** [`DB.md`](../DB.md), [`00_MANIFESTO.md`](../00_MANIFESTO.md)
> **Última Atualização:** 2026-02-15

Análise do schema da tabela `fazendas` e propostas de evolução.

---

## 1. Inventário de Campos (Estado Atual)

Conforme migrações `0001` até `0017`.

| Campo            | Obrigatório | Descrição          | Origem        |
| :--------------- | :---------: | :----------------- | :------------ |
| `id`             |     Sim     | PK (UUID)          | Core          |
| `nome`           |     Sim     | Nome fantasia      | Core          |
| `municipio`      |     Não     | Cidade             | Core          |
| `timezone`       |     Sim     | Fuso horário       | Core          |
| `estado`         |     Não     | UF (Enum)          | Migração 0016 |
| `cep`            |     Não     | Formato XXXXX-XXX  | Migração 0016 |
| `area_total_ha`  |     Não     | Hectares (> 0)     | Migração 0016 |
| `tipo_producao`  |     Não     | Corte/Leite/Mista  | Migração 0016 |
| `sistema_manejo` |     Não     | Confinamento/Pasto | Migração 0016 |
| `metadata`       |     Sim     | JSONB Extensível   | Core          |

## 2. Gaps e Lacunas (Análise)

Resumo das lacunas identificadas em relação aos requisitos de pecuária profissional.

### 2.1 Lacunas de Infraestrutura (Pendente)

- **Falta detalhamento de estruturas:** Currais, cochos, bebedouros, embarcadores.
- **Impacto:** Dificulta planejamento de capacidade e inventário patrimonial.
- **Status:** Previsto no Roadmap (Fase 2/3).

### 2.2 Lacunas de Contato e Rastreabilidade (Pendente)

- **Campos ausentes:** Email, Telefone, CNPJ, Inscrição Estadual, Registro Sisbov.
- **Impacto:** Limita emissão de GTA e comunicação automatizada.
- **Status:** Previsto no Roadmap.

### 2.3 Lacunas Resolvidas (Histórico)

- _Localização (UF/CEP)_: Resolvido na `0016`.
- _Produção (Tipo/Manejo)_: Resolvido na `0016`.

## 3. Propostas de Evolução

### 3.1 Infraestrutura (JSONB)

Recomendado expandir o uso de `metadata` ou criar tabela `infraestrutura` ao invés de muitas colunas na tabela `fazendas`.
Ver detalhamento em [`ROADMAP.md`](../ROADMAP.md).

### 3.2 Validações

Manter validações de domínio (CEP, UF) no banco (Constraints) e na UI (Zod).

## 4. Referências Cruzadas

- **[DB.md](../DB.md)**: Schema oficial.
- **[ROADMAP.md](../ROADMAP.md)**: Planejamento de implementações futuras.
- **[TECH_DEBT.md](../TECH_DEBT.md)**: Dívidas técnicas relacionadas.
