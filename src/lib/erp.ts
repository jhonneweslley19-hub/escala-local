import type { CurvaDemanda, ISODate } from "./engine/types";
import { abrirXlsx, lerCsv, type Aba, type Celula } from "./xlsx";
import { normalizar } from "./importacao";

/**
 * Importação das vendas do ERP (relatório de cupons por PDV) para montar a curva de demanda
 * da frente de caixa: itens vendidos por hora → operadores necessários por hora.
 */

/** Movimento de uma hora de um dia. */
export interface HoraVendas {
  itens: number;
  cupons: number;
  /** Operadores diferentes que registraram venda na hora (se a planilha tiver a coluna). */
  operadores: number;
}

export interface VendasERP {
  aba: string;
  cupons: number;
  /** Linhas sem data, hora ou quantidade válidas. */
  ignoradas: number;
  colunas: { data: string; hora: string; itens: string; operador?: string };
  /** Chave `AAAA-MM-DD|h` (h de 0 a 23). */
  horas: Record<string, HoraVendas>;
}

const ALIASES = {
  hora: ["horario", "hora", "hora venda", "hora da venda", "horario venda"],
  itens: ["qtde vendida", "qtde", "quantidade", "quantidade vendida", "qtd", "qtd vendida", "qtde itens", "itens", "qtd itens"],
  data: ["data", "data venda", "data da venda", "data emissao", "data movimento", "data erp", "dt venda", "dt"],
  operador: ["operador", "cod operador", "codigo operador", "operador pdv", "nome operador", "nome"],
  cupom: ["n cupom", "no cupom", "numero cupom", "num cupom", "cupom"],
  documento: ["n cf e", "n nfc e", "no nfc e", "numero nfc e", "nfc e", "cf e", "n nfce", "nfce"],
  valor: ["venda liquida", "valor total", "valor", "total"],
};
type Campo = keyof typeof ALIASES;
type Mapa = Partial<Record<Campo, number>>;

const chaveCabecalho = (v: Celula) => normalizar(String(v ?? "")).replace(/[^a-z0-9]+/g, " ").trim();

/** Procura, nas primeiras linhas, um cabeçalho com as colunas conhecidas. */
function mapear(linha: Celula[]): Mapa {
  const nomes = linha.map(chaveCabecalho);
  const m: Mapa = {};
  for (const campo of Object.keys(ALIASES) as Campo[]) {
    for (const alias of ALIASES[campo]) {
      const i = nomes.indexOf(alias);
      if (i >= 0 && !Object.values(m).includes(i)) {
        m[campo] = i;
        break;
      }
    }
  }
  return m;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Data em número de série do Excel, "dd/mm/aaaa", "dd/mm/aaaa - SAB" ou "aaaa-mm-dd". */
export function lerData(v: Celula): ISODate | null {
  if (typeof v === "number") return v > 20000 && v < 80000 ? isoUTC(new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)) : null;
  if (!v) return null;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v.trim());
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[1])));
    return d.getUTCDate() === Number(m[1]) ? isoUTC(d) : null;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Hora (0–23) de uma fração do dia do Excel, de um número de série com hora ou de "hh:mm[:ss]". */
export function lerHora(v: Celula): number | null {
  if (typeof v === "number") {
    if (!(v >= 0)) return null;
    const h = Math.floor((v - Math.floor(v)) * 24 + 1e-9);
    return h >= 0 && h < 24 ? h : null;
  }
  const m = /(?:^|\s)(\d{1,2}):(\d{2})/.exec(String(v ?? ""));
  return m && Number(m[1]) < 24 ? Number(m[1]) : null;
}

/** Número do Excel ou texto em formato brasileiro ("1.234,5") ou americano ("1,234.5"). */
const lerNumero = (v: Celula): number | null => {
  if (typeof v === "number") return v;
  if (!v) return null;
  let s = v.replace(/\s/g, "");
  const virgula = s.lastIndexOf(",");
  const ponto = s.lastIndexOf(".");
  if (virgula > ponto) s = s.replace(/\./g, "").replace(",", ".");
  else if (virgula >= 0) s = s.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
};

/** Origem das linhas: uma aba de .xlsx ou as linhas de um CSV. */
interface Fonte {
  nome: string;
  linhas(porLinha: (l: Celula[]) => boolean | void, progresso?: (f: number) => void): Promise<void>;
}

/** Lê o cabeçalho (até a 20ª linha) de uma fonte. */
interface Cabecalho {
  mapa: Mapa;
  /** Índice da linha do cabeçalho. */
  linha: number;
  nomes: Celula[];
}

async function cabecalho(f: Fonte): Promise<Cabecalho | null> {
  let achado: Cabecalho | null = null;
  let n = 0;
  await f.linhas((l) => {
    const mapa = mapear(l);
    if ((mapa.hora !== undefined && mapa.itens !== undefined) || (mapa.cupom !== undefined && mapa.data !== undefined)) {
      achado = { mapa, linha: n, nomes: l };
      return false;
    }
    return ++n < 20;
  });
  return achado;
}

/** Chave para cruzar o cupom com a aba de notas (que tem a data), como a planilha faz no PROCV. */
const chaveCupom = (l: Celula[], m: Mapa, campos: Campo[]) => campos.map((c) => String(lerNumero(l[m[c]!]) ?? l[m[c]!] ?? "")).join("|");

/**
 * Lê a exportação de cupons do ERP (.xlsx ou .csv). Procura a aba com hora e quantidade de itens;
 * se ela não tiver a data (relatório "PDV Cupons"), cruza o número do cupom com outra aba que tenha
 * (relatório "NFC-e"), usando também o número da nota e o valor quando as duas abas têm essas colunas.
 */
export async function lerVendasERP(bytes: Uint8Array, nomeArquivo: string, progresso?: (f: number) => void): Promise<VendasERP> {
  let fontes: Fonte[];
  if (/\.(csv|txt)$/i.test(nomeArquivo)) {
    const linhas = lerCsv(bytes);
    fontes = [{ nome: nomeArquivo, async linhas(cb) { for (const l of linhas) if (cb(l) === false) return; } }];
  } else {
    const p = await abrirXlsx(bytes);
    fontes = p.abas.map((a: Aba) => ({ nome: a.nome, linhas: (cb, pr) => p.linhas(a, cb, pr) }));
  }

  const cabs = await Promise.all(fontes.map(async (f) => ({ f, cab: await cabecalho(f) })));
  const vendas = cabs
    .filter((x) => x.cab && x.cab.mapa.hora !== undefined && x.cab.mapa.itens !== undefined)
    .sort((a, b) => Number(b.cab!.mapa.data !== undefined) - Number(a.cab!.mapa.data !== undefined));
  if (!vendas.length) {
    throw new Error("Não encontrei as colunas de hora e quantidade vendida. A planilha precisa ter um cabeçalho com \"Horário\" e \"Qtde. Vendida\" (relatório de cupons do ERP).");
  }
  const { f: principal, cab } = vendas[0];
  const m = cab!.mapa;

  // Sem data na aba de cupons: busca a data pelo número do cupom em outra aba.
  let dataPorCupom: Map<string, ISODate> | null = null;
  let campos: Campo[] = [];
  let nomeData = "";
  if (m.data === undefined) {
    const notas = cabs.find((x) => x.f !== principal && x.cab?.mapa.cupom !== undefined && x.cab.mapa.data !== undefined);
    if (!notas || m.cupom === undefined) {
      throw new Error("A aba de cupons não tem a data da venda. Inclua a coluna \"Data\" ou a aba de notas (NFC-e) com o número do cupom e a data.");
    }
    const mn = notas.cab!.mapa;
    campos = (["cupom", "documento", "valor"] as Campo[]).filter((c) => m[c] !== undefined && mn[c] !== undefined);
    nomeData = `${notas.f.nome} › ${headerNome(notas.cab!, "data")}`;
    dataPorCupom = new Map();
    let i = 0;
    await notas.f.linhas((l) => {
      if (i++ <= notas.cab!.linha) return;
      const d = lerData(l[mn.data!]);
      if (d) dataPorCupom!.set(chaveCupom(l, mn, campos), d);
    }, (fr) => progresso?.(fr * 0.35));
  }

  const horas: Record<string, HoraVendas & { ops?: Set<string> }> = {};
  let cupons = 0;
  let ignoradas = 0;
  let i = 0;
  await principal.linhas(
    (l) => {
      if (i++ <= cab!.linha) return;
      if (l.every((c) => c === null || c === "")) return;
      const data = dataPorCupom ? dataPorCupom.get(chaveCupom(l, m, campos)) ?? null : lerData(l[m.data!]);
      const hora = lerHora(l[m.hora!]) ?? (m.data !== undefined && typeof l[m.data] === "number" && (l[m.data] as number) % 1 > 0 ? lerHora(l[m.data]) : null);
      const itens = lerNumero(l[m.itens!]);
      if (!data || hora === null || itens === null) {
        ignoradas++;
        return;
      }
      const k = `${data}|${hora}`;
      const h = (horas[k] ??= { itens: 0, cupons: 0, operadores: 0 });
      h.itens += itens;
      h.cupons++;
      cupons++;
      if (m.operador !== undefined && l[m.operador] !== null && l[m.operador] !== "") (h.ops ??= new Set()).add(String(l[m.operador]));
    },
    (fr) => progresso?.(dataPorCupom ? 0.35 + fr * 0.65 : fr),
  );
  if (!cupons) throw new Error("Nenhuma venda com data, hora e quantidade válidas foi encontrada.");
  for (const h of Object.values(horas)) {
    h.operadores = h.ops?.size ?? 0;
    delete h.ops;
  }
  return {
    aba: principal.nome,
    cupons,
    ignoradas,
    colunas: {
      data: nomeData || headerNome(cab!, "data"),
      hora: headerNome(cab!, "hora"),
      itens: headerNome(cab!, "itens"),
      operador: m.operador !== undefined ? headerNome(cab!, "operador") : undefined,
    },
    horas,
  };
}

const headerNome = (c: Cabecalho, campo: Campo) => String(c.nomes[c.mapa[campo]!] ?? "");

export interface OpcoesDemandaERP {
  /** Itens que um operador passa por hora. */
  produtividade: number;
  /** Número de caixas (PDVs) da loja: teto de operadores numa hora. */
  caixas: number;
  /** Datas fora da média (feriados, inventário, dias atípicos). */
  excluir?: Iterable<ISODate>;
  /** Abaixo desta média de itens na hora, a loja é considerada fechada (0 operador). */
  minimoItens?: number;
}

export interface DemandaERP {
  demanda: CurvaDemanda;
  /** Média de itens por hora, [seg..dom][0..23]. */
  itens: number[][];
  /** Média de operadores que registraram venda, [seg..dom][0..23]. */
  operadoresERP: number[][];
  inicio: ISODate;
  fim: ISODate;
  /** Quantos dias de cada dia da semana entraram na média, [seg..dom]. */
  dias: number[];
  excluidas: ISODate[];
  /** Itens por operador por hora nas 10% horas mais movimentadas (referência para a produtividade). */
  produtividadePico: number | null;
}

/** Dia da semana com segunda = 0 … domingo = 6. */
const diaSemana = (iso: ISODate) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * Operadores necessários por hora = média de itens da hora (por dia da semana) ÷ produtividade,
 * arredondado para cima com tolerância de 0,15 operador e limitado ao número de caixas.
 * Hora com movimento (média ≥ `minimoItens`) tem pelo menos 1 operador.
 */
export function calcularDemandaERP(v: VendasERP, o: OpcoesDemandaERP): DemandaERP {
  const excluir = new Set(o.excluir ?? []);
  const minimo = o.minimoItens ?? 20;
  const todas = [...new Set(Object.keys(v.horas).map((k) => k.slice(0, 10)))].sort();
  const datas = todas.filter((d) => !excluir.has(d));
  const dias = [0, 0, 0, 0, 0, 0, 0];
  for (const d of datas) dias[diaSemana(d)]++;
  const itens = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const ops = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const usadas = new Set(datas);
  const pico: { itens: number; ops: number }[] = [];
  for (const [k, h] of Object.entries(v.horas)) {
    const d = k.slice(0, 10);
    if (!usadas.has(d)) continue;
    const w = diaSemana(d);
    const hr = Number(k.slice(11));
    itens[w][hr] += h.itens / dias[w];
    ops[w][hr] += h.operadores / dias[w];
    if (h.operadores > 0) pico.push({ itens: h.itens, ops: h.operadores });
  }
  const demanda = itens.map((dia) =>
    dia.map((media) => (media >= minimo ? Math.min(o.caixas, Math.max(1, Math.ceil(media / o.produtividade - 0.15))) : 0)),
  );
  pico.sort((a, b) => b.itens - a.itens);
  const topo = pico.slice(0, Math.max(1, Math.round(pico.length / 10))).map((p) => p.itens / p.ops).sort((a, b) => a - b);
  return {
    demanda,
    itens,
    operadoresERP: ops,
    inicio: datas[0] ?? todas[0],
    fim: datas[datas.length - 1] ?? todas[todas.length - 1],
    dias,
    excluidas: todas.filter((d) => excluir.has(d)),
    produtividadePico: pico.length ? Math.round(topo[Math.floor(topo.length / 2)]) : null,
  };
}
