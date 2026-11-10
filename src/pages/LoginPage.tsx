import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { ErrorNote } from "../components/ui.tsx"
import { accessRedirect } from "../lib/format.ts"
import { client } from "../lib/supabase.ts"

export function LoginPage() {
  const session = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!session.configured) return <Navigate to="/" replace />
  if (!session.loading && session.userId) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setInfo(null)
    const { error: signError } = await client().auth.signInWithPassword({ email, password })
    setPending(false)
    if (signError) setError("E-mail ou senha não conferem.")
  }

  async function forgot() {
    setError(null)
    setInfo(null)
    if (!email) {
      setError("Informe o e-mail para receber o link.")
      return
    }
    const { error: resetError } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: accessRedirect(),
    })
    if (resetError) setError("Não foi possível enviar o e-mail agora.")
    else setInfo("Se a conta existir, o link de acesso está no e-mail.")
  }

  return (
    <AuthLayout>
      <main className="center-card">
        <p className="eyebrow">Escola de música</p>
        <h1>Entrar</h1>
        <p className="lede">Agenda, recados e mensalidade no mesmo lugar.</p>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <ErrorNote>{error}</ErrorNote>
          {info ? <p className="muted">{info}</p> : null}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </button>
          <button className="btn ghost" type="button" onClick={forgot}>
            Esqueci minha senha
          </button>
        </form>
      </main>
    </AuthLayout>
  )
}
