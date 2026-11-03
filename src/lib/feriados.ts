import type { Feriado } from "./engine/types";

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(ano, mes - 1, ((h + l - 7 * m + 114) % 31) + 1));
}

/**
 * Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e a Sexta-feira Santa
 * (Lei 9.093/1995). Pontos facultativos, como Carnaval e Corpus Christi, ficam de fora.
 */
export function feriadosNacionais(ano: number): Feriado[] {
  const sexta = new Date(pascoa(ano).getTime() - 2 * 86400000).toISOString().slice(0, 10);
  const f = (md: string, nome: string) => ({ data: `${ano}-${md}`, nome });
  return [
    f("01-01", "Confraternização Universal"),
    { data: sexta, nome: "Sexta-feira Santa" },
    f("04-21", "Tiradentes"),
    f("05-01", "Dia do Trabalho"),
    f("09-07", "Independência do Brasil"),
    f("10-12", "Nossa Senhora Aparecida"),
    f("11-02", "Finados"),
    f("11-15", "Proclamação da República"),
    ...(ano >= 2024 ? [f("11-20", "Dia Nacional de Zumbi e da Consciência Negra")] : []),
    f("12-25", "Natal"),
  ];
}
