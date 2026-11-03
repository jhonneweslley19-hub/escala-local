import { exigirAdmin, usuarioAtual } from "@/lib/server/auth";
import { rota } from "@/lib/server/http";
import { ACOES, listarRegistro, registrarUsuario } from "@/lib/server/registro";

export const runtime = "nodejs";

const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Exporta o registro de acessos em CSV (ex.: para responder à ANPD ou a um titular). Só o administrador. */
export async function GET(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    exigirAdmin(u);
    const p = new URL(req.url).searchParams;
    const dias = Math.min(365, Math.max(1, Number(p.get("dias")) || 7));
    const linhas = await listarRegistro({ dias, quem: p.get("quem") ?? undefined, acao: p.get("acao") ?? undefined, limite: 5000 });
    await registrarUsuario(u, "EXPORTAR_DADOS", `registro de acessos (${dias} dias)`);
    const csv = [
      ["Quando (UTC)", "Quem", "Perfil", "Ação", "Detalhe", "Loja", "IP"].join(";"),
      ...linhas.map((r) => [r.quando, r.quem, r.perfil, ACOES[r.acao] ?? r.acao, r.alvo ?? "", r.lojaId ?? "", r.ip ?? ""].map(esc).join(";")),
    ];
    return new Response("﻿" + csv.join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registro-acessos.csv"` },
    });
  });
}
