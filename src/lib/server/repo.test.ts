import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorSqlite, usarMotor } from "./db";
import * as repo from "./repo";
import * as auth from "./auth";
import * as registro from "./registro";
import { dadosDoTitular } from "./titular";

describe("repositório (SQLite)", () => {
  // Criar as tabelas e semear a rede de demonstração fica na preparação, com prazo próprio.
  beforeAll(async () => {
    usarMotor(motorSqlite(":memory:"));
    await repo.listarLojas();
  }, 60_000);

  it("semeia a rede de demonstração", async () => {
    const lojas = await repo.listarLojas();
    expect(lojas).toHaveLength(4);
    expect(lojas.every((l) => l.setores === 5 && l.colaboradores > 20)).toBe(true);
    expect((await repo.obterEmpresa()).regras.acordoCompensacao).toBe(true);
    expect((await repo.listarFeriados()).length).toBeGreaterThan(3);
  });

  it("gera, lista, edita, publica e reabre uma escala com histórico", async () => {
    const e = await repo.criarEscala("loja-sul", "2026-11-02", 2, "teste");
    expect(e.resultado.metricas.erros).toBe(0);
    const lista = await repo.listarEscalas("loja-sul");
    expect(lista[0]).toMatchObject({ id: e.id, status: "RASCUNHO", semanas: 2 });
    expect(lista[0].metricas.coberturaPct).toBe(e.resultado.metricas.coberturaPct);

    const colab = e.entrada.colaboradores[0].id;
    const editada = await repo.editarDia(e.id, colab, { data: "2026-11-03", tipo: "F" }, "teste");
    expect(editada.resultado.escala.dias[colab][1].tipo).toBe("F");
    expect((await repo.obterEscala(e.id))!.resultado.escala.dias[colab][1].tipo).toBe("F");

    const pub = await repo.publicarEscala(e.id, "teste", true);
    expect(pub.status).toBe("PUBLICADA");
    await expect(repo.editarDia(e.id, colab, { data: "2026-11-04", tipo: "F" }, "teste")).rejects.toThrow(/publicada/);
    await expect(repo.excluirEscala(e.id)).rejects.toThrow(/publicada/);
    await repo.reabrirEscala(e.id, "teste", "ajuste");
    const eventos = (await repo.listarEventos(e.id)).map((x) => x.acao);
    expect(eventos).toEqual(["REABERTA", "PUBLICADA", "EDITADA", "GERADA"]);
  });

  it("continua a escala anterior (histórico) e falha a transação inteira em erro", async () => {
    const seguinte = await repo.criarEscala("loja-sul", "2026-11-16", 2, "teste");
    const gerada = (await repo.listarEventos(seguinte.id))[0];
    expect(Number(gerada.detalhe?.comHistorico)).toBeGreaterThan(0);
    expect(seguinte.resultado.metricas.erros).toBe(0);
    // transação: se algo falha no meio, nada é gravado
    const antes = (await repo.listarColaboradores("loja-sul")).length;
    const r = await repo.importarColaboradores("loja-sul", "Nome;Setor\nNovo A;Padaria\nNovo B;Setor Inexistente\n");
    expect(r.importados).toBe(0);
    expect((await repo.listarColaboradores("loja-sul")).length).toBe(antes);
    const ok = await repo.importarColaboradores("loja-sul", "Nome;Setor\nNovo A;Padaria\nNovo B;Açougue\n");
    expect(ok.importados).toBe(2);
    expect((await repo.listarColaboradores("loja-sul")).length).toBe(antes + 2);
  });

  it("usuários dos três perfis: RH/DP e administrador sem loja, gerente com loja", async () => {
    const r = await auth.criarUsuario({ login: "Maria.RH", nome: "Maria (RH/DP)", perfil: "RH", lojaId: "loja-norte", senha: "SenhaForte123" });
    expect(r).toMatchObject({ login: "maria.rh", perfil: "RH", lojaId: null });
    const g = await auth.criarUsuario({ login: "joao", nome: "João", perfil: "GERENTE", lojaId: "loja-norte", senha: "SenhaForte123" });
    expect(g.lojaId).toBe("loja-norte");
    await auth.atualizarUsuario(g.id, { perfil: "RH" });
    expect(await auth.obterUsuario(g.id)).toMatchObject({ perfil: "RH", lojaId: null });
    expect((await auth.autenticar("MARIA.RH", "SenhaForte123")).perfil).toBe("RH");
  });

  it("LGPD: registro de acessos com filtro e prazo de guarda, encarregado e dados do titular", async () => {
    await registro.registrarAcesso({ quem: "maria.rh", perfil: "RH", acao: "VER_ESCALA", alvo: "Loja Norte — escala de 07/01/2030", lojaId: "loja-norte" });
    await registro.registrarAcesso({ quem: "joao", perfil: "GERENTE", acao: "EXPORTAR_CSV", alvo: "escala", lojaId: "loja-norte" });
    const todos = await registro.listarRegistro({ dias: 1 });
    expect(todos.map((r) => r.acao)).toEqual(expect.arrayContaining(["VER_ESCALA", "EXPORTAR_CSV"]));
    expect(await registro.listarRegistro({ dias: 1, quem: "MARIA" })).toHaveLength(1);
    expect((await registro.listarRegistro({ dias: 1, acao: "EXPORTAR_CSV" }))[0].quem).toBe("joao");
    // Passado o prazo de guarda (12 meses), o registro é apagado.
    await registro.limparRegistroAntigo(new Date(Date.now() + 400 * 86400000));
    expect(await registro.listarRegistro({ dias: 1 })).toEqual([]);

    await repo.salvarEncarregado({ nome: "Ana DPO", email: "dpo@empresa.com.br" });
    expect((await repo.obterEmpresa()).encarregado).toEqual({ nome: "Ana DPO", email: "dpo@empresa.com.br" });

    const nova = await repo.criarEscala("loja-norte", "2030-01-07", 2, "teste");
    await repo.publicarEscala(nova.id, "teste", true);
    const colab = nova.entrada.colaboradores[0];
    const d = (await dadosDoTitular(colab.id))!;
    expect(d.titular.nome).toBe(colab.nome);
    expect(d.escalasPublicadas.map((x) => x.inicio)).toContain("2030-01-07");
    expect(d.escalasPublicadas[0].dias.length).toBeGreaterThan(0);
    expect(await dadosDoTitular("nao-existe")).toBeNull();
  });

  it("feriados por loja, setores e lojas novas", async () => {
    await repo.salvarFeriado({ data: "2026-12-08", nome: "Padroeira", lojaId: "loja-norte" });
    await repo.salvarFeriado({ data: "2026-12-08", nome: "Padroeira (corrigido)", lojaId: "loja-norte" });
    const norte = await repo.listarFeriados("loja-norte");
    expect(norte.filter((f) => f.data === "2026-12-08").map((f) => f.nome)).toEqual(["Padroeira (corrigido)"]);
    expect((await repo.listarFeriados("loja-sul")).some((f) => f.data === "2026-12-08")).toBe(false);

    const setor = (await repo.listarSetores("loja-norte"))[0];
    await repo.atualizarSetor(setor.id, { inicios: [420, 480] });
    expect((await repo.obterSetor(setor.id))!).toMatchObject({ nome: setor.nome, inicios: [420, 480] });

    const loja = await repo.criarLoja({ nome: "Loja Nova", cidade: "", abre: "07:00", fecha: "21:00", abreDomingo: "08:00", fechaDomingo: "13:00" });
    await repo.criarSetor(loja.id, "Caixa", [420], Array.from({ length: 7 }, () => new Array(24).fill(1)));
    expect((await repo.listarLojas()).find((l) => l.id === loja.id)?.setores).toBe(1);
    await repo.limparDados();
    expect(await repo.listarLojas()).toEqual([]);
  });
});

describe("semente Loja Modelo (dados fictícios)", () => {
  const anterior = process.env.ESCALA_SEED;
  beforeAll(async () => {
    process.env.ESCALA_SEED = "exemplo";
    usarMotor(motorSqlite(":memory:"));
    await repo.listarLojas();
  }, 60_000);
  afterAll(() => {
    if (anterior === undefined) delete process.env.ESCALA_SEED;
    else process.env.ESCALA_SEED = anterior;
  });

  it("cria a Loja Modelo com 16 operadores e a escala 5x2 pronta", async () => {
    const [loja] = await repo.listarLojas();
    expect(loja).toMatchObject({ id: "loja-modelo", nome: "Loja Modelo", colaboradores: 16, setores: 1 });
    const e = (await repo.obterEscala("loja-modelo-2026-11-02"))!;
    expect(e.resultado.metricas.erros).toBe(0);
    expect(e.resultado.escala.regimes.every((r) => r === "EC141_42H")).toBe(true);
  });
});
