"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function TrocarSenha() {
  const [f, setF] = useState({ atual: "", nova: "", confirma: "" });
  const [msg, setMsg] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (f.nova !== f.confirma) return setMsg("A confirmação não confere com a nova senha.");
    try {
      await api("/api/conta", "PUT", { atual: f.atual, nova: f.nova });
      alert("Senha alterada. Entre novamente com a nova senha.");
      window.location.href = "/login";
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card stack" style={{ maxWidth: 420 }} onSubmit={salvar}>
      <label className="campo">Senha atual<input type="password" autoComplete="current-password" required value={f.atual} onChange={set("atual")} /></label>
      <label className="campo">Nova senha (mínimo 8 caracteres)<input type="password" autoComplete="new-password" required minLength={8} value={f.nova} onChange={set("nova")} /></label>
      <label className="campo">Confirme a nova senha<input type="password" autoComplete="new-password" required value={f.confirma} onChange={set("confirma")} /></label>
      {msg && <p className="erro-msg">{msg}</p>}
      <button className="primario">Alterar senha</button>
    </form>
  );
}
