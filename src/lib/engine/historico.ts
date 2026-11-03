import { addDias, diaSemana } from "./tempo";
import type { Colaborador, DiaEscala, ISODate } from "./types";

export type Historico = Pick<Colaborador, "ultimoDomingoFolga" | "diasConsecutivosAntes" | "ultimoTurnoAntes">;

/**
 * Extrai, dos dias de escalas anteriores, o que a próxima escala precisa para
 * continuar o rodízio sem quebrar regras na virada do período:
 * último domingo de folga, dias seguidos trabalhados e o último turno (interjornada/35h).
 * `dias` pode vir fora de ordem e conter dias de qualquer data; só os anteriores a `inicio` são usados.
 */
export function historicoAntes(dias: DiaEscala[], inicio: ISODate): Historico {
  const porData = new Map(dias.filter((d) => d.data < inicio).map((d) => [d.data, d]));
  if (!porData.size) return {};
  const h: Historico = {};

  // Dias seguidos de trabalho terminando na véspera do início.
  let seq = 0;
  for (let data = addDias(inicio, -1); porData.get(data)?.tipo === "T"; data = addDias(data, -1)) seq++;
  h.diasConsecutivosAntes = seq;

  // Último turno nos 3 dias anteriores (o que importa para 11h/35h de descanso).
  for (let k = 1; k <= 3; k++) {
    const d = porData.get(addDias(inicio, -k));
    if (d?.tipo === "T" && d.fim != null) {
      h.ultimoTurnoAntes = { diasAtras: k, fim: d.fim };
      break;
    }
    if (d?.tipo === "A") break;
  }

  // Último domingo sem trabalho; se todos os domingos conhecidos foram trabalhados,
  // assume folga no domingo anterior ao mais antigo (estimativa conservadora da sequência).
  const domingos = [...porData.values()].filter((d) => diaSemana(d.data) === 6).sort((a, b) => b.data.localeCompare(a.data));
  const folga = domingos.find((d) => d.tipo !== "T");
  if (folga) h.ultimoDomingoFolga = folga.data;
  else if (domingos.length) h.ultimoDomingoFolga = addDias(domingos[domingos.length - 1].data, -7);
  return h;
}

/** Aplica o histórico ao colaborador; campos não encontrados no histórico mantêm o cadastro. */
export function aplicarHistorico(c: Colaborador, h: Historico): Colaborador {
  return {
    ...c,
    ultimoDomingoFolga: h.ultimoDomingoFolga ?? c.ultimoDomingoFolga,
    diasConsecutivosAntes: h.diasConsecutivosAntes ?? c.diasConsecutivosAntes,
    ultimoTurnoAntes: h.ultimoTurnoAntes ?? c.ultimoTurnoAntes,
  };
}
