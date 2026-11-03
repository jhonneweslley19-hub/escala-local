import Link from "next/link";
import { listarLojas } from "@/lib/server/repo";
import { NovaLoja } from "@/components/NovaLoja";
import { filtrarPorLoja, usuarioPagina } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Lojas() {
  const u = await usuarioPagina();
  const lojas = filtrarPorLoja(u, await listarLojas(), (l) => l.id);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Lojas e demanda</h1>
          <p className="muted">Horário de funcionamento, setores, horários de entrada e curva de demanda por hora.</p>
        </div>
      </div>
      <div className="grid g2">
        {lojas.map((l) => (
          <Link key={l.id} href={`/lojas/${l.id}`} className="card" style={{ color: "inherit", textDecoration: "none" }}>
            <h2 style={{ marginBottom: 4 }}>{l.nome}</h2>
            <p className="muted small">Seg–sáb {l.abre}–{l.fecha} · Domingo {l.abreDomingo}–{l.fechaDomingo}</p>
            <div className="row">
              <span className="badge">{l.setores} setores</span>
              <span className="badge">{l.colaboradores} colaboradores</span>
            </div>
          </Link>
        ))}
      </div>
      {u.perfil === "ADMIN" && <NovaLoja />}
    </div>
  );
}
