import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESSAO, encerrarSessao } from "@/lib/server/auth";
import { rota } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST() {
  return rota(async () => {
    const token = (await cookies()).get(COOKIE_SESSAO)?.value;
    if (token) encerrarSessao(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(COOKIE_SESSAO);
    return res;
  });
}
