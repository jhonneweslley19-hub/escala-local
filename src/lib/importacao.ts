import type { Colaborador } from "./engine/types";

/** Linha de planilha já convertida em colaborador (sem id e sem loja). */
export type ColaboradorImportado = Omit<Colaborador, "id">;

export interface ResultadoImportacao {
  colaboradores: ColaboradorImportado[];
  erros: { linha: number; mensagem: string }[];
}

export const MODELO_CSV =
  "Nome;Setor;Carga semanal;Menor de 18;Domingo quinzenal;Não trabalha;Último domingo de folga\n" +
  "Maria da Silva;Frente de Caixa;44;não;sim;;02/11/2026\n" +
  "João Souza;Açougue;44;não;não;dom;\n" +
  "Ana Lima;Padaria;30;sim;não;seg,ter;\n";

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

/** Divide uma linha CSV respeitando aspas. */
function dividir(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (aspas) {
      if (ch === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else atual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      out.push(atual);
      atual = "";
    } else atual += ch;
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

const COLUNAS: Record<string, string[]> = {
  nome: ["nome", "colaborador", "funcionario", "nome completo"],
  setor: ["setor", "departamento", "secao"],
  carga: ["carga semanal", "carga", "horas semanais", "carga horaria"],
  menor: ["menor de 18", "menor", "menor de idade"],
  quinzenal: ["domingo quinzenal", "quinzenal", "revezamento quinzenal"],
  indisponivel: ["nao trabalha", "dias indisponiveis", "indisponivel"],
  ultimoDomingo: ["ultimo domingo de folga", "ultimo domingo", "ultima folga no domingo"],
};

const simNao = (v: string) => ["sim", "s", "x", "1", "true", "verdadeiro"].includes(normalizar(v));

/**
 * Converte uma planilha CSV (separada por `;` ou `,`, como o Excel exporta) em colaboradores.
 * `setores` mapeia o nome normalizado do setor para o id.
 */
export function lerPlanilha(csv: string, setores: Map<string, string>): ResultadoImportacao {
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const erros: ResultadoImportacao["erros"] = [];
  if (linhas.length < 2) return { colaboradores: [], erros: [{ linha: 1, mensagem: "A planilha precisa de cabeçalho e ao menos uma linha." }] };
  const sep = linhas[0].includes(";") ? ";" : linhas[0].includes("\t") ? "\t" : ",";
  const cab = dividir(linhas[0], sep).map(normalizar);
  const idx = Object.fromEntries(
    Object.entries(COLUNAS).map(([k, nomes]) => [k, cab.findIndex((c) => nomes.includes(c))]),
  ) as Record<keyof typeof COLUNAS, number>;
  if (idx.nome < 0 || idx.setor < 0) {
    return { colaboradores: [], erros: [{ linha: 1, mensagem: "Cabeçalho precisa ter as colunas “Nome” e “Setor”." }] };
  }

  const colaboradores: ColaboradorImportado[] = [];
  linhas.slice(1).forEach((linha, i) => {
    const n = i + 2;
    const v = dividir(linha, sep);
    const campo = (k: keyof typeof COLUNAS) => (idx[k] >= 0 ? v[idx[k]] ?? "" : "");
    const nome = campo("nome");
    if (!nome) return erros.push({ linha: n, mensagem: "Nome vazio." });
    const setorId = setores.get(normalizar(campo("setor")));
    if (!setorId) return erros.push({ linha: n, mensagem: `Setor “${campo("setor")}” não existe nesta loja.` });
    const cargaTxt = campo("carga").replace(",", ".").replace(/h$/i, "");
    const carga = cargaTxt ? Number(cargaTxt) : 44;
    if (!Number.isFinite(carga) || carga <= 0 || carga > 44) return erros.push({ linha: n, mensagem: `Carga semanal inválida: “${campo("carga")}”.` });
    const dias: number[] = [];
    for (const d of campo("indisponivel").split(/[,/ ]+/).map(normalizar).filter(Boolean)) {
      const k = DIAS.findIndex((x) => d.startsWith(x));
      if (k < 0) return erros.push({ linha: n, mensagem: `Dia inválido em “Não trabalha”: “${d}” (use seg, ter, qua, qui, sex, sab, dom).` });
      dias.push(k);
    }
    let ultimoDomingoFolga: string | undefined;
    const ud = campo("ultimoDomingo");
    if (ud) {
      const m = ud.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? ud.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return erros.push({ linha: n, mensagem: `Data inválida em “Último domingo de folga”: “${ud}” (use dd/mm/aaaa).` });
      ultimoDomingoFolga = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    colaboradores.push({
      nome,
      setorId,
      cargaSemanal: carga,
      menorDeIdade: simNao(campo("menor")),
      domingoQuinzenal: simNao(campo("quinzenal")),
      diasIndisponiveis: [...new Set(dias)],
      ausencias: [],
      ultimoDomingoFolga,
    });
  });
  return { colaboradores, erros };
}
