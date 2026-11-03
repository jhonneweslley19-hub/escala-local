import { criarUsuario, exigirAdmin, listarUsuarios, usuarioAtual, validarSenhaNova } from "@/lib/server/auth";
import { exigir, rota } from "@/lib/server/http";
import { registrarUsuario } from "@/lib/server/registro";
import { validarPerfil } from "./validar";

export const runtime = "nodejs";

export async function GET() {
  return rota(async () => {
    exigirAdmin(await usuarioAtual());
    return await listarUsuarios();
  });
}

export async function POST(req: Request) {
  return rota(async () => {
    const eu = await usuarioAtual();
    exigirAdmin(eu);
    const b = await req.json();
    exigir(typeof b.login === "string" && /^[a-zA-Z0-9._-]{3,40}$/.test(b.login), "Usuário: 3 a 40 letras, números, ponto, hífen ou sublinhado");
    exigir(typeof b.nome === "string" && b.nome.trim(), "Informe o nome");
    const erroSenha = validarSenhaNova(b.senha);
    exigir(!erroSenha, erroSenha ?? "");
    const { perfil, lojaId } = await validarPerfil(b);
    try {
      const novo = await criarUsuario({ login: b.login, nome: b.nome.trim(), perfil, lojaId, senha: b.senha });
      await registrarUsuario(eu, "USUARIO", `${novo.login} criado (${perfil})`);
      return novo;
    } catch (e) {
      exigir(!String(e).includes("UNIQUE"), "Já existe um usuário com esse login");
      throw e;
    }
  });
}
