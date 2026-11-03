import Link from "next/link";
import { notFound } from "next/navigation";
import { listarColaboradores, listarFeriados, listarSetores, obterLoja } from "@/lib/server/repo";
import { DemandaEditor } from "@/components/DemandaEditor";
import { podeAlterarEscala, podeVerLoja, usuarioPagina } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function LojaPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioPagina();
  const { id } = await params;
  const loja = await obterLoja(id);
  if (!loja || !podeVerLoja(u, id)) notFound();
  const setores = await listarSetores(id);
  const colaboradores = await listarColaboradores(id);
  const feriados = (await listarFeriados(id)).map((f) => f.data);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{loja.nome}</h1>
          <p className="muted">Seg–sáb {loja.abre}–{loja.fecha} · Domingo {loja.abreDomingo}–{loja.fechaDomingo} · {colaboradores.length} colaboradores</p>
        </div>
        <div className="row">
          <Link className="btn" href={`/colaboradores?loja=${id}`}>Colaboradores</Link>
          <Link className="btn primario" href={`/escalas?loja=${id}`}>{podeAlterarEscala(u) ? "Gerar escala" : "Ver escalas"}</Link>
        </div>
      </div>
      {setores.map((s) => (
        <DemandaEditor key={s.id} setor={s} quadro={colaboradores.filter((c) => c.setorId === s.id).length} feriados={feriados} />
      ))}
    </div>
  );
}
