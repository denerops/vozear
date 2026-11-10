import { NavLink, Outlet } from "react-router-dom"
import { useSession } from "../auth/session.tsx"

export function Shell() {
  const session = useSession()
  const admin = session.papeis.includes("administrador")
  const professor = session.papeis.includes("professor")
  const aluno = session.papeis.includes("aluno")

  const links = [
    admin ? { to: "/escola", label: "Hoje", end: true } : null,
    admin ? { to: "/escola/agenda", label: "Agenda", end: false } : null,
    admin ? { to: "/escola/alunos", label: "Alunos", end: false } : null,
    admin ? { to: "/escola/professores", label: "Professores", end: false } : null,
    admin ? { to: "/escola/mensalidades", label: "Mensalidades", end: false } : null,
    admin ? { to: "/escola/configuracao", label: "Escola", end: false } : null,
    professor ? { to: "/professor", label: "Minha semana", end: true } : null,
    aluno ? { to: "/aluno", label: "Agenda", end: true } : null,
    aluno ? { to: "/aluno/pagamentos", label: "Pagamentos", end: false } : null,
  ].filter((item): item is { to: string; label: string; end: boolean } => item !== null)

  return (
    <div className="shell">
      <nav className="nav">
        <NavLink to="/" className="brand" end>
          Vozear
        </NavLink>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-user">
          <span>{session.nome || session.email}</span>
          <button type="button" onClick={() => session.signOut()}>
            Sair
          </button>
        </div>
      </nav>
      <div className="content">
        <Outlet />
      </div>
    </div>
  )
}
