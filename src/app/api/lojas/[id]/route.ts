import { rota } from "@/lib/server/http";
import { dimensionamentoLoja, listarColaboradores, listarSetores, obterLoja } from "@/lib/server/repo";

import { exigirLoja, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    exigirLoja(await usuarioAtual(), id);
    const loja = await obterLoja(id);
    if (!loja) return Response.json({ erro: "Loja não encontrada" }, { status: 404 });
    return { loja, setores: await listarSetores(id), colaboradores: await listarColaboradores(id), dimensionamento: await dimensionamentoLoja(id) };
  });
}
