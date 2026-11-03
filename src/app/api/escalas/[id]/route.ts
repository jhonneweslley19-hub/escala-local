import { ehData, exigir, rota } from "@/lib/server/http";
import { exigirLoja, exigirRH, usuarioAtual } from "@/lib/server/auth";
import { editarDia, excluirEscala, listarEventos, obterEscala, publicarEscala, reabrirEscala } from "@/lib/server/repo";
import type { DiaEscala } from "@/lib/engine/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Usuário logado com acesso à loja da escala (404 se a escala não existe). `alterar` exige o RH/DP. */
async function acesso(id: string, alterar = false) {
  const u = await usuarioAtual();
  const e = await obterEscala(id);
  exigir(e, "Escala não encontrada");
  exigirLoja(u, e.lojaId);
  if (alterar) exigirRH(u);
  return { u, e };
}

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return rota(async () => {
    if (!await obterEscala(id)) return Response.json({ erro: "Escala não encontrada" }, { status: 404 });
    return (await acesso(id)).e;
  });
}

/** Edição manual de um dia: `{ colaboradorId, dia: { data, tipo, inicio?, fim?, intervalo?, intervaloInicio? } }`. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return rota(async () => {
    const { u } = await acesso(id, true);
    const { colaboradorId, dia } = (await req.json()) as { colaboradorId: string; dia: DiaEscala };
    exigir(typeof colaboradorId === "string" && dia && ehData(dia.data), "Dados inválidos");
    exigir(["T", "F", "A"].includes(dia.tipo), "Tipo de dia inválido");
    let novo: DiaEscala;
    if (dia.tipo === "T") {
      const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 2880;
      exigir(ok(dia.inicio) && ok(dia.fim) && dia.fim! > dia.inicio!, "Horários inválidos");
      const intervalo = Number(dia.intervalo ?? 0);
      exigir(intervalo >= 0 && intervalo <= 240, "Intervalo inválido");
      const ii = dia.intervaloInicio ?? Math.round((dia.inicio! + dia.fim! - intervalo) / 2 / 30) * 30;
      novo = { data: dia.data, tipo: "T", inicio: dia.inicio, fim: dia.fim, intervalo, intervaloInicio: intervalo ? ii : undefined };
    } else {
      novo = { data: dia.data, tipo: dia.tipo, motivo: dia.tipo === "F" ? "FOLGA_MANUAL" : dia.motivo ?? "OUTRO" };
    }
    const e = await editarDia(id, colaboradorId, novo, u.login);
    return { resultado: e.resultado, atualizadoEm: e.atualizadoEm, eventos: await listarEventos(id) };
  });
}

/** Publicar ou reabrir: `{ acao: "publicar" | "reabrir", motivo? }`. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return rota(async () => {
    const { u } = await acesso(id, true);
    const b = await req.json();
    exigir(b.acao === "publicar" || b.acao === "reabrir", "Ação inválida");
    if (b.acao === "reabrir") exigir(typeof b.motivo === "string" && b.motivo.trim().length >= 3, "Informe o motivo da reabertura");
    const e = b.acao === "publicar" ? await publicarEscala(id, u.login) : await reabrirEscala(id, u.login, b.motivo.trim());
    return { status: e.status, publicadoEm: e.publicadoEm, publicadoPor: e.publicadoPor, eventos: await listarEventos(id) };
  });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return rota(async () => {
    await acesso(id, true);
    await excluirEscala(id);
  });
}
