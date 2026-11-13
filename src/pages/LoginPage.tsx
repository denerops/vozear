import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { ErrorNote } from "../components/chrome.tsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <main className="grid gap-6">
        <div className="grid gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Escola de música</p>
          <h1 className="font-heading text-2xl font-medium tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground">Agenda, recados e mensalidade no mesmo lugar.</p>
        </div>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <ErrorNote>{error}</ErrorNote>
          {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <Button variant="ghost" type="button" onClick={forgot}>
            Esqueci minha senha
          </Button>
        </form>
      </main>
    </AuthLayout>
  )
}
