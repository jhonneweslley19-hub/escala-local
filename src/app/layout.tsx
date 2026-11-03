import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { MenuUsuario } from "@/components/MenuUsuario";
import { SCRIPT_TEMA, SeletorTema } from "@/components/SeletorTema";
import { obterEmpresa } from "@/lib/server/repo";
import { existemUsuarios, usuarioOpcional } from "@/lib/server/auth";
import { NOME_PERFIL } from "@/lib/perfis";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Escala — Gestão de Escalas",
  description: "Escalas de trabalho por demanda para supermercados, em conformidade com a CLT e a EC 141/2026.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioOpcional();
  // Sem sessão (tela de login): só o conteúdo, sem menu.
  if (!usuario) {
    return (
      <html lang="pt-BR" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        </head>
        <body>
          <div className="login-tema">
            <SeletorTema compacto />
          </div>
          {children}
        </body>
      </html>
    );
  }
  const semLogin = !await existemUsuarios();
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <b>{(await obterEmpresa()).nome}</b>
              <small>Gestão de escalas</small>
            </div>
            <Nav perfil={usuario.perfil} />
            <MenuUsuario nome={usuario.nome} perfil={usuario.perfil} nomePerfil={NOME_PERFIL[usuario.perfil]} comLogin={!semLogin} />
          </aside>
          <main className="main">
            {semLogin && (
              <div className="aviso-demo">
                O sistema está aberto, sem login. <a href="/usuarios">Crie o primeiro administrador</a> para exigir usuário e senha.
              </div>
            )}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
