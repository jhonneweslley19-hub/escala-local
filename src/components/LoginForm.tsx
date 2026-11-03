"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function LoginForm() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      await api("/api/auth/login", "POST", { login, senha });
      window.location.href = "/";
    } catch (err) {
      setErro((err as Error).message);
      setEntrando(false);
    }
  }

  return (
    <form className="stack" onSubmit={entrar}>
      <label className="campo">
        Usuário
        <input autoFocus autoComplete="username" required value={login} onChange={(e) => setLogin(e.target.value)} />
      </label>
      <label className="campo">
        Senha
        <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      {erro && <p className="erro-msg">{erro}</p>}
      <button className="primario" disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
