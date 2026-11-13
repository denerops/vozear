import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { ErrorNote } from "../components/chrome.tsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    <AuthLayout>
      <main className="grid gap-6">
        <div className="grid gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Primeiro acesso</p>
          <h1 className="font-heading text-2xl font-medium tracking-tight">Defina sua senha</h1>
        </div>
        {session.loading ? <p className="text-sm text-muted-foreground">Conferindo o convite…</p> : null}
        {!session.loading && !session.userId ? (
          <p className="text-sm">Abra o link do e-mail neste aparelho. Se ele expirou, peça outro convite.</p>
        ) : null}
        {session.userId && !done ? (
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar senha"}
            </Button>
          </form>
        ) : null}
        {done ? (
          <p className="text-sm">
            Senha definida. <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/">Entrar na escola</Link>
          </p>
        ) : null}
      </main>
    </AuthLayout>
  )
}
