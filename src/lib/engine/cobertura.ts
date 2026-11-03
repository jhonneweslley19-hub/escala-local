import { addDias, diaSemana } from "./tempo";
import type { Colaborador, CoberturaDia, DiaEscala, Escala, Feriado, Setor } from "./types";

/** Curva horária de demanda de um setor em uma data (feriado usa a curva de domingo). */
export function curvaDoDia(setor: Setor, data: string, feriados: Set<string>): number[] {
  const dia = feriados.has(data) ? 6 : diaSemana(data);
  return setor.demanda[dia] ?? new Array(24).fill(0);
}

/** Minutos efetivamente trabalhados no dia (sem o intervalo). */
export function minutosTrabalhados(d: DiaEscala): number {
  if (d.tipo !== "T" || d.inicio == null || d.fim == null) return 0;
  return d.fim - d.inicio - (d.intervalo ?? 0);
}

/**
 * Soma, em `alvo` (indexado por hora absoluta desde o início do período),
 * a fração de cada hora coberta pelo turno — descontando o intervalo.
 */
export function somarTurno(alvo: number[], indiceDia: number, d: DiaEscala, sinal = 1): void {
  if (d.tipo !== "T" || d.inicio == null || d.fim == null) return;
  const base = indiceDia * 1440;
  const trechos: [number, number][] = [];
  if (d.intervalo && d.intervaloInicio != null) {
    trechos.push([d.inicio, d.intervaloInicio], [d.intervaloInicio + d.intervalo, d.fim]);
  } else {
    trechos.push([d.inicio, d.fim]);
  }
  for (const [a, b] of trechos) {
    const ini = base + a;
    const fim = base + b;
    for (let h = Math.floor(ini / 60); h * 60 < fim; h++) {
      if (h < 0 || h >= alvo.length) continue;
      const sobreposicao = Math.min(fim, (h + 1) * 60) - Math.max(ini, h * 60);
      if (sobreposicao > 0) alvo[h] += (sinal * sobreposicao) / 60;
    }
  }
}

export function calcularCobertura(
  escala: Escala,
  setores: Setor[],
  colaboradores: Colaborador[],
  feriados: Feriado[],
): CoberturaDia[] {
  const D = escala.semanas * 7;
  const fer = new Set(feriados.map((f) => f.data));
  const resultado: CoberturaDia[] = [];
  for (const setor of setores) {
    const alocado = new Array(D * 24).fill(0);
    for (const c of colaboradores) {
      if (c.setorId !== setor.id) continue;
      (escala.dias[c.id] ?? []).forEach((dia, i) => somarTurno(alocado, i, dia));
    }
    for (let i = 0; i < D; i++) {
      const data = addDias(escala.inicio, i);
      resultado.push({
        data,
        setorId: setor.id,
        necessario: curvaDoDia(setor, data, fer).slice(0, 24),
        alocado: alocado.slice(i * 24, i * 24 + 24).map((v) => Math.round(v * 100) / 100),
      });
    }
  }
  return resultado;
}
