import { ehData, exigir, rota } from "@/lib/server/http";
import { exigirLoja, exigirRH, filtrarPorLoja, usuarioAtual } from "@/lib/server/auth";
import { criarEscala, listarEscalas, obterLoja } from "@/lib/server/repo";
import { REGIMES } from "@/lib/engine/regimes";
import { diaSemana } from "@/lib/engine/tempo";
import type { RegimeId } from "@/lib/engine/types";

export const runtime = "nodejs";

export function GET(req: Request) {
  const loja = new URL(req.url).searchParams.get("loja") ?? undefined;
  return rota(async () => {
    const u = await usuarioAtual();
    if (loja) exigirLoja(u, loja);
    return filtrarPorLoja(u, await listarEscalas(loja), (e) => e.lojaId);
  });
}

export async function POST(req: Request) {
  return rota(async () => {
    const b = await req.json();
    exigir(typeof b.lojaId === "string" && await obterLoja(b.lojaId), "Loja inválida");
    const u = await usuarioAtual();
    exigirRH(u);
    exigirLoja(u, b.lojaId);
    exigir(ehData(b.inicio) && diaSemana(b.inicio) === 0, "A escala deve começar em uma segunda-feira");
    exigir(Number.isInteger(b.semanas) && b.semanas >= 1 && b.semanas <= 12, "Semanas deve estar entre 1 e 12");
    exigir(b.regimeId == null || b.regimeId in REGIMES, "Regime inválido");
    const e = await criarEscala(b.lojaId, b.inicio, b.semanas, u.login, (b.regimeId as RegimeId) ?? undefined);
    return { id: e.id, metricas: e.resultado.metricas };
  });
}
