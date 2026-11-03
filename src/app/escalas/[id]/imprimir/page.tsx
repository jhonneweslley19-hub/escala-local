import Link from "next/link";
import { notFound } from "next/navigation";
import { minutosTrabalhados } from "@/lib/engine/cobertura";
import { REGIMES } from "@/lib/engine/regimes";
import { NOMES_DIAS, diaSemana, hhmm } from "@/lib/engine/tempo";
import type { Colaborador, DiaEscala } from "@/lib/engine/types";
import { podeVerLoja, usuarioPagina } from "@/lib/server/auth";
import { obterEmpresa, obterEscala, obterLoja } from "@/lib/server/repo";
import { registrarUsuario } from "@/lib/server/registro";
import { rotuloAusencia } from "@/lib/engine/ausencia";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { fmtData, fmtNum } from "@/lib/api";

export const dynamic = "force-dynamic";

/** O mural fica exposto na loja: afastamento e licença saem só como "AUSENTE" (LGPD). */
function texto(d: DiaEscala): string {
  if (d.tipo === "T") return `${hhmm(d.inicio!)}–${hhmm(d.fim!)}`;
  if (d.tipo === "F") return "FOLGA";
  return rotuloAusencia(d.motivo, false).toUpperCase();
}

function intervalo(d: DiaEscala): string {
  return d.tipo === "T" && d.intervalo && d.intervaloInicio != null
    ? `int. ${hhmm(d.intervaloInicio)}–${hhmm(d.intervaloInicio + d.intervalo)}`
    : "";
}

export default async function Imprimir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string; setor?: string }>;
}) {
  const u = await usuarioPagina();
  const { id } = await params;
  const { modo = "setor", setor: setorFiltro } = await searchParams;
  const e = await obterEscala(id);
  if (!e || !podeVerLoja(u, e.lojaId)) notFound();
  const loja = await obterLoja(e.lojaId);
  await registrarUsuario(u, "IMPRIMIR_ESCALA", `${loja?.nome ?? e.lojaId} — escala de ${fmtData(e.entrada.inicio)} (${modo === "individual" ? "folhas individuais" : "por setor"})`, e.lojaId);
  const empresa = (await obterEmpresa()).nome;
  const { escala } = e.resultado;
  const datas = escala.dias[e.entrada.colaboradores[0]?.id]?.map((d) => d.data) ?? [];
  const feriados = new Map(e.entrada.feriados.map((f) => [f.data, f.nome]));
  const setores = e.entrada.setores.filter((s) => !setorFiltro || s.id === setorFiltro);
  const porSetor = (sid: string) => e.entrada.colaboradores.filter((c) => c.setorId === sid).sort((a, b) => a.nome.localeCompare(b.nome));
  const rascunho = e.status !== "PUBLICADA";
  const url = (q: Record<string, string | undefined>) =>
    `/escalas/${id}/imprimir?${new URLSearchParams(Object.entries({ modo, setor: setorFiltro, ...q }).filter(([, v]) => v) as [string, string][])}`;

  const cabecalho = (titulo: string) => (
    <div className="imp-cab">
      <div>
        <strong>{empresa}</strong> · {loja?.nome}
        <div className="imp-titulo">{titulo}</div>
      </div>
      <div className="imp-dir">
        {fmtData(datas[0])} a {fmtData(datas[datas.length - 1])}
        <div>{[...new Set(escala.regimes)].map((r) => REGIMES[r].nome).join(" → ")}</div>
        {rascunho ? <div className="imp-rascunho">RASCUNHO — NÃO OFICIAL</div> : <div>Publicada em {fmtData(e.publicadoEm!.slice(0, 10))} por {e.publicadoPor}</div>}
      </div>
    </div>
  );

  return (
    <div className="imprimir">
      <style>{`@page { size: A4 ${modo === "setor" ? "landscape" : "portrait"}; margin: 9mm; }`}</style>
      <div className="nao-imprimir card row" style={{ marginBottom: 16 }}>
        <Link href={`/escalas/${id}`}>← Voltar à escala</Link>
        <span className="spacer" />
        <span className="small muted">Formato:</span>
        <Link className={`btn ${modo === "setor" ? "primario" : ""}`} href={url({ modo: "setor" })}>Mural por setor</Link>
        <Link className={`btn ${modo === "individual" ? "primario" : ""}`} href={url({ modo: "individual" })}>Individual por colaborador</Link>
        <select defaultValue={setorFiltro ?? ""} aria-label="Setor" data-nav="1">
          <option value="">Todos os setores</option>
          {e.entrada.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <BotaoImprimir urlBase={url({ setor: undefined })} />
      </div>
      {rascunho && <p className="nao-imprimir aviso-demo">Esta escala ainda é um rascunho. Publique-a antes de afixar no mural.</p>}

      {modo === "setor"
        ? setores.map((s) =>
            Array.from({ length: escala.semanas }, (_, w) => {
              const dias = datas.slice(w * 7, w * 7 + 7);
              const cols = porSetor(s.id);
              if (!cols.length) return null;
              return (
                <section key={`${s.id}-${w}`} className="imp-pagina">
                  {cabecalho(`${s.nome} — semana de ${fmtData(dias[0])} a ${fmtData(dias[6])}`)}
                  <table className="imp-tabela">
                    <thead>
                      <tr>
                        <th style={{ width: "19%" }}>Colaborador</th>
                        {dias.map((d) => (
                          <th key={d} className={diaSemana(d) === 6 ? "imp-dom" : ""}>
                            {NOMES_DIAS[diaSemana(d)]} {d.slice(8)}/{d.slice(5, 7)}
                            {feriados.has(d) && <div className="imp-fer">{feriados.get(d)}</div>}
                          </th>
                        ))}
                        <th style={{ width: "6%" }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cols.map((c) => {
                        const sem = (escala.dias[c.id] ?? []).slice(w * 7, w * 7 + 7);
                        return (
                          <tr key={c.id}>
                            <td className="imp-nome">{c.nome}</td>
                            {sem.map((d) => (
                              <td key={d.data} className={`imp-${d.tipo} ${diaSemana(d.data) === 6 ? "imp-dom" : ""}`}>
                                <div>{texto(d)}</div>
                                <div className="imp-int">{intervalo(d)}</div>
                              </td>
                            ))}
                            <td className="imp-horas">{fmtNum(sem.reduce((t, d) => t + minutosTrabalhados(d), 0) / 60, 1)}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Rodape />
                </section>
              );
            }),
          )
        : setores.flatMap((s) => porSetor(s.id).map((c) => <Individual key={c.id} c={c} setor={s.nome} dias={escala.dias[c.id] ?? []} feriados={feriados} cabecalho={cabecalho} />))}
    </div>
  );
}

function Individual({
  c,
  setor,
  dias,
  feriados,
  cabecalho,
}: {
  c: Colaborador;
  setor: string;
  dias: DiaEscala[];
  feriados: Map<string, string>;
  cabecalho: (t: string) => React.ReactNode;
}) {
  const horas = dias.reduce((t, d) => t + minutosTrabalhados(d), 0) / 60;
  return (
    <section className="imp-individual">
      {cabecalho(`${c.nome} — ${setor}`)}
      <table className="imp-tabela">
        <thead>
          <tr><th>Data</th><th>Dia</th><th>Horário</th><th>Intervalo</th><th>Observação</th></tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.data} className={diaSemana(d.data) === 6 ? "imp-dom" : ""}>
              <td>{fmtData(d.data)}</td>
              <td>{NOMES_DIAS[diaSemana(d.data)]}</td>
              <td className={`imp-${d.tipo}`}>{texto(d)}</td>
              <td>{intervalo(d).replace("int. ", "")}</td>
              <td>{feriados.get(d.data) ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="imp-assinatura">
        <span>Total no período: {fmtNum(horas, 1)}h</span>
        <span>Ciente: ____________________________ Data: ___/___/_____</span>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <div className="imp-rodape">
      FOLGA = descanso semanal remunerado. Intervalo de refeição indicado abaixo do horário. Dúvidas ou trocas: procure a liderança do setor.
    </div>
  );
}
