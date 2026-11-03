import Link from "next/link";
import { REGIMES } from "@/lib/engine/regimes";
import { addDias } from "@/lib/engine/tempo";
import { listarEscalas, listarLojas } from "@/lib/server/repo";
import { NovaEscala } from "@/components/NovaEscala";
import { fmtData, fmtNum } from "@/lib/api";
import { filtrarPorLoja, podeAlterarEscala, podeVerLoja, usuarioPagina } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Escalas({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const u = await usuarioPagina();
  const { loja: pedida } = await searchParams;
  const loja = pedida && podeVerLoja(u, pedida) ? pedida : u.lojaId ?? undefined;
  const lojas = filtrarPorLoja(u, await listarLojas(), (l) => l.id);
  const escalas = filtrarPorLoja(u, await listarEscalas(loja), (e) => e.lojaId);
  const todas = loja ? escalas : filtrarPorLoja(u, await listarEscalas(), (e) => e.lojaId);
  /** Dia seguinte ao fim da escala mais avançada da loja (prioriza publicadas). */
  const proximoInicio = (lojaId: string) => {
    const daLoja = todas.filter((e) => e.lojaId === lojaId);
    const base = daLoja.some((e) => e.status === "PUBLICADA") ? daLoja.filter((e) => e.status === "PUBLICADA") : daLoja;
    const fins = base.map((e) => addDias(e.inicio, e.semanas * 7));
    return fins.sort().pop();
  };
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Escalas</h1>
          <p className="muted">
            {podeAlterarEscala(u)
              ? "Gere escalas por loja a partir da demanda e das regras de folga vigentes."
              : "As escalas são geradas, alteradas e publicadas pelo RH/DP. Aqui você consulta, imprime e exporta."}
          </p>
        </div>
      </div>
      {podeAlterarEscala(u) && <NovaEscala lojas={lojas.map((l) => ({ id: l.id, nome: l.nome, proximoInicio: proximoInicio(l.id) }))} lojaInicial={loja} />}
      <div className="card">
        <h2>Escalas geradas</h2>
        {escalas.length === 0 ? (
          <p className="muted">Nenhuma escala gerada ainda.</p>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Loja</th><th>Período</th><th>Situação</th><th>Regime</th><th className="num">Cobertura</th>
                  <th className="num">Pessoa-hora faltante</th><th className="num">Folga no domingo</th><th>Conformidade</th><th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {escalas.map((e) => (
                  <tr key={e.id}>
                    <td>{e.loja}</td>
                    <td><Link href={`/escalas/${e.id}`}>{fmtData(e.inicio)} · {e.semanas} semana{e.semanas > 1 ? "s" : ""}</Link></td>
                    <td>
                      {e.status === "PUBLICADA" ? <span className="badge ok">Publicada</span> : <span className="badge alerta">Rascunho</span>}
                    </td>
                    <td>{[...new Set(e.regimes)].map((r) => <span key={r} className="badge" style={{ marginRight: 4 }}>{REGIMES[r].horasSemanaisMax}h/{REGIMES[r].folgasSemanaisMin}F</span>)}</td>
                    <td className="num">{fmtNum(e.metricas.coberturaPct, 1)}%</td>
                    <td className="num">{fmtNum(e.metricas.horasFaltantes, 0)}</td>
                    <td className="num">{fmtNum(e.metricas.folgaDominicalPct, 0)}%</td>
                    <td>{e.metricas.erros ? <span className="badge erro">{e.metricas.erros} violações</span> : <span className="badge ok">Conforme</span>}</td>
                    <td className="small muted">{new Date(e.criadoEm).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
