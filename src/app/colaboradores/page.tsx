import { listarColaboradores, listarLojas, listarSetores } from "@/lib/server/repo";
import { ColaboradoresView } from "@/components/ColaboradoresView";
import { ehGestao, filtrarPorLoja, podeVerLoja, usuarioPagina } from "@/lib/server/auth";
import { registrarUsuario } from "@/lib/server/registro";

export const dynamic = "force-dynamic";

export default async function Colaboradores({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const u = await usuarioPagina();
  const lojas = filtrarPorLoja(u, await listarLojas(), (l) => l.id);
  const { loja: pedida } = await searchParams;
  const loja = pedida && podeVerLoja(u, pedida) ? pedida : lojas[0]?.id;
  if (loja) await registrarUsuario(u, "VER_COLABORADORES", lojas.find((l) => l.id === loja)?.nome ?? loja, loja);
  return (
    <ColaboradoresView
      lojas={lojas.map((l) => ({ id: l.id, nome: l.nome }))}
      lojaId={loja}
      setores={loja ? (await listarSetores(loja)).map((s) => ({ id: s.id, nome: s.nome })) : []}
      colaboradores={loja ? await listarColaboradores(loja) : []}
      gestao={ehGestao(u)}
    />
  );
}
