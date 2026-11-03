"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Setor } from "@/lib/engine/types";
import { NOMES_DIAS, hhmm, parseHHMM } from "@/lib/engine/tempo";
import { api, fmtNum } from "@/lib/api";
import { ImportarERP } from "./ImportarERP";

export function DemandaEditor({ setor, quadro, feriados }: { setor: Setor; quadro: number; feriados: string[] }) {
  const router = useRouter();
  const [demanda, setDemanda] = useState(setor.demanda);
  const [inicios, setInicios] = useState(setor.inicios.map(hhmm).join(", "));
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | string>("");
  const [aberto, setAberto] = useState(false);
  const [importar, setImportar] = useState(false);
  const [importada, setImportada] = useState(false);
  const alterado = JSON.stringify(demanda) !== JSON.stringify(setor.demanda) || inicios !== setor.inicios.map(hhmm).join(", ");

  const horas = Array.from({ length: 24 }, (_, h) => h);
  const visiveis = horas.filter((h) => demanda.some((d) => d[h] > 0) || (h >= 6 && h <= 22));
  const max = Math.max(1, ...demanda.flat());
  const total = demanda.reduce((t, d) => t + d.reduce((a, b) => a + b, 0), 0);

  const setCel = (d: number, h: number, v: number) =>
    setDemanda((x) => x.map((dia, i) => (i === d ? dia.map((n, j) => (j === h ? Math.max(0, Math.min(500, v || 0)) : n)) : dia)));

  async function salvar() {
    setEstado("salvando");
    try {
      const lista = inicios.split(/[,\s]+/).filter(Boolean).map(parseHHMM);
      if (lista.some((m) => !Number.isFinite(m))) throw new Error("Horários de entrada inválidos (use HH:MM)");
      await api(`/api/setores/${encodeURIComponent(setor.id)}`, "PUT", { demanda, inicios: [...new Set(lista)].sort((a, b) => a - b) });
      setEstado("salvo");
      setImportada(false);
      router.refresh();
    } catch (e) {
      setEstado((e as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>{setor.nome}</h2>
        <span className="badge">{quadro} colaboradores</span>
        <span className="badge">{fmtNum(total)} pessoa-hora/semana</span>
        <span className="spacer" />
        <button onClick={() => setAberto(!aberto)}>{aberto ? "Fechar" : "Editar demanda"}</button>
      </div>
      {aberto && (
        <div className="stack" style={{ marginTop: 14 }}>
          <label className="campo">
            Horários de entrada permitidos
            <input value={inicios} onChange={(e) => setInicios(e.target.value)} placeholder="07:00, 08:00, 14:00" />
          </label>
          <div className="row">
            <span className="small muted">Pessoas necessárias por hora (clique e digite). Feriados usam a curva de domingo.</span>
            <span className="spacer" />
            <button onClick={() => setImportar(!importar)}>{importar ? "Fechar importação" : "Importar vendas do ERP"}</button>
          </div>
          {importar && (
            <ImportarERP
              atual={demanda}
              feriados={feriados}
              onAplicar={(d) => {
                setDemanda(d);
                setImportar(false);
                setImportada(true);
                setEstado("");
              }}
            />
          )}
          {importada && alterado && <div className="aviso-ok">Demanda calculada a partir do ERP. Confira a grade abaixo e clique em <b>Salvar</b>.</div>}
          <div className="tabela-wrap">
            <table className="grade">
              <thead>
                <tr>
                  <th className="nome" style={{ minWidth: 60 }}>Dia</th>
                  {visiveis.map((h) => <th key={h}>{String(h).padStart(2, "0")}h</th>)}
                </tr>
              </thead>
              <tbody>
                {demanda.map((dia, d) => (
                  <tr key={d}>
                    <td className="nome" style={{ minWidth: 60 }}>{NOMES_DIAS[d]}</td>
                    {visiveis.map((h) => (
                      <td key={h} style={{ background: dia[h] ? `color-mix(in srgb, var(--primary) ${Math.round((dia[h] / max) * 45)}%, transparent)` : undefined }}>
                        <input
                          type="number"
                          min={0}
                          value={dia[h]}
                          onChange={(e) => setCel(d, h, Number(e.target.value))}
                          style={{ width: 44, border: 0, background: "transparent", textAlign: "center", padding: "6px 2px" }}
                          aria-label={`${NOMES_DIAS[d]} ${h}h`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="primario" disabled={!alterado || estado === "salvando"} onClick={salvar}>Salvar</button>
            {estado === "salvo" && !alterado && <span className="badge ok">Salvo</span>}
            {estado && estado !== "salvo" && estado !== "salvando" && <span className="erro-msg">{estado}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
