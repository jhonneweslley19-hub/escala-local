"use client";
import { useState } from "react";
import type { SimulacaoSetor } from "@/lib/engine/dimensionamento";
import { LISTA_REGIMES } from "@/lib/engine/regimes";
import { api, fmtNum } from "@/lib/api";

export function SimulacaoLoja({ lojaId }: { lojaId: string }) {
  const [dados, setDados] = useState<SimulacaoSetor[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");

  async function simular() {
    setRodando(true);
    setErro("");
    try {
      setDados(await api<SimulacaoSetor[]>(`/api/dimensionamento?loja=${encodeURIComponent(lojaId)}&simular=1`));
    } catch (e) {
      setErro((e as Error).message);
    }
    setRodando(false);
  }

  if (!dados) {
    return (
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primario" onClick={simular} disabled={rodando}>{rodando ? "Simulando escalas…" : "Simular com o motor de escalas"}</button>
        <span className="small muted">Gera escalas de 3 semanas em cada regime e calcula quantas pessoas faltam para manter a cobertura de hoje.</span>
        {erro && <span className="erro-msg">{erro}</span>}
      </div>
    );
  }
  const total = (f: (s: SimulacaoSetor) => number) => dados.reduce((t, s) => t + f(s), 0);
  return (
    <div style={{ marginTop: 14 }}>
      <h3>Simulação com o motor</h3>
      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Setor</th><th className="num">Quadro atual</th>
              {LISTA_REGIMES.map((r) => <th key={r.id} className="num">Cobertura {r.horasSemanaisMax}h</th>)}
              {LISTA_REGIMES.slice(1).map((r) => <th key={r.id} className="num">Quadro p/ manter ({r.horasSemanaisMax}h)</th>)}
            </tr>
          </thead>
          <tbody>
            {dados.map((s) => (
              <tr key={s.setorId}>
                <td>{s.setor}</td>
                <td className="num">{s.quadroAtual}</td>
                {LISTA_REGIMES.map((r) => <td key={r.id} className="num">{fmtNum(s.cobertura[r.id], 1)}%</td>)}
                {LISTA_REGIMES.slice(1).map((r) => {
                  const d = s.quadroParaManter[r.id] - s.quadroAtual;
                  return <td key={r.id} className="num">{s.quadroParaManter[r.id]} {d > 0 && <span className="badge alerta">+{d}</span>}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td><strong>Total</strong></td>
              <td className="num"><strong>{total((s) => s.quadroAtual)}</strong></td>
              {LISTA_REGIMES.map((r) => <td key={r.id} />)}
              {LISTA_REGIMES.slice(1).map((r) => {
                const d = total((s) => s.quadroParaManter[r.id] - s.quadroAtual);
                return <td key={r.id} className="num"><strong>{total((s) => s.quadroParaManter[r.id])}</strong> {d > 0 && <span className="badge alerta">+{d}</span>}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
