import { exigir, rota } from "@/lib/server/http";
import { obterEmpresa, salvarRegras } from "@/lib/server/repo";
import type { RegrasEmpresa } from "@/lib/engine/types";

import { exigirGestao, usuarioAtual } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";

export const runtime = "nodejs";

export function GET() {
  return rota(async () => {
    await usuarioAtual();
    return await obterEmpresa();
  });
}

export async function PUT(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    exigirGestao(u);
    const body = (await req.json()) as Partial<RegrasEmpresa>;
    const atual = (await obterEmpresa()).regras;
    const regras: RegrasEmpresa = { ...atual };
    for (const k of ["acordoCompensacao", "feriadoExigeCCT", "feriadosAutorizadosCCT", "folgasConsecutivasPreferidas"] as const) {
      if (body[k] !== undefined) {
        exigir(typeof body[k] === "boolean", `${k} deve ser booleano`);
        regras[k] = body[k]!;
      }
    }
    if (body.absenteismo !== undefined) {
      exigir(typeof body.absenteismo === "number" && body.absenteismo >= 0 && body.absenteismo < 0.5, "absenteismo deve estar entre 0 e 0,5");
      regras.absenteismo = body.absenteismo;
    }
    if (body.intervaloMaximo !== undefined) {
      exigir([60, 90, 120].includes(body.intervaloMaximo as number), "intervaloMaximo deve ser 60, 90 ou 120 minutos");
      regras.intervaloMaximo = body.intervaloMaximo;
    }
    await salvarRegras(regras);
    await registrarUsuario(u, "CONFIGURACAO", `regras: ${Object.keys(body).join(", ")}`);
    return regras;
  });
}
