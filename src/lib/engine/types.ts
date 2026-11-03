/** Data no formato ISO `YYYY-MM-DD` (sempre interpretada em UTC). */
export type ISODate = string;

export type RegimeId = "CLT_44H_6X1" | "EC141_42H" | "EC141_40H";

/** Parâmetros legais de jornada e descanso de um regime. */
export interface Regime {
  id: RegimeId;
  nome: string;
  descricao: string;
  /** Primeiro dia de vigência (inclusive). */
  vigenciaInicio: ISODate;
  /** Último dia de vigência (inclusive). Ausente = sem data de término. */
  vigenciaFim?: ISODate;
  horasSemanaisMax: number;
  folgasSemanaisMin: number;
  /** Dias de trabalho seguidos permitidos antes de uma folga (OJ 410 SDI-1/TST). */
  maxDiasConsecutivos: number;
  /** Jornada normal diária (CF art. 7º, XIII). Acima disso só com acordo de compensação. */
  horasDiariasNormais: number;
  /** Teto absoluto diário, inclusive com compensação/extras (CLT art. 59). */
  horasDiariasMax: number;
  /** Intervalo mínimo entre duas jornadas (CLT art. 66). */
  interjornadaMinHoras: number;
  /** DSR de 24h + 11h de interjornada (CLT art. 67 + Súmula 110/TST). */
  descansoSemanalMinHoras: number;
  /** No comércio, a folga deve coincidir com domingo ao menos 1 vez a cada N semanas (Lei 10.101/2000, art. 6º, p.u.). */
  domingoFolgaACadaSemanas: number;
  /** EC 141/2026: uma das folgas semanais deve recair, preferencialmente, no domingo. */
  preferirFolgaNoDomingo: boolean;
  fundamentacao: string[];
}

/** Configurações da empresa / convenção coletiva que alteram a aplicação das regras. */
export interface RegrasEmpresa {
  /** Há acordo de compensação de jornada (CLT art. 59, §2º) permitindo jornada diária > 8h. */
  acordoCompensacao: boolean;
  /** Trabalho em feriados no comércio exige autorização em convenção coletiva (Portaria MTE 3.665/2023; Lei 10.101/2000, art. 6º-A). */
  feriadoExigeCCT: boolean;
  /** A CCT vigente autoriza trabalho em feriados. */
  feriadosAutorizadosCCT: boolean;
  /** Preferir que as 2 folgas semanais sejam em dias seguidos. */
  folgasConsecutivasPreferidas: boolean;
  /** Fator de absenteísmo usado no dimensionamento (0–1). */
  absenteismo: number;
  /**
   * Intervalo máximo (min) que o motor pode usar em jornadas acima de 6h: 60 (só o mínimo legal),
   * 90 ou 120. A CLT permite de 1h a 2h sem acordo (art. 71); o motor só alonga o intervalo
   * quando isso cobre mais horas de demanda, por exemplo no vale entre os picos do almoço e da noite.
   */
  intervaloMaximo?: number;
}

export type TipoAusencia = "FERIAS" | "AFASTAMENTO" | "LICENCA" | "OUTRO";

export interface Ausencia {
  inicio: ISODate;
  fim: ISODate;
  tipo: TipoAusencia;
}

export interface Colaborador {
  id: string;
  nome: string;
  setorId: string;
  /** Carga semanal contratada, em horas. */
  cargaSemanal: number;
  /** Aplicar escala de revezamento quinzenal com domingo (CLT art. 386). */
  domingoQuinzenal: boolean;
  /** Menor de 18 anos: proibido trabalho noturno 22h–5h (CLT art. 404). */
  menorDeIdade: boolean;
  /** Dias da semana em que não pode trabalhar (0 = segunda … 6 = domingo). */
  diasIndisponiveis: number[];
  /** Janela de disponibilidade diária, em minutos desde 00:00. */
  disponivelDe?: number;
  disponivelAte?: number;
  ausencias: Ausencia[];
  /** Último domingo de folga antes do início do período (para continuar o rodízio). */
  ultimoDomingoFolga?: ISODate;
  /** Dias trabalhados em sequência imediatamente antes do início do período. */
  diasConsecutivosAntes?: number;
  /** Último turno antes do período: quantos dias antes do início e horário de saída (min desde 00:00 daquele dia). */
  ultimoTurnoAntes?: { diasAtras: number; fim: number };
}

/** Demanda de pessoas por hora: `[diaSemana 0=seg..6=dom][hora 0..23]`. */
export type CurvaDemanda = number[][];

export interface Setor {
  id: string;
  nome: string;
  /** Horários de início de turno permitidos, em minutos desde 00:00. */
  inicios: number[];
  demanda: CurvaDemanda;
}

export interface Feriado {
  data: ISODate;
  nome: string;
}

export type TipoDia = "T" | "F" | "A";

export interface DiaEscala {
  data: ISODate;
  tipo: TipoDia;
  /** Minutos desde 00:00 do dia (apenas para `T`). */
  inicio?: number;
  /** Minutos desde 00:00 do dia; pode passar de 1440 em turnos que viram a noite. */
  fim?: number;
  /** Duração do intervalo intrajornada, em minutos. */
  intervalo?: number;
  /** Início do intervalo, em minutos desde 00:00 do dia. */
  intervaloInicio?: number;
  /** Para `A`: tipo da ausência. */
  motivo?: string;
}

export interface EntradaGeracao {
  inicio: ISODate;
  semanas: number;
  /** Regime fixo; se omitido, usa o regime vigente em cada semana. */
  regimeId?: RegimeId;
  regras: RegrasEmpresa;
  setores: Setor[];
  colaboradores: Colaborador[];
  feriados: Feriado[];
}

export type Severidade = "erro" | "alerta";

export type CodigoRegra =
  | "JORNADA_SEMANAL"
  | "FOLGAS_SEMANAIS"
  | "DIAS_CONSECUTIVOS"
  | "DOMINGO_ROTATIVO"
  | "DOMINGO_QUINZENAL"
  | "INTERJORNADA"
  | "DESCANSO_SEMANAL"
  | "JORNADA_DIARIA"
  | "INTERVALO"
  | "MENOR_NOTURNO"
  | "FERIADO_SEM_CCT"
  | "INDISPONIBILIDADE"
  | "COBERTURA";

export interface Violacao {
  regra: CodigoRegra;
  severidade: Severidade;
  mensagem: string;
  colaboradorId?: string;
  setorId?: string;
  data?: ISODate;
}

export interface CoberturaDia {
  data: ISODate;
  setorId: string;
  necessario: number[];
  alocado: number[];
}

export interface Metricas {
  horasDemandadas: number;
  horasCobertas: number;
  horasFaltantes: number;
  horasExcedentes: number;
  /** % da demanda (pessoa-hora) atendida. */
  coberturaPct: number;
  /** % de semanas-colaborador em que uma das folgas caiu no domingo. */
  folgaDominicalPct: number;
  erros: number;
  alertas: number;
}

export interface Escala {
  inicio: ISODate;
  semanas: number;
  /** Regime aplicado em cada semana. */
  regimes: RegimeId[];
  /** Dias de cada colaborador, indexados pelo id. */
  dias: Record<string, DiaEscala[]>;
}

export interface ResultadoEscala {
  escala: Escala;
  violacoes: Violacao[];
  cobertura: CoberturaDia[];
  metricas: Metricas;
}
