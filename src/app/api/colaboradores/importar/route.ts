import { exigir, json, rota } from "@/lib/server/http";
import { importarColaboradores, obterLoja } from "@/lib/server/repo";

import { exigirLoja, usuarioAtual } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";

export const runtime = "nodejs";

/** `{ lojaId, csv }` → importa todos ou nenhum; retorna os erros por linha. */
export async function POST(req: Request) {
  return rota(async () => {
    const b = await req.json();
    exigir(typeof b.lojaId === "string" && await obterLoja(b.lojaId), "Loja inválida");
    const u = await usuarioAtual();
    exigirLoja(u, b.lojaId);
    exigir(typeof b.csv === "string" && b.csv.length < 2_000_000, "Planilha inválida");
    const r = await importarColaboradores(b.lojaId, b.csv);
    if (r.importados) await registrarUsuario(u, "IMPORTAR_COLABORADORES", `${r.importados} colaboradores`, b.lojaId);
    return r.erros.length ? json(r, 400) : r;
  });
}
