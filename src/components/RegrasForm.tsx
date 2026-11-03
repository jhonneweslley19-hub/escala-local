"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RegrasEmpresa } from "@/lib/engine/types";
import type { FeriadoLoja } from "@/lib/server/repo";
import { api, fmtData } from "@/lib/api";

const OPCOES: { k: keyof RegrasEmpresa; titulo: string; desc: string }[] = [
  { k: "acordoCompensacao", titulo: "Acordo de compensação de jornada", desc: "Permite jornada diária acima de 8h (até 10h) — ex.: 8h24 no regime de 42h em 5 dias. Sem ele, o dia fica limitado a 8h." },
  { k: "feriadoExigeCCT", titulo: "Feriados exigem autorização em CCT", desc: "Portaria MTE 3.665/2023: o trabalho em feriados no comércio depende de convenção coletiva." },
  { k: "feriadosAutorizadosCCT", titulo: "A CCT vigente autoriza trabalho em feriados", desc: "Se desmarcado, qualquer turno em feriado é apontado como violação." },
  { k: "folgasConsecutivasPreferidas", titulo: "Preferir folgas em dias seguidos", desc: "No regime de 2 folgas, tenta juntá-las (ex.: domingo + segunda)." },
];

export function RegrasForm({ regras, feriados, lojas }: { regras: RegrasEmpresa; feriados: FeriadoLoja[]; lojas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [r, setR] = useState(regras);
  const [lista, setLista] = useState(feriados);
  const [novo, setNovo] = useState({ data: "", nome: "", lojaId: "" });
  const nomeLoja = new Map(lojas.map((l) => [l.id, l.nome]));
  const [msg, setMsg] = useState("");

  async function salvar(p: Partial<RegrasEmpresa>) {
    const nova = { ...r, ...p };
    setR(nova);
    try {
      await api("/api/regras", "PUT", nova);
      setMsg("Configurações salvas. Valem para as próximas escalas geradas.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function addFeriado(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLista(await api<FeriadoLoja[]>("/api/feriados", "POST", novo));
      setNovo({ ...novo, data: "", nome: "" });
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="grid g2">
      <div className="card stack">
        <h2>Empresa e convenção coletiva</h2>
        {OPCOES.map((o) => (
          <label className="check" key={o.k}>
            <input type="checkbox" checked={Boolean(r[o.k])} onChange={(e) => salvar({ [o.k]: e.target.checked })} />
            <span><strong>{o.titulo}</strong><br /><span className="small muted">{o.desc}</span></span>
          </label>
        ))}
        <label className="campo">
          Intervalo de almoço (jornadas acima de 6h)
          <select value={r.intervaloMaximo ?? 60} onChange={(e) => salvar({ intervaloMaximo: Number(e.target.value) })} style={{ maxWidth: 360 }}>
            <option value={60}>Sempre 1h (mínimo legal)</option>
            <option value={90}>De 1h a 1h30, quando melhorar a cobertura</option>
            <option value={120}>De 1h a 2h, quando melhorar a cobertura</option>
          </select>
          <span className="small muted">
            A CLT permite intervalo de 1h a 2h sem acordo (art. 71). Um intervalo maior no vale da tarde deixa a mesma pessoa cobrir o pico do
            almoço e o da noite. O motor só alonga o intervalo quando isso cobre mais demanda. Confira a convenção coletiva e combine com a equipe.
          </span>
        </label>
        <label className="campo" style={{ maxWidth: 220 }}>
          Absenteísmo previsto (%)
          <input type="number" min={0} max={40} value={Math.round(r.absenteismo * 100)} onChange={(e) => salvar({ absenteismo: Number(e.target.value) / 100 })} />
        </label>
        {msg && <p className="small muted">{msg}</p>}
      </div>
      <div className="card">
        <h2>Feriados</h2>
        <form className="row" onSubmit={addFeriado} style={{ marginBottom: 12 }}>
          <input type="date" required value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} />
          <input placeholder="Nome" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <select value={novo.lojaId} onChange={(e) => setNovo({ ...novo, lojaId: e.target.value })} aria-label="Abrangência">
            <option value="">Todas as lojas</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>Só {l.nome}</option>)}
          </select>
          <button>Adicionar</button>
        </form>
        <div className="tabela-wrap" style={{ maxHeight: 300 }}>
          <table>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td>{fmtData(f.data)}</td>
                  <td>{f.nome}</td>
                  <td>{f.lojaId ? <span className="badge">{nomeLoja.get(f.lojaId) ?? f.lojaId}</span> : <span className="badge primario">Todas as lojas</span>}</td>
                  <td className="num">
                    <button className="perigo" onClick={async () => setLista(await api<FeriadoLoja[]>(`/api/feriados?id=${f.id}`, "DELETE"))}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Nacionais e estaduais valem para todas as lojas; cadastre os municipais só na loja da cidade correspondente.</p>
      </div>
    </div>
  );
}
