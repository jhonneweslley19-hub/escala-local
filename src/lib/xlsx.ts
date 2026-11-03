/**
 * Leitor mínimo de planilhas .xlsx, sem dependências: lê o zip, descompacta com o
 * DecompressionStream do navegador (ou do Node) e percorre as linhas de uma aba em
 * fluxo, sem montar a planilha inteira na memória. Serve para exportações grandes
 * (ex.: 150 mil cupons do ERP) direto no navegador.
 */

export type Celula = string | number | null;

interface EntradaZip {
  metodo: number;
  inicio: number;
  tamanho: number;
  tamanhoReal: number;
}

/** Lê o diretório central do zip. */
function lerZip(bytes: Uint8Array): Map<string, EntradaZip> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("O arquivo não é uma planilha .xlsx válida.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const nomes = new TextDecoder();
  const entradas = new Map<string, EntradaZip>();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Planilha corrompida.");
    const metodo = v.getUint16(p + 10, true);
    const tamanho = v.getUint32(p + 20, true);
    const tamanhoReal = v.getUint32(p + 24, true);
    const lNome = v.getUint16(p + 28, true);
    const lExtra = v.getUint16(p + 30, true);
    const lComent = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = nomes.decode(bytes.subarray(p + 46, p + 46 + lNome));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    entradas.set(nome, { metodo, inicio, tamanho, tamanhoReal });
    p += 46 + lNome + lExtra + lComent;
  }
  return entradas;
}

/** Texto de um arquivo do zip, em pedaços. `progresso` recebe a fração lida (0–1). */
async function* textoEntrada(bytes: Uint8Array, e: EntradaZip, progresso?: (f: number) => void): AsyncGenerator<string> {
  const dados = bytes.slice(e.inicio, e.inicio + e.tamanho);
  let fluxo: ReadableStream<Uint8Array> = new Blob([dados]).stream();
  if (e.metodo === 8) fluxo = fluxo.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  else if (e.metodo !== 0) throw new Error("Compressão da planilha não suportada.");
  const leitor = fluxo.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let lidos = 0;
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) return;
      lidos += value.length;
      progresso?.(Math.min(1, lidos / Math.max(1, e.tamanhoReal)));
      yield value;
    }
  } finally {
    await leitor.cancel().catch(() => {});
  }
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (s: string) =>
  s.indexOf("&") < 0
    ? s
    : s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c: string) =>
        c[0] === "#" ? String.fromCodePoint(c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10)) : ENTIDADES[c] ?? m,
      );

/** Percorre os elementos `<tag>…</tag>` de um texto em fluxo. */
async function* elementos(pedacos: AsyncIterable<string>, tag: string): AsyncGenerator<string> {
  const fecha = `</${tag}>`;
  const re = new RegExp(`<${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, "g");
  let resto = "";
  for await (const p of pedacos) {
    resto += p;
    const ate = resto.lastIndexOf(fecha);
    if (ate < 0) continue;
    const bloco = resto.slice(0, ate + fecha.length);
    resto = resto.slice(ate + fecha.length);
    for (const m of bloco.matchAll(re)) yield m[0];
  }
  for (const m of resto.matchAll(re)) yield m[0];
}

const textoRico = (si: string) =>
  decodificar([...si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

/** Índice da coluna a partir da referência ("B12" → 1). */
function coluna(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export interface Aba {
  nome: string;
  arquivo: string;
}

export interface Planilha {
  abas: Aba[];
  /** Percorre as linhas da aba; devolva `false` em `porLinha` para parar. */
  linhas(aba: Aba, porLinha: (celulas: Celula[]) => boolean | void, progresso?: (f: number) => void): Promise<void>;
}

async function textoCompleto(bytes: Uint8Array, e: EntradaZip | undefined): Promise<string> {
  if (!e) return "";
  let s = "";
  for await (const p of textoEntrada(bytes, e)) s += p;
  return s;
}

export async function abrirXlsx(bytes: Uint8Array): Promise<Planilha> {
  const zip = lerZip(bytes);
  const wb = await textoCompleto(bytes, zip.get("xl/workbook.xml"));
  if (!wb) throw new Error("O arquivo não é uma planilha do Excel (.xlsx).");
  const rels = await textoCompleto(bytes, zip.get("xl/_rels/workbook.xml.rels"));
  const alvo = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) alvo.set(id, t.startsWith("/") ? t.slice(1) : `xl/${t}`);
  }
  const abas: Aba[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = decodificar(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    const arquivo = alvo.get(rid);
    if (arquivo && zip.has(arquivo)) abas.push({ nome, arquivo });
  }

  const compartilhados: string[] = [];
  const sst = zip.get("xl/sharedStrings.xml");
  if (sst) for await (const si of elementos(textoEntrada(bytes, sst), "si")) compartilhados.push(textoRico(si));

  return {
    abas,
    async linhas(aba, porLinha, progresso) {
      for await (const row of elementos(textoEntrada(bytes, zip.get(aba.arquivo)!, progresso), "row")) {
        const celulas: Celula[] = [];
        let pos = 0;
        for (const c of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = c[1];
          const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1];
          const i = ref ? coluna(ref) : pos;
          pos = i + 1;
          const corpo = c[2] ?? "";
          const tipo = /\bt="(\w+)"/.exec(attrs)?.[1];
          let valor: Celula = null;
          if (tipo === "inlineStr") valor = textoRico(corpo);
          else {
            const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
            if (v !== undefined) {
              if (tipo === "s") valor = compartilhados[Number(v)] ?? "";
              else if (tipo === "str" || tipo === "e" || tipo === "d") valor = decodificar(v);
              else if (tipo === "b") valor = v === "1" ? 1 : 0;
              else valor = Number(v);
            }
          }
          celulas[i] = valor;
        }
        for (let i = 0; i < celulas.length; i++) if (celulas[i] === undefined) celulas[i] = null;
        if (porLinha(celulas) === false) return;
      }
    },
  };
}

/** Ex.: arquivo CSV exportado pelo Excel (separado por `;`, `,` ou tabulação). Tenta UTF-8 e cai para Windows-1252. */
export function lerCsv(bytes: Uint8Array): Celula[][] {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  texto = texto.replace(/^﻿/, "");
  const primeira = texto.split("\n", 1)[0];
  const sep = [";", "\t", ","].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: Celula[][] = [];
  let linha: Celula[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else atual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(atual.trim());
      atual = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(atual.trim());
      linhas.push(linha);
      linha = [];
      atual = "";
    } else atual += ch;
  }
  if (atual || linha.length) {
    linha.push(atual.trim());
    linhas.push(linha);
  }
  return linhas;
}
