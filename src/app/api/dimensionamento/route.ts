import { exigir, rota } from "@/lib/server/http";
import { dimensionamentoLoja, obterLoja, simulacaoLoja } from "@/lib/server/repo";

import { exigirLoja, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export function GET(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    const url = new URL(req.url);
    const loja = url.searchParams.get("loja");
    exigir(loja && await obterLoja(loja), "Loja inválida");
    exigirLoja(u, loja);
    return url.searchParams.get("simular") ? await simulacaoLoja(loja) : await dimensionamentoLoja(loja);
  });
}
