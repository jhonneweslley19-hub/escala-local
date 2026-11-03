import { ehHora, exigir, rota } from "@/lib/server/http";
import { criarLoja, criarSetor, listarLojas } from "@/lib/server/repo";
import { parseHHMM } from "@/lib/engine/tempo";

import { exigirAdmin, filtrarPorLoja, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export function GET() {
  return rota(async () => filtrarPorLoja(await usuarioAtual(), await listarLojas(), (l) => l.id));
}

const SETORES_PADRAO = ["Frente de Caixa", "Reposição", "Açougue", "Padaria", "Hortifrúti"];

export async function POST(req: Request) {
  return rota(async () => {
    exigirAdmin(await usuarioAtual());
    const b = await req.json();
    exigir(typeof b.nome === "string" && b.nome.trim(), "Informe o nome da loja");
    for (const k of ["abre", "fecha", "abreDomingo", "fechaDomingo"]) exigir(ehHora(b[k]), `Horário inválido: ${k}`);
    const loja = await criarLoja({ nome: b.nome.trim(), cidade: String(b.cidade ?? ""), abre: b.abre, fecha: b.fecha, abreDomingo: b.abreDomingo, fechaDomingo: b.fechaDomingo });
    // Setores padrão com demanda mínima de 1 pessoa no horário de funcionamento.
    const inicios: number[] = [];
    for (let m = parseHHMM(b.abre); m <= parseHHMM(b.fecha) - 360; m += 60) inicios.push(m);
    const demanda = Array.from({ length: 7 }, (_, d) => {
      const a = Math.floor(parseHHMM(d === 6 ? b.abreDomingo : b.abre) / 60);
      const f = Math.ceil(parseHHMM(d === 6 ? b.fechaDomingo : b.fecha) / 60);
      return Array.from({ length: 24 }, (_, h) => (h >= a && h < f ? 1 : 0));
    });
    for (const nome of SETORES_PADRAO) await criarSetor(loja.id, nome, inicios, demanda);
    return loja;
  });
}
