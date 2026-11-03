import "server-only";
import { headers } from "next/headers";
import { executar, todos } from "./db";

/**
 * Registro de acessos a dados pessoais (LGPD, arts. 37 e 46): quem viu, exportou ou alterou o quê,
 * quando e de qual IP. Guardado por 12 meses (o Marco Civil da Internet, art. 15, pede no mínimo 6).
 * Só o administrador consulta.
 */

export const ACOES = {
  LOGIN: "Entrou no sistema",
  LOGIN_FALHOU: "Tentativa de login recusada",
  VER_ESCALA: "Abriu escala",
  IMPRIMIR_ESCALA: "Abriu impressão da escala",
  EXPORTAR_CSV: "Exportou escala (CSV)",
  VER_COLABORADORES: "Abriu lista de colaboradores",
  SALVAR_COLABORADOR: "Cadastrou ou alterou colaborador",
  EXCLUIR_COLABORADOR: "Excluiu colaborador",
  IMPORTAR_COLABORADORES: "Importou planilha de colaboradores",
  // Do link pessoal do colaborador (função removida); mantidos para exibir registros antigos.
  GERAR_LINK: "Gerou ou consultou link pessoal",
  ABRIR_LINK: "Colaborador abriu o link pessoal",
  EXPORTAR_DADOS: "Exportou dados do titular",
  USUARIO: "Criou ou alterou usuário",
  CONFIGURACAO: "Alterou configurações",
  APAGAR_DADOS: "Apagou lojas e colaboradores",
  VER_REGISTRO: "Consultou o registro de acessos",
} as const;

export type AcaoRegistro = keyof typeof ACOES;

export const RETENCAO_DIAS = 365;

export interface EntradaRegistro {
  id: number;
  quando: string;
  quem: string;
  perfil: string;
  acao: AcaoRegistro;
  alvo: string | null;
  lojaId: string | null;
  ip: string | null;
}

async function ipDaRequisicao(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  } catch {
    return null; // fora de uma requisição (ex.: testes)
  }
}

/** Grava uma entrada; nunca quebra a página ou a API que chamou. */
export async function registrarAcesso(r: { quem: string; perfil: string; acao: AcaoRegistro; alvo?: string | null; lojaId?: string | null }) {
  try {
    await executar("INSERT INTO escala_registro (quando, quem, perfil, acao, alvo, loja_id, ip) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      new Date().toISOString(), r.quem.slice(0, 120), r.perfil, r.acao, r.alvo?.slice(0, 300) ?? null, r.lojaId ?? null, await ipDaRequisicao(),
    ]);
    // De vez em quando, apaga o que passou do prazo de guarda.
    if (Math.random() < 0.02) await limparRegistroAntigo();
  } catch (e) {
    console.error("Falha ao gravar o registro de acessos:", e);
  }
}

/** Atalho para quem está logado. */
export const registrarUsuario = (u: { login: string; perfil: string }, acao: AcaoRegistro, alvo?: string | null, lojaId?: string | null) =>
  registrarAcesso({ quem: u.login, perfil: u.perfil, acao, alvo, lojaId });

export async function limparRegistroAntigo(agora = new Date()) {
  const limite = new Date(agora.getTime() - RETENCAO_DIAS * 86400000).toISOString();
  await executar("DELETE FROM escala_registro WHERE quando < ?", [limite]);
}

export async function listarRegistro(f: { dias: number; quem?: string; acao?: string; limite?: number }): Promise<EntradaRegistro[]> {
  const desde = new Date(Date.now() - f.dias * 86400000).toISOString();
  const cond = ["quando >= ?"];
  const p: unknown[] = [desde];
  if (f.quem) {
    cond.push("LOWER(quem) LIKE ?");
    p.push(`%${f.quem.toLowerCase()}%`);
  }
  if (f.acao && f.acao in ACOES) {
    cond.push("acao = ?");
    p.push(f.acao);
  }
  const rows = await todos(`SELECT * FROM escala_registro WHERE ${cond.join(" AND ")} ORDER BY quando DESC, id DESC LIMIT ${Math.min(f.limite ?? 500, 5000)}`, p);
  return rows.map((r) => ({
    id: Number(r.id),
    quando: String(r.quando),
    quem: String(r.quem),
    perfil: String(r.perfil),
    acao: r.acao as AcaoRegistro,
    alvo: r.alvo == null ? null : String(r.alvo),
    lojaId: r.loja_id == null ? null : String(r.loja_id),
    ip: r.ip == null ? null : String(r.ip),
  }));
}
