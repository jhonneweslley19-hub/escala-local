import { describe, expect, it } from "vitest";
import { MODELO_CSV, lerPlanilha, normalizar } from "./importacao";

const setores = new Map([["frente de caixa", "s1"], ["acougue", "s2"], ["padaria", "s3"]].map(([k, v]) => [normalizar(k), v]));

describe("importação de planilha", () => {
  it("lê o modelo com acentos, sim/não, dias e datas", () => {
    const r = lerPlanilha(MODELO_CSV, setores);
    expect(r.erros).toEqual([]);
    expect(r.colaboradores).toHaveLength(3);
    expect(r.colaboradores[0]).toMatchObject({ nome: "Maria da Silva", setorId: "s1", cargaSemanal: 44, domingoQuinzenal: true, ultimoDomingoFolga: "2026-11-02" });
    expect(r.colaboradores[1]).toMatchObject({ setorId: "s2", diasIndisponiveis: [6] });
    expect(r.colaboradores[2]).toMatchObject({ cargaSemanal: 30, menorDeIdade: true, diasIndisponiveis: [0, 1] });
  });

  it("aceita vírgula, aspas e aponta erros por linha", () => {
    const csv = 'nome,setor,carga\n"Silva, José",Padaria,36\nSem Setor,Peixaria,44\nCarga Ruim,Padaria,50\n';
    const r = lerPlanilha(csv, setores);
    expect(r.colaboradores.map((c) => c.nome)).toEqual(["Silva, José"]);
    expect(r.erros.map((e) => e.linha)).toEqual([3, 4]);
  });
});
