import { calcularCobertura, minutosTrabalhados } from "./cobertura";
import { REGIMES, intervaloMinimo } from "./regimes";
import { addDias, diaSemana, diffDias, entre, hhmm } from "./tempo";
import type {
  CoberturaDia,
  Colaborador,
  Escala,
  Feriado,
  Metricas,
  Regime,
  RegrasEmpresa,
  Setor,
  Violacao,
} from "./types";

/** Folgas exigidas em uma semana, proporcionais aos dias em que o colaborador não está ausente. */
export function folgasExigidas(regime: Regime, diasAusentes: number): number {
  if (diasAusentes >= 7) return 0;
  return Math.round((regime.folgasSemanaisMin * (7 - diasAusentes)) / 7);
}

/** Semanas de domingos trabalhados em sequência permitidas antes da folga obrigatória. */
export function limiteDomingos(c: Colaborador, regime: Regime): number {
  return c.domingoQuinzenal ? 2 : regime.domingoFolgaACadaSemanas;
}

/** Domingos seguidos já trabalhados antes do primeiro domingo do período. */
export function domingosTrabalhadosAntes(c: Colaborador, primeiroDomingo: string): number {
  if (!c.ultimoDomingoFolga) return 0;
  return Math.max(0, Math.round(diffDias(primeiroDomingo, c.ultimoDomingoFolga) / 7) - 1);
}

export function emAusencia(c: Colaborador, data: string) {
  return c.ausencias.find((a) => entre(data, a.inicio, a.fim));
}

export interface ContextoValidacao {
  escala: Escala;
  colaboradores: Colaborador[];
  setores: Setor[];
  regras: RegrasEmpresa;
  feriados: Feriado[];
}

export function validarEscala(ctx: ContextoValidacao): {
  violacoes: Violacao[];
  cobertura: CoberturaDia[];
  metricas: Metricas;
} {
  const { escala, colaboradores, setores, regras, feriados } = ctx;
  const v: Violacao[] = [];
  const fer = new Map(feriados.map((f) => [f.data, f.nome]));
  const regimeSemana = (w: number) => REGIMES[escala.regimes[w]];
  const primeiroDomingo = addDias(escala.inicio, 6);
  let semanasComDomingo = 0;
  let semanasFolgaDomingo = 0;

  for (const c of colaboradores) {
    const dias = escala.dias[c.id];
    if (!dias) continue;
    const add = (regra: Violacao["regra"], mensagem: string, data?: string, severidade: Violacao["severidade"] = "erro") =>
      v.push({ regra, severidade, mensagem, colaboradorId: c.id, setorId: c.setorId, data });

    // Por dia
    dias.forEach((d, i) => {
      const ausencia = emAusencia(c, d.data);
      if (ausencia && d.tipo === "T") add("INDISPONIBILIDADE", `Escalado durante ${ausencia.tipo.toLowerCase()}.`, d.data);
      if (d.tipo !== "T" || d.inicio == null || d.fim == null) return;
      const regime = regimeSemana(Math.floor(i / 7));
      const trab = minutosTrabalhados(d);
      if (trab > regime.horasDiariasMax * 60) {
        add("JORNADA_DIARIA", `Jornada de ${hhmm(trab)} acima do teto de ${regime.horasDiariasMax}h (CLT art. 59).`, d.data);
      } else if (trab > regime.horasDiariasNormais * 60 && !regras.acordoCompensacao) {
        add("JORNADA_DIARIA", `Jornada de ${hhmm(trab)} acima de 8h sem acordo de compensação (CF art. 7º, XIII).`, d.data);
      }
      const minIntervalo = intervaloMinimo(trab);
      if ((d.intervalo ?? 0) < minIntervalo) {
        add("INTERVALO", `Intervalo de ${d.intervalo ?? 0} min; mínimo de ${minIntervalo} min (CLT art. 71).`, d.data);
      } else if (minIntervalo === 60 && (d.intervalo ?? 0) > 120) {
        add("INTERVALO", `Intervalo de ${hhmm(d.intervalo!)}: acima de 2h só com acordo escrito ou convenção coletiva (CLT art. 71).`, d.data, "alerta");
      }
      if (c.menorDeIdade && (d.inicio < 300 || d.fim > 1320)) {
        add("MENOR_NOTURNO", "Menor de 18 anos em horário noturno (22h–5h) — CLT art. 404.", d.data);
      }
      if (fer.has(d.data) && regras.feriadoExigeCCT && !regras.feriadosAutorizadosCCT) {
        add("FERIADO_SEM_CCT", `Trabalho no feriado (${fer.get(d.data)}) sem autorização em CCT (Portaria MTE 3.665/2023).`, d.data);
      }
      if (c.diasIndisponiveis.includes(diaSemana(d.data))) {
        add("INDISPONIBILIDADE", "Escalado em dia marcado como indisponível.", d.data, "alerta");
      }
      if ((c.disponivelDe != null && d.inicio < c.disponivelDe) || (c.disponivelAte != null && d.fim > c.disponivelAte)) {
        add("INDISPONIBILIDADE", "Turno fora da janela de disponibilidade.", d.data, "alerta");
      }
      // Interjornada com o dia anterior (no 1º dia, com o último turno da escala anterior)
      const ant = dias[i - 1];
      const fimAnterior =
        ant?.tipo === "T" && ant.fim != null ? ant.fim : i === 0 && c.ultimoTurnoAntes?.diasAtras === 1 ? c.ultimoTurnoAntes.fim : null;
      if (fimAnterior != null) {
        const descanso = d.inicio + 1440 - fimAnterior;
        if (descanso < regime.interjornadaMinHoras * 60) {
          add("INTERJORNADA", `Interjornada de ${hhmm(descanso)}; mínimo de 11h (CLT art. 66).`, d.data);
        }
      }
    });

    // Dias consecutivos (OJ 410 SDI-1/TST)
    let seq = c.diasConsecutivosAntes ?? 0;
    dias.forEach((d, i) => {
      seq = d.tipo === "T" ? seq + 1 : 0;
      const max = regimeSemana(Math.floor(i / 7)).maxDiasConsecutivos;
      if (seq === max + 1) add("DIAS_CONSECUTIVOS", `${seq} dias seguidos de trabalho sem folga (máx. ${max}).`, d.data);
    });

    // Domingos (Lei 10.101/2000 art. 6º p.u.; CLT art. 386)
    let domSeq = domingosTrabalhadosAntes(c, primeiroDomingo);
    for (let w = 0; w < escala.semanas; w++) {
      const dom = dias[w * 7 + 6];
      if (!dom) break;
      const regime = regimeSemana(w);
      if (dom.tipo === "T") {
        domSeq++;
        const lim = limiteDomingos(c, regime);
        if (domSeq === lim) {
          add(
            c.domingoQuinzenal ? "DOMINGO_QUINZENAL" : "DOMINGO_ROTATIVO",
            c.domingoQuinzenal
              ? "Sem folga dominical quinzenal (CLT art. 386)."
              : `${domSeq} domingos seguidos trabalhados; a folga deve coincidir com domingo ao menos 1x a cada ${lim} semanas (Lei 10.101/2000).`,
            dom.data,
          );
        }
      } else {
        domSeq = 0;
      }
      if (dom.tipo !== "A") {
        semanasComDomingo++;
        if (dom.tipo === "F") semanasFolgaDomingo++;
      }
    }

    // Por semana: jornada, folgas e descanso semanal de 35h
    let ultimoFimAbs: number | null = c.ultimoTurnoAntes ? -c.ultimoTurnoAntes.diasAtras * 1440 + c.ultimoTurnoAntes.fim : null;
    const descansos: { inicioAbs: number; fimAbs: number; diaFolga: number }[] = [];
    dias.forEach((d, i) => {
      if (d.tipo !== "T" || d.inicio == null || d.fim == null) return;
      const inicioAbs = i * 1440 + d.inicio;
      const anteriorFolga = i > 0 && dias[i - 1].tipo !== "T";
      if (anteriorFolga) descansos.push({ inicioAbs: ultimoFimAbs ?? -Infinity, fimAbs: inicioAbs, diaFolga: i - 1 });
      ultimoFimAbs = i * 1440 + d.fim;
    });
    for (let w = 0; w < escala.semanas; w++) {
      const regime = regimeSemana(w);
      const semana = dias.slice(w * 7, w * 7 + 7);
      const horas = semana.reduce((s, d) => s + minutosTrabalhados(d), 0) / 60;
      const ini = semana[0]?.data;
      if (horas > regime.horasSemanaisMax + 1e-6) {
        add("JORNADA_SEMANAL", `${horas.toFixed(1)}h na semana; limite de ${regime.horasSemanaisMax}h (${regime.nome}).`, ini);
      } else if (horas > c.cargaSemanal + 1e-6) {
        add("JORNADA_SEMANAL", `${horas.toFixed(1)}h na semana, acima da carga contratada de ${c.cargaSemanal}h.`, ini, "alerta");
      }
      const ausentes = semana.filter((d) => d.tipo === "A").length;
      const folgas = semana.filter((d) => d.tipo === "F").length;
      const exigidas = folgasExigidas(regime, ausentes);
      if (folgas < exigidas) {
        add("FOLGAS_SEMANAIS", `${folgas} folga(s) na semana; mínimo de ${exigidas} (${regime.nome}).`, ini);
      }
      const descansosSemana = descansos.filter((x) => Math.floor(x.diaFolga / 7) === w);
      if (descansosSemana.length && !descansosSemana.some((x) => x.fimAbs - x.inicioAbs >= regime.descansoSemanalMinHoras * 60)) {
        add("DESCANSO_SEMANAL", "Nenhum descanso semanal de 35h (24h de DSR + 11h de interjornada — Súmula 110/TST).", ini);
      }
    }
  }

  const cobertura = calcularCobertura(escala, setores, colaboradores, feriados);
  let dem = 0, cob = 0, falt = 0, exc = 0;
  for (const dia of cobertura) {
    let faltaDia = 0;
    dia.necessario.forEach((n, h) => {
      const a = dia.alocado[h];
      dem += n;
      cob += Math.min(n, a);
      falt += Math.max(0, n - a);
      exc += Math.max(0, a - n);
      faltaDia += Math.max(0, n - a);
    });
    if (faltaDia >= 0.5) {
      const setor = setores.find((s) => s.id === dia.setorId)?.nome ?? dia.setorId;
      v.push({
        regra: "COBERTURA",
        severidade: "alerta",
        mensagem: `${setor}: ${faltaDia.toFixed(1)} pessoa-hora abaixo da demanda.`,
        setorId: dia.setorId,
        data: dia.data,
      });
    }
  }

  const r1 = (x: number) => Math.round(x * 10) / 10;
  const metricas: Metricas = {
    horasDemandadas: r1(dem),
    horasCobertas: r1(cob),
    horasFaltantes: r1(falt),
    horasExcedentes: r1(exc),
    coberturaPct: dem ? r1((cob / dem) * 100) : 100,
    folgaDominicalPct: semanasComDomingo ? r1((semanasFolgaDomingo / semanasComDomingo) * 100) : 0,
    erros: v.filter((x) => x.severidade === "erro").length,
    alertas: v.filter((x) => x.severidade === "alerta").length,
  };
  return { violacoes: v, cobertura, metricas };
}
