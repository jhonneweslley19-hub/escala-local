import { curvaDoDia, somarTurno } from "./cobertura";
import { REGIMES, intervaloMinimo, regimeVigente } from "./regimes";
import { addDias, diaSemana } from "./tempo";
import {
  domingosTrabalhadosAntes,
  emAusencia,
  folgasExigidas,
  limiteDomingos,
  validarEscala,
} from "./validador";
import type { Colaborador, DiaEscala, EntradaGeracao, Regime, ResultadoEscala, Setor, TipoDia } from "./types";

/** Hash determinístico para desempates — a mesma entrada sempre gera a mesma escala. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Plano {
  c: Colaborador;
  tipo: TipoDia[];
  motivo: (string | undefined)[];
  /** Minutos de trabalho em cada dia do período (0 em folgas e ausências). */
  jornada: number[];
  dias: DiaEscala[];
}

const DESCANSO_DIARIO = 11 * 60;
const DESCANSO_SEMANAL = 35 * 60;

/**
 * Gera a escala em duas fases:
 *  1. Folgas — rodízio de domingos (Lei 10.101/2000, art. 386 CLT, preferência
 *     dominical da EC 141/2026) e folgas semanais nos dias de menor demanda,
 *     respeitando o limite de dias consecutivos.
 *  2. Turnos — escolhe o horário de entrada que mais cobre a curva de demanda,
 *     respeitando interjornada (11h), descanso semanal (35h), janela de
 *     disponibilidade e restrições de menores; depois refina por busca local.
 * Ao final a escala passa pelo validador, que é a fonte da verdade sobre conformidade.
 */
export function gerarEscala(entrada: EntradaGeracao): ResultadoEscala {
  const { inicio, semanas, regras, setores, colaboradores, feriados } = entrada;
  const D = semanas * 7;
  const datas = Array.from({ length: D }, (_, i) => addDias(inicio, i));
  const regimes: Regime[] = Array.from({ length: semanas }, (_, w) =>
    entrada.regimeId ? REGIMES[entrada.regimeId] : regimeVigente(datas[w * 7 + 6]),
  );
  const fer = new Set(feriados.map((f) => f.data));
  const dias: Record<string, DiaEscala[]> = {};

  for (const setor of setores) {
    const planos = colaboradores
      .filter((c) => c.setorId === setor.id)
      .map((c) => criarPlano(c, datas));
    if (!planos.length) continue;
    planejarFolgas(planos, setor, datas, regimes, fer, regras.folgasConsecutivasPreferidas);
    definirJornadas(planos, setor, datas, regimes, fer, regras.acordoCompensacao);
    alocarTurnos(planos, setor, datas, fer, regras.intervaloMaximo ?? 60);
    for (const p of planos) dias[p.c.id] = p.dias;
  }

  const escala = { inicio, semanas, regimes: regimes.map((r) => r.id), dias };
  return { escala, ...validarEscala({ escala, colaboradores, setores, regras, feriados }) };
}

function criarPlano(c: Colaborador, datas: string[]): Plano {
  const tipo: TipoDia[] = [];
  const motivo: (string | undefined)[] = [];
  for (const data of datas) {
    const aus = emAusencia(c, data);
    if (aus) {
      tipo.push("A");
      motivo.push(aus.tipo);
    } else if (c.diasIndisponiveis.includes(diaSemana(data))) {
      tipo.push("F");
      motivo.push("INDISPONIVEL");
    } else {
      tipo.push("T");
      motivo.push(undefined);
    }
  }
  return { c, tipo, motivo, jornada: [], dias: [] };
}

/** Pessoas necessárias no dia: o maior entre o pico horário e a demanda total dividida pela jornada média. */
function necessidadeDiaria(curva: number[], jornadaMediaH: number): number {
  const pico = Math.max(0, ...curva);
  const total = curva.reduce((a, b) => a + b, 0);
  return Math.max(Math.ceil(pico), Math.ceil(total / Math.max(1, jornadaMediaH)));
}

function maiorSequencia(p: Plano, ate: number): { tamanho: number; fim: number } {
  let seq = p.c.diasConsecutivosAntes ?? 0;
  let melhor = { tamanho: seq, fim: -1 };
  for (let i = 0; i <= ate; i++) {
    seq = p.tipo[i] === "T" ? seq + 1 : 0;
    if (seq > melhor.tamanho) melhor = { tamanho: seq, fim: i };
  }
  return melhor;
}

function planejarFolgas(
  planos: Plano[],
  setor: Setor,
  datas: string[],
  regimes: Regime[],
  fer: Set<string>,
  consecutivas: boolean,
) {
  const necessario = datas.map((data, i) => {
    const r = regimes[Math.floor(i / 7)];
    const jornadaMedia = planos.reduce((s, p) => s + Math.min(p.c.cargaSemanal, r.horasSemanaisMax), 0) /
      planos.length / (7 - r.folgasSemanaisMin);
    return necessidadeDiaria(curvaDoDia(setor, data, fer), jornadaMedia);
  });
  const trabalhando = (i: number) => planos.filter((p) => p.tipo[i] === "T").length;
  const folgasDomingo = new Map<Plano, number>(planos.map((p) => [p, 0]));
  const domSeq = new Map<Plano, number>(planos.map((p) => [p, domingosTrabalhadosAntes(p.c, datas[6])]));

  for (let w = 0; w < regimes.length; w++) {
    const regime = regimes[w];
    const dom = w * 7 + 6;

    // 1) Rodízio de domingos
    const candidatos = planos.filter((p) => p.tipo[dom] === "T");
    for (const p of planos) if (p.tipo[dom] !== "T") domSeq.set(p, 0);
    const obrigatorios = candidatos.filter((p) => domSeq.get(p)! >= limiteDomingos(p.c, regime) - 1);
    const capacidade = Math.max(0, trabalhando(dom) - necessario[dom]);
    const justo = Math.ceil(candidatos.length / regime.domingoFolgaACadaSemanas);
    const alvo = regime.preferirFolgaNoDomingo ? capacidade : Math.min(capacidade, justo);
    const quantidade = Math.min(candidatos.length, Math.max(obrigatorios.length, alvo));
    const ordenados = [...candidatos].sort(
      (a, b) =>
        domSeq.get(b)! / limiteDomingos(b.c, regime) - domSeq.get(a)! / limiteDomingos(a.c, regime) ||
        folgasDomingo.get(a)! - folgasDomingo.get(b)! ||
        hash(a.c.id + w) - hash(b.c.id + w),
    );
    ordenados.forEach((p, idx) => {
      if (idx < quantidade) {
        p.tipo[dom] = "F";
        p.motivo[dom] = "FOLGA_DOMINICAL";
        domSeq.set(p, 0);
        folgasDomingo.set(p, folgasDomingo.get(p)! + 1);
      } else {
        domSeq.set(p, domSeq.get(p)! + 1);
      }
    });

    // 2) Folgas semanais nos dias de maior sobra de pessoal
    const ordem = [...planos].sort((a, b) => hash(a.c.id + "s" + w) - hash(b.c.id + "s" + w));
    const contagem = Array.from({ length: 7 }, (_, k) => trabalhando(w * 7 + k));
    for (const p of ordem) {
      const idx = Array.from({ length: 7 }, (_, k) => w * 7 + k);
      const ausentes = idx.filter((i) => p.tipo[i] === "A").length;
      const exigidas = folgasExigidas(regime, ausentes);
      const escolher = () => {
        let melhor = -1;
        let melhorScore = -Infinity;
        for (const i of idx) {
          if (p.tipo[i] !== "T" || i === dom) continue;
          const k = i - w * 7;
          let score = contagem[k] - necessario[i];
          if (consecutivas && (p.tipo[i - 1] === "F" || p.tipo[i + 1] === "F")) score += 0.75;
          p.tipo[i] = "F";
          if (maiorSequencia(p, w * 7 + 6).tamanho > regime.maxDiasConsecutivos) score -= 1000;
          p.tipo[i] = "T";
          score += (hash(p.c.id + i) % 100) / 1000;
          if (score > melhorScore) {
            melhorScore = score;
            melhor = i;
          }
        }
        if (melhor >= 0) {
          p.tipo[melhor] = "F";
          p.motivo[melhor] = "FOLGA";
          contagem[melhor - w * 7]--;
        }
        return melhor >= 0;
      };
      let folgas = idx.filter((i) => p.tipo[i] === "F").length;
      while (folgas < exigidas && escolher()) folgas++;
      // Folga extra quando necessária para não ultrapassar o limite de dias seguidos
      let seguranca = 7;
      while (maiorSequencia(p, w * 7 + 6).tamanho > regime.maxDiasConsecutivos && seguranca--) {
        const { tamanho, fim } = maiorSequencia(p, w * 7 + 6);
        const comeco = fim - tamanho + 1;
        let melhor = -1;
        let melhorScore = -Infinity;
        // A folga precisa cair dentro dos primeiros `max` dias após o início da sequência.
        for (let i = Math.max(w * 7, fim - regime.maxDiasConsecutivos); i <= Math.min(fim, comeco + regime.maxDiasConsecutivos); i++) {
          if (p.tipo[i] !== "T") continue;
          const score = contagem[i - w * 7] - necessario[i];
          if (score > melhorScore) {
            melhorScore = score;
            melhor = i;
          }
        }
        if (melhor < 0) break;
        p.tipo[melhor] = "F";
        p.motivo[melhor] = "FOLGA";
        contagem[melhor - w * 7]--;
      }
    }
  }
}

/** Maior jornada (min) que cabe, com o intervalo obrigatório, em uma janela de `janela` minutos. */
export function jornadaQueCabe(janela: number): number {
  let m = Math.floor(janela / 5) * 5;
  while (m > 0 && m + intervaloMinimo(m) > janela) m -= 5;
  return m;
}

/** Janela (min) em que o setor tem demanda no dia, limitada à disponibilidade do colaborador. */
function janelaDoDia(curva: number[], c: Colaborador): number {
  const horas = curva.map((n, h) => (n > 0 ? h : -1)).filter((h) => h >= 0);
  if (!horas.length) return Infinity;
  let ini = horas[0] * 60;
  let fim = (horas[horas.length - 1] + 1) * 60;
  if (c.disponivelDe != null) ini = Math.max(ini, c.disponivelDe);
  if (c.disponivelAte != null) fim = Math.min(fim, c.disponivelAte);
  if (c.menorDeIdade) {
    ini = Math.max(ini, 300);
    fim = Math.min(fim, 1320);
  }
  return Math.max(0, fim - ini);
}

/**
 * Jornada de cada dia trabalhado. A carga da semana é dividida igualmente pelos dias
 * de trabalho (até o teto diário). Em dias de funcionamento curto — domingo ou feriado
 * em que a loja fecha cedo — o turno é reduzido para caber no horário, e os minutos
 * que sobram são compensados nos demais dias da semana, sem passar do teto.
 */
function definirJornadas(planos: Plano[], setor: Setor, datas: string[], regimes: Regime[], fer: Set<string>, acordoCompensacao: boolean) {
  const janelasPorDia = datas.map((d) => curvaDoDia(setor, d, fer));
  for (const p of planos) {
    p.jornada = new Array(datas.length).fill(0);
    regimes.forEach((r, w) => {
      const idx = Array.from({ length: 7 }, (_, k) => w * 7 + k).filter((i) => p.tipo[i] === "T");
      if (!idx.length) return;
      const ausentes = p.tipo.slice(w * 7, w * 7 + 7).filter((t) => t === "A").length;
      const alvo = (Math.min(p.c.cargaSemanal, r.horasSemanaisMax) * 60 * (7 - ausentes)) / 7;
      const teto = (acordoCompensacao ? r.horasDiariasMax : r.horasDiariasNormais) * 60;
      const base = Math.min(teto, alvo / idx.length);
      const limite = new Map(idx.map((i) => [i, Math.min(teto, jornadaQueCabe(janelaDoDia(janelasPorDia[i], p.c)))]));
      const min = new Map(idx.map((i) => [i, Math.min(base, limite.get(i)!)]));
      // Compensa o que foi cortado nos dias curtos, distribuindo nos dias com folga de teto.
      let sobra = idx.reduce((t, i) => t + base - min.get(i)!, 0);
      for (let rodada = 0; sobra > 1 && rodada < 10; rodada++) {
        const abertos = idx.filter((i) => min.get(i)! < limite.get(i)! - 1);
        if (!abertos.length) break;
        const parcela = sobra / abertos.length;
        for (const i of abertos) {
          const add = Math.min(parcela, limite.get(i)! - min.get(i)!);
          min.set(i, min.get(i)! + add);
          sobra -= add;
        }
      }
      // Minuto exato: 42h ÷ 5 = 8h24 (arredondar para 5 min perderia 20 min por semana).
      for (const i of idx) p.jornada[i] = Math.floor(min.get(i)! + 1e-9);
    });
  }
}

function montarTurno(data: string, inicio: number, minutos: number, intervalo = intervaloMinimo(minutos)): DiaEscala {
  const meio = Math.round(minutos / 2 / 30) * 30;
  return {
    data,
    tipo: "T",
    inicio,
    fim: inicio + minutos + intervalo,
    intervalo,
    intervaloInicio: intervalo ? inicio + meio : undefined,
  };
}

/** Durações de intervalo possíveis: acima de 6h de trabalho, de 1h até `maximo`, de 30 em 30 min (CLT art. 71). */
function intervalosPossiveis(minutos: number, maximo: number): number[] {
  const min = intervaloMinimo(minutos);
  if (min < 60) return [min];
  const out: number[] = [];
  for (let iv = 60; iv <= Math.min(120, Math.max(60, maximo)); iv += 30) out.push(iv);
  return out;
}

/** Custo de um intervalo acima de 1h: só vale a pena se cobrir mais demanda do que isso. */
const custoIntervalo = (t: DiaEscala) => (t.intervalo && t.intervalo > 60 ? (0.2 * (t.intervalo - 60)) / 30 : 0);

function alocarTurnos(planos: Plano[], setor: Setor, datas: string[], fer: Set<string>, intervaloMaximo: number) {
  const D = datas.length;
  const necessario = datas.flatMap((d) => curvaDoDia(setor, d, fer).slice(0, 24));
  const alocado = new Array(D * 24).fill(0);
  const inicios = [...setor.inicios].sort((a, b) => a - b);

  for (const p of planos) {
    p.dias = datas.map((data, i) =>
      p.tipo[i] === "T" ? { data, tipo: "T" } : { data, tipo: p.tipo[i], motivo: p.motivo[i] },
    );
  }

  // Horário com demanda em cada dia: o turno deve caber nele, com tolerância para abertura e
  // fechamento (ninguém escalado horas depois de a loja fechar).
  const TOLERANCIA = 30;
  const janelas = datas.map((_, i) => {
    const horas = necessario.slice(i * 24, i * 24 + 24).map((n, h) => (n > 0 ? h : -1)).filter((h) => h >= 0);
    return horas.length ? { ini: horas[0] * 60, fim: (horas[horas.length - 1] + 1) * 60 } : null;
  });

  /** Turnos possíveis no dia (entrada × duração do intervalo), ainda sem conferir o descanso. */
  const cacheTurnos = new Map<string, DiaEscala[]>();
  const turnosPermitidos = (p: Plano, i: number): DiaEscala[] => {
    const m = p.jornada[i];
    const chave = `${p.c.id}|${i}|${m}`;
    const salvo = cacheTurnos.get(chave);
    if (salvo) return salvo;
    const validos: DiaEscala[] = [];
    for (const s of inicios) {
      for (const iv of intervalosPossiveis(m, intervaloMaximo)) {
        const fim = s + m + iv;
        if (p.c.disponivelDe != null && s < p.c.disponivelDe) continue;
        if (p.c.disponivelAte != null && fim > p.c.disponivelAte) continue;
        if (p.c.menorDeIdade && (s < 300 || fim > 1320)) continue;
        validos.push(montarTurno(datas[i], s, m, iv));
      }
    }
    const j = janelas[i];
    const dentro = j ? validos.filter((t) => t.inicio! >= j.ini - TOLERANCIA && t.fim! <= j.fim + TOLERANCIA) : validos;
    const r = dentro.length ? dentro : validos.filter((t) => t.intervalo === intervaloMinimo(m));
    cacheTurnos.set(chave, r);
    return r;
  };

  /** Fim (absoluto) do último turno antes de `i`, e quantos dias de folga há no meio. */
  const anterior = (p: Plano, i: number) => {
    for (let j = i - 1; j >= 0; j--) {
      const d = p.dias[j];
      if (d.tipo === "T" && d.fim != null) return { fimAbs: j * 1440 + d.fim, folga: j < i - 1 };
      if (d.tipo === "A") return null;
    }
    // Sem turno no período: usa o último turno da escala anterior, se houver.
    const h = p.c.ultimoTurnoAntes;
    return h ? { fimAbs: -h.diasAtras * 1440 + h.fim, folga: i + h.diasAtras > 1 } : null;
  };
  /** Início (absoluto) mais cedo possível do próximo turno após `i`. */
  const proximo = (p: Plano, i: number, usarAtribuido: boolean) => {
    for (let j = i + 1; j < D; j++) {
      if (p.tipo[j] === "A") return null;
      if (p.tipo[j] !== "T") continue;
      const d = p.dias[j];
      if (usarAtribuido && d.inicio != null) return { inicioAbs: j * 1440 + d.inicio, folga: j > i + 1 };
      const perm = turnosPermitidos(p, j);
      if (!perm.length) return null;
      return { inicioAbs: j * 1440 + Math.min(...perm.map((t) => t.inicio!)), folga: j > i + 1 };
    }
    return null;
  };

  const contrib = new Array<number>(24).fill(0);
  const escolher = (p: Plano, i: number, usarAtribuido: boolean) => {
    const m = p.jornada[i];
    if (!m) return;
    const ant = anterior(p, i);
    const prox = proximo(p, i, usarAtribuido);
    const inicioAnterior = p.dias[i - 1]?.inicio;
    let melhor: DiaEscala | null = null;
    let melhorScore = -Infinity;
    let reserva: DiaEscala | null = null;
    let reservaFolga = -Infinity;
    for (const opcao of turnosPermitidos(p, i)) {
      const turno = { ...opcao };
      const s = turno.inicio!;
      const iniAbs = i * 1440 + s;
      const fimAbs = i * 1440 + turno.fim!;
      let folgaMin = Infinity;
      if (ant) folgaMin = Math.min(folgaMin, iniAbs - ant.fimAbs - (ant.folga ? DESCANSO_SEMANAL : DESCANSO_DIARIO));
      if (prox) folgaMin = Math.min(folgaMin, prox.inicioAbs - fimAbs - (prox.folga ? DESCANSO_SEMANAL : DESCANSO_DIARIO));
      if (folgaMin > reservaFolga) {
        reservaFolga = folgaMin;
        reserva = turno;
      }
      if (folgaMin < 0) continue;
      // O turno fica dentro do próprio dia: basta olhar as 24 horas dele.
      contrib.fill(0);
      somarTurno(contrib, 0, turno);
      let score = 0;
      for (let h = 0; h < 24; h++) {
        if (!contrib[h]) continue;
        const deficit = Math.max(0, necessario[i * 24 + h] - alocado[i * 24 + h]);
        const util = Math.min(contrib[h], deficit);
        score += util - 0.2 * (contrib[h] - util);
      }
      if (s === inicioAnterior) score += 0.05;
      score -= custoIntervalo(turno);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = turno;
      }
    }
    // Sem opção legal: usa a que menos viola o descanso; o validador sinaliza.
    const turno = melhor ?? reserva;
    if (!turno) return;
    p.dias[i] = turno;
    somarTurno(alocado, i, turno);
  };

  const ordem = (i: number) =>
    planos
      .filter((p) => p.tipo[i] === "T")
      .sort(
        (a, b) =>
          turnosPermitidos(a, i).length - turnosPermitidos(b, i).length ||
          hash(a.c.id + "t" + i) - hash(b.c.id + "t" + i),
      );

  for (let i = 0; i < D; i++) for (const p of ordem(i)) escolher(p, i, false);

  // Busca local: realoca cada turno junto com o próximo dia trabalhado, o que
  // permite, por exemplo, atrasar a entrada de sábado e de segunda ao mesmo tempo
  // sem quebrar as 35h de descanso semanal.
  const buffer = new Array(D * 24).fill(0);
  const pontuarFixo = (i: number, turno: DiaEscala) => {
    somarTurno(buffer, i, turno);
    let score = 0;
    for (let h = i * 24; h < Math.min(D * 24, i * 24 + 48); h++) {
      if (!buffer[h]) continue;
      const deficit = Math.max(0, necessario[h] - alocado[h]);
      const util = Math.min(buffer[h], deficit);
      score += util - 0.2 * (buffer[h] - util);
      buffer[h] = 0;
    }
    return score;
  };
  /** Pontua o turno e posiciona o intervalo onde ele menos prejudica a cobertura (entre 2h após a entrada e 2h antes da saída). */
  const pontuar = (i: number, turno: DiaEscala) => {
    if (!turno.intervalo || turno.inicio == null || turno.fim == null) return pontuarFixo(i, turno);
    let melhor = -Infinity;
    let melhorPos = turno.intervaloInicio;
    for (let pos = turno.inicio + 120; pos + turno.intervalo <= turno.fim - 120; pos += 30) {
      turno.intervaloInicio = pos;
      const sc = pontuarFixo(i, turno);
      if (sc > melhor) {
        melhor = sc;
        melhorPos = pos;
      }
    }
    turno.intervaloInicio = melhorPos;
    return melhor === -Infinity ? pontuarFixo(i, turno) : melhor;
  };
  const descansoOk = (a: number, ta: DiaEscala, b: number, tb: DiaEscala) =>
    b * 1440 + tb.inicio! - (a * 1440 + ta.fim!) >= (b > a + 1 ? DESCANSO_SEMANAL : DESCANSO_DIARIO);
  const vizinho = (p: Plano, i: number, passo: 1 | -1) => {
    for (let j = i + passo; j >= 0 && j < D; j += passo) {
      if (p.tipo[j] === "A") return -1;
      if (p.tipo[j] === "T" && p.dias[j].inicio != null) return j;
    }
    return -1;
  };
  /** Descanso em relação ao último turno da escala anterior, quando não há turno antes de `i` no período. */
  const historicoOk = (p: Plano, i: number, ti: DiaEscala) => {
    const h = p.c.ultimoTurnoAntes;
    if (!h || p.tipo.slice(0, i).includes("A")) return true;
    const fimAbs = -h.diasAtras * 1440 + h.fim;
    return i * 1440 + ti.inicio! - fimAbs >= (i + h.diasAtras > 1 ? DESCANSO_SEMANAL : DESCANSO_DIARIO);
  };
  const opcoes = (p: Plano, i: number) => (p.jornada[i] ? turnosPermitidos(p, i).map((t) => ({ ...t })) : []);

  const melhorar = (p: Plano, i: number) => {
    const a = vizinho(p, i, -1);
    const j = vizinho(p, i, 1);
    const k = j >= 0 ? vizinho(p, j, 1) : -1;
    const atualI = p.dias[i];
    const atualJ = j >= 0 ? p.dias[j] : null;
    somarTurno(alocado, i, atualI, -1);
    if (atualJ) somarTurno(alocado, j, atualJ, -1);

    // Os turnos ficam dentro do próprio dia, então a nota do dia j não depende do turno do dia i:
    // calcula uma vez e, para cada opção de i, pega a melhor de j que respeita o descanso.
    const notaJ = (tj: DiaEscala) => pontuar(j, tj) - custoIntervalo(tj);
    const opcoesJ =
      j < 0
        ? []
        : opcoes(p, j)
            .filter((tj) => k < 0 || descansoOk(j, tj, k, p.dias[k]))
            .map((tj) => ({ tj, sj: notaJ(tj) }))
            .sort((x, y) => y.sj - x.sj);
    const avaliar = (ti: DiaEscala, tjFixo?: DiaEscala): { score: number; tj: DiaEscala | null } | null => {
      if (a >= 0 ? !descansoOk(a, p.dias[a], i, ti) : !historicoOk(p, i, ti)) return null;
      const si = pontuar(i, ti) + (ti.inicio === p.dias[i - 1]?.inicio ? 0.05 : 0) - custoIntervalo(ti);
      if (j < 0) return { score: si, tj: null };
      if (tjFixo) {
        if (!descansoOk(i, ti, j, tjFixo) || (k >= 0 && !descansoOk(j, tjFixo, k, p.dias[k]))) return null;
        const tj = { ...tjFixo };
        return { score: si + notaJ(tj), tj };
      }
      const melhor = opcoesJ.find((o) => descansoOk(i, ti, j, o.tj));
      return melhor ? { score: si + melhor.sj, tj: { ...melhor.tj } } : null;
    };

    let escolha = { ti: atualI, tj: atualJ };
    let melhorScore = avaliar(atualI, atualJ ?? undefined)?.score ?? -Infinity;
    for (const ti of opcoes(p, i)) {
      const r = avaliar(ti);
      if (r && r.score > melhorScore + 1e-9) {
        melhorScore = r.score;
        escolha = { ti: { ...ti }, tj: r.tj };
      }
    }
    p.dias[i] = escolha.ti;
    somarTurno(alocado, i, escolha.ti);
    if (j >= 0 && escolha.tj) {
      p.dias[j] = escolha.tj;
      somarTurno(alocado, j, escolha.tj);
    }
  };

  for (let passada = 0; passada < 3; passada++) {
    for (let i = 0; i < D; i++) for (const p of ordem(i)) if (p.dias[i].inicio != null) melhorar(p, i);
  }
}
