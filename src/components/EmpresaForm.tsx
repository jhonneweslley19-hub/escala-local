"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function EmpresaForm({ nome, temLojas, encarregado }: { nome: string; temLojas: boolean; encarregado: { nome: string; email: string } | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(nome);
  const [enc, setEnc] = useState(encarregado ?? { nome: "", email: "" });
  const [msg, setMsg] = useState("");

  async function salvarEncarregado(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/empresa", "PUT", { encarregado: enc });
      setMsg("Encarregado salvo. Ele aparece na página de privacidade.");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/empresa", "PUT", { nome: valor });
      setMsg("Nome salvo.");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function limpar() {
    const ok = prompt(
      "Isto apaga TODAS as lojas, setores, colaboradores e escalas (regras e feriados são mantidos).\nUse para remover os dados de demonstração antes de cadastrar a sua rede.\n\nDigite APAGAR para confirmar:",
    );
    if (ok !== "APAGAR") return;
    try {
      await api("/api/empresa", "DELETE", { confirmar: "APAGAR" });
      router.push("/lojas");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="card stack">
      <h2>Empresa</h2>
      <form className="row" onSubmit={salvarNome} style={{ alignItems: "flex-end" }}>
        <label className="campo" style={{ minWidth: 280 }}>
          Nome da empresa
          <input value={valor} onChange={(e) => setValor(e.target.value)} required maxLength={120} />
        </label>
        <button className="primario" disabled={valor.trim() === nome}>Salvar</button>
      </form>
      <form className="stack" onSubmit={salvarEncarregado} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div>
          <strong>Encarregado de dados (LGPD)</strong>
          <div className="small muted">
            Quem responde aos colaboradores sobre os dados pessoais deles (LGPD, art. 41). Aparece na <a href="/privacidade" target="_blank">página de privacidade</a>,
            que tem um texto-base: revise com o jurídico.
          </div>
        </div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="campo" style={{ minWidth: 220 }}>
            Nome
            <input value={enc.nome} onChange={(e) => setEnc({ ...enc, nome: e.target.value })} maxLength={120} />
          </label>
          <label className="campo" style={{ minWidth: 240 }}>
            E-mail
            <input type="email" value={enc.email} onChange={(e) => setEnc({ ...enc, email: e.target.value })} />
          </label>
          <button disabled={enc.nome === (encarregado?.nome ?? "") && enc.email === (encarregado?.email ?? "")}>Salvar encarregado</button>
        </div>
      </form>
      {temLojas && (
        <div className="row" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div>
            <strong>Começar com os dados reais</strong>
            <div className="small muted">Remove lojas, colaboradores e escalas — por exemplo, a rede de demonstração que vem instalada.</div>
          </div>
          <span className="spacer" />
          <button className="perigo" onClick={limpar}>Apagar lojas e colaboradores</button>
        </div>
      )}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
