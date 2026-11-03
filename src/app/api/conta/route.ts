import { atualizarUsuario, conferirSenha, usuarioAtual, validarSenhaNova } from "@/lib/server/auth";
import { um } from "@/lib/server/db";
import { exigir, rota } from "@/lib/server/http";

export const runtime = "nodejs";

/** Troca a própria senha: `{ atual, nova }`. Encerra as outras sessões. */
export async function PUT(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    exigir(u.id !== "local", "Crie um usuário antes de definir senha");
    const b = await req.json();
    const r = await um("SELECT senha_hash FROM escala_usuarios WHERE id = ?", [u.id]);
    exigir(typeof b.atual === "string" && r && conferirSenha(b.atual, String(r.senha_hash)), "Senha atual incorreta");
    const erro = validarSenhaNova(b.nova);
    exigir(!erro, erro ?? "");
    await atualizarUsuario(u.id, { senha: b.nova });
  });
}
