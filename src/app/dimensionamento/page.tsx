import Link from "next/link";
import { LISTA_REGIMES } from "@/lib/engine/regimes";
import { dimensionamentoLoja, listarLojas, obterEmpresa } from "@/lib/server/repo";
import { SimulacaoLoja } from "@/components/SimulacaoLoja";
import { fmtNum } from "@/lib/api";
import { filtrarPorLoja, usuarioPagina } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Dimensionamento() {
  const u = await usuarioPagina();
  const { regras } = await obterEmpresa();
  const lojas = filtrarPorLoja(u, await listarLojas(), (l) => l.id);
  const dims = new Map(await Promise.all(lojas.map(async (l) => [l.id, await dimensionamentoLoja(l.id)] as const)));
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dimensionamento</h1>
          <p className="muted">
            Impacto da EC 141/2026 no quadro de cada loja. A simulação usa o próprio motor de escalas; a tabela
            de mínimo teórico é um limite inferior rápido. Absenteísmo considerado:{" "}
            {fmtNum(regras.absenteismo * 100)}% · Acordo de compensação: {regras.acordoCompensacao ? "sim" : "não"}.
          </p>
        </div>
      </div>
      {lojas.map((l) => {
        const d = dims.get(l.id)!;
        return (
          <div className="card" key={l.id}>
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>{l.nome}</h2>
              <span className="spacer" />
              <Link href={`/lojas/${l.id}`} className="small">
                Editar demanda
              </Link>
            </div>
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th className="num">Pessoa-hora/semana</th>
                    <th className="num">Quadro atual</th>
                    {LISTA_REGIMES.map((r) => (
                      <th key={r.id} className="num">
                        Mínimo teórico {r.horasSemanaisMax}h
                      </th>
                    ))}
                    <th className="num">Horas disponíveis (44h → 40h)</th>
                  </tr>
                </thead>
                <tbody>
                  {d.map((s) => (
                    <tr key={s.setorId}>
                      <td>{s.setor}</td>
                      <td className="num">{fmtNum(s.horasDemandadas)}</td>
                      <td className="num">{s.quadroAtual}</td>
                      {LISTA_REGIMES.map((r) => {
                        const n = s.quadroNecessario[r.id];
                        return (
                          <td key={r.id} className="num">
                            {n} {n > s.quadroAtual && <span className="badge alerta">+{n - s.quadroAtual}</span>}
                          </td>
                        );
                      })}
                      <td className="num">
                        {fmtNum(s.capacidade.CLT_44H_6X1)} → {fmtNum(s.capacidade.EC141_40H)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SimulacaoLoja lojaId={l.id} />
          </div>
        );
      })}
      <p className="small muted">
        Mínimo teórico: o maior entre (a) pessoa-hora semanal ÷ horas efetivas por pessoa, (b) pessoas necessárias no dia útil mais
        exigente e (c) pessoas no domingo ÷ fração do quadro que pode trabalhar no domingo pelo rodízio. É uma estimativa para
        planejar; jornadas mais longas (8h24) podem reduzir esse mínimo, mas na prática a escala perde cobertura — por isso
        a simulação é a referência para contratação. Ela ignora férias e afastamentos; some o absenteísmo previsto.
      </p>
    </div>
  );
}
