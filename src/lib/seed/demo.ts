import { dimensionar } from "../engine/dimensionamento";
import { REGRAS_PADRAO } from "../engine/regimes";
import { parseHHMM } from "../engine/tempo";
import type { Ausencia, Colaborador, CurvaDemanda, Feriado, Setor } from "../engine/types";

/** Dados de demonstração: rede de supermercados com 4 lojas e 5 setores por loja. */

export interface LojaDemo {
  id: string;
  nome: string;
  cidade: string;
  abre: string;
  fecha: string;
  abreDomingo: string;
  fechaDomingo: string;
  porte: number;
}

export const LOJAS_DEMO: LojaDemo[] = [
  { id: "loja-centro", nome: "Loja 01 — Centro", cidade: "Centro", abre: "07:00", fecha: "22:00", abreDomingo: "08:00", fechaDomingo: "20:00", porte: 1.2 },
  { id: "loja-norte", nome: "Loja 02 — Zona Norte", cidade: "Zona Norte", abre: "07:00", fecha: "22:00", abreDomingo: "08:00", fechaDomingo: "20:00", porte: 1.0 },
  { id: "loja-sul", nome: "Loja 03 — Zona Sul", cidade: "Zona Sul", abre: "07:00", fecha: "21:00", abreDomingo: "08:00", fechaDomingo: "14:00", porte: 0.8 },
  { id: "loja-avenida", nome: "Loja 04 — Avenida", cidade: "Avenida", abre: "06:00", fecha: "23:00", abreDomingo: "07:00", fechaDomingo: "21:00", porte: 1.4 },
];

interface SetorBase {
  chave: string;
  nome: string;
  /** Pessoas no pico de um dia útil. */
  pico: number;
  /** Fator de intensidade por hora relativa à abertura (forma da curva). */
  forma: (hora: number, abre: number, fecha: number) => number;
  /** Multiplicador por dia (seg..dom). */
  semana: number[];
  /** Antecede a abertura em horas (ex.: padaria, reposição). */
  antecipa: number;
}

const picos = (hora: number, centros: [number, number][]) =>
  Math.max(0.35, ...centros.map(([c, peso]) => peso * Math.exp(-((hora - c) ** 2) / 4)));

const SETORES_BASE: SetorBase[] = [
  { chave: "caixa", nome: "Frente de Caixa", pico: 10, antecipa: 0, semana: [0.8, 0.75, 0.8, 0.85, 1.0, 1.15, 0.8],
    forma: (h) => picos(h, [[11.5, 0.85], [18.5, 1]]) },
  { chave: "reposicao", nome: "Reposição", pico: 6, antecipa: 1, semana: [1, 0.9, 0.9, 0.9, 1, 1.05, 0.6],
    forma: (h, a) => (h < a + 4 ? 1 : 0.55) },
  { chave: "acougue", nome: "Açougue", pico: 4, antecipa: 0, semana: [0.8, 0.75, 0.8, 0.85, 1, 1.2, 0.9],
    forma: (h) => picos(h, [[11, 1], [18, 0.8]]) },
  { chave: "padaria", nome: "Padaria", pico: 4, antecipa: 1, semana: [1, 1, 1, 1, 1, 1.1, 0.9],
    forma: (h) => picos(h, [[7, 1], [17.5, 0.9]]) },
  { chave: "hortifruti", nome: "Hortifrúti", pico: 3, antecipa: 1, semana: [0.9, 0.85, 1, 0.9, 1, 1.1, 0.7],
    forma: (h, a) => (h < a + 3 ? 1 : picos(h, [[11, 0.8], [18, 0.7]])) },
];

function curva(loja: LojaDemo, base: SetorBase): CurvaDemanda {
  return base.semana.map((mult, dia) => {
    const abre = Math.floor(parseHHMM(dia === 6 ? loja.abreDomingo : loja.abre) / 60) - base.antecipa;
    const fecha = Math.ceil(parseHHMM(dia === 6 ? loja.fechaDomingo : loja.fecha) / 60);
    return Array.from({ length: 24 }, (_, h) => {
      if (h < abre || h >= fecha) return 0;
      return Math.max(1, Math.round(base.pico * loja.porte * mult * base.forma(h + 0.5, abre, fecha)));
    });
  });
}

function inicios(loja: LojaDemo, base: SetorBase): number[] {
  const abre = parseHHMM(loja.abre) - base.antecipa * 60;
  const out: number[] = [];
  for (let m = Math.min(abre, parseHHMM(loja.abreDomingo) - base.antecipa * 60); m <= parseHHMM(loja.fecha) - 6 * 60; m += 60) out.push(m);
  return out;
}

export function setoresDemo(loja: LojaDemo): Setor[] {
  return SETORES_BASE.map((b) => ({ id: `${loja.id}:${b.chave}`, nome: b.nome, inicios: inicios(loja, b), demanda: curva(loja, b) }));
}

const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo", "Queila", "Rafael", "Sabrina", "Tiago", "Úrsula", "Vinícius", "Wanessa", "Xavier", "Yasmin", "Zeca", "Patrícia", "Marcos", "Juliana", "Rodrigo", "Fernanda", "Leandro", "Camila", "André", "Letícia", "Renato"];
const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Ferreira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Gomes", "Martins", "Rocha", "Barbosa"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function colaboradoresDemo(loja: LojaDemo, setores: Setor[], semente: number): Colaborador[] {
  const r = rng(semente);
  const out: Colaborador[] = [];
  let n = 0;
  for (const s of setores) {
    // Quadro dimensionado para a regra atual (44h / 6x1).
    const quadro = Math.max(3, dimensionar([s], [], REGRAS_PADRAO)[0].quadroNecessario.CLT_44H_6X1);
    for (let i = 0; i < quadro; i++) {
      n++;
      const nome = `${NOMES[Math.floor(r() * NOMES.length)]} ${SOBRENOMES[Math.floor(r() * SOBRENOMES.length)]}`;
      const meioPeriodo = r() < 0.08;
      const menor = !meioPeriodo && r() < 0.04;
      const ausencias: Ausencia[] = [];
      if (r() < 0.07) {
        const dia = 1 + Math.floor(r() * 20);
        ausencias.push({ inicio: `2026-12-${String(dia).padStart(2, "0")}`, fim: `2026-12-${String(Math.min(31, dia + 9)).padStart(2, "0")}`, tipo: "FERIAS" });
      }
      out.push({
        id: `${loja.id}:c${String(n).padStart(3, "0")}`,
        nome,
        setorId: s.id,
        cargaSemanal: menor ? 30 : meioPeriodo ? 36 : 44,
        domingoQuinzenal: false,
        menorDeIdade: menor,
        diasIndisponiveis: r() < 0.05 ? [Math.floor(r() * 6)] : [],
        ausencias,
      });
    }
  }
  return out;
}

export const FERIADOS_DEMO: Feriado[] = [
  { data: "2026-11-02", nome: "Finados" },
  { data: "2026-11-15", nome: "Proclamação da República" },
  { data: "2026-11-20", nome: "Dia da Consciência Negra" },
  { data: "2026-12-25", nome: "Natal" },
  { data: "2027-01-01", nome: "Confraternização Universal" },
];
