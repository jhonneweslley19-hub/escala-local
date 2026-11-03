"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Ausencia, Colaborador } from "@/lib/engine/types";
import { NOMES_DIAS, hhmm, parseHHMM } from "@/lib/engine/tempo";
import { api, fmtData } from "@/lib/api";
import { ImportarPlanilha } from "./ImportarPlanilha";

type Opcao = { id: string; nome: string };

export function ColaboradoresView({ lojas, lojaId, setores, colaboradores, gestao }: {
  lojas: Opcao[];
  lojaId?: string;
  setores: Opcao[];
  colaboradores: Colaborador[];
  /** RH/DP ou administrador: exporta os dados do titular (LGPD). */
  gestao: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [editando, setEditando] = useState<Partial<Colaborador> | null>(null);
  const [importando, setImportando] = useState(false);
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const lista = colaboradores.filter(
    (c) => (!setorFiltro || c.setorId === setorFiltro) && c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Colaboradores</h1>
          <p className="muted">{colaboradores.length} colaboradores na loja selecionada.</p>
        </div>
        {lojaId && (
          <div className="row">
            <button onClick={() => setImportando(true)}>Importar planilha</button>
            <button className="primario" onClick={() => setEditando({ setorId: setores[0]?.id, cargaSemanal: 44, diasIndisponiveis: [], ausencias: [] })}>
              Novo colaborador
            </button>
          </div>
        )}
      </div>
      {!lojaId && (
        <div className="card">
          <p>Nenhuma loja cadastrada. <a href="/lojas">Cadastre uma loja</a> para incluir colaboradores.</p>
        </div>
      )}
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={lojaId} onChange={(e) => router.push(`/colaboradores?loja=${e.target.value}`)}>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <select value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Setor</th><th className="num">Carga</th><th>Condições</th><th>Ausências</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{nomeSetor.get(c.setorId)}</td>
                  <td className="num">{c.cargaSemanal}h</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {c.menorDeIdade && <span className="badge alerta">menor de 18</span>}
                      {c.domingoQuinzenal && <span className="badge primario">domingo quinzenal</span>}
                      {c.diasIndisponiveis.length > 0 && <span className="badge">não trabalha {c.diasIndisponiveis.map((d) => NOMES_DIAS[d]).join(", ")}</span>}
                      {(c.disponivelDe != null || c.disponivelAte != null) && (
                        <span className="badge">{hhmm(c.disponivelDe ?? 0)}–{hhmm(c.disponivelAte ?? 1440)}</span>
                      )}
                    </div>
                  </td>
                  <td className="small">{c.ausencias.map((a) => `${a.tipo.toLowerCase()} ${fmtData(a.inicio)}–${fmtData(a.fim)}`).join("; ") || <span className="muted">—</span>}</td>
                  <td className="num">
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <button onClick={() => setEditando(c)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {importando && lojaId && (
        <ImportarPlanilha
          lojaId={lojaId}
          lojaNome={lojas.find((l) => l.id === lojaId)?.nome ?? ""}
          setores={setores}
          onFechar={() => setImportando(false)}
          onImportado={() => router.refresh()}
        />
      )}
      {editando && lojaId && (
        <FormColaborador
          inicial={editando}
          lojaId={lojaId}
          setores={setores}
          gestao={gestao}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function FormColaborador({ inicial, lojaId, setores, gestao, onFechar, onSalvo }: {
  inicial: Partial<Colaborador>;
  lojaId: string;
  setores: Opcao[];
  gestao: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [c, setC] = useState<Partial<Colaborador>>(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Colaborador>(k: K, v: Colaborador[K]) => setC((x) => ({ ...x, [k]: v }));
  const ausencias = c.ausencias ?? [];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await api(c.id ? `/api/colaboradores/${encodeURIComponent(c.id)}` : "/api/colaboradores", c.id ? "PUT" : "POST", { ...c, lojaId });
      onSalvo();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!c.id || !confirm(`Excluir ${c.nome}?`)) return;
    await api(`/api/colaboradores/${encodeURIComponent(c.id)}`, "DELETE");
    onSalvo();
  }

  const setAusencia = (i: number, a: Partial<Ausencia>) => set("ausencias", ausencias.map((x, j) => (j === i ? { ...x, ...a } : x)));

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <form className="modal stack" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <h2>{c.id ? "Editar colaborador" : "Novo colaborador"}</h2>
        <div className="grid g2">
          <label className="campo">Nome<input required value={c.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></label>
          <label className="campo">
            Setor
            <select value={c.setorId} onChange={(e) => set("setorId", e.target.value)}>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label className="campo">Carga semanal contratada (h)<input type="number" min={1} max={44} value={c.cargaSemanal ?? 44} onChange={(e) => set("cargaSemanal", Number(e.target.value))} /></label>
          <label className="campo">Último domingo de folga<input type="date" value={c.ultimoDomingoFolga ?? ""} onChange={(e) => set("ultimoDomingoFolga", e.target.value || undefined)} /></label>
          <label className="campo">Disponível a partir de<input type="time" value={c.disponivelDe != null ? hhmm(c.disponivelDe) : ""} onChange={(e) => set("disponivelDe", e.target.value ? parseHHMM(e.target.value) : undefined)} /></label>
          <label className="campo">Disponível até<input type="time" value={c.disponivelAte != null ? hhmm(c.disponivelAte) : ""} onChange={(e) => set("disponivelAte", e.target.value ? parseHHMM(e.target.value) : undefined)} /></label>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <label className="check"><input type="checkbox" checked={!!c.menorDeIdade} onChange={(e) => set("menorDeIdade", e.target.checked)} /> <span>Menor de 18 anos <span className="muted small">(sem trabalho entre 22h e 5h — CLT art. 404)</span></span></label>
          <label className="check"><input type="checkbox" checked={!!c.domingoQuinzenal} onChange={(e) => set("domingoQuinzenal", e.target.checked)} /> <span>Revezamento quinzenal de domingo <span className="muted small">(CLT art. 386)</span></span></label>
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 4 }}>Dias em que não pode trabalhar</div>
          <div className="row">
            {NOMES_DIAS.map((n, d) => (
              <label key={d} className="check">
                <input
                  type="checkbox"
                  checked={(c.diasIndisponiveis ?? []).includes(d)}
                  onChange={(e) => set("diasIndisponiveis", e.target.checked ? [...(c.diasIndisponiveis ?? []), d] : (c.diasIndisponiveis ?? []).filter((x) => x !== d))}
                />
                {n}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="small muted">Férias e afastamentos</span>
            <span className="spacer" />
            <button type="button" onClick={() => set("ausencias", [...ausencias, { inicio: "", fim: "", tipo: "FERIAS" }])}>Adicionar</button>
          </div>
          {ausencias.map((a, i) => (
            <div className="row" key={i} style={{ marginBottom: 6 }}>
              <select value={a.tipo} onChange={(e) => setAusencia(i, { tipo: e.target.value as Ausencia["tipo"] })}>
                <option value="FERIAS">Férias</option>
                <option value="AFASTAMENTO">Afastamento</option>
                <option value="LICENCA">Licença</option>
                <option value="OUTRO">Outro</option>
              </select>
              <input type="date" value={a.inicio} onChange={(e) => setAusencia(i, { inicio: e.target.value })} />
              <input type="date" value={a.fim} onChange={(e) => setAusencia(i, { fim: e.target.value })} />
              <button type="button" className="perigo" onClick={() => set("ausencias", ausencias.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
        </div>
        {erro && <p className="erro-msg">{erro}</p>}
        <div className="row">
          {c.id && <button type="button" className="perigo" onClick={excluir}>Excluir</button>}
          {c.id && gestao && (
            <a className="btn" href={`/api/colaboradores/${encodeURIComponent(c.id)}/dados`} title="Tudo o que o sistema guarda sobre a pessoa (LGPD, art. 18)">
              Exportar dados (LGPD)
            </a>
          )}
          <span className="spacer" />
          <button type="button" onClick={onFechar}>Cancelar</button>
          <button className="primario" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </div>
  );
}
