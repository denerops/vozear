import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { ErrorNote } from "../components/ui.tsx"
import { client } from "../lib/supabase.ts"

export function AccessPage() {
  const session = useSession()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const { error: updateError } = await client().auth.updateUser({ password })
    setPending(false)
    if (updateError) setError("Não foi possível definir a senha. Abra o link do e-mail de novo.")
    else setDone(true)
  }

  return (
    <main className="center-card">
      <p className="eyebrow">Primeiro acesso</p>
      <h1>Defina sua senha</h1>
      {session.loading ? <p className="muted">Conferindo o convite…</p> : null}
      {!session.loading && !session.userId ? (
        <p>Abra o link do e-mail neste aparelho. Se ele expirou, peça outro convite.</p>
      ) : null}
      {session.userId && !done ? (
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
      ) : null}
      {done ? (
        <p>
          Senha definida. <Link to="/">Entrar na escola</Link>
        </p>
      ) : null}
    </main>
  )
}
