import { Navigate, Outlet, useLocation } from "react-router-dom"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { useSession } from "./session.tsx"
import type { Papel } from "../types.ts"

export function RequireAuth() {
  const session = useSession()
  const location = useLocation()
  if (!session.configured) return <Setup />
  if (session.loading) return <p className="muted page-loading">Carregando…</p>
  if (!session.userId) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequirePapel({ papel }: { papel: Papel }) {
  const session = useSession()
  if (session.loading) return <p className="muted page-loading">Carregando…</p>
  if (!session.papeis.includes(papel)) return <Navigate to="/" replace />
  return <Outlet />
}

export function HomeRedirect() {
  const session = useSession()
  if (!session.configured) return <Setup />
  if (session.loading) return <p className="muted page-loading">Carregando…</p>
  if (!session.userId) return <Navigate to="/login" replace />
  if (session.papeis.includes("administrador")) return <Navigate to="/escola" replace />
  if (session.papeis.includes("professor")) return <Navigate to="/professor" replace />
  if (session.papeis.includes("aluno")) return <Navigate to="/aluno" replace />
  return (
    <AuthLayout>
      <main className="center-card">
        <h1>Conta sem acesso</h1>
        <p>Peça à escola para concluir o seu convite.</p>
        <button className="btn secondary" type="button" onClick={() => session.signOut()}>
          Sair
        </button>
      </main>
    </AuthLayout>
  )
}

function Setup() {
  return (
    <AuthLayout>
      <main className="center-card">
        <p className="eyebrow">Vozear</p>
        <h1>Falta ligar o banco</h1>
        <p>
          Crie um arquivo <code>.env</code> com <code>VITE_SUPABASE_URL</code> e{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>. A chave secreta do Supabase não entra aqui.
        </p>
      </main>
    </AuthLayout>
  )
}
