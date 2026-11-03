import { exigir, rota } from "@/lib/server/http";
import { excluirColaborador, obterColaborador, salvarColaborador } from "@/lib/server/repo";
import { exigirLoja, usuarioAtual } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";
import { validarColaborador } from "../validar";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    const b = await req.json();
    exigir(typeof b.lojaId === "string", "Informe a loja");
    const u = await usuarioAtual();
    exigirLoja(u, (await obterColaborador(id))?.lojaId);
    exigirLoja(u, b.lojaId);
    const c = await salvarColaborador(b.lojaId, { ...validarColaborador(b), id });
    await registrarUsuario(u, "SALVAR_COLABORADOR", c.nome, b.lojaId);
    return c;
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    const u = await usuarioAtual();
    const c = await obterColaborador(id);
    exigirLoja(u, c?.lojaId);
    await excluirColaborador(id);
    await registrarUsuario(u, "EXCLUIR_COLABORADOR", c!.nome, c!.lojaId);
  });
}
