import { LISTA_REGIMES } from "./regimes";
import type { Colaborador, EntradaGeracao, Regime, RegimeId, RegrasEmpresa, ResultadoEscala, Setor } from "./types";

export interface DimensionamentoSetor {
  setorId: string;
  setor: string;
  quadroAtual: number;
  /** Pessoa-hora demandada por semana. */
  horasDemandadas: number;
  /** Horas disponíveis por semana com o quadro atual, por regime. */
  capacidade: Record<RegimeId, number>;
  /** Quadro mínimo estimado por regime. */
  quadroNecessario: Record<RegimeId, number>;
}

/** Horas semanais efetivas de uma pessoa no regime (sem acordo de compensação, o dia fica limitado a 8h). */
export function horasEfetivas(carga: number, regime: Regime, regras: RegrasEmpresa): number {
  const semanal = Math.min(carga, regime.horasSemanaisMax);
  if (regras.acordoCompensacao) return semanal;
  return Math.min(semanal, regime.horasDiariasNormais * (7 - regime.folgasSemanaisMin));
}

/**
 * Estimativa de quadro mínimo por setor. Usa o maior entre:
 *  - horas demandadas na semana ÷ horas efetivas por pessoa (descontado o absenteísmo);
 *  - pessoas necessárias no dia mais exigente (seg–sáb);
 *  - pessoas no domingo ÷ fração do quadro que pode trabalhar no domingo (rodízio dominical).
 * É um limite inferior para planejamento; a geração da escala confirma a cobertura real.
 */
export function dimensionar(setores: Setor[], colaboradores: Colaborador[], regras: RegrasEmpresa): DimensionamentoSetor[] {
  return setores.map((s) => {
    const quadro = colaboradores.filter((c) => c.setorId === s.id);
    const horasDemandadas = s.demanda.reduce((t, dia) => t + dia.reduce((a, b) => a + b, 0), 0);
    const cargaMedia = quadro.length ? quadro.reduce((t, c) => t + c.cargaSemanal, 0) / quadro.length : 44;
    const capacidade = {} as Record<RegimeId, number>;
    const quadroNecessario = {} as Record<RegimeId, number>;
    for (const r of LISTA_REGIMES) {
      capacidade[r.id] = Math.round(quadro.reduce((t, c) => t + horasEfetivas(c.cargaSemanal, r, regras), 0) * (1 - regras.absenteismo));
      const porPessoa = horasEfetivas(cargaMedia, r, regras) * (1 - regras.absenteismo);
      const jornada = porPessoa / (7 - r.folgasSemanaisMin);
      const porHoras = horasDemandadas / porPessoa;
      const diaria = (dia: number[]) =>
        Math.max(Math.max(0, ...dia), dia.reduce((a, b) => a + b, 0) / Math.max(1, jornada));
      const picoSemana = Math.max(...s.demanda.slice(0, 6).map(diaria));
      const porDomingo = diaria(s.demanda[6]) / (1 - 1 / r.domingoFolgaACadaSemanas);
      quadroNecessario[r.id] = Math.ceil(Math.max(porHoras, picoSemana, porDomingo) - 1e-9);
    }
    return { setorId: s.id, setor: s.nome, quadroAtual: quadro.length, horasDemandadas: Math.round(horasDemandadas), capacidade, quadroNecessario };
  });
}

export interface SimulacaoSetor {
  setorId: string;
  setor: string;
  quadroAtual: number;
  /** Cobertura da demanda (%) com o quadro atual em cada regime. */
  cobertura: Record<RegimeId, number>;
  /** Quadro necessário para manter a cobertura que o setor tem hoje (regime de 44h). */
  quadroParaManter: Record<RegimeId, number>;
}

/**
 * Dimensionamento por simulação: gera escalas com o próprio motor em cada regime
 * e acrescenta colaboradores de 44h até a cobertura voltar ao nível do regime atual
 * (tolerância de 0,5 ponto percentual, para absorver a variação da heurística).
 * Ausências são ignoradas para medir a capacidade estrutural do quadro.
 */
export function simularQuadro(
  setores: Setor[],
  colaboradores: Colaborador[],
  regras: RegrasEmpresa,
  gerar: (entrada: EntradaGeracao) => ResultadoEscala,
  opcoes: { inicio?: string; semanas?: number; maxExtras?: number } = {},
): SimulacaoSetor[] {
  const inicio = opcoes.inicio ?? "2027-01-04";
  const semanas = opcoes.semanas ?? 3;
  const maxExtras = opcoes.maxExtras ?? 15;
  const rodar = (setor: Setor, quadro: Colaborador[], regimeId: RegimeId) =>
    gerar({ inicio, semanas, regimeId, regras, setores: [setor], colaboradores: quadro, feriados: [] }).metricas.coberturaPct;

  return setores.map((s) => {
    const quadro = colaboradores
      .filter((c) => c.setorId === s.id)
      .map((c) => ({ ...c, ausencias: [], ultimoDomingoFolga: undefined, diasConsecutivosAntes: undefined }));
    const cobertura = {} as Record<RegimeId, number>;
    const quadroParaManter = {} as Record<RegimeId, number>;
    for (const r of LISTA_REGIMES) cobertura[r.id] = rodar(s, quadro, r.id);
    const alvo = cobertura.CLT_44H_6X1 - 0.5;
    let anterior = quadro.length;
    // Regimes em ordem decrescente de horas: o quadro nunca diminui de um para o seguinte.
    for (const r of LISTA_REGIMES) {
      let n = 0;
      let cob = cobertura[r.id];
      const extras: Colaborador[] = [];
      while (cob < alvo && n < maxExtras) {
        n++;
        extras.push({ id: `${s.id}:sim${n}`, nome: `Simulado ${n}`, setorId: s.id, cargaSemanal: 44, domingoQuinzenal: false, menorDeIdade: false, diasIndisponiveis: [], ausencias: [] });
        cob = rodar(s, [...quadro, ...extras], r.id);
      }
      quadroParaManter[r.id] = Math.max(anterior, quadro.length + n);
      anterior = quadroParaManter[r.id];
    }
    return { setorId: s.id, setor: s.nome, quadroAtual: quadro.length, cobertura, quadroParaManter };
  });
}
