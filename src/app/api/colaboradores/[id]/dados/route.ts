import { rota } from "@/lib/server/http";
import { obterColaborador } from "@/lib/server/repo";
import { exigirGestao, exigirLoja, usuarioAtual } from "@/lib/server/auth";
import { dadosDoTitular, respostaJson } from "@/lib/server/titular";
import { registrarUsuario } from "@/lib/server/registro";

export const runtime = "nodejs";

/** RH/DP ou administrador exporta os dados de um colaborador para atender a um pedido do titular (LGPD, art. 18). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    const u = await usuarioAtual();
    const c = await obterColaborador(id);
    exigirLoja(u, c?.lojaId);
    exigirGestao(u);
    await registrarUsuario(u, "EXPORTAR_DADOS", c!.nome, c!.lojaId);
    return respostaJson(await dadosDoTitular(id), `dados-${c!.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
  });
}
