import { exigir, rota } from "@/lib/server/http";
import { limparDados, obterEmpresa, salvarEncarregado, salvarNomeEmpresa } from "@/lib/server/repo";
import { registrarUsuario } from "@/lib/server/registro";
import { exigirAdmin, usuarioAtual } from "@/lib/server/auth";

export const runtime = "nodejs";

export function GET() {
  return rota(async () => {
    await usuarioAtual();
    return await obterEmpresa();
  });
}

/** `{ nome? , encarregado?: { nome, email } | null }` — o encarregado (LGPD, art. 41) aparece na página de privacidade. */
export async function PUT(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    exigirAdmin(u);
    const b = await req.json();
    if (b.nome !== undefined) {
      exigir(typeof b.nome === "string" && b.nome.trim() && b.nome.length <= 120, "Informe o nome da empresa");
      await salvarNomeEmpresa(b.nome.trim());
    }
    if (b.encarregado !== undefined) {
      const e = b.encarregado;
      if (e === null || (!e.nome?.trim() && !e.email?.trim())) await salvarEncarregado(null);
      else {
        exigir(typeof e.nome === "string" && e.nome.trim() && e.nome.length <= 120, "Informe o nome do encarregado");
        exigir(typeof e.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email.trim()), "E-mail do encarregado inválido");
        await salvarEncarregado({ nome: e.nome.trim(), email: e.email.trim() });
      }
    }
    await registrarUsuario(u, "CONFIGURACAO", `empresa: ${Object.keys(b).join(", ")}`);
    return await obterEmpresa();
  });
}

/** Remove lojas, colaboradores e escalas (ex.: dados de demonstração). Exige confirmação explícita. */
export async function DELETE(req: Request) {
  return rota(async () => {
    const u = await usuarioAtual();
    exigirAdmin(u);
    const b = await req.json().catch(() => ({}));
    exigir(b.confirmar === "APAGAR", "Confirmação ausente");
    await limparDados();
    await registrarUsuario(u, "APAGAR_DADOS", "lojas, colaboradores e escalas");
  });
}
