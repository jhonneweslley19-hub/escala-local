import { exigir, rota } from "@/lib/server/http";
import { atualizarSetor, obterSetor } from "@/lib/server/repo";
import { exigirLoja, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(async () => {
    exigirLoja(await usuarioAtual(), (await obterSetor(id))?.lojaId);
    const b = await req.json();
    if (b.demanda !== undefined) {
      exigir(
        Array.isArray(b.demanda) && b.demanda.length === 7 &&
          b.demanda.every((d: unknown) => Array.isArray(d) && d.length === 24 && d.every((n) => Number.isInteger(n) && n >= 0 && n <= 500)),
        "Demanda deve ser 7 dias x 24 horas com inteiros de 0 a 500",
      );
    }
    if (b.inicios !== undefined) {
      exigir(Array.isArray(b.inicios) && b.inicios.length > 0 && b.inicios.every((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 1440), "Horários de entrada inválidos");
    }
    if (b.nome !== undefined) exigir(typeof b.nome === "string" && b.nome.trim(), "Nome inválido");
    return await atualizarSetor(id, { nome: b.nome, inicios: b.inicios, demanda: b.demanda });
  });
}
