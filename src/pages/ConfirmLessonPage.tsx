import { useState } from "react"
import { useParams } from "react-router-dom"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { CardSkeleton, ErrorNote } from "../components/chrome.tsx"
import { Button } from "@/components/ui/button"
import { useQuery } from "../data/useQuery.ts"
import { formatWhen } from "../lib/dates.ts"
import { humanError } from "../lib/errors.ts"
import { client } from "../lib/supabase.ts"
import type { ConfirmacaoAula } from "../types.ts"

export function ConfirmLessonPage() {
  const { token = "" } = useParams()
  const query = useQuery(token ? `confirmacao:${token}` : null, async () => {
    const { data, error } = await client().rpc("ver_confirmacao", { p_token: token })
    if (error) throw error
    return (data ?? null) as ConfirmacaoAula | null
  })
  const [answer, setAnswer] = useState<ConfirmacaoAula | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [arming, setArming] = useState(false)
  const lesson = answer ?? query.data ?? null

  async function respond(resposta: "confirmar" | "cancelar") {
    setPending(true)
    setError(null)
    const { data, error: respondError } = await client().rpc("responder_confirmacao", {
      p_token: token,
      p_resposta: resposta,
    })
    setPending(false)
    setArming(false)
    if (respondError) {
      setError(humanError(respondError))
      return
    }
    setAnswer(data as ConfirmacaoAula)
  }

  return (
    <AuthLayout>
      <main className="grid gap-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sua aula</p>
        {query.pending && !lesson ? <CardSkeleton rows={2} /> : null}
        <ErrorNote>{error ?? query.error}</ErrorNote>
        {!query.pending && !query.error && !lesson ? (
          <>
            <h1 className="font-heading text-2xl font-medium tracking-tight">Link inválido</h1>
            <p className="text-sm text-muted-foreground">Este endereço não corresponde a uma aula. Peça um novo link para a escola.</p>
          </>
        ) : null}
        {lesson ? (
          <>
            <h1 className="font-heading text-2xl font-medium tracking-tight">{lesson.instrumento}</h1>
            <p className="text-sm text-muted-foreground">
              {formatWhen(lesson.inicio)} · {lesson.duracao_minutos} minutos
              <br />
              {lesson.aluno} com {lesson.professor}
            </p>
            {lesson.situacao === "cancelada" || lesson.confirmacao === "cancelada" ? (
              <p>Esta aula foi cancelada.</p>
            ) : !lesson.aberta ? (
              <p>Esta aula não aceita mais confirmação.</p>
            ) : lesson.confirmacao === "confirmada" ? (
              <div className="grid gap-3">
                <div className="grid gap-1 rounded-lg border border-[color-mix(in_oklch,var(--ok)_30%,white)] bg-[var(--ok-soft)] px-4 py-3 text-[var(--ok)]" role="status">
                  <strong>Aula confirmada</strong>
                  <span className="text-sm">A escola já recebeu a sua presença.</span>
                </div>
                {arming ? (
                  <>
                    <p className="text-sm text-muted-foreground">Cancelar cancela só esta data.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="destructive" type="button" disabled={pending} onClick={() => void respond("cancelar")}>
                        {pending ? "Cancelando…" : "Cancelar aula"}
                      </Button>
                      <Button variant="outline" type="button" disabled={pending} onClick={() => setArming(false)}>
                        Voltar
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="destructive" type="button" disabled={pending} onClick={() => setArming(true)}>
                    Cancelar aula
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                <p>Você vai a esta aula?</p>
                <Button type="button" disabled={pending} onClick={() => void respond("confirmar")}>
                  {pending ? "Confirmando…" : "Confirmar presença"}
                </Button>
                {arming ? (
                  <>
                    <p className="text-sm text-muted-foreground">Cancelar cancela só esta data.</p>
                    <Button variant="destructive" type="button" disabled={pending} onClick={() => void respond("cancelar")}>
                      {pending ? "Cancelando…" : "Sim, cancelar esta aula"}
                    </Button>
                    <Button variant="outline" type="button" disabled={pending} onClick={() => setArming(false)}>
                      Voltar
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" type="button" disabled={pending} onClick={() => setArming(true)}>
                    Cancelar aula
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}
      </main>
    </AuthLayout>
  )
}
