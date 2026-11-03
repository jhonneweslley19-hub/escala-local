import type { Metadata } from "next";
import { obterEmpresa } from "@/lib/server/repo";
import { RETENCAO_DIAS } from "@/lib/server/registro";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacidade — Escala" };

/** Aviso de privacidade para colaboradores e usuários (LGPD, arts. 9º e 18). Pública, sem login. */
export default async function Privacidade() {
  const { nome, encarregado } = await obterEmpresa();
  return (
    <div className="minha stack privacidade">
      <div>
        <h1>Privacidade e proteção de dados</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>Sistema de escalas de trabalho de {nome}</p>
      </div>

      <div className="card stack">
        <h2>Quem cuida dos seus dados</h2>
        <p>
          <b>{nome}</b> é a controladora dos dados tratados neste sistema.{" "}
          {encarregado ? (
            <>Encarregado de dados: <b>{encarregado.nome}</b> — <a href={`mailto:${encarregado.email}`}>{encarregado.email}</a>.</>
          ) : (
            <>Para falar sobre os seus dados, procure o RH/DP da empresa.</>
          )}
        </p>
      </div>

      <div className="card stack">
        <h2>Quais dados e para quê</h2>
        <ul>
          <li><b>Colaboradores:</b> nome, loja e setor, carga horária, dias e horários em que não pode trabalhar, se é menor de 18 anos, férias e ausências (sem diagnóstico nem atestado), escalas e turnos.</li>
          <li><b>Usuários do sistema:</b> nome, usuário, perfil e o registro de acessos (data, hora, IP e o que foi visto ou alterado).</li>
        </ul>
        <p>
          Os dados servem para montar as escalas, cumprir as regras de jornada e descanso (CLT e Emenda Constitucional 141/2026),
          e planejar o quadro de pessoal. A base legal é o cumprimento de obrigação
          legal e a execução do contrato de trabalho (LGPD, art. 7º, II e V). De ausências por saúde o sistema guarda só que a pessoa está
          afastada, para não escalá-la.
        </p>
      </div>

      <div className="card stack">
        <h2>Quem vê o quê</h2>
        <table>
          <tbody>
            <tr><td><b>Administrador e RH/DP</b></td><td>Todas as lojas, inclusive o motivo de ausências.</td></tr>
            <tr><td><b>Gerente de loja</b></td><td>Escala e cadastro da própria loja, sem o motivo de afastamentos e licenças.</td></tr>
                        <tr><td><b>Mural da loja</b></td><td>Horários e folgas; ausências aparecem só como “férias” ou “ausente”.</td></tr>
          </tbody>
        </table>
        <p className="small muted" style={{ margin: 0 }}>
          O sistema funciona num servidor da própria empresa: os dados ficam na rede interna e não são enviados a terceiros.
        </p>
      </div>

      <div className="card stack">
        <h2>Por quanto tempo</h2>
        <ul>
          <li><b>Cadastro:</b> enquanto durar o vínculo. Ao excluir o colaborador, ele é apagado.</li>
          <li><b>Escalas publicadas:</b> pelo prazo em que podem ser exigidas em questões trabalhistas (até 5 anos — Constituição, art. 7º, XXIX).</li>
          <li><b>Registro de acessos:</b> {Math.round(RETENCAO_DIAS / 30)} meses; depois é apagado automaticamente.</li>
        </ul>
      </div>

      <div className="card stack">
        <h2>Seus direitos</h2>
        <p>
          Você pode confirmar que seus dados são tratados, ter acesso a eles, pedir correção de dados errados e saber com quem são
          compartilhados (LGPD, art. 18). Para pedir uma cópia dos seus dados ou fazer outro pedido, fale com {encarregado ? `o encarregado (${encarregado.email})` : "o RH/DP"}.
        </p>
      </div>

      <div className="card stack">
        <h2>Segurança</h2>
        <p>
          Cada pessoa entra com usuário e senha próprios, e as senhas ficam guardadas de forma cifrada (hash). O acesso é limitado pelo perfil.
          O sistema registra quem viu, exportou ou alterou dados pessoais.
        </p>
      </div>
    </div>
  );
}
