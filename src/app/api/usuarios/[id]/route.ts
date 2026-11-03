import { atualizarUsuario, contarAdminsAtivos, exigirAdmin, obterUsuario, usuarioAtual, validarSenhaNova } from "@/lib/server/auth";
import { exigir, rota } from "@/lib/server/http";
import { registrarUsuario } from "@/lib/server/registro";
import { transacao } from "@/lib/server/db";
import { validarPerfil } from "../validar";

export const runtime = "nodejs";

/** Altera nome, perfil/loja, ativo e/ou redefine a senha. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    const eu = await usuarioAtual();
    exigirAdmin(eu);
    const b = await req.json();
    const alvo = await obterUsuario(id);
    exigir(alvo, "Usuário não encontrado");
    const dados: Parameters<typeof atualizarUsuario>[1] = {};
    if (b.nome !== undefined) {
      exigir(typeof b.nome === "string" && b.nome.trim(), "Nome inválido");
      dados.nome = b.nome.trim();
    }
    if (b.perfil !== undefined) Object.assign(dados, await validarPerfil(b));
    if (b.ativo !== undefined) dados.ativo = Boolean(b.ativo);
    if (b.senha) {
      const erro = validarSenhaNova(b.senha);
      exigir(!erro, erro ?? "");
      dados.senha = b.senha;
    }
    await transacao(async () => {
      await atualizarUsuario(id, dados);
      exigir((await contarAdminsAtivos()) > 0, "É preciso manter pelo menos um administrador ativo");
    });
    await registrarUsuario(eu, "USUARIO", `${alvo.login} alterado (${Object.keys(dados).map((k) => (k === "senha" ? "senha redefinida" : k)).join(", ")})`);
    return await obterUsuario(id);
  });
}
