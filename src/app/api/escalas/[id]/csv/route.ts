import { obterEscala } from "@/lib/server/repo";
import { ehGestao, podeVerLoja, usuarioOpcional } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";
import { rotuloAusencia } from "@/lib/engine/ausencia";
import { minutosTrabalhados } from "@/lib/engine/cobertura";
import { hhmm } from "@/lib/engine/tempo";

export const runtime = "nodejs";

const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await obterEscala(id);
  if (!e) return new Response("Escala não encontrada", { status: 404 });
  const u = await usuarioOpcional();
  if (!u) return new Response("Sessão expirada", { status: 401 });
  if (!podeVerLoja(u, e.lojaId)) return new Response("Sem acesso", { status: 403 });
  await registrarUsuario(u, "EXPORTAR_CSV", `escala de ${e.entrada.inicio.split("-").reverse().join("/")}`, e.lojaId);
  // Motivo da ausência (pode revelar dado de saúde) só para o RH/DP e o administrador.
  const detalhar = ehGestao(u);
  const setores = new Map(e.entrada.setores.map((s) => [s.id, s.nome]));
  const linhas = [["Setor", "Colaborador", "Data", "Situação", "Entrada", "Saída", "Intervalo (min)", "Horas"].join(";")];
  for (const c of e.entrada.colaboradores) {
    for (const d of e.resultado.escala.dias[c.id] ?? []) {
      const sit = d.tipo === "T" ? "Trabalho" : d.tipo === "F" ? "Folga" : rotuloAusencia(d.motivo, detalhar);
      linhas.push(
        [
          setores.get(c.setorId) ?? "",
          c.nome,
          d.data.split("-").reverse().join("/"),
          sit,
          d.tipo === "T" ? hhmm(d.inicio!) : "",
          d.tipo === "T" ? hhmm(d.fim!) : "",
          d.tipo === "T" ? String(d.intervalo ?? 0) : "",
          d.tipo === "T" ? (minutosTrabalhados(d) / 60).toFixed(2).replace(".", ",") : "",
        ].map(esc).join(";"),
      );
    }
  }
  return new Response("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="escala-${e.entrada.inicio}.csv"`,
    },
  });
}
