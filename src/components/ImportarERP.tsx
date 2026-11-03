"use client";
import { useMemo, useRef, useState } from "react";
import type { CurvaDemanda } from "@/lib/engine/types";
import { NOMES_DIAS } from "@/lib/engine/tempo";
import { calcularDemandaERP, lerData, lerVendasERP, type VendasERP } from "@/lib/erp";
import { fmtData, fmtNum } from "@/lib/api";
import { feriadosNacionais } from "@/lib/feriados";

type Vista = "demanda" | "itens" | "erp";

/**
 * Lê no navegador a exportação de cupons do ERP e propõe a curva de demanda do setor.
 * A planilha não sai do computador: só a curva calculada vai para o editor (e é salva por ele).
 */
export function ImportarERP({ atual, feriados, onAplicar }: { atual: CurvaDemanda; feriados: string[]; onAplicar: (d: CurvaDemanda) => void }) {
  const [vendas, setVendas] = useState<VendasERP | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [lendo, setLendo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [produtividade, setProdutividade] = useState(150);
  const [caixas, setCaixas] = useState(Math.max(...atual.flat()) || 10);
  const [semFeriados, setSemFeriados] = useState(true);
  const [outras, setOutras] = useState("");
  const [vista, setVista] = useState<Vista>("demanda");
  const ultimo = useRef(-1);

  async function ler(f: File | undefined) {
    if (!f) return;
    setErro("");
    setVendas(null);
    setArquivo(f.name);
    setLendo(0);
    ultimo.current = -1;
    try {
      const v = await lerVendasERP(new Uint8Array(await f.arrayBuffer()), f.name, (fr) => {
        const p = Math.floor(fr * 100);
        if (p !== ultimo.current) setLendo((ultimo.current = p));
      });
      setVendas(v);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLendo(null);
    }
  }

  const outrasDatas = useMemo(() => outras.split(/[,;\s]+/).filter(Boolean).map((s) => lerData(s)), [outras]);
  const outrasValidas = useMemo(() => outrasDatas.filter((d): d is string => !!d), [outrasDatas]);
  const r = useMemo(() => {
    if (!vendas || !(produtividade > 0) || !(caixas > 0)) return null;
    const anos = new Set(Object.keys(vendas.horas).map((k) => Number(k.slice(0, 4))));
    const nacionais = [...anos].flatMap((a) => feriadosNacionais(a).map((f) => f.data));
    const excluir = [...(semFeriados ? [...nacionais, ...feriados] : []), ...outrasValidas];
    return calcularDemandaERP(vendas, { produtividade, caixas: Math.round(caixas), excluir });
  }, [vendas, produtividade, caixas, semFeriados, feriados, outrasValidas]);

  const total = (c: number[][]) => c.reduce((t, d) => t + d.reduce((a, b) => a + b, 0), 0);
  const horas = r ? Array.from({ length: 24 }, (_, h) => h).filter((h) => r.itens.some((d) => d[h] > 0) || atual.some((d) => d[h] > 0)) : [];
  const valores = r ? (vista === "demanda" ? r.demanda : vista === "itens" ? r.itens : r.operadoresERP) : [];
  const max = Math.max(1, ...valores.flat());
  const semanas = r ? Math.min(...r.dias) : 0;

  return (
    <div className="card stack" style={{ background: "var(--surface-2)" }}>
      <div>
        <h3 style={{ margin: 0 }}>Importar vendas do ERP</h3>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Use o relatório de cupons do ERP (.xlsx ou .csv) com data, horário e quantidade vendida de cada cupom. Se a aba de cupons não tiver
          a data, inclua no mesmo arquivo a aba de notas (NFC-e) com o número do cupom e a data. A planilha é lida aqui no navegador e
          não é enviada ao servidor; só a curva calculada vai para a demanda.
        </p>
      </div>
      <div className="row">
        <label className="btn">
          {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
          <input type="file" accept=".xlsx,.csv,.txt" hidden disabled={lendo !== null} onChange={(e) => ler(e.target.files?.[0])} />
        </label>
        {arquivo && <span className="small muted">{arquivo}</span>}
        {lendo !== null && (
          <span className="small" role="status">
            Lendo… {lendo}% <progress max={100} value={lendo} style={{ verticalAlign: "middle", width: 120 }} />
          </span>
        )}
      </div>
      {erro && <div className="erro-msg">{erro}</div>}
      {vendas && r && (
        <>
          <div className="small">
            Aba <b>{vendas.aba}</b> · {fmtNum(vendas.cupons)} cupons · {fmtData(r.inicio)} a {fmtData(r.fim)} · colunas {vendas.colunas.data},{" "}
            {vendas.colunas.hora} e {vendas.colunas.itens}
            {vendas.ignoradas > 0 && <span className="muted"> · {fmtNum(vendas.ignoradas)} linhas sem data, hora ou quantidade ignoradas</span>}
          </div>
          {semanas < 4 && <div className="aviso-demo" style={{ margin: 0 }}>Poucos dados: há dia da semana com só {semanas} dia(s) na média. O ideal são 8 a 12 semanas.</div>}
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="campo">
              Itens por operador por hora
              <input type="number" min={10} max={2000} value={produtividade} onChange={(e) => setProdutividade(Number(e.target.value))} style={{ width: 120 }} />
            </label>
            <label className="campo">
              Caixas (PDVs) da loja
              <input type="number" min={1} max={200} value={caixas} onChange={(e) => setCaixas(Number(e.target.value))} style={{ width: 120 }} />
            </label>
            <label className="campo" style={{ flex: "1 1 220px" }}>
              Outras datas para ignorar (dias atípicos)
              <input value={outras} onChange={(e) => setOutras(e.target.value)} placeholder="ex.: 15/08/2026, 22/08/2026" />
            </label>
          </div>
          {outrasDatas.length > outrasValidas.length && <div className="erro-msg">Use datas no formato dd/mm/aaaa.</div>}
          <label className="check small">
            <input type="checkbox" checked={semFeriados} onChange={(e) => setSemFeriados(e.target.checked)} />
            <span>Tirar da média os feriados (nacionais e os cadastrados para a loja){r.excluidas.length > 0 && <span className="muted"> (fora da média: {r.excluidas.map(fmtData).join(", ")})</span>}</span>
          </label>
          {r.produtividadePico && (
            <div className="small muted">
              Referência do ERP: nas 10% horas mais movimentadas, cada operador passou em média {fmtNum(r.produtividadePico)} itens por hora.
              Um valor menor que esse deixa folga para a fila andar.
            </div>
          )}
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={vista === "demanda" ? "ativo" : ""} onClick={() => setVista("demanda")}>Operadores necessários</button>
            <button className={vista === "itens" ? "ativo" : ""} onClick={() => setVista("itens")}>Itens por hora (média)</button>
            {vendas.colunas.operador && <button className={vista === "erp" ? "ativo" : ""} onClick={() => setVista("erp")}>Operadores no ERP (média)</button>}
          </div>
          <div className="tabela-wrap">
            <table className="grade">
              <thead>
                <tr>
                  <th className="nome" style={{ minWidth: 60 }}>Dia</th>
                  {horas.map((h) => <th key={h}>{String(h).padStart(2, "0")}h</th>)}
                </tr>
              </thead>
              <tbody>
                {valores.map((dia, d) => (
                  <tr key={d}>
                    <td className="nome" style={{ minWidth: 60 }}>
                      {NOMES_DIAS[d]} <span className="muted small">({r.dias[d]})</span>
                    </td>
                    {horas.map((h) => {
                      const muda = vista === "demanda" && dia[h] !== atual[d][h];
                      return (
                        <td
                          key={h}
                          title={`Média de ${fmtNum(r.itens[d][h])} itens · atual: ${atual[d][h]} · calculado: ${r.demanda[d][h]}`}
                          style={{ padding: "6px 2px", minWidth: 36, background: dia[h] ? `color-mix(in srgb, var(--primary) ${Math.round((dia[h] / max) * 45)}%, transparent)` : undefined }}
                        >
                          {vista === "demanda" ? dia[h] : fmtNum(dia[h], vista === "erp" ? 1 : 0)}
                          {muda && <div className="muted" style={{ fontSize: 10 }}>era {atual[d][h]}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="small muted">
            Operadores necessários = média de itens da hora ÷ itens por operador, arredondado para cima (tolerância de 0,15), no máximo o
            número de caixas; hora com movimento tem pelo menos 1. Entre parênteses, quantos dias entraram na média.
          </div>
          <div className="row">
            <button className="primario" onClick={() => onAplicar(r.demanda)}>Usar esta demanda</button>
            <span className="small">
              {fmtNum(total(r.demanda))} pessoa-hora/semana <span className="muted">(atual: {fmtNum(total(atual))})</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
