import "server-only";
import { todos } from "./db";
import { listarSetores, obterColaborador, obterEmpresa, obterEscala, obterLoja } from "./repo";

/**
 * Dados pessoais de um colaborador, para atender ao direito de acesso do titular (LGPD, art. 18, II):
 * cadastro e escalas publicadas em que aparece.
 */
export async function dadosDoTitular(colaboradorId: string) {
  const c = await obterColaborador(colaboradorId);
  if (!c) return null;
  const { lojaId, ...cadastro } = c;
  const loja = await obterLoja(lojaId);
  const setor = (await listarSetores(lojaId)).find((s) => s.id === c.setorId);
  const escalas = [];
  for (const r of await todos("SELECT id FROM escala_escalas WHERE loja_id = ? AND status = 'PUBLICADA' ORDER BY inicio", [lojaId])) {
    const e = await obterEscala(String(r.id));
    const dias = e?.resultado.escala.dias[colaboradorId];
    if (e && dias) escalas.push({ inicio: e.entrada.inicio, semanas: e.entrada.semanas, publicadaEm: e.publicadoEm, dias });
  }
  return {
    geradoEm: new Date().toISOString(),
    controlador: (await obterEmpresa()).nome,
    titular: { nome: c.nome, loja: loja?.nome ?? lojaId, setor: setor?.nome ?? c.setorId },
    cadastro,
    escalasPublicadas: escalas,
  };
}

export const respostaJson = (dados: unknown, nome: string) =>
  new Response(JSON.stringify(dados, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
