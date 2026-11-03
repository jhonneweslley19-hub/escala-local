import { usuarioPagina } from "@/lib/server/auth";
import { TrocarSenha } from "@/components/TrocarSenha";

export const dynamic = "force-dynamic";

export default async function Conta() {
  const u = await usuarioPagina();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Minha senha</h1>
          <p className="muted">{u.nome} · usuário <strong>{u.login}</strong></p>
        </div>
      </div>
      <TrocarSenha />
    </div>
  );
}
