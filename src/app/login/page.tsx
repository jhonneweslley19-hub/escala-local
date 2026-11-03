import { redirect } from "next/navigation";
import { criarAdminInicialPorAmbiente, existemUsuarios, usuarioOpcional } from "@/lib/server/auth";
import { obterEmpresa } from "@/lib/server/repo";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function Login() {
  await criarAdminInicialPorAmbiente(); // instância recém-iniciada ainda não criou o administrador
  if (!await existemUsuarios() || (await usuarioOpcional())) redirect("/");
  return (
    <div className="login-fundo">
      <div className="card login-card stack">
        <div className="brand" style={{ padding: "0 0 14px" }}>
          <b>{(await obterEmpresa()).nome}</b>
          <small>Gestão de escalas</small>
        </div>
        <LoginForm />
        <div className="rodape-links"><a href="/privacidade">Privacidade e proteção de dados</a></div>
      </div>
    </div>
  );
}
