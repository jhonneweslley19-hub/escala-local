import Link from "next/link";
import { redirect } from "next/navigation";
import { ehAdmin, usuarioPagina } from "@/lib/server/auth";
import { listarLojas } from "@/lib/server/repo";
import { ACOES, RETENCAO_DIAS, limparRegistroAntigo, listarRegistro, registrarUsuario } from "@/lib/server/registro";
import { NOME_PERFIL, type Perfil } from "@/lib/perfis";

export const dynamic = "force-dynamic";

const PERIODOS: [number, string][] = [[1, "Últimas 24 horas"], [7, "Últimos 7 dias"], [30, "Últimos 30 dias"], [90, "Últimos 90 dias"], [365, "Últimos 12 meses"]];

/** Registro de acessos a dados pessoais (LGPD). Só o administrador consulta. */
export default async function Acessos({ searchParams }: { searchParams: Promise<{ dias?: string; quem?: string; acao?: string }> }) {
  const u = await usuarioPagina();
  if (!ehAdmin(u)) redirect("/");
  const q = await searchParams;
  const dias = PERIODOS.some(([d]) => String(d) === q.dias) ? Number(q.dias) : 7;
  const filtro = { dias, quem: q.quem?.trim() || undefined, acao: q.acao || undefined };
  await limparRegistroAntigo();
  await registrarUsuario(u, "VER_REGISTRO", [PERIODOS.find(([d]) => d === dias)![1].toLowerCase(), filtro.quem, filtro.acao].filter(Boolean).join(", "));
  const linhas = await listarRegistro(filtro);
  const lojas = new Map((await listarLojas()).map((l) => [l.id, l.nome]));
  const csv = `/api/acessos?${new URLSearchParams(Object.entries({ dias: String(dias), quem: filtro.quem ?? "", acao: filtro.acao ?? "" }).filter(([, v]) => v))}`;
  const perfil = (p: string) => NOME_PERFIL[p as Perfil] ?? (p === "COLABORADOR" ? "Colaborador (link)" : p);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Registro de acessos</h1>
          <p className="muted">
            Quem entrou no sistema, abriu, exportou ou alterou dados pessoais (LGPD). Guardado por {Math.round(RETENCAO_DIAS / 30)} meses.{" "}
            <Link href="/privacidade">Página de privacidade</Link>
          </p>
        </div>
        <a className="btn" href={csv}>Exportar CSV</a>
      </div>
      <form className="card row" style={{ alignItems: "flex-end" }}>
        <label className="campo">
          Período
          <select name="dias" defaultValue={dias}>
            {PERIODOS.map(([d, t]) => <option key={d} value={d}>{t}</option>)}
          </select>
        </label>
        <label className="campo">
          Pessoa
          <input name="quem" defaultValue={filtro.quem} placeholder="usuário ou nome" />
        </label>
        <label className="campo">
          Ação
          <select name="acao" defaultValue={filtro.acao ?? ""}>
            <option value="">Todas</option>
            {Object.entries(ACOES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <button className="primario">Filtrar</button>
      </form>
      <div className="card tabela-wrap">
        {linhas.length === 0 ? (
          <p className="muted">Nenhum registro no período.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Quando</th><th>Quem</th><th>Perfil</th><th>Ação</th><th>Detalhe</th><th>Loja</th><th>IP</th></tr>
            </thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.id}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{new Date(r.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  <td>{r.quem}</td>
                  <td className="small">{perfil(r.perfil)}</td>
                  <td><span className={`badge ${r.acao === "LOGIN_FALHOU" ? "erro" : r.acao.startsWith("EXPORTAR") || r.acao === "APAGAR_DADOS" ? "alerta" : ""}`}>{ACOES[r.acao] ?? r.acao}</span></td>
                  <td className="small">{r.alvo ?? ""}</td>
                  <td className="small">{r.lojaId ? lojas.get(r.lojaId) ?? r.lojaId : ""}</td>
                  <td className="small muted">{r.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {linhas.length >= 500 && <p className="small muted">Mostrando os 500 mais recentes. Use os filtros ou exporte o CSV.</p>}
      </div>
    </div>
  );
}
