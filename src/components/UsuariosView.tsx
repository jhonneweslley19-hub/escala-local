"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Usuario } from "@/lib/server/auth";
import { DESCRICAO_PERFIL, NOME_PERFIL, PERFIS, type Perfil } from "@/lib/perfis";
import { api } from "@/lib/api";

type Opcao = { id: string; nome: string };
type Form = { id?: string; login: string; nome: string; perfil: Perfil; lojaId: string; senha: string; ativo: boolean };

export function UsuariosView({ usuarios, lojas, primeiro, eu }: { usuarios: Usuario[]; lojas: Opcao[]; primeiro: boolean; eu: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(
    primeiro ? { login: "", nome: "", perfil: "ADMIN", lojaId: "", senha: "", ativo: true } : null,
  );
  const [erro, setErro] = useState("");
  const nomeLoja = new Map(lojas.map((l) => [l.id, l.nome]));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro("");
    try {
      const corpo = { ...form, lojaId: form.perfil === "GERENTE" ? form.lojaId : null, senha: form.senha || undefined };
      if (form.id) await api(`/api/usuarios/${form.id}`, "PUT", corpo);
      else await api("/api/usuarios", "POST", corpo);
      if (primeiro) {
        alert("Administrador criado. A partir de agora o sistema exige login.");
        window.location.href = "/login";
        return;
      }
      setForm(null);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Quem pode o quê em cada perfil:</p>
          <ul className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {PERFIS.map((p) => <li key={p}><b>{NOME_PERFIL[p]}:</b> {DESCRICAO_PERFIL[p]}</li>)}
          </ul>
        </div>
        {!primeiro && (
          <button className="primario" onClick={() => setForm({ login: "", nome: "", perfil: "GERENTE", lojaId: lojas[0]?.id ?? "", senha: "", ativo: true })}>
            Novo usuário
          </button>
        )}
      </div>

      {primeiro && (
        <div className="card">
          <h2>Criar o primeiro administrador</h2>
          <p className="muted">Hoje o sistema está aberto. Depois de criar este usuário, todos precisarão entrar com usuário e senha.</p>
        </div>
      )}

      {!primeiro && (
        <div className="card tabela-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Loja</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}{u.id === eu && <span className="small muted"> (você)</span>}</td>
                  <td>{u.login}</td>
                  <td><span className={`badge ${u.perfil === "ADMIN" ? "primario" : u.perfil === "RH" ? "ok" : ""}`}>{NOME_PERFIL[u.perfil]}</span></td>
                  <td>{u.lojaId ? nomeLoja.get(u.lojaId) ?? "—" : "Todas"}</td>
                  <td>{u.ativo ? <span className="badge ok">Ativo</span> : <span className="badge erro">Desativado</span>}</td>
                  <td className="num">
                    <button onClick={() => setForm({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, lojaId: u.lojaId ?? lojas[0]?.id ?? "", senha: "", ativo: u.ativo })}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <form className="card stack" onSubmit={salvar} style={{ maxWidth: 640 }}>
          <h2>{form.id ? `Editar ${form.login}` : primeiro ? "Administrador" : "Novo usuário"}</h2>
          <div className="grid g2">
            <label className="campo">Nome<input required value={form.nome} onChange={(e) => set("nome", e.target.value)} /></label>
            <label className="campo">
              Usuário (login)
              <input required disabled={Boolean(form.id)} pattern="[a-zA-Z0-9._\-]{3,40}" title="3 a 40 letras, números, ponto, hífen ou sublinhado" value={form.login} onChange={(e) => set("login", e.target.value)} />
            </label>
            {!primeiro && (
              <label className="campo">
                Perfil
                <select value={form.perfil} onChange={(e) => set("perfil", e.target.value as Perfil)}>
                  {PERFIS.map((p) => <option key={p} value={p}>{NOME_PERFIL[p]}</option>)}
                </select>
                <span className="small muted">{DESCRICAO_PERFIL[form.perfil]}</span>
              </label>
            )}
            {form.perfil === "GERENTE" && (
              <label className="campo">
                Loja
                <select value={form.lojaId} onChange={(e) => set("lojaId", e.target.value)}>
                  {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </label>
            )}
            <label className="campo">
              {form.id ? "Nova senha (deixe vazio para manter)" : "Senha (mínimo 8 caracteres)"}
              <input type="password" autoComplete="new-password" required={!form.id} minLength={8} value={form.senha} onChange={(e) => set("senha", e.target.value)} />
            </label>
          </div>
          {form.id && form.id !== eu && (
            <label className="check">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              <span>Ativo <span className="small muted">(desativar impede o acesso e encerra as sessões abertas)</span></span>
            </label>
          )}
          {erro && <p className="erro-msg">{erro}</p>}
          <div className="row">
            <span className="spacer" />
            {!primeiro && <button type="button" onClick={() => setForm(null)}>Cancelar</button>}
            <button className="primario">Salvar</button>
          </div>
        </form>
      )}
    </div>
  );
}
