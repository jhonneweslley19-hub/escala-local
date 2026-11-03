"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LISTA_REGIMES, regimeVigente } from "@/lib/engine/regimes";
import { addDias, diaSemana, toISO } from "@/lib/engine/tempo";
import { api } from "@/lib/api";

function proximaSegunda() {
  const hoje = toISO(new Date());
  return addDias(hoje, (7 - diaSemana(hoje)) % 7 || 7);
}

type LojaOpcao = { id: string; nome: string; proximoInicio?: string };

export function NovaEscala({ lojas, lojaInicial }: { lojas: LojaOpcao[]; lojaInicial?: string }) {
  const router = useRouter();
  const [lojaId, setLojaId] = useState(lojaInicial ?? lojas[0]?.id ?? "");
  const sugestao = (id: string) => lojas.find((l) => l.id === id)?.proximoInicio ?? proximaSegunda();
  const [inicio, setInicio] = useState(() => sugestao(lojaInicial ?? lojas[0]?.id ?? ""));
  const setLoja = (id: string) => {
    setLojaId(id);
    setInicio(sugestao(id));
  };
  const continuacao = lojas.find((l) => l.id === lojaId)?.proximoInicio;
  const [semanas, setSemanas] = useState(4);
  const [regime, setRegime] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);

  const segunda = diaSemana(inicio) === 0;
  const fim = addDias(inicio, semanas * 7 - 1);
  const auto = [...new Set([regimeVigente(addDias(inicio, 6)).nome, regimeVigente(fim).nome])];

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setGerando(true);
    try {
      const r = await api<{ id: string }>("/api/escalas", "POST", { lojaId, inicio, semanas, regimeId: regime || null });
      router.push(`/escalas/${r.id}`);
    } catch (err) {
      setErro((err as Error).message);
      setGerando(false);
    }
  }

  return (
    <form className="card" onSubmit={gerar}>
      <h2>Nova escala</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="campo">
          Loja
          <select value={lojaId} onChange={(e) => setLoja(e.target.value)}>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <label className="campo">
          Início (segunda-feira)
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="campo">
          Semanas
          <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="campo">
          Regime de jornada
          <select value={regime} onChange={(e) => setRegime(e.target.value)}>
            <option value="">Automático pela data (recomendado)</option>
            {LISTA_REGIMES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <button className="primario" disabled={gerando || !segunda || !lojaId}>{gerando ? "Gerando…" : "Gerar escala"}</button>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        {!segunda ? <span className="erro-msg">Escolha uma segunda-feira.</span> : regime ? "Regime fixo para todo o período." : `Regime aplicado: ${auto.join(" → ")}.`}
        {segunda && continuacao && (inicio === continuacao
          ? " Continua a escala anterior desta loja: rodízio de domingos, dias seguidos e descansos são mantidos."
          : inicio > continuacao
            ? ` Atenção: há um intervalo sem escala desde ${continuacao.split("-").reverse().join("/")}.`
            : " Este período se sobrepõe a uma escala existente.")}
      </p>
      {erro && <p className="erro-msg">{erro}</p>}
    </form>
  );
}
