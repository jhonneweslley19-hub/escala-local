"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EscalaSalva, EventoEscala, StatusEscala } from "@/lib/server/repo";
import type { Colaborador, DiaEscala, ResultadoEscala, Violacao } from "@/lib/engine/types";
import { REGIMES, intervaloMinimo } from "@/lib/engine/regimes";
import { minutosTrabalhados } from "@/lib/engine/cobertura";
import { NOMES_DIAS, diaSemana, hhmm, parseHHMM } from "@/lib/engine/tempo";
import { api, fmtData, fmtNum } from "@/lib/api";

const ROTULO_AUSENCIA: Record<string, string> = { FERIAS: "FÉR", AFASTAMENTO: "AFA", LICENCA: "LIC", OUTRO: "AUS" };
/** Afastamento e licença podem revelar dado de saúde: para o gerente aparecem só como ausência (LGPD). */
const rotuloCurto = (motivo: string | undefined, detalhar: boolean) =>
  motivo === "FERIAS" || detalhar ? ROTULO_AUSENCIA[motivo ?? "OUTRO"] ?? "AUS" : "AUS";

export function EscalaView({ salva, lojaNome, eventosIniciais, podeAlterar }: {
  salva: EscalaSalva;
  lojaNome: string;
  eventosIniciais: EventoEscala[];
  /** Só o RH/DP altera a escala; os gerentes consultam. */
  podeAlterar: boolean;
}) {
  const router = useRouter();
  const { entrada } = salva;
  const [resultado, setResultado] = useState<ResultadoEscala>(salva.resultado);
  const [setorId, setSetorId] = useState(entrada.setores[0]?.id ?? "");
  const [editando, setEditando] = useState<{ c: Colaborador; dia: DiaEscala } | null>(null);
  const [filtro, setFiltro] = useState<"erro" | "alerta" | "todos">("erro");
  const [status, setStatus] = useState<{ status: StatusEscala; publicadoEm: string | null; publicadoPor: string | null }>({
    status: salva.status, publicadoEm: salva.publicadoEm, publicadoPor: salva.publicadoPor,
  });
  const [eventos, setEventos] = useState(eventosIniciais);
  const [aviso, setAviso] = useState("");
  const publicada = status.status === "PUBLICADA";

  const { escala, metricas, violacoes, cobertura } = resultado;
  const datas = escala.dias[entrada.colaboradores[0]?.id]?.map((d) => d.data) ?? [];
  const feriados = new Map(entrada.feriados.map((f) => [f.data, f.nome]));
  const colabs = entrada.colaboradores.filter((c) => c.setorId === setorId);
  const nomes = new Map(entrada.colaboradores.map((c) => [c.id, c.nome]));
  const setor = entrada.setores.find((s) => s.id === setorId);

  const violPorCelula = useMemo(() => {
    const m = new Map<string, Violacao[]>();
    for (const v of violacoes) {
      if (!v.colaboradorId || !v.data) continue;
      const k = `${v.colaboradorId}|${v.data}`;
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    return m;
  }, [violacoes]);

  const errosPorSetor = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of violacoes) if (v.severidade === "erro" && v.setorId) m.set(v.setorId, (m.get(v.setorId) ?? 0) + 1);
    return m;
  }, [violacoes]);

  const lista = violacoes.filter((v) => v.setorId === setorId && (filtro === "todos" || v.severidade === filtro));

  async function salvarDia(colaboradorId: string, dia: DiaEscala) {
    const r = await api<{ resultado: ResultadoEscala; eventos: EventoEscala[] }>(`/api/escalas/${salva.id}`, "PATCH", { colaboradorId, dia });
    setResultado(r.resultado);
    setEventos(r.eventos);
    setEditando(null);
    router.refresh();
  }

  async function mudarStatus(acao: "publicar" | "reabrir") {
    setAviso("");
    let motivo: string | null = null;
    if (acao === "reabrir") {
      motivo = prompt("Motivo da reabertura (fica registrado no histórico):");
      if (!motivo) return;
    }
    try {
      const r = await api<typeof status & { eventos: EventoEscala[] }>(`/api/escalas/${salva.id}`, "POST", { acao, motivo });
      setStatus({ status: r.status, publicadoEm: r.publicadoEm, publicadoPor: r.publicadoPor });
      setEventos(r.eventos);
      router.refresh();
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  async function excluir() {
    if (!confirm("Excluir esta escala?")) return;
    await api(`/api/escalas/${salva.id}`, "DELETE");
    router.push("/escalas");
    router.refresh();
  }

  const regimesUnicos = [...new Set(escala.regimes)];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1>{lojaNome}</h1>
            {publicada ? <span className="badge ok">Publicada</span> : <span className="badge alerta">Rascunho</span>}
          </div>
          <p className="muted">
            {fmtData(datas[0])} a {fmtData(datas[datas.length - 1])} · {escala.semanas} semana{escala.semanas > 1 ? "s" : ""} ·{" "}
            {regimesUnicos.map((r) => REGIMES[r].nome).join(" → ")}
          </p>
        </div>
        <div className="row">
          {podeAlterar && (publicada ? (
            <button onClick={() => mudarStatus("reabrir")}>Reabrir para edição</button>
          ) : (
            <button className="primario" onClick={() => mudarStatus("publicar")}>Publicar escala</button>
          ))}
          <a className="btn" href={`/api/escalas/${salva.id}/csv`}>Exportar CSV</a>
          <a className="btn" href={`/escalas/${salva.id}/imprimir`}>Imprimir para o mural</a>
          {podeAlterar && !publicada && <button className="perigo" onClick={excluir}>Excluir</button>}
        </div>
      </div>
      {aviso && <div className="card erro-msg">{aviso}</div>}
      {publicada && (
        <div className="aviso-ok">
          Publicada em {new Date(status.publicadoEm!).toLocaleString("pt-BR")} por <strong>{status.publicadoPor}</strong>. A escala está travada;
          {podeAlterar ? " para alterar, reabra-a informando o motivo." : " alterações são feitas pelo RH/DP."}
        </div>
      )}
      {!podeAlterar && !publicada && <div className="aviso-demo" style={{ margin: 0 }}>Rascunho em preparação pelo RH/DP: ainda não é a escala oficial.</div>}

      <div className="grid g4">
        <div className="card kpi">
          <div className="rotulo">Conformidade legal</div>
          <div className="valor">{metricas.erros ? <span style={{ color: "var(--danger)" }}>{metricas.erros}</span> : <span style={{ color: "var(--ok)" }}>OK</span>}</div>
          <div className="small muted">{metricas.erros ? "violações a corrigir" : "nenhuma violação"} · {metricas.alertas} alertas</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">Cobertura da demanda</div>
          <div className="valor">{fmtNum(metricas.coberturaPct, 1)}%</div>
          <div className="small muted">{fmtNum(metricas.horasFaltantes)} pessoa-hora faltando</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">Excesso de pessoal</div>
          <div className="valor">{fmtNum(metricas.horasExcedentes)}</div>
          <div className="small muted">pessoa-hora acima da demanda</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">Folga no domingo</div>
          <div className="valor">{fmtNum(metricas.folgaDominicalPct)}%</div>
          <div className="small muted">das semanas por colaborador</div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          {entrada.setores.map((s) => (
            <button key={s.id} className={s.id === setorId ? "ativo" : ""} onClick={() => setSetorId(s.id)}>
              {s.nome} {errosPorSetor.get(s.id) ? <span className="badge erro">{errosPorSetor.get(s.id)}</span> : null}
            </button>
          ))}
        </div>
        <div className="legenda" style={{ marginBottom: 10 }}>
          <span style={{ ["--c" as string]: "var(--surface-2)" }}>Trabalho (entrada/saída)</span>
          <span style={{ ["--c" as string]: "var(--folga)" }}>Folga</span>
          <span style={{ ["--c" as string]: "var(--ausencia)" }}>Férias/afastamento</span>
          <span style={{ ["--c" as string]: "var(--danger)" }}>Violação</span>
          <span className="muted">
            {!podeAlterar ? "Somente leitura: alterações são feitas pelo RH/DP." : publicada ? "Escala publicada (somente leitura)." : "Clique em um dia para editar."}
          </span>
        </div>
        <div className="tabela-wrap" style={{ maxHeight: "65vh" }}>
          <table className="grade">
            <thead>
              <tr>
                <th className="nome">Colaborador</th>
                {datas.map((d, i) => {
                  const dom = diaSemana(d) === 6;
                  return (
                    <th key={d} className={`${dom ? "dom" : ""} ${feriados.has(d) ? "fer" : ""} ${i % 7 === 0 && i ? "semana" : ""}`} title={feriados.get(d)}>
                      {NOMES_DIAS[diaSemana(d)]}
                      <br />
                      {d.slice(8)}/{d.slice(5, 7)}
                      {feriados.has(d) ? " ★" : ""}
                    </th>
                  );
                })}
                <th>h/sem</th>
              </tr>
            </thead>
            <tbody>
              {colabs.map((c) => {
                const dias = escala.dias[c.id] ?? [];
                const horas = dias.reduce((t, d) => t + minutosTrabalhados(d), 0) / 60 / escala.semanas;
                return (
                  <tr key={c.id}>
                    <td className="nome">
                      {c.nome}
                      <div className="small muted">
                        {c.cargaSemanal}h{c.menorDeIdade ? " · menor" : ""}{c.domingoQuinzenal ? " · dom. quinzenal" : ""}
                      </div>
                    </td>
                    {dias.map((d, i) => {
                      const v = violPorCelula.get(`${c.id}|${d.data}`)?.filter((x) => x.severidade === "erro");
                      const dom = diaSemana(d.data) === 6;
                      return (
                        <td key={d.data} className={`${dom ? "dom" : ""} ${i % 7 === 0 && i ? "semana" : ""}`}>
                          <button
                            className={`cel ${d.tipo} ${v?.length ? "viol" : ""}`}
                            title={v?.map((x) => x.mensagem).join("\n") || undefined}
                            onClick={() =>
                              !podeAlterar ? setAviso("Só o RH/DP pode alterar a escala.")
                              : publicada ? setAviso("Escala publicada: reabra-a para editar.")
                              : setEditando({ c, dia: d })
                            }
                          >
                            {d.tipo === "T" ? (
                              <>
                                {hhmm(d.inicio!)}
                                <br />
                                {hhmm(d.fim!)}
                              </>
                            ) : d.tipo === "F" ? (
                              "F"
                            ) : (
                              rotuloCurto(d.motivo, podeAlterar)
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="small" style={{ padding: "0 8px" }}>{fmtNum(horas, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {setor && <MapaCobertura cobertura={cobertura.filter((c) => c.setorId === setorId)} />}

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Validação — {setor?.nome}</h2>
          <span className="spacer" />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="erro">Só violações legais</option>
            <option value="alerta">Só alertas</option>
            <option value="todos">Tudo</option>
          </select>
        </div>
        {lista.length === 0 ? (
          <p className="muted">{filtro === "erro" ? "Nenhuma violação legal neste setor." : "Nada a mostrar."}</p>
        ) : (
          <div className="tabela-wrap" style={{ maxHeight: 360 }}>
            <table>
              <thead>
                <tr><th>Data</th><th>Colaborador</th><th>Regra</th><th>Detalhe</th></tr>
              </thead>
              <tbody>
                {lista.map((v, i) => (
                  <tr key={i}>
                    <td>{v.data ? fmtData(v.data) : "—"}</td>
                    <td>{v.colaboradorId ? nomes.get(v.colaboradorId) : "—"}</td>
                    <td><span className={`badge ${v.severidade}`}>{v.regra.replace(/_/g, " ").toLowerCase()}</span></td>
                    <td>{v.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Historico eventos={eventos} />

      {editando && (
        <EditarDia
          colaborador={editando.c}
          dia={editando.dia}
          inicios={setor?.inicios ?? []}
          violacoes={violPorCelula.get(`${editando.c.id}|${editando.dia.data}`) ?? []}
          onFechar={() => setEditando(null)}
          onSalvar={(d) => salvarDia(editando.c.id, d)}
        />
      )}
    </div>
  );
}

function MapaCobertura({ cobertura }: { cobertura: ResultadoEscala["cobertura"] }) {
  const horas = Array.from({ length: 24 }, (_, h) => h).filter((h) => cobertura.some((c) => c.necessario[h] > 0 || c.alocado[h] > 0.05));
  const cor = (nec: number, alo: number) => {
    if (!nec && !alo) return "transparent";
    const r = nec ? alo / nec : 2;
    if (r < 0.75) return "var(--danger-soft)";
    if (r < 0.98) return "var(--warn-soft)";
    if (r <= 1.4) return "var(--ok-soft)";
    return "var(--folga)";
  };
  return (
    <div className="card">
      <h2>Cobertura por hora (alocado / necessário)</h2>
      <div className="legenda" style={{ marginBottom: 10 }}>
        <span style={{ ["--c" as string]: "var(--danger-soft)" }}>&lt; 75%</span>
        <span style={{ ["--c" as string]: "var(--warn-soft)" }}>75–98%</span>
        <span style={{ ["--c" as string]: "var(--ok-soft)" }}>adequado</span>
        <span style={{ ["--c" as string]: "var(--folga)" }}>&gt; 140% (sobra)</span>
      </div>
      <div className="tabela-wrap">
        <div className="heat" style={{ gridTemplateColumns: `44px repeat(${cobertura.length}, minmax(38px, 1fr))` }}>
          <div />
          {cobertura.map((c) => (
            <div key={c.data} className="muted" style={{ fontWeight: diaSemana(c.data) === 6 ? 700 : 400 }}>
              {NOMES_DIAS[diaSemana(c.data)].slice(0, 1)} {c.data.slice(8)}
            </div>
          ))}
          {horas.map((h) => (
            <Linha key={h} h={h} cobertura={cobertura} cor={cor} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Linha({ h, cobertura, cor }: { h: number; cobertura: ResultadoEscala["cobertura"]; cor: (n: number, a: number) => string }) {
  return (
    <>
      <div className="muted">{String(h).padStart(2, "0")}h</div>
      {cobertura.map((c) => (
        <div key={c.data} style={{ background: cor(c.necessario[h], c.alocado[h]) }} title={`${fmtData(c.data)} ${h}h — alocado ${fmtNum(c.alocado[h], 1)} / necessário ${c.necessario[h]}`}>
          {c.necessario[h] || c.alocado[h] > 0.05 ? `${fmtNum(c.alocado[h], 0)}/${c.necessario[h]}` : ""}
        </div>
      ))}
    </>
  );
}

function EditarDia({
  colaborador,
  dia,
  inicios,
  violacoes,
  onFechar,
  onSalvar,
}: {
  colaborador: Colaborador;
  dia: DiaEscala;
  inicios: number[];
  violacoes: Violacao[];
  onFechar: () => void;
  onSalvar: (d: DiaEscala) => Promise<void>;
}) {
  const trabalhoPadrao = dia.tipo === "T" ? minutosTrabalhados(dia) : 440;
  const [tipo, setTipo] = useState<"T" | "F">(dia.tipo === "A" ? "F" : dia.tipo);
  const [inicio, setInicio] = useState(hhmm(dia.inicio ?? inicios[0] ?? 480));
  const [duracao, setDuracao] = useState(hhmm(trabalhoPadrao));
  const [intervalo, setIntervalo] = useState(dia.intervalo ?? intervaloMinimo(trabalhoPadrao));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const ini = parseHHMM(inicio);
  const trab = parseHHMM(duracao);
  const fim = ini + trab + intervalo;
  const hora = /^([01]?\d|2[0-3]):[0-5]\d$/;
  const duracaoValida = hora.test(inicio) && /^\d{1,2}:[0-5]\d$/.test(duracao) && trab > 0 && trab <= 720;

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await onSalvar(tipo === "T" ? { data: dia.data, tipo, inicio: ini, fim, intervalo } : { data: dia.data, tipo });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{colaborador.nome}</h2>
        <p className="muted">{NOMES_DIAS[diaSemana(dia.data)]}, {fmtData(dia.data)}{dia.tipo === "A" ? ` — ausência (${dia.motivo})` : ""}</p>
        {violacoes.length > 0 && (
          <div className="stack" style={{ margin: "12px 0" }}>
            {violacoes.map((v, i) => (
              <div key={i} className={`badge ${v.severidade}`} style={{ whiteSpace: "normal", display: "block" }}>{v.mensagem}</div>
            ))}
          </div>
        )}
        <div className="row" style={{ margin: "12px 0" }}>
          <label className="check"><input type="radio" checked={tipo === "T"} onChange={() => setTipo("T")} /> Trabalho</label>
          <label className="check"><input type="radio" checked={tipo === "F"} onChange={() => setTipo("F")} /> Folga</label>
        </div>
        {tipo === "T" && (
          <div className="grid g3">
            <label className="campo">
              Entrada
              <input inputMode="numeric" placeholder="hh:mm" value={inicio} onChange={(e) => setInicio(e.target.value)} list="inicios-setor" />
              <datalist id="inicios-setor">{inicios.map((m) => <option key={m} value={hhmm(m)} />)}</datalist>
            </label>
            <label className="campo">
              Horas de trabalho
              <input
                inputMode="numeric"
                placeholder="hh:mm"
                value={duracao}
                onChange={(e) => {
                  setDuracao(e.target.value);
                  const m = parseHHMM(e.target.value);
                  if (Number.isFinite(m)) setIntervalo(intervaloMinimo(m));
                }}
              />
            </label>
            <label className="campo">
              Intervalo (min)
              <input type="number" min={0} max={240} step={15} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
            </label>
          </div>
        )}
        {tipo === "T" && !duracaoValida && <p className="erro-msg">Informe entrada e horas de trabalho no formato hh:mm (ex.: 07:00 e 08:00).</p>}
        {tipo === "T" && duracaoValida && <p className="small muted" style={{ marginTop: 8 }}>Saída às {hhmm(fim)}{fim > 1440 ? " (dia seguinte)" : ""}. A escala é revalidada ao salvar.</p>}
        {erro && <p className="erro-msg">{erro}</p>}
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onFechar}>Cancelar</button>
          <button className="primario" onClick={salvar} disabled={salvando || (tipo === "T" && !duracaoValida)}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

const ACOES: Record<EventoEscala["acao"], string> = { GERADA: "Gerada", EDITADA: "Alterada", PUBLICADA: "Publicada", REABERTA: "Reaberta" };

function descrever(e: EventoEscala): string {
  const d = e.detalhe ?? {};
  switch (e.acao) {
    case "GERADA":
      return `${d.colaboradores} colaboradores; ${d.comHistorico ? `continua a escala anterior para ${d.comHistorico} deles` : "sem escala anterior (rodízio a partir do cadastro)"}; ${d.erros ? `${d.erros} violações` : "sem violações"}.`;
    case "EDITADA":
      return `${d.colaborador} em ${fmtData(String(d.data))}: ${d.antes} → ${d.depois}${d.erros ? ` (${d.erros} violações na escala)` : ""}.`;
    case "REABERTA":
      return `Motivo: ${d.motivo}`;
    default:
      return "";
  }
}

function Historico({ eventos }: { eventos: EventoEscala[] }) {
  return (
    <div className="card">
      <h2>Histórico de alterações</h2>
      {eventos.length === 0 ? (
        <p className="muted">Sem registros.</p>
      ) : (
        <div className="tabela-wrap" style={{ maxHeight: 320 }}>
          <table>
            <thead>
              <tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{new Date(e.quando).toLocaleString("pt-BR")}</td>
                  <td>{e.usuario}</td>
                  <td><span className={`badge ${e.acao === "PUBLICADA" ? "ok" : e.acao === "REABERTA" ? "alerta" : ""}`}>{ACOES[e.acao] ?? e.acao}</span></td>
                  <td>{descrever(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
