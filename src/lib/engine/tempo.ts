import type { ISODate } from "./types";

const DIA_MS = 86_400_000;

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDias(d: ISODate, n: number): ISODate {
  return toISO(new Date(parseISO(d).getTime() + n * DIA_MS));
}

export function diffDias(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / DIA_MS);
}

/** Dia da semana com segunda = 0 … domingo = 6. */
export function diaSemana(d: ISODate): number {
  return (parseISO(d).getUTCDay() + 6) % 7;
}

/** Segunda-feira da semana que contém `d`. */
export function inicioSemana(d: ISODate): ISODate {
  return addDias(d, -diaSemana(d));
}

export function entre(d: ISODate, inicio: ISODate, fim: ISODate): boolean {
  return d >= inicio && d <= fim;
}

export function hhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const NOMES_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
