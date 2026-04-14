/**
 * Índice de Fixtures — Regressão Sanitária
 *
 * Centraliza export de todos os fixtures para uso em testes de scheduler
 * e validação de domínio.
 */

export { brucelosaBezerra100d } from "./brucelose.bezerra.100d";
export { raivaRiscoPrimoVacinacao } from "./raiva.risco.primo";
export { raivaReforçoDependencia } from "./raiva.reforco.dependencia";
export { campnhaMaioGO } from "./campanha.maio.go";
export { vermifugacaoRecorrente } from "./vermifugacao.recorrente";
export { procedimentoImediatoNotificacao } from "./procedimento.imediato";
export { invalidCicloDependencia } from "./invalid.ciclo.dependencia";
export { invalidCampanhaSemMeses } from "./invalid.campanha.sem_meses";

/**
 * Lista de todos os fixtures válidos (para testes de regressão)
 */
export const validFixtures = [
  { name: "brucelose.bezerra.100d", fixture: brucelosaBezerra100d },
  { name: "raiva.risco.primo", fixture: raivaRiscoPrimoVacinacao },
  { name: "raiva.reforço.dependencia", fixture: raivaReforçoDependencia },
  { name: "campanha.maio.go", fixture: campnhaMaioGO },
  { name: "vermifugacao.recorrente", fixture: vermifugacaoRecorrente },
  { name: "procedimento.imediato", fixture: procedimentoImediatoNotificacao },
];

/**
 * Lista de todos os fixtures inválidos (para testes de validação)
 */
export const invalidFixtures = [
  { name: "invalid.ciclo.dependencia", fixture: invalidCicloDependencia },
  { name: "invalid.campanha.sem_meses", fixture: invalidCampanhaSemMeses },
];
