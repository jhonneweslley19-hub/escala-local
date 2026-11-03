import type { ISODate, Regime, RegimeId, RegrasEmpresa } from "./types";

const BASE = {
  maxDiasConsecutivos: 6,
  horasDiariasNormais: 8,
  horasDiariasMax: 10,
  interjornadaMinHoras: 11,
  descansoSemanalMinHoras: 35,
  domingoFolgaACadaSemanas: 3,
};

/**
 * Regimes de jornada.
 *
 * As datas da EC 141/2026 seguem a contagem divulgada pelo Senado a partir da
 * publicação em 16/10/2026 (42h após ~2 meses; 40h um ano depois). Confirme no
 * texto publicado no DOU e no decreto regulamentador do MTE antes de produção —
 * por isso as datas ficam em um único lugar.
 */
export const REGIMES: Record<RegimeId, Regime> = {
  CLT_44H_6X1: {
    ...BASE,
    id: "CLT_44H_6X1",
    nome: "CLT atual — 44h / 6x1",
    descricao: "Até 44h semanais com 1 folga (DSR) por semana.",
    vigenciaInicio: "1988-10-05",
    vigenciaFim: "2026-12-15",
    horasSemanaisMax: 44,
    folgasSemanaisMin: 1,
    preferirFolgaNoDomingo: false,
    fundamentacao: [
      "CF art. 7º, XIII e XV",
      "CLT arts. 58, 59, 66, 67, 71, 386 e 404",
      "Lei 605/1949 (DSR)",
      "Lei 10.101/2000, art. 6º, p.u. (domingo a cada 3 semanas no comércio)",
      "OJ 410 SDI-1/TST (folga até o 7º dia)",
      "Súmula 110/TST (35h de descanso)",
    ],
  },
  EC141_42H: {
    ...BASE,
    id: "EC141_42H",
    nome: "EC 141/2026 — transição 42h / 5x2",
    descricao: "Fim da 6x1: 2 folgas semanais, uma preferencialmente no domingo, e limite de 42h.",
    vigenciaInicio: "2026-12-16",
    vigenciaFim: "2027-12-15",
    horasSemanaisMax: 42,
    folgasSemanaisMin: 2,
    preferirFolgaNoDomingo: true,
    fundamentacao: [
      "Emenda Constitucional 141/2026 (promulgada em 16/10/2026)",
      "CF art. 7º, XIII e XV (redação da EC 141/2026)",
      "Lei 10.101/2000, art. 6º, p.u.",
      "CLT arts. 59, 66, 67, 71, 386 e 404",
    ],
  },
  EC141_40H: {
    ...BASE,
    id: "EC141_40H",
    nome: "EC 141/2026 — 40h / 5x2",
    descricao: "Regra definitiva: até 40h semanais, 2 folgas por semana, uma preferencialmente no domingo.",
    vigenciaInicio: "2027-12-16",
    horasSemanaisMax: 40,
    folgasSemanaisMin: 2,
    preferirFolgaNoDomingo: true,
    fundamentacao: [
      "Emenda Constitucional 141/2026",
      "CF art. 7º, XIII e XV (redação da EC 141/2026)",
      "Lei 10.101/2000, art. 6º, p.u.",
      "CLT arts. 59, 66, 67, 71, 386 e 404",
    ],
  },
};

export const LISTA_REGIMES: Regime[] = Object.values(REGIMES);

export function regimeVigente(data: ISODate): Regime {
  const r = LISTA_REGIMES.find((r) => data >= r.vigenciaInicio && (!r.vigenciaFim || data <= r.vigenciaFim));
  return r ?? REGIMES.EC141_40H;
}

export const REGRAS_PADRAO: RegrasEmpresa = {
  acordoCompensacao: true,
  feriadoExigeCCT: true,
  feriadosAutorizadosCCT: true,
  folgasConsecutivasPreferidas: true,
  absenteismo: 0.05,
  intervaloMaximo: 60,
};

/** Jornada diária (horas) de um colaborador em uma semana com `diasTrabalho` dias. */
export function jornadaDiaria(cargaSemanal: number, regime: Regime, regras: RegrasEmpresa): number {
  const semanal = Math.min(cargaSemanal, regime.horasSemanaisMax);
  const dias = 7 - regime.folgasSemanaisMin;
  const teto = regras.acordoCompensacao ? regime.horasDiariasMax : regime.horasDiariasNormais;
  return Math.min(semanal / dias, teto);
}

/** Intervalo intrajornada mínimo, em minutos (CLT art. 71). */
export function intervaloMinimo(minutosTrabalho: number): number {
  if (minutosTrabalho > 360) return 60;
  if (minutosTrabalho > 240) return 15;
  return 0;
}
