import { describe, expect, it } from "vitest";
import { FERIADOS_DEMO, LOJAS_DEMO, colaboradoresDemo, setoresDemo } from "../seed/demo";
import { REGRAS_PADRAO, aplicarHistorico, gerarEscala, historicoAntes, validarEscala, type DiaEscala, type Escala } from "./index";

const loja = LOJAS_DEMO[2];
const setores = setoresDemo(loja);
const colaboradores = colaboradoresDemo(loja, setores, 3);
const gerar = (inicio: string, cols = colaboradores, regimeId?: "CLT_44H_6X1" | "EC141_42H") =>
  gerarEscala({ inicio, semanas: 4, regimeId, regras: REGRAS_PADRAO, setores, colaboradores: cols, feriados: FERIADOS_DEMO });

describe("histórico entre escalas", () => {
  it("extrai último domingo de folga, dias seguidos e último turno", () => {
    const dias: DiaEscala[] = [
      { data: "2026-11-01", tipo: "F" }, // domingo
      { data: "2026-11-02", tipo: "T", inicio: 480, fim: 980 },
      { data: "2026-11-07", tipo: "T", inicio: 840, fim: 1340 },
      { data: "2026-11-08", tipo: "T", inicio: 840, fim: 1340 }, // domingo trabalhado
      { data: "2026-11-06", tipo: "T", inicio: 480, fim: 980 },
    ];
    expect(historicoAntes(dias, "2026-11-09")).toEqual({
      ultimoDomingoFolga: "2026-11-01",
      diasConsecutivosAntes: 3,
      ultimoTurnoAntes: { diasAtras: 1, fim: 1340 },
    });
    expect(historicoAntes(dias, "2026-11-01")).toEqual({});
  });

  for (const regimeId of ["CLT_44H_6X1", "EC141_42H"] as const) {
    it(`duas escalas seguidas ficam conformes quando vistas como uma só (${regimeId})`, () => {
      const r1 = gerar("2026-11-02", colaboradores, regimeId);
      const inicio2 = "2026-11-30";
      const cols2 = colaboradores.map((c) => aplicarHistorico(c, historicoAntes(r1.escala.dias[c.id], inicio2)));
      const r2 = gerar(inicio2, cols2, regimeId);
      expect(r2.violacoes.filter((v) => v.severidade === "erro")).toEqual([]);

      const junta: Escala = {
        inicio: "2026-11-02",
        semanas: 8,
        regimes: [...r1.escala.regimes, ...r2.escala.regimes],
        dias: Object.fromEntries(colaboradores.map((c) => [c.id, [...r1.escala.dias[c.id], ...r2.escala.dias[c.id]]])),
      };
      const v = validarEscala({ escala: junta, colaboradores, setores, regras: REGRAS_PADRAO, feriados: FERIADOS_DEMO });
      expect(v.violacoes.filter((x) => x.severidade === "erro")).toEqual([]);
    });
  }
});
