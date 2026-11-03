import { ehData, exigir, rota } from "@/lib/server/http";
import { excluirFeriado, listarFeriados, obterLoja, salvarFeriado } from "@/lib/server/repo";

import { exigirGestao, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export function GET(req: Request) {
  return rota(async () => {
    await usuarioAtual();
    return await listarFeriados(new URL(req.url).searchParams.get("loja") ?? undefined);
  });
}

/** `{ data, nome, lojaId? }` — sem `lojaId` o feriado vale para todas as lojas. */
export async function POST(req: Request) {
  return rota(async () => {
    exigirGestao(await usuarioAtual());
    const b = await req.json();
    exigir(ehData(b.data), "Data inválida");
    exigir(typeof b.nome === "string" && b.nome.trim(), "Informe o nome do feriado");
    exigir(!b.lojaId || await obterLoja(b.lojaId), "Loja inválida");
    await salvarFeriado({ data: b.data, nome: b.nome.trim(), lojaId: b.lojaId || null });
    return await listarFeriados();
  });
}

export function DELETE(req: Request) {
  return rota(async () => {
    exigirGestao(await usuarioAtual());
    const id = Number(new URL(req.url).searchParams.get("id"));
    exigir(Number.isInteger(id) && id > 0, "Feriado inválido");
    await excluirFeriado(id);
    return await listarFeriados();
  });
}
