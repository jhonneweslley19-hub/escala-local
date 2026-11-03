import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { executar, todos, um, type Linha } from "./db";
import type { Perfil } from "../perfis";

export type { Perfil };

export interface Usuario {
  id: string;
  login: string;
  nome: string;
  perfil: Perfil;
  /** Loja do gerente; null para administrador e RH/DP (todas as lojas). */
  lojaId: string | null;
  ativo: boolean;
}

export const COOKIE_SESSAO = "escala_sessao";
const DURACAO_SESSAO_MS = 7 * 24 * 3600 * 1000;

/** Erro de autenticação (401) ou de permissão (403). */
export class ErroAcesso extends Error {
  name = "ErroAcesso";
  constructor(mensagem: string, public status: 401 | 403 = 403) {
    super(mensagem);
  }
}

const toUsuario = (r: Linha): Usuario => ({
  id: String(r.id),
  login: String(r.login),
  nome: String(r.nome),
  perfil: r.perfil as Perfil,
  lojaId: r.loja_id == null ? null : String(r.loja_id),
  ativo: Number(r.ativo) === 1,
});

// ---------- Senhas ----------

export function hashSenha(senha: string, salFixo?: Buffer): string {
  const sal = salFixo ?? randomBytes(16);
  const h = scryptSync(senha, sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString("hex")}$${h.toString("hex")}`;
}

export function conferirSenha(senha: string, armazenado: string): boolean {
  const [alg, salHex, hHex] = armazenado.split("$");
  if (alg !== "scrypt" || !salHex || !hHex) return false;
  const esperado = Buffer.from(hHex, "hex");
  const h = scryptSync(senha, Buffer.from(salHex, "hex"), esperado.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(h, esperado);
}

export function validarSenhaNova(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (senha.length > 200) return "Senha longa demais.";
  return null;
}

// ---------- Usuários ----------

export async function existemUsuarios(): Promise<boolean> {
  return Boolean(await um("SELECT 1 AS x FROM escala_usuarios LIMIT 1"));
}

export async function listarUsuarios(): Promise<Usuario[]> {
  return (await todos("SELECT * FROM escala_usuarios ORDER BY perfil, nome")).map(toUsuario);
}

export async function obterUsuario(id: string): Promise<Usuario | null> {
  const r = await um("SELECT * FROM escala_usuarios WHERE id = ?", [id]);
  return r ? toUsuario(r) : null;
}

/** O login é guardado em minúsculas: "Joao.Norte" e "joao.norte" são o mesmo usuário. */
export async function criarUsuario(
  dados: { login: string; nome: string; perfil: Perfil; lojaId: string | null; senha: string },
  salFixo?: Buffer,
): Promise<Usuario> {
  const id = randomUUID();
  await executar(
    "INSERT INTO escala_usuarios (id, login, nome, perfil, loja_id, senha_hash, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    [id, dados.login.toLowerCase(), dados.nome, dados.perfil, dados.perfil === "GERENTE" ? dados.lojaId : null, hashSenha(dados.senha, salFixo), new Date().toISOString()],
  );
  return (await obterUsuario(id))!;
}

export async function atualizarUsuario(id: string, dados: { nome?: string; perfil?: Perfil; lojaId?: string | null; ativo?: boolean; senha?: string }) {
  const u = await obterUsuario(id);
  if (!u) throw new ErroAcesso("Usuário não encontrado", 403);
  const perfil = dados.perfil ?? u.perfil;
  const lojaId = perfil !== "GERENTE" ? null : dados.lojaId !== undefined ? dados.lojaId : u.lojaId;
  const ativo = dados.ativo ?? u.ativo;
  await executar("UPDATE escala_usuarios SET nome = ?, perfil = ?, loja_id = ?, ativo = ? WHERE id = ?", [
    dados.nome ?? u.nome, perfil, lojaId, ativo ? 1 : 0, id,
  ]);
  if (dados.senha) await executar("UPDATE escala_usuarios SET senha_hash = ? WHERE id = ?", [hashSenha(dados.senha), id]);
  // Nova senha muda a impressão gravada no cookie e desativar bloqueia a leitura do usuário:
  // os dois encerram as sessões abertas. Perfil e loja são lidos do banco a cada requisição.
}

export async function contarAdminsAtivos(): Promise<number> {
  return Number((await um("SELECT COUNT(*) AS n FROM escala_usuarios WHERE perfil = 'ADMIN' AND ativo = 1"))?.n ?? 0);
}

/** Na primeira execução com ESCALA_SENHA definida, cria o administrador com essa senha (compatibilidade). */
export async function criarAdminInicialPorAmbiente() {
  const senha = process.env.ESCALA_SENHA;
  if (!senha || (await existemUsuarios())) return;
  const login = process.env.ESCALA_USUARIO ?? "admin";
  // Sal derivado da configuração: todas as instâncias geram o mesmo hash, e o cookie de
  // sessão (que carrega a impressão do hash) vale em qualquer uma delas.
  const sal = createHash("sha256").update(`escala-admin|${login}|${senha}`).digest().subarray(0, 16);
  try {
    await criarUsuario({ login, nome: "Administrador", perfil: "ADMIN", lojaId: null, senha }, sal);
  } catch (e) {
    // Outra instância criou ao mesmo tempo (login único): segue normalmente.
    if (!(await existemUsuarios())) throw e;
  }
}

// ---------- Login e sessões ----------

const tentativas = new Map<string, { falhas: number; ate: number }>();

/** Valida login e senha; bloqueia por 5 minutos após 5 falhas seguidas do mesmo login. */
export async function autenticar(login: string, senha: string): Promise<Usuario> {
  await criarAdminInicialPorAmbiente(); // a instância pode ter acabado de iniciar
  const chave = login.toLowerCase();
  const t = tentativas.get(chave);
  if (t && t.ate > Date.now()) throw new ErroAcesso("Muitas tentativas. Aguarde alguns minutos.", 401);
  const r = await um("SELECT * FROM escala_usuarios WHERE login = ?", [chave]);
  const ok = r && Number(r.ativo) === 1 && conferirSenha(senha, String(r.senha_hash));
  if (!ok) {
    const falhas = (t?.falhas ?? 0) + 1;
    tentativas.set(chave, { falhas: falhas >= 5 ? 0 : falhas, ate: falhas >= 5 ? Date.now() + 5 * 60_000 : 0 });
    throw new ErroAcesso("Usuário ou senha inválidos.", 401);
  }
  tentativas.delete(chave);
  return toUsuario(r);
}

/**
 * Sessão sem estado: o cookie carrega login, validade e uma impressão da senha atual,
 * assinados com HMAC. Assim qualquer instância do servidor valida o login — necessário
 * mesmo se o sistema rodar em mais de um processo.
 * Trocar a senha muda a impressão e invalida os cookies anteriores; desativar o usuário também.
 */
let segredoProcesso: Buffer | null = null;
function segredo(): Buffer {
  if (process.env.ESCALA_SEGREDO) return createHash("sha256").update(process.env.ESCALA_SEGREDO).digest();
  if (process.env.ESCALA_SENHA) return createHash("sha256").update(`escala-sessao|${process.env.ESCALA_SENHA}`).digest();
  segredoProcesso ??= randomBytes(32);
  return segredoProcesso;
}

const assinar = (dados: string) => createHmac("sha256", segredo()).update(dados).digest("base64url");
const impressao = (senhaHash: string) => createHash("sha256").update(senhaHash).digest("base64url").slice(0, 16);

export async function criarSessao(usuarioId: string): Promise<{ token: string; expira: Date }> {
  const r = (await um("SELECT login, senha_hash FROM escala_usuarios WHERE id = ?", [usuarioId]))!;
  const expira = new Date(Date.now() + DURACAO_SESSAO_MS);
  const dados = Buffer.from(JSON.stringify({ l: r.login, v: impressao(String(r.senha_hash)), e: expira.getTime() })).toString("base64url");
  return { token: `${dados}.${assinar(dados)}`, expira };
}

/** A sessão vive só no cookie; sair apaga o cookie no navegador. */
export function encerrarSessao(_token: string) {}

async function usuarioDaSessao(token: string | undefined): Promise<Usuario | null> {
  if (!token) return null;
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura) return null;
  const esperado = Buffer.from(assinar(dados));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  let s: { l: string; v: string; e: number };
  try {
    s = JSON.parse(Buffer.from(dados, "base64url").toString());
  } catch {
    return null;
  }
  if (!s || typeof s.l !== "string" || !(s.e > Date.now())) return null;
  const r = await um("SELECT * FROM escala_usuarios WHERE login = ? AND ativo = 1", [s.l]);
  if (!r || impressao(String(r.senha_hash)) !== s.v) return null;
  return toUsuario(r);
}

/** Enquanto nenhum usuário foi cadastrado, o sistema fica aberto como administrador local. */
const ADMIN_LOCAL: Usuario = { id: "local", login: "local", nome: "Administrador (sem login)", perfil: "ADMIN", lojaId: null, ativo: true };

/** Usuário da requisição atual, ou null se não houver sessão válida. */
export async function usuarioOpcional(): Promise<Usuario | null> {
  await criarAdminInicialPorAmbiente();
  if (!(await existemUsuarios())) return ADMIN_LOCAL;
  return usuarioDaSessao((await cookies()).get(COOKIE_SESSAO)?.value);
}

/** Para rotas da API: lança 401 sem sessão válida. */
export async function usuarioAtual(): Promise<Usuario> {
  const u = await usuarioOpcional();
  if (!u) throw new ErroAcesso("Sessão expirada. Entre novamente.", 401);
  return u;
}

/** Para páginas: redireciona ao login sem sessão válida. */
export async function usuarioPagina(): Promise<Usuario> {
  const u = await usuarioOpcional();
  if (!u) redirect("/login");
  return u;
}

// ---------- Permissões ----------

export const ehAdmin = (u: Usuario) => u.perfil === "ADMIN";

/** Administrador e RH/DP: todas as lojas, escalas, convenção coletiva e feriados. */
export const ehGestao = (u: Usuario) => u.perfil === "ADMIN" || u.perfil === "RH";

export function podeVerLoja(u: Usuario, lojaId: string): boolean {
  return ehGestao(u) || u.lojaId === lojaId;
}

export function exigirAdmin(u: Usuario) {
  if (!ehAdmin(u)) throw new ErroAcesso("Apenas administradores podem fazer isso.");
}

/** Só o RH/DP (e o administrador) gera, altera, publica, reabre ou exclui escalas. */
export const podeAlterarEscala = ehGestao;

export function exigirRH(u: Usuario) {
  if (!podeAlterarEscala(u)) throw new ErroAcesso("Só o RH/DP pode alterar a escala.");
}

/** Convenção coletiva, regras da empresa e feriados: RH/DP e administrador. */
export function exigirGestao(u: Usuario) {
  if (!ehGestao(u)) throw new ErroAcesso("Só o RH/DP ou o administrador pode alterar isso.");
}

export function exigirLoja(u: Usuario, lojaId: string | null | undefined) {
  if (!lojaId || !podeVerLoja(u, lojaId)) throw new ErroAcesso("Sem acesso a esta loja.");
}

/** Filtra uma lista pelas lojas que o usuário pode ver. */
export function filtrarPorLoja<T>(u: Usuario, itens: T[], loja: (x: T) => string): T[] {
  return ehGestao(u) ? itens : itens.filter((x) => loja(x) === u.lojaId);
}
