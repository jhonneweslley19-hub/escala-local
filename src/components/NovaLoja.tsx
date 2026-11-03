"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function NovaLoja() {
  const router = useRouter();
  const [f, setF] = useState({ nome: "", cidade: "", abre: "07:00", fecha: "22:00", abreDomingo: "08:00", fechaDomingo: "20:00" });
  const [erro, setErro] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const loja = await api<{ id: string }>("/api/lojas", "POST", f);
      router.push(`/lojas/${loja.id}`);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <form className="card" onSubmit={criar}>
      <h2>Nova loja</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="campo">Nome<input required value={f.nome} onChange={set("nome")} /></label>
        <label className="campo">Bairro/cidade<input value={f.cidade} onChange={set("cidade")} /></label>
        <label className="campo">Abre (seg–sáb)<input type="time" value={f.abre} onChange={set("abre")} /></label>
        <label className="campo">Fecha<input type="time" value={f.fecha} onChange={set("fecha")} /></label>
        <label className="campo">Abre (dom)<input type="time" value={f.abreDomingo} onChange={set("abreDomingo")} /></label>
        <label className="campo">Fecha (dom)<input type="time" value={f.fechaDomingo} onChange={set("fechaDomingo")} /></label>
        <button className="primario">Criar loja</button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>A loja é criada com 5 setores padrão e demanda de 1 pessoa por hora — ajuste a curva depois.</p>
      {erro && <p className="erro-msg">{erro}</p>}
    </form>
  );
}
