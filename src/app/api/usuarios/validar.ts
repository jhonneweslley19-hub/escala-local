import { exigir } from "@/lib/server/http";
import { obterLoja } from "@/lib/server/repo";
import { PERFIS, type Perfil } from "@/lib/perfis";

export async function validarPerfil(b: Record<string, unknown>): Promise<{ perfil: Perfil; lojaId: string | null }> {
  exigir(PERFIS.includes(b.perfil as Perfil), "Perfil inválido");
  const perfil = b.perfil as Perfil;
  if (perfil === "GERENTE") {
    exigir(typeof b.lojaId === "string" && (await obterLoja(b.lojaId)), "Gerente precisa de uma loja");
    return { perfil, lojaId: b.lojaId as string };
  }
  return { perfil, lojaId: null };
}
