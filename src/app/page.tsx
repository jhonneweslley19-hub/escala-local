import Link from "next/link";
import { LISTA_REGIMES, regimeVigente } from "@/lib/engine/regimes";
import { diffDias, toISO } from "@/lib/engine/tempo";
import { dimensionamentoLoja, listarEscalas, listarLojas } from "@/lib/server/repo";
import { fmtData, fmtNum } from "@/lib/api";
import { ehGestao, filtrarPorLoja, podeAlterarEscala, usuarioPagina } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Painel() {
  const u = await usuarioPagina();
  const hoje = toISO(new Date());
  const atual = regimeVigente(hoje);
  const proximo = LISTA_REGIMES.find((r) => r.vigenciaInicio > hoje);
  const lojas = filtrarPorLoja(u, await listarLojas(), (l) => l.id);
  const escalas = filtrarPorLoja(u, await listarEscalas(), (e) => e.lojaId);
  const totalColab = lojas.reduce((t, l) => t + l.colaboradores, 0);
  const impacto = await Promise.all(lojas.map(async (l) => {
    const d = await dimensionamentoLoja(l.id);
    const soma = (k: keyof (typeof d)[number]["capacidade"]) => d.reduce((t, s) => t + s.capacidade[k], 0);
    return { loja: l, h44: soma("CLT_44H_6X1"), h42: soma("EC141_42H"), h40: soma("EC141_40H") };
  }));
  const tot = impacto.reduce((t, i) => ({ h44: t.h44 + i.h44, h42: t.h42 + i.h42, h40: t.h40 + i.h40 }), { h44: 0, h42: 0, h40: 0 });
  const pct = (a: number, b: number) => `${fmtNum(((a - b) / b) * 100, 1)}%`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Painel</h1>
          <p className="muted">{ehGestao(u) ? `Visão geral da rede — ${lojas.length} lojas` : lojas[0]?.nome ?? "Sem loja atribuída"}, {totalColab} colaboradores.</p>
        </div>
        <Link className="btn primario" href="/escalas">{podeAlterarEscala(u) ? "Gerar escala" : "Ver escalas"}</Link>
      </div>


      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Transição da jornada — EC 141/2026 (fim da escala 6x1)</h2>
          <span className="spacer" />
          {proximo && <span className="badge alerta">{diffDias(proximo.vigenciaInicio, hoje)} dias para {proximo.nome.split("—")[1]?.trim()}</span>}
        </div>
        <div className="timeline">
          {LISTA_REGIMES.map((r) => (
            <div key={r.id} className={r.id === atual.id ? "atual" : r.vigenciaInicio > hoje ? "futuro" : ""}>
              <div className="row">
                <strong>{r.nome}</strong>
                {r.id === atual.id && <span className="badge primario">vigente</span>}
              </div>
              <div className="small muted">
                {r.vigenciaInicio > "2000-01-01" ? `a partir de ${fmtData(r.vigenciaInicio)}` : "regra atual"}
                {r.vigenciaFim ? ` até ${fmtData(r.vigenciaFim)}` : ""}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {r.horasSemanaisMax}h/semana · {r.folgasSemanaisMin} folga{r.folgasSemanaisMin > 1 ? "s" : ""}/semana
                {r.preferirFolgaNoDomingo ? " · uma preferencialmente no domingo" : ""}
              </div>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Datas conforme divulgado pelo Senado na promulgação (16/10/2026). Confirme no DOU e no decreto regulamentador do MTE.
          Em todas as fases continuam valendo: folga dominical ao menos 1x a cada 3 semanas no comércio (Lei 10.101/2000), 11h de interjornada e 35h de descanso semanal.
        </p>
      </div>

      <div className="grid g4">
        <div className="card kpi"><div className="rotulo">Colaboradores</div><div className="valor">{fmtNum(totalColab)}</div></div>
        <div className="card kpi"><div className="rotulo">Horas/semana hoje (44h)</div><div className="valor">{fmtNum(tot.h44)}</div><div className="small muted">capacidade do quadro atual</div></div>
        <div className="card kpi"><div className="rotulo">Horas/semana em 40h</div><div className="valor">{fmtNum(tot.h40)}</div><div className="small muted">{pct(tot.h40, tot.h44)} com o mesmo quadro</div></div>
        <div className="card kpi"><div className="rotulo">Escalas geradas</div><div className="valor">{escalas.length}</div></div>
      </div>

      <div className="card">
        <h2>Lojas</h2>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Loja</th><th className="num">Colaboradores</th><th className="num">Horas/sem. 44h</th><th className="num">42h</th><th className="num">40h</th>
                <th>Última escala</th><th className="num">Cobertura</th><th>Conformidade</th>
              </tr>
            </thead>
            <tbody>
              {impacto.map(({ loja, h44, h42, h40 }) => {
                const e = escalas.find((x) => x.lojaId === loja.id);
                return (
                  <tr key={loja.id}>
                    <td><Link href={`/lojas/${loja.id}`}>{loja.nome}</Link></td>
                    <td className="num">{loja.colaboradores}</td>
                    <td className="num">{fmtNum(h44)}</td>
                    <td className="num">{fmtNum(h42)} <span className="small muted">{pct(h42, h44)}</span></td>
                    <td className="num">{fmtNum(h40)} <span className="small muted">{pct(h40, h44)}</span></td>
                    <td>{e ? <Link href={`/escalas/${e.id}`}>{fmtData(e.inicio)} · {e.semanas} sem.</Link> : <span className="muted">—</span>}</td>
                    <td className="num">{e ? `${fmtNum(e.metricas.coberturaPct, 1)}%` : "—"}</td>
                    <td>{e ? e.metricas.erros ? <span className="badge erro">{e.metricas.erros} violações</span> : <span className="badge ok">Conforme</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Horas disponíveis por semana com o quadro atual (descontado o absenteísmo). Para saber quantas contratações manter a cobertura exige,
          use a simulação em <Link href="/dimensionamento">Dimensionamento</Link>.
        </p>
      </div>
    </div>
  );
}
