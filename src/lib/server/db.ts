import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FERIADOS_DEMO, LOJAS_DEMO, colaboradoresDemo, setoresDemo } from "../seed/demo";
import { REGRAS_PADRAO } from "../engine/regimes";
import { gerarEscala } from "../engine/gerador";
import { ESCALA_EXEMPLO, LOJA_EXEMPLO, OPERADORES_EXEMPLO, SETOR_CAIXA } from "../seed/exemplo";

/**
 * Banco de dados local: SQLite em arquivo (node:sqlite), por padrão em data/escala.db
 * (ou no caminho de ESCALA_DB). Nada sai do servidor da empresa.
 * Todas as tabelas têm o prefixo `escala_`.
 */

export type Linha = Record<string, unknown>;

export interface Executor {
  todos(sql: string, params?: unknown[]): Promise<Linha[]>;
  um(sql: string, params?: unknown[]): Promise<Linha | undefined>;
  executar(sql: string, params?: unknown[]): Promise<void>;
  /** Vários comandos de uma vez (DDL), sem parâmetros. */
  script(sql: string): Promise<void>;
}

export interface Motor extends Executor {
  tipo: "sqlite";
  transacao<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
}

// ---------- Motor SQLite ----------

export function motorSqlite(arquivo: string): Motor {
  if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const ex: Executor = {
    async todos(sql, p = []) {
      return db.prepare(sql).all(...(p as never[])) as Linha[];
    },
    async um(sql, p = []) {
      return db.prepare(sql).get(...(p as never[])) as Linha | undefined;
    },
    async executar(sql, p = []) {
      db.prepare(sql).run(...(p as never[]));
    },
    async script(sql) {
      db.exec(sql);
    },
  };
  // Uma transação por vez: o SQLite tem uma única conexão.
  let fila: Promise<unknown> = Promise.resolve();
  return {
    ...ex,
    tipo: "sqlite",
    transacao(fn) {
      const r = fila.then(async () => {
        db.exec("BEGIN");
        try {
          const v = await fn(ex);
          db.exec("COMMIT");
          return v;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      });
      fila = r.catch(() => undefined);
      return r;
    },
  };
}

// ---------- Esquema ----------

const SQLITE_V1 = `
CREATE TABLE IF NOT EXISTS empresa (id INTEGER PRIMARY KEY CHECK (id = 1), nome TEXT NOT NULL, regras TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lojas (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, cidade TEXT NOT NULL DEFAULT '', abre TEXT NOT NULL, fecha TEXT NOT NULL,
  abre_domingo TEXT NOT NULL, fecha_domingo TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS setores (
  id TEXT PRIMARY KEY, loja_id TEXT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE, nome TEXT NOT NULL,
  inicios TEXT NOT NULL, demanda TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS colaboradores (
  id TEXT PRIMARY KEY, loja_id TEXT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES setores(id) ON DELETE CASCADE, nome TEXT NOT NULL, dados TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS colaboradores_loja ON colaboradores(loja_id);
CREATE TABLE IF NOT EXISTS feriados (data TEXT PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS escalas (
  id TEXT PRIMARY KEY, loja_id TEXT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE, inicio TEXT NOT NULL,
  semanas INTEGER NOT NULL, regime_id TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, dados TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS escalas_loja ON escalas(loja_id);
`;

/**
 * Migrações do SQLite, controladas por `PRAGMA user_version` (índice 0 → versão 1).
 * Nunca altere uma migração já publicada; acrescente outra.
 */
const SQLITE_MIGRACOES: string[] = [
  "",
  // v2: publicação, histórico de alterações e feriados por loja
  `
  ALTER TABLE escalas ADD COLUMN status TEXT NOT NULL DEFAULT 'RASCUNHO';
  ALTER TABLE escalas ADD COLUMN publicado_em TEXT;
  ALTER TABLE escalas ADD COLUMN publicado_por TEXT;
  CREATE TABLE escala_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, escala_id TEXT NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
    quando TEXT NOT NULL, usuario TEXT NOT NULL, acao TEXT NOT NULL, detalhe TEXT
  );
  CREATE INDEX escala_eventos_escala ON escala_eventos(escala_id);
  CREATE TABLE feriados_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, nome TEXT NOT NULL,
    loja_id TEXT REFERENCES lojas(id) ON DELETE CASCADE
  );
  INSERT INTO feriados_v2 (data, nome) SELECT data, nome FROM feriados;
  DROP TABLE feriados;
  ALTER TABLE feriados_v2 RENAME TO feriados;
  CREATE UNIQUE INDEX feriados_data_loja ON feriados(data, IFNULL(loja_id, ''));
  `,
  // v3: usuários e sessões
  `
  CREATE TABLE usuarios (
    id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('ADMIN', 'GERENTE')), loja_id TEXT REFERENCES lojas(id) ON DELETE SET NULL,
    senha_hash TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
  );
  CREATE TABLE sessoes (
    token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL, expira_em TEXT NOT NULL
  );
  CREATE INDEX sessoes_usuario ON sessoes(usuario_id);
  `,
  // v4: prefixo escala_, métricas em coluna, login em minúsculas,
  // sessões no cookie (tabela de sessões removida)
  `
  ALTER TABLE empresa RENAME TO escala_empresa;
  ALTER TABLE lojas RENAME TO escala_lojas;
  ALTER TABLE setores RENAME TO escala_setores;
  ALTER TABLE colaboradores RENAME TO escala_colaboradores;
  ALTER TABLE feriados RENAME TO escala_feriados;
  ALTER TABLE escalas RENAME TO escala_escalas;
  ALTER TABLE usuarios RENAME TO escala_usuarios;
  DROP TABLE sessoes;
  ALTER TABLE escala_escalas ADD COLUMN metricas TEXT;
  ALTER TABLE escala_escalas ADD COLUMN regimes TEXT;
  UPDATE escala_escalas SET metricas = json_extract(dados, '$.resultado.metricas'),
                            regimes = json_extract(dados, '$.resultado.escala.regimes');
  UPDATE escala_usuarios SET login = lower(login);
  `,
  // v5: link pessoal do colaborador e pedidos de troca
  `
  CREATE TABLE escala_acessos (
    colaborador_id TEXT PRIMARY KEY REFERENCES escala_colaboradores(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL UNIQUE, criado_em TEXT NOT NULL
  );
  CREATE TABLE escala_pedidos (
    id TEXT PRIMARY KEY, escala_id TEXT NOT NULL REFERENCES escala_escalas(id) ON DELETE CASCADE,
    colaborador_id TEXT NOT NULL REFERENCES escala_colaboradores(id) ON DELETE CASCADE,
    colega_id TEXT REFERENCES escala_colaboradores(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, detalhe TEXT NOT NULL, status TEXT NOT NULL, criado_em TEXT NOT NULL,
    decidido_em TEXT, decidido_por TEXT, resposta TEXT
  );
  CREATE INDEX escala_pedidos_escala ON escala_pedidos(escala_id);
  CREATE INDEX escala_pedidos_colaborador ON escala_pedidos(colaborador_id);
  CREATE INDEX escala_pedidos_colega ON escala_pedidos(colega_id);
  `,
  // v6: perfil RH/DP (o SQLite não altera CHECK: recria a tabela de usuários)
  `
  CREATE TABLE escala_usuarios_v6 (
    id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('ADMIN', 'RH', 'GERENTE')), loja_id TEXT REFERENCES escala_lojas(id) ON DELETE SET NULL,
    senha_hash TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL
  );
  INSERT INTO escala_usuarios_v6 (id, login, nome, perfil, loja_id, senha_hash, ativo, criado_em)
    SELECT id, login, nome, perfil, loja_id, senha_hash, ativo, criado_em FROM escala_usuarios;
  DROP TABLE escala_usuarios;
  ALTER TABLE escala_usuarios_v6 RENAME TO escala_usuarios;
  `,
  // v7: LGPD — registro de acessos a dados pessoais e contato do encarregado
  `
  CREATE TABLE escala_registro (
    id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, quem TEXT NOT NULL, perfil TEXT NOT NULL,
    acao TEXT NOT NULL, alvo TEXT, loja_id TEXT, ip TEXT
  );
  CREATE INDEX escala_registro_quando ON escala_registro(quando);
  ALTER TABLE escala_empresa ADD COLUMN encarregado TEXT;
  `,
  // v8: link pessoal do colaborador e pedidos de troca foram removidos
  `
  DROP TABLE IF EXISTS escala_pedidos;
  DROP TABLE IF EXISTS escala_acessos;
  `,
];

async function prepararSqlite(m: Motor) {
  await m.script(SQLITE_V1);
  const atual = Number((await m.um("PRAGMA user_version"))?.user_version ?? 0);
  for (let v = Math.max(atual, 1); v < SQLITE_MIGRACOES.length; v++) {
    await m.transacao(async (tx) => {
      await tx.script(SQLITE_MIGRACOES[v]);
      await tx.script(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

// ---------- Dados iniciais ----------

type Semente = "demo" | "exemplo" | "nenhuma";

function sementeEscolhida(): Semente {
  if (process.env.ESCALA_SEM_DEMO === "1") return "nenhuma";
  return process.env.ESCALA_SEED === "exemplo" ? "exemplo" : "demo";
}

async function semearDemo(tx: Executor) {
  for (const [li, l] of LOJAS_DEMO.entries()) {
    await tx.executar("INSERT INTO escala_lojas VALUES (?, ?, ?, ?, ?, ?, ?)", [l.id, l.nome, l.cidade, l.abre, l.fecha, l.abreDomingo, l.fechaDomingo]);
    const setores = setoresDemo(l);
    for (const [i, s] of setores.entries()) {
      await tx.executar("INSERT INTO escala_setores VALUES (?, ?, ?, ?, ?, ?)", [s.id, l.id, s.nome, JSON.stringify(s.inicios), JSON.stringify(s.demanda), i]);
    }
    for (const c of colaboradoresDemo(l, setores, li + 1)) {
      await tx.executar("INSERT INTO escala_colaboradores VALUES (?, ?, ?, ?, ?)", [c.id, l.id, c.setorId, c.nome, JSON.stringify(c)]);
    }
  }
}

/**
 * Loja Modelo (dados fictícios) com a escala 5x2 já gerada. O gerador é determinístico:
 * qualquer instância cria a mesma escala, com o mesmo id.
 */
async function semearExemplo(tx: Executor) {
  const l = LOJA_EXEMPLO;
  const s = SETOR_CAIXA;
  await tx.executar("INSERT INTO escala_lojas VALUES (?, ?, ?, ?, ?, ?, ?)", [l.id, l.nome, l.cidade, l.abre, l.fecha, l.abreDomingo, l.fechaDomingo]);
  await tx.executar("INSERT INTO escala_setores VALUES (?, ?, ?, ?, ?, ?)", [s.id, l.id, s.nome, JSON.stringify(s.inicios), JSON.stringify(s.demanda), 0]);
  for (const c of OPERADORES_EXEMPLO) {
    await tx.executar("INSERT INTO escala_colaboradores VALUES (?, ?, ?, ?, ?)", [c.id, l.id, c.setorId, c.nome, JSON.stringify(c)]);
  }
  const e = ESCALA_EXEMPLO;
  const entrada = { inicio: e.inicio, semanas: e.semanas, regimeId: e.regimeId, regras: REGRAS_PADRAO, setores: [s], colaboradores: OPERADORES_EXEMPLO, feriados: FERIADOS_DEMO };
  const resultado = gerarEscala(entrada);
  const quando = "2026-10-30T12:00:00.000Z";
  await tx.executar(
    `INSERT INTO escala_escalas (id, loja_id, inicio, semanas, regime_id, criado_em, atualizado_em, dados, metricas, regimes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, l.id, e.inicio, e.semanas, e.regimeId, quando, quando, JSON.stringify({ entrada, resultado }),
      JSON.stringify(resultado.metricas), JSON.stringify(resultado.escala.regimes)],
  );
  await tx.executar("INSERT INTO escala_eventos (escala_id, quando, usuario, acao, detalhe) VALUES (?, ?, ?, ?, ?)", [
    e.id, quando, "sistema", "GERADA",
    JSON.stringify({ colaboradores: OPERADORES_EXEMPLO.length, comHistorico: 0, erros: resultado.metricas.erros, cobertura: resultado.metricas.coberturaPct }),
  ]);
}

async function semearSeVazio(m: Motor) {
  await m.transacao(async (tx) => {
    if (await tx.um("SELECT 1 AS x FROM escala_empresa")) return;
    const semente = sementeEscolhida();
    const nome = semente === "nenhuma" ? "Minha empresa" : semente === "exemplo" ? "Supermercado Exemplo" : "Rede de Supermercados (demo)";
    await tx.executar("INSERT INTO escala_empresa (id, nome, regras) VALUES (1, ?, ?)", [nome, JSON.stringify(REGRAS_PADRAO)]);
    if (semente === "nenhuma") return;
    for (const f of FERIADOS_DEMO) await tx.executar("INSERT INTO escala_feriados (data, nome) VALUES (?, ?)", [f.data, f.nome]);
    if (semente === "demo") await semearDemo(tx);
    else await semearExemplo(tx);
  });
}

// ---------- Acesso ----------

const global_ = globalThis as unknown as { __escalaMotor?: Motor; __escalaPronto?: Promise<void> };
const contexto = new AsyncLocalStorage<Executor>();

function criarMotor(): Motor {
  return motorSqlite(process.env.ESCALA_DB ?? path.join(process.cwd(), "data", "escala.db"));
}

/** Troca o motor (testes). Reinicia a preparação do esquema. */
export function usarMotor(m: Motor) {
  global_.__escalaMotor = m;
  global_.__escalaPronto = undefined;
}

export function motor(): Motor {
  global_.__escalaMotor ??= criarMotor();
  return global_.__escalaMotor;
}

/** Garante esquema e dados iniciais uma vez por processo. */
function pronto(): Promise<void> {
  global_.__escalaPronto ??= (async () => {
    const m = motor();
    await prepararSqlite(m);
    await semearSeVazio(m);
  })().catch((e) => {
    global_.__escalaPronto = undefined;
    throw e;
  });
  return global_.__escalaPronto;
}

const atual = () => contexto.getStore() ?? motor();

export async function todos(sql: string, params: unknown[] = []): Promise<Linha[]> {
  await pronto();
  return atual().todos(sql, params);
}

export async function um(sql: string, params: unknown[] = []): Promise<Linha | undefined> {
  await pronto();
  return atual().um(sql, params);
}

export async function executar(sql: string, params: unknown[] = []): Promise<void> {
  await pronto();
  return atual().executar(sql, params);
}

/** Executa `fn` numa transação; consultas dentro dela (todos/um/executar) usam a mesma transação. */
export async function transacao<T>(fn: () => Promise<T>): Promise<T> {
  await pronto();
  if (contexto.getStore()) return fn();
  return motor().transacao((tx) => contexto.run(tx, fn));
}
