/**
 * Perfis de acesso:
 *  - ADMIN: dono do sistema; altera tudo, inclusive usuários, lojas e dados da empresa.
 *  - RH: RH/DP; organiza e valida as escalas de todas as lojas (gera, altera, publica),
 *    cuida de colaboradores, demanda, convenção coletiva e feriados.
 *  - GERENTE: gerente de loja; consulta a escala da própria loja e mantém colaboradores e demanda dela.
 */
export type Perfil = "ADMIN" | "RH" | "GERENTE";

export const PERFIS: Perfil[] = ["ADMIN", "RH", "GERENTE"];

export const NOME_PERFIL: Record<Perfil, string> = { ADMIN: "Administrador", RH: "RH/DP", GERENTE: "Gerente de loja" };

export const DESCRICAO_PERFIL: Record<Perfil, string> = {
  ADMIN: "Altera tudo: escalas, configurações, lojas, usuários e dados da empresa.",
  RH: "Organiza e valida as escalas de todas as lojas: gera, altera e publica; cuida de colaboradores, demanda, convenção coletiva e feriados.",
  GERENTE: "Consulta, imprime e exporta a escala da própria loja; mantém colaboradores e demanda da loja.",
};
