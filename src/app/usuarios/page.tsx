import { redirect } from "next/navigation";
import { existemUsuarios, listarUsuarios, usuarioPagina } from "@/lib/server/auth";
import { listarLojas } from "@/lib/server/repo";
import { UsuariosView } from "@/components/UsuariosView";

export const dynamic = "force-dynamic";

export default async function Usuarios() {
  const u = await usuarioPagina();
  if (u.perfil !== "ADMIN") redirect("/");
  return (
    <UsuariosView
      usuarios={await listarUsuarios()}
      lojas={(await listarLojas()).map((l) => ({ id: l.id, nome: l.nome }))}
      primeiro={!await existemUsuarios()}
      eu={u.id}
    />
  );
}
