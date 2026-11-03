import { NextResponse } from "next/server";
import { COOKIE_SESSAO, autenticar, criarSessao } from "@/lib/server/auth";
import { exigir, rota } from "@/lib/server/http";
import { registrarAcesso } from "@/lib/server/registro";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return rota(async () => {
    const b = await req.json();
    exigir(typeof b.login === "string" && typeof b.senha === "string", "Informe usuário e senha");
    const u = await autenticar(b.login.trim(), b.senha).catch(async (e) => {
      await registrarAcesso({ quem: b.login.trim().toLowerCase(), perfil: "—", acao: "LOGIN_FALHOU" });
      throw e;
    });
    await registrarAcesso({ quem: u.login, perfil: u.perfil, acao: "LOGIN" });
    const { token, expira } = await criarSessao(u.id);
    const res = NextResponse.json({ ok: true, perfil: u.perfil });
    res.cookies.set(COOKIE_SESSAO, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      expires: expira,
    });
    return res;
  });
}
