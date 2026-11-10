import type { ReactNode } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { LogoMark } from "./Brand.tsx"

type IconName = "home" | "calendar" | "people" | "cap" | "card" | "gear" | "exit"

type NavItem = { to: string; label: string; end: boolean; icon: IconName }

export function Shell() {
  const session = useSession()
  const admin = session.papeis.includes("administrador")
  const professor = session.papeis.includes("professor")
  const aluno = session.papeis.includes("aluno")

  const links: NavItem[] = [
    admin ? { to: "/escola", label: "Hoje", end: true, icon: "home" } : null,
    admin ? { to: "/escola/agenda", label: "Agenda", end: false, icon: "calendar" } : null,
    admin ? { to: "/escola/alunos", label: "Alunos", end: false, icon: "people" } : null,
    admin ? { to: "/escola/professores", label: "Professores", end: false, icon: "cap" } : null,
    admin ? { to: "/escola/mensalidades", label: "Mensalidades", end: false, icon: "card" } : null,
    professor ? { to: "/professor", label: "Minha semana", end: true, icon: "calendar" } : null,
    aluno ? { to: "/aluno", label: "Agenda", end: true, icon: "calendar" } : null,
    aluno ? { to: "/aluno/pagamentos", label: "Pagamentos", end: false, icon: "card" } : null,
  ].filter((item): item is NavItem => item !== null)

  const settings: NavItem | null = admin
    ? { to: "/escola/configuracao", label: "Configurações", end: false, icon: "gear" }
    : null

  const who = session.nome || session.email || ""
  const initials =
    who
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  const roleLabel = admin ? "Administração" : professor ? "Professor" : "Aluno"

  return (
    <div className="shell">
      <nav className="nav">
        <NavLink to="/" className="brand" end aria-label="Vozear">
          <LogoMark size={34} />
          <span className="brand-name">Vozear</span>
        </NavLink>
        <p className="nav-label">Menu</p>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <NavIcon name={link.icon} />
              <span className="nav-text">{link.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="nav-foot">
          {settings ? (
            <NavLink to={settings.to} end={settings.end}>
              <NavIcon name={settings.icon} />
              <span className="nav-text">{settings.label}</span>
            </NavLink>
          ) : null}
          <div className="nav-user">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="nav-user-text">
              <strong>{who}</strong>
              <small>{roleLabel}</small>
            </span>
            <button type="button" aria-label="Sair" title="Sair" onClick={() => session.signOut()}>
              <NavIcon name="exit" />
            </button>
          </div>
        </div>
      </nav>
      <div className="content">
        <Outlet />
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: IconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  const paths: Record<IconName, ReactNode> = {
    home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />,
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5V7M16 3.5V7M4 10h16" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="2.4" />
        <path d="M4.5 18.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" />
        <circle cx="16" cy="8.5" r="2" />
        <path d="M16 14.5c1.6.2 2.9 1.2 3.5 3" />
      </>
    ),
    cap: (
      <>
        <path d="M3 10 12 6l9 4-9 4z" />
        <path d="M7 12.2V16c1.5 1.3 3.1 2 5 2s3.5-.7 5-2v-3.8" />
        <path d="M21 10.5V16" />
      </>
    ),
    card: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="M3.5 10.5h17" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
      </>
    ),
    exit: (
      <>
        <path d="M10 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H10" />
        <path d="M14.5 8.5 18 12l-3.5 3.5M18 12H9.5" />
      </>
    ),
  }
  return <svg {...common}>{paths[name]}</svg>
}
