import { notFound } from "next/navigation";
import { listarEventos, obterEscala, obterLoja } from "@/lib/server/repo";
import { EscalaView } from "@/components/EscalaView";
import { podeAlterarEscala, podeVerLoja, usuarioPagina } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";
import { fmtData } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function EscalaPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioPagina();
  const { id } = await params;
  const e = await obterEscala(id);
  if (!e || !podeVerLoja(u, e.lojaId)) notFound();
  const loja = await obterLoja(e.lojaId);
  await registrarUsuario(u, "VER_ESCALA", `${loja?.nome ?? e.lojaId} — escala de ${fmtData(e.entrada.inicio)}`, e.lojaId);
  return <EscalaView salva={e} lojaNome={loja?.nome ?? e.lojaId} eventosIniciais={await listarEventos(id)} podeAlterar={podeAlterarEscala(u)} />;
}
