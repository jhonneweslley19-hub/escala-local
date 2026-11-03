import { exigir, rota } from "@/lib/server/http";
import { listarColaboradores, salvarColaborador } from "@/lib/server/repo";
import { validarColaborador } from "./validar";

import { exigirLoja, filtrarPorLoja, usuarioAtual } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";

export const runtime = "nodejs";

export function GET(req: Request) {
  const loja = new URL(req.url).searchParams.get("loja") ?? undefined;
  return rota(async () => {
    const u = await usuarioAtual();
    if (loja) exigirLoja(u, loja);
    return filtrarPorLoja(u, await listarColaboradores(loja), (c) => c.lojaId);
  });
}

export async function POST(req: Request) {
  return rota(async () => {
    const b = await req.json();
    exigir(typeof b.lojaId === "string", "Informe a loja");
    const u = await usuarioAtual();
    exigirLoja(u, b.lojaId);
    const c = await salvarColaborador(b.lojaId, validarColaborador(b));
    await registrarUsuario(u, "SALVAR_COLABORADOR", c.nome, b.lojaId);
    return c;
  });
}
