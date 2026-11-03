import type { Colaborador, CurvaDemanda, Setor } from "../engine/types";

/**
 * Loja Modelo (Frente de Caixa) com dados fictícios, para demonstração: curva de demanda
 * inventada (pico no almoço e no fim da tarde, sábado mais forte), no máximo 12 caixas,
 * e 16 operadores com nomes inventados. As operadoras marcadas têm domingo quinzenal
 * (CLT art. 386). Usada quando ESCALA_SEED=exemplo.
 */

export const LOJA_EXEMPLO = {
  id: "loja-modelo",
  nome: "Loja Modelo",
  cidade: "Bairro Exemplo",
  abre: "07:00",
  fecha: "22:00",
  abreDomingo: "07:00",
  fechaDomingo: "22:00",
};

/** Operadores necessários por hora: [seg..dom][0..23h]. */
const DEMANDA: CurvaDemanda = [
  [0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 5, 5, 3, 3, 3, 4, 6, 8, 8, 6, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 5, 5, 3, 3, 3, 4, 6, 8, 8, 6, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 5, 5, 4, 3, 3, 5, 6, 8, 8, 6, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 6, 4, 3, 3, 5, 7, 9, 9, 7, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 3, 5, 6, 7, 7, 5, 3, 3, 6, 8, 10, 10, 8, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 3, 5, 7, 8, 9, 9, 5, 4, 4, 7, 9, 12, 12, 9, 4, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 6, 6, 4, 3, 3, 5, 6, 6, 6, 5, 2, 0, 0],
];

/** Entradas a cada 30 min das 07:00 às 12:30, mais 12:36 (saída às 22:00 com 8h24 + 1h). */
const INICIOS = [...Array.from({ length: 12 }, (_, i) => 420 + i * 30), 756];

export const SETOR_CAIXA: Setor = { id: "loja-modelo:caixa", nome: "Frente de Caixa", inicios: INICIOS, demanda: DEMANDA };

const OPERADORES = [
  "Amanda Teixeira", "Bruno Cavalcante", "Cíntia Moraes", "Davi Rezende", "Elisa Prado", "Felipe Antunes",
  "Giovana Lacerda", "Hugo Siqueira", "Íris Monteiro", "Jonas Peixoto", "Lívia Brandão", "Murilo Fontes",
  "Nádia Vasconcelos", "Otávio Rangel", "Priscila Duarte", "Samuel Queiroz",
];
const DOMINGO_QUINZENAL = new Set(["Amanda Teixeira", "Cíntia Moraes", "Elisa Prado", "Giovana Lacerda", "Íris Monteiro", "Lívia Brandão", "Nádia Vasconcelos"]);

export const OPERADORES_EXEMPLO: Colaborador[] = OPERADORES.map((nome, i) => ({
  id: `loja-modelo:op${String(i + 1).padStart(2, "0")}`,
  nome,
  setorId: SETOR_CAIXA.id,
  cargaSemanal: 44,
  domingoQuinzenal: DOMINGO_QUINZENAL.has(nome),
  menorDeIdade: false,
  diasIndisponiveis: [],
  ausencias: [],
}));

/** Escala 5x2 de demonstração: 4 semanas a partir de 02/11/2026, regime de 42h. */
export const ESCALA_EXEMPLO = { id: "loja-modelo-2026-11-02", inicio: "2026-11-02", semanas: 4, regimeId: "EC141_42H" as const };
