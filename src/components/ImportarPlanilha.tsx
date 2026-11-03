"use client";
import { useState } from "react";
import { MODELO_CSV } from "@/lib/importacao";

type Retorno = { importados: number; erros: { linha: number; mensagem: string }[] };

export function ImportarPlanilha({
  lojaId,
  lojaNome,
  setores,
  onFechar,
  onImportado,
}: {
  lojaId: string;
  lojaNome: string;
  setores: { id: string; nome: string }[];
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [r, setR] = useState<Retorno | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function lerArquivo(f: File) {
    setArquivo(f.name);
    setR(null);
    const buf = await f.arrayBuffer();
    // O Excel no Brasil costuma salvar CSV em Windows-1252; tenta UTF-8 primeiro.
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
    setCsv(texto);
  }

  async function importar() {
    setEnviando(true);
    const resp = await fetch("/api/colaboradores/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lojaId, csv }),
    });
    const dados = (await resp.json()) as Retorno & { erro?: string };
    setR(dados.erro ? { importados: 0, erros: [{ linha: 0, mensagem: dados.erro }] } : dados);
    setEnviando(false);
    if (dados.importados) onImportado();
  }

  const modeloUrl = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + MODELO_CSV)}`;

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 100%)" }}>
        <h2>Importar colaboradores — {lojaNome}</h2>
        <p className="small muted">
          No Excel, salve a planilha como <strong>CSV (separado por ponto e vírgula)</strong>. Colunas obrigatórias: <strong>Nome</strong> e{" "}
          <strong>Setor</strong>. Opcionais: Carga semanal (padrão 44), Menor de 18 (sim/não), Domingo quinzenal (sim/não), Não trabalha
          (ex.: “dom” ou “seg,ter”) e Último domingo de folga (dd/mm/aaaa). <a href={modeloUrl} download="modelo-colaboradores.csv">Baixar modelo</a>.
        </p>
        <p className="small muted">Setores desta loja: {setores.map((s) => s.nome).join(", ")}.</p>
        <label className="btn" style={{ alignSelf: "flex-start" }}>
          {arquivo || "Escolher arquivo CSV"}
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
        </label>
        <textarea
          rows={8}
          placeholder="…ou cole aqui o conteúdo da planilha"
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setR(null); }}
          style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
        {r && r.importados > 0 && <p className="badge ok">{r.importados} colaboradores importados.</p>}
        {r && r.erros.length > 0 && (
          <div>
            <p className="erro-msg">Nada foi importado. Corrija as linhas abaixo e tente de novo:</p>
            <ul className="small" style={{ maxHeight: 180, overflow: "auto", margin: 0 }}>
              {r.erros.map((e, i) => <li key={i}>{e.linha ? `Linha ${e.linha}: ` : ""}{e.mensagem}</li>)}
            </ul>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={onFechar}>{r?.importados ? "Fechar" : "Cancelar"}</button>
          {!r?.importados && <button className="primario" disabled={!csv.trim() || enviando} onClick={importar}>{enviando ? "Importando…" : "Importar"}</button>}
        </div>
      </div>
    </div>
  );
}
