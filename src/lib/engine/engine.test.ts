import { describe, expect, it } from "vitest";
import { FERIADOS_DEMO, LOJAS_DEMO, colaboradoresDemo, setoresDemo } from "../seed/demo";
import {
  REGIMES,
  REGRAS_PADRAO,
  addDias,
  dimensionar,
  gerarEscala,
  jornadaDiaria,
  regimeVigente,
  simularQuadro,
  validarEscala,
  type Colaborador,
  type DiaEscala,
  type Escala,
  type RegimeId,
  type Setor,
} from "./index";

const loja = LOJAS_DEMO[1];
const setores = setoresDemo(loja);
const colaboradores = colaboradoresDemo(loja, setores, 2);

function gerar(inicio: string, regimeId?: RegimeId, semanas = 4) {
  return gerarEscala({ inicio, semanas, regimeId, regras: REGRAS_PADRAO, setores, colaboradores, feriados: FERIADOS_DEMO });
}

describe("regimes", () => {
  it("seleciona o regime vigente pela data (EC 141/2026)", () => {
    expect(regimeVigente("2026-10-30").id).toBe("CLT_44H_6X1");
    expect(regimeVigente("2026-12-15").id).toBe("CLT_44H_6X1");
    expect(regimeVigente("2026-12-16").id).toBe("EC141_42H");
    expect(regimeVigente("2027-12-15").id).toBe("EC141_42H");
    expect(regimeVigente("2027-12-16").id).toBe("EC141_40H");
  });

  it("calcula a jornada diária pela carga e pelo número de dias de trabalho", () => {
    expect(jornadaDiaria(44, REGIMES.CLT_44H_6X1, REGRAS_PADRAO) * 60).toBeCloseTo(440); // 7h20 x 6
    expect(jornadaDiaria(44, REGIMES.EC141_42H, REGRAS_PADRAO) * 60).toBeCloseTo(504); // 8h24 x 5
    expect(jornadaDiaria(44, REGIMES.EC141_40H, REGRAS_PADRAO)).toBe(8);
    // Sem acordo de compensação, o dia fica limitado a 8h.
    expect(jornadaDiaria(44, REGIMES.EC141_42H, { ...REGRAS_PADRAO, acordoCompensacao: false })).toBe(8);
  });
});

describe("gerador", () => {
  for (const [inicio, regimeId] of [
    ["2026-11-02", undefined],
    ["2026-12-14", undefined],
    ["2027-12-13", "EC141_40H"],
  ] as const) {
    it(`gera escala sem violações legais (${inicio} ${regimeId ?? "auto"})`, () => {
      const r = gerar(inicio, regimeId);
      expect(r.violacoes.filter((v) => v.severidade === "erro")).toEqual([]);
      expect(r.metricas.coberturaPct).toBeGreaterThan(80);
    });
  }

  it("dá 2 folgas por semana e prioriza o domingo no regime da EC 141", () => {
    const clt = gerar("2026-11-02", "CLT_44H_6X1");
    const ec = gerar("2026-11-02", "EC141_42H");
    for (const c of colaboradores) {
      const dias = ec.escala.dias[c.id];
      for (let w = 0; w < 4; w++) {
        const semana = dias.slice(w * 7, w * 7 + 7);
        if (semana.some((d) => d.tipo === "A")) continue;
        expect(semana.filter((d) => d.tipo === "F").length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(ec.metricas.folgaDominicalPct).toBeGreaterThan(clt.metricas.folgaDominicalPct);
  });

  it("garante folga dominical ao menos 1x a cada 3 semanas (Lei 10.101/2000)", () => {
    const r = gerar("2026-11-02", "CLT_44H_6X1", 6);
    for (const c of colaboradores) {
      const domingos = r.escala.dias[c.id].filter((_, i) => i % 7 === 6).map((d) => d.tipo !== "T");
      for (let w = 0; w + 3 <= domingos.length; w++) expect(domingos.slice(w, w + 3).some(Boolean)).toBe(true);
    }
  });

  it("aplica o revezamento quinzenal do art. 386 da CLT", () => {
    const cols = colaboradores.map((c) => ({ ...c, domingoQuinzenal: true }));
    const r = gerarEscala({ inicio: "2026-11-02", semanas: 6, regimeId: "CLT_44H_6X1", regras: REGRAS_PADRAO, setores, colaboradores: cols, feriados: [] });
    expect(r.violacoes.filter((v) => v.regra === "DOMINGO_QUINZENAL")).toEqual([]);
  });

  it("respeita ausências, menores e é determinístico", () => {
    const r = gerar("2026-12-14");
    for (const c of colaboradores) {
      r.escala.dias[c.id].forEach((d) => {
        const ausente = c.ausencias.some((a) => d.data >= a.inicio && d.data <= a.fim);
        expect(d.tipo === "A").toBe(ausente);
        if (c.menorDeIdade && d.tipo === "T") {
          expect(d.inicio!).toBeGreaterThanOrEqual(300);
          expect(d.fim!).toBeLessThanOrEqual(1320);
        }
      });
    }
    expect(gerar("2026-12-14").escala).toEqual(r.escala);
  });
});

describe("validador", () => {
  const setor: Setor = { id: "s", nome: "Teste", inicios: [480], demanda: Array.from({ length: 7 }, () => new Array(24).fill(0)) };
  const base: Colaborador = { id: "c", nome: "Teste", setorId: "s", cargaSemanal: 44, domingoQuinzenal: false, menorDeIdade: false, diasIndisponiveis: [], ausencias: [] };
  const turno = (data: string, inicio: number, minutos: number, intervalo = 60): DiaEscala => ({
    data, tipo: "T", inicio, fim: inicio + minutos + intervalo, intervalo, intervaloInicio: intervalo ? inicio + 240 : undefined,
  });
  const escala = (dias: DiaEscala[], regime: RegimeId = "CLT_44H_6X1"): Escala => ({
    inicio: "2026-11-02", semanas: Math.ceil(dias.length / 7), regimes: Array(Math.ceil(dias.length / 7)).fill(regime), dias: { c: dias },
  });
  const validar = (dias: DiaEscala[], extra: Partial<Colaborador> = {}, regime?: RegimeId, regras = REGRAS_PADRAO) =>
    validarEscala({ escala: escala(dias, regime), colaboradores: [{ ...base, ...extra }], setores: [setor], regras, feriados: FERIADOS_DEMO })
      .violacoes.filter((v) => v.severidade === "erro").map((v) => v.regra);
  const semanaPadrao = (i0: string) =>
    Array.from({ length: 7 }, (_, i) => (i === 6 ? { data: addDias(i0, i), tipo: "F" as const } : turno(addDias(i0, i), 480, 440)));

  it("aceita uma semana 6x1 regular", () => {
    expect(validar(semanaPadrao("2026-11-09"))).toEqual([]);
  });

  it("detecta interjornada menor que 11h", () => {
    const dias = semanaPadrao("2026-11-09");
    dias[0] = turno(dias[0].data, 840, 440); // sai 22:20
    dias[1] = turno(dias[1].data, 360, 440); // entra 06:00
    expect(validar(dias)).toContain("INTERJORNADA");
  });

  it("detecta mais de 6 dias seguidos e falta de folga semanal", () => {
    const dias = Array.from({ length: 7 }, (_, i) => turno(addDias("2026-11-09", i), 480, 360));
    expect(validar(dias)).toEqual(expect.arrayContaining(["DIAS_CONSECUTIVOS", "FOLGAS_SEMANAIS"]));
  });

  it("exige 2 folgas e no máximo 42h no regime de transição", () => {
    expect(validar(semanaPadrao("2026-11-09"), {}, "EC141_42H")).toEqual(expect.arrayContaining(["FOLGAS_SEMANAIS", "JORNADA_SEMANAL"]));
  });

  it("detecta intervalo insuficiente, jornada > 8h sem acordo e menor em horário noturno", () => {
    const dias = semanaPadrao("2026-11-09");
    dias[0] = turno(dias[0].data, 480, 440, 30);
    dias[1] = turno(dias[1].data, 480, 540);
    dias[2] = turno(dias[2].data, 840, 440); // sai 22:20
    expect(validar(dias, { menorDeIdade: true }, "CLT_44H_6X1", { ...REGRAS_PADRAO, acordoCompensacao: false })).toEqual(
      expect.arrayContaining(["INTERVALO", "JORNADA_DIARIA", "MENOR_NOTURNO"]),
    );
  });

  it("exige autorização em CCT para trabalho em feriado", () => {
    const dias = semanaPadrao("2026-11-16"); // 20/11 é feriado
    const semCCT = { ...REGRAS_PADRAO, feriadosAutorizadosCCT: false };
    expect(validar(dias, {}, "CLT_44H_6X1", semCCT)).toContain("FERIADO_SEM_CCT");
    expect(validar(dias)).not.toContain("FERIADO_SEM_CCT");
  });

  it("detecta terceiro domingo seguido trabalhado", () => {
    const dias = [0, 1, 2].flatMap((w) => {
      const s = semanaPadrao(addDias("2026-11-02", w * 7));
      s[6] = turno(s[6].data, 480, 440);
      s[2] = { data: s[2].data, tipo: "F" };
      return s;
    });
    expect(validar(dias)).toContain("DOMINGO_ROTATIVO");
  });
});

describe("dimensionamento", () => {
  it("indica quadro maior ou igual com a redução para 40h", () => {
    for (const d of dimensionar(setores, colaboradores, REGRAS_PADRAO)) {
      expect(d.quadroNecessario.EC141_40H).toBeGreaterThanOrEqual(d.quadroNecessario.EC141_42H);
      expect(d.capacidade.EC141_40H).toBeLessThan(d.capacidade.CLT_44H_6X1);
    }
  });

  it("simulação: menos horas exigem quadro igual ou maior para manter a cobertura", () => {
    const [caixa] = simularQuadro(setores.slice(0, 1), colaboradores, REGRAS_PADRAO, gerarEscala, { semanas: 2 });
    expect(caixa.quadroParaManter.CLT_44H_6X1).toBe(caixa.quadroAtual);
    expect(caixa.quadroParaManter.EC141_42H).toBeGreaterThanOrEqual(caixa.quadroAtual);
    expect(caixa.quadroParaManter.EC141_40H).toBeGreaterThanOrEqual(caixa.quadroParaManter.EC141_42H);
  });
});

describe("dias de funcionamento curto", () => {
  const lojaSul = LOJAS_DEMO.find((l) => l.id === "loja-sul")!; // domingo 08h–14h
  const setoresSul = setoresDemo(lojaSul);
  const colsSul = colaboradoresDemo(lojaSul, setoresSul, 3).map((c) => ({ ...c, ausencias: [], diasIndisponiveis: [] }));

  for (const regimeId of ["CLT_44H_6X1", "EC141_42H"] as const) {
    it(`encurta o turno de domingo e compensa na semana (${regimeId})`, () => {
      const r = gerarEscala({ inicio: "2026-11-02", semanas: 3, regimeId, regras: REGRAS_PADRAO, setores: setoresSul, colaboradores: colsSul, feriados: [] });
      expect(r.violacoes.filter((v) => v.severidade === "erro")).toEqual([]);
      let domingos = 0;
      for (const c of colsSul) {
        const setor = setoresSul.find((s) => s.id === c.setorId)!;
        const fimDemandaDomingo = (setor.demanda[6].findLastIndex((n) => n > 0) + 1) * 60;
        const dias = r.escala.dias[c.id];
        dias.forEach((d, i) => {
          if (i % 7 === 6 && d.tipo === "T") {
            domingos++;
            expect(d.fim!).toBeLessThanOrEqual(fimDemandaDomingo + 30); // tolerância de fechamento
          }
        });
        // A carga semanal se mantém (até 5 min por dia de arredondamento).
        const carga = Math.min(c.cargaSemanal, REGIMES[regimeId].horasSemanaisMax) * 60;
        for (let w = 0; w < 3; w++) {
          const sem = dias.slice(w * 7, w * 7 + 7);
          const trab = sem.filter((d) => d.tipo === "T");
          const min = trab.reduce((t, d) => t + d.fim! - d.inicio! - (d.intervalo ?? 0), 0);
          expect(min).toBeLessThanOrEqual(carga);
          expect(min).toBeGreaterThanOrEqual(carga - 5 * trab.length);
        }
      }
      expect(domingos).toBeGreaterThan(0);
    });
  }
});

describe("intervalo de almoço flexível (CLT art. 71)", () => {
  it("com intervalo de até 2h, cobre mais o pico da noite sem violar regras", async () => {
    const { ESCALA_EXEMPLO, OPERADORES_EXEMPLO, SETOR_CAIXA } = await import("../seed/exemplo");
    const base = { inicio: ESCALA_EXEMPLO.inicio, semanas: 4, regimeId: ESCALA_EXEMPLO.regimeId, setores: [SETOR_CAIXA], colaboradores: OPERADORES_EXEMPLO, feriados: FERIADOS_DEMO };
    const curto = gerarEscala({ ...base, regras: REGRAS_PADRAO });
    const longo = gerarEscala({ ...base, regras: { ...REGRAS_PADRAO, intervaloMaximo: 120 } });
    expect(longo.violacoes.filter((v) => v.severidade === "erro")).toEqual([]);
    expect(longo.metricas.coberturaPct).toBeGreaterThan(curto.metricas.coberturaPct + 3);
    const dias = Object.values(longo.escala.dias).flat().filter((d) => d.tipo === "T");
    expect(dias.every((d) => [60, 90, 120].includes(d.intervalo!))).toBe(true);
    expect(dias.some((d) => d.intervalo === 120)).toBe(true);
    // Com o padrão, o intervalo continua sendo sempre de 1h.
    expect(Object.values(curto.escala.dias).flat().filter((d) => d.tipo === "T").every((d) => d.intervalo === 60)).toBe(true);
    // A falta de gente das 18h às 20h cai.
    const falta = (r: typeof curto) => r.cobertura.reduce((t, c) => t + [18, 19].reduce((s, h) => s + Math.max(0, c.necessario[h] - c.alocado[h]), 0), 0);
    expect(falta(longo)).toBeLessThan(falta(curto) * 0.7);
  });

  it("intervalo acima de 2h é alerta (exige acordo escrito ou CCT)", () => {
    const r = gerar("2026-11-02", "CLT_44H_6X1", 1);
    const c = colaboradores[0];
    const dias = r.escala.dias[c.id].map((d) => ({ ...d }));
    const i = dias.findIndex((d) => d.tipo === "T" && d.intervalo === 60);
    dias[i] = { ...dias[i], fim: dias[i].fim! + 90, intervalo: 150 };
    const v = validarEscala({ escala: { ...r.escala, dias: { ...r.escala.dias, [c.id]: dias } }, colaboradores, setores, regras: REGRAS_PADRAO, feriados: FERIADOS_DEMO });
    const iv = v.violacoes.filter((x) => x.regra === "INTERVALO" && x.colaboradorId === c.id);
    expect(iv).toHaveLength(1);
    expect(iv[0].severidade).toBe("alerta");
  });
});
