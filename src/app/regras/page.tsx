import { LISTA_REGIMES } from "@/lib/engine/regimes";
import { listarFeriados, listarLojas, obterEmpresa } from "@/lib/server/repo";
import { EmpresaForm } from "@/components/EmpresaForm";
import { ehAdmin, ehGestao, usuarioPagina } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { RegrasForm } from "@/components/RegrasForm";
import { fmtData } from "@/lib/api";

export const dynamic = "force-dynamic";

const REGRAS_FIXAS: [string, string][] = [
  ["Folga dominical no comércio", "A folga deve coincidir com o domingo pelo menos 1 vez a cada 3 semanas (Lei 10.101/2000, art. 6º, parágrafo único)."],
  ["Revezamento quinzenal", "Quando marcado no colaborador, domingo de folga a cada 2 semanas (CLT art. 386)."],
  ["Dias consecutivos", "No máximo 6 dias seguidos de trabalho; a folga não pode passar do 7º dia (OJ 410 SDI-1/TST)."],
  ["Interjornada", "Mínimo de 11h entre o fim de uma jornada e o início da seguinte (CLT art. 66)."],
  ["Descanso semanal", "24h de DSR + 11h de interjornada = 35h seguidas de descanso por semana (CLT art. 67; Súmula 110/TST)."],
  ["Intervalo intrajornada", "1h para jornadas acima de 6h; 15 min entre 4h e 6h (CLT art. 71)."],
  ["Jornada diária", "8h normais (CF art. 7º, XIII). Até 10h somente com acordo de compensação (CLT art. 59)."],
  ["Menores de 18 anos", "Proibido o trabalho noturno, das 22h às 5h (CLT art. 404)."],
  ["Feriados no comércio", "Exigem autorização em convenção coletiva (Lei 10.101/2000, art. 6º-A; Portaria MTE 3.665/2023)."],
];

export default async function Regras() {
  const u = await usuarioPagina();
  if (!ehGestao(u)) redirect("/");
  const { nome, regras, encarregado } = await obterEmpresa();
  const feriados = await listarFeriados();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Regimes de jornada, regras legais aplicadas pelo motor, convenção coletiva, feriados e dados da empresa.</p>
        </div>
      </div>

      <div className="grid g3">
        {LISTA_REGIMES.map((r) => (
          <div className="card" key={r.id}>
            <h2 style={{ marginBottom: 4 }}>{r.nome}</h2>
            <p className="small muted">
              {r.vigenciaInicio > "2000-01-01" ? `De ${fmtData(r.vigenciaInicio)}` : "Até"}
              {r.vigenciaFim ? `${r.vigenciaInicio > "2000-01-01" ? " a " : " "}${fmtData(r.vigenciaFim)}` : " em diante"}
            </p>
            <p>{r.descricao}</p>
            <table>
              <tbody>
                <tr><td>Horas semanais</td><td className="num">{r.horasSemanaisMax}h</td></tr>
                <tr><td>Folgas por semana</td><td className="num">{r.folgasSemanaisMin}</td></tr>
                <tr><td>Folga no domingo</td><td className="num">{r.preferirFolgaNoDomingo ? "preferencial + 1 a cada 3 sem." : "1 a cada 3 semanas"}</td></tr>
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 8 }}>{r.fundamentacao.join(" · ")}</p>
          </div>
        ))}
      </div>

      <RegrasForm regras={regras} feriados={feriados} lojas={(await listarLojas()).map((l) => ({ id: l.id, nome: l.nome }))} />

      {ehAdmin(u) && <EmpresaForm nome={nome} temLojas={(await listarLojas()).length > 0} encarregado={encarregado} />}

      <div className="card">
        <h2>Regras verificadas em toda escala</h2>
        <table>
          <tbody>
            {REGRAS_FIXAS.map(([t, d]) => (
              <tr key={t}><td style={{ width: 220 }}><strong>{t}</strong></td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 10 }}>
          A convenção coletiva da sua categoria pode ter regras mais favoráveis (por exemplo, mais domingos de folga ou adicional para domingos e feriados).
          Valide estas configurações com o jurídico/RH antes de usar em produção.
        </p>
      </div>
    </div>
  );
}
