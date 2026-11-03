import { describe, expect, it } from "vitest";
import { calcularDemandaERP, lerData, lerHora, lerVendasERP } from "./erp";
import { abrirXlsx, lerCsv } from "./xlsx";

/** Monta um .xlsx mínimo (zip com deflate) com as abas e linhas informadas. */
async function xlsx(abas: { nome: string; linhas: (string | number | null)[][] }[]): Promise<Uint8Array> {
  const textos: string[] = [];
  const idx = (s: string) => (textos.includes(s) ? textos.indexOf(s) : textos.push(s) - 1);
  const col = (i: number) => String.fromCharCode(65 + i);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const arquivos: [string, string][] = abas.map((a, n) => [
    `xl/worksheets/sheet${n + 1}.xml`,
    `<?xml version="1.0"?><worksheet><sheetData>${a.linhas
      .map((l, r) => `<row r="${r + 1}">${l
        .map((v, c) => v === null ? "" : typeof v === "number"
          ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>`
          : `<c r="${col(c)}${r + 1}" t="s"><v>${idx(v)}</v></c>`)
        .join("")}</row>`)
      .join("")}</sheetData></worksheet>`,
  ]);
  arquivos.push(["xl/sharedStrings.xml", `<sst>${textos.map((t) => `<si><t>${esc(t)}</t></si>`).join("")}</sst>`]);
  arquivos.push(["xl/workbook.xml", `<workbook><sheets>${abas.map((a, n) => `<sheet name="${esc(a.nome)}" sheetId="${n + 1}" r:id="rId${n + 1}"/>`).join("")}</sheets></workbook>`]);
  arquivos.push(["xl/_rels/workbook.xml.rels", `<Relationships>${abas.map((_, n) => `<Relationship Id="rId${n + 1}" Target="worksheets/sheet${n + 1}.xml"/>`).join("")}</Relationships>`]);

  const enc = new TextEncoder();
  const partes: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let pos = 0;
  for (const [nome, conteudo] of arquivos) {
    const bruto = enc.encode(conteudo);
    const comp = new Uint8Array(await new Response(new Blob([bruto]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const n = enc.encode(nome);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, comp.length, true);
    local.setUint32(22, bruto.length, true);
    local.setUint16(26, n.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(10, 8, true);
    cd.setUint32(20, comp.length, true);
    cd.setUint32(24, bruto.length, true);
    cd.setUint16(28, n.length, true);
    cd.setUint32(42, pos, true);
    partes.push(new Uint8Array(local.buffer), n, comp);
    central.push(new Uint8Array(cd.buffer), n);
    pos += 30 + n.length + comp.length;
  }
  const tamCentral = central.reduce((t, p) => t + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  return new Uint8Array(await new Blob([...partes, ...central, new Uint8Array(fim.buffer)]).arrayBuffer());
}

// 03/08/2026 é segunda-feira; número de série do Excel 46237.
const SEG = 46237;
const hora = (h: number, m = 0) => (h * 60 + m) / 1440;

describe("leitura de datas e horas", () => {
  it("aceita número de série, texto do ERP e ISO", () => {
    expect(lerData(46235)).toBe("2026-08-01");
    expect(lerData("01/08/2026 - SAB")).toBe("2026-08-01");
    expect(lerData("2026-08-01")).toBe("2026-08-01");
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerHora(0.35252314814814817)).toBe(8);
    expect(lerHora(46235.75)).toBe(18);
    expect(lerHora("21:59:59")).toBe(21);
    expect(lerHora("01/08/2026 07:05")).toBe(7);
  });
});

describe("importação de vendas do ERP", () => {
  it("lê a aba de cupons com data e calcula operadores por hora", async () => {
    const linhas: (string | number | null)[][] = [["Nº Cupom", "Qtde. Vendida", "Venda Líquida", "Operador", "Nome", "Horário", "Data"]];
    // Duas segundas-feiras: às 10h, 300 e 500 itens (média 400); às 18h, 1 cupom de 30 itens.
    for (const [data, h, itens, op] of [[SEG, 10, 120, 1], [SEG, 10, 180, 2], [SEG + 7, 10, 500, 1], [SEG, 18, 30, 3], [SEG + 7, 18, 10, 3]] as const) {
      linhas.push([linhas.length, itens, 9.9, op, "X", hora(h, 15), data]);
    }
    const v = await lerVendasERP(await xlsx([{ nome: "Resumo", linhas: [["Relatório"]] }, { nome: "PDV Cupons", linhas }]), "vendas.xlsx");
    expect(v.aba).toBe("PDV Cupons");
    expect(v.cupons).toBe(5);
    expect(v.colunas).toMatchObject({ data: "Data", hora: "Horário", itens: "Qtde. Vendida", operador: "Operador" });
    expect(v.horas["2026-08-03|10"]).toEqual({ itens: 300, cupons: 2, operadores: 2 });

    const d = calcularDemandaERP(v, { produtividade: 150, caixas: 13 });
    expect(d.dias).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(d.itens[0][10]).toBe(400);
    expect(d.demanda[0][10]).toBe(3); // 400 ÷ 150 = 2,67 → 3
    expect(d.demanda[0][18]).toBe(1); // média 20 itens: loja aberta, ao menos 1
    expect(d.demanda[0][9]).toBe(0);
    expect(d.operadoresERP[0][10]).toBe(1.5);
    expect(calcularDemandaERP(v, { produtividade: 150, caixas: 2 }).demanda[0][10]).toBe(2);
    // Excluir uma data tira o dia da média.
    const sem = calcularDemandaERP(v, { produtividade: 100, caixas: 13, excluir: ["2026-08-10"] });
    expect(sem.dias[0]).toBe(1);
    expect(sem.excluidas).toEqual(["2026-08-10"]);
    expect(sem.demanda[0][10]).toBe(3); // 300 ÷ 100
  });

  it("cruza o cupom com a aba de notas quando a aba de cupons não tem data", async () => {
    const cupons = [
      ["Nº Cupom", "Qtde. Vendida", "Venda Líquida", "Horário", "Nº CF-e"],
      [10, 5, 20.5, hora(9), 900],
      [10, 7, 30, hora(9), 901], // mesmo cupom em outro PDV/dia: separado pelo nº da nota
    ];
    const notas = [
      ["ID", "Nº Cupom", "ECF", "Data", "Valor Total", "Nº NFC-e"],
      ["", 10, 1, "03/08/2026 - SEG", 20.5, 900],
      ["", 10, 2, "04/08/2026 - TER", 30, 901],
    ];
    const v = await lerVendasERP(await xlsx([{ nome: "PDV Cupons", linhas: cupons }, { nome: "NFC-e", linhas: notas }]), "x.xlsx");
    expect(v.horas).toEqual({ "2026-08-03|9": { itens: 5, cupons: 1, operadores: 0 }, "2026-08-04|9": { itens: 7, cupons: 1, operadores: 0 } });
    expect(v.colunas.data).toBe("NFC-e › Data");
  });

  it("lê CSV com ponto e vírgula, vírgula decimal e acentos em Windows-1252", async () => {
    const csv = "Data;Horário;Qtde. Vendida\r\n03/08/2026;10:15:00;1.234,5\r\n03/08/2026;10:40;0,5\r\n;;\r\n";
    const bytes = Uint8Array.from(csv, (c) => (c === "á" ? 0xe1 : c.charCodeAt(0)));
    expect(lerCsv(bytes)[0][1]).toBe("Horário");
    const v = await lerVendasERP(bytes, "vendas.csv");
    expect(v.horas["2026-08-03|10"].itens).toBe(1235);
  });

  it("explica o que falta quando a planilha não tem as colunas", async () => {
    await expect(lerVendasERP(await xlsx([{ nome: "A", linhas: [["Produto", "Preço"], ["Arroz", 5]] }]), "a.xlsx")).rejects.toThrow(/Horário/);
    await expect(lerVendasERP(new TextEncoder().encode("isto não é zip"), "a.xlsx")).rejects.toThrow(/xlsx/);
  });

  it("para de ler a aba quando pedido", async () => {
    const p = await abrirXlsx(await xlsx([{ nome: "A", linhas: [[1], [2], [3]] }]));
    const vistas: unknown[] = [];
    await p.linhas(p.abas[0], (l) => {
      vistas.push(l[0]);
      return vistas.length < 2;
    });
    expect(vistas).toEqual([1, 2]);
  });
});

describe("feriados nacionais", () => {
  it("calcula a Sexta-feira Santa e inclui a Consciência Negra a partir de 2024", async () => {
    const { feriadosNacionais } = await import("./feriados");
    const datas = (a: number) => feriadosNacionais(a).map((f) => f.data);
    expect(datas(2026)).toContain("2026-04-03");
    expect(datas(2027)).toContain("2027-03-26");
    expect(datas(2024)).toContain("2024-03-29");
    expect(datas(2026)).toContain("2026-09-07");
    expect(datas(2026)).toContain("2026-11-20");
    expect(datas(2023)).not.toContain("2023-11-20");
    expect(datas(2026)).toHaveLength(10);
  });
});
