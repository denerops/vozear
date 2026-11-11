import { useState } from "react"
import { useParams } from "react-router-dom"
import { AuthLayout } from "../components/AuthLayout.tsx"
import { CardSkeleton, ErrorNote } from "../components/ui.tsx"
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
      <main className="center-card stack">
        <p className="eyebrow">Sua aula</p>
        {query.pending && !lesson ? <CardSkeleton rows={2} /> : null}
        <ErrorNote>{error ?? query.error}</ErrorNote>
        {!query.pending && !query.error && !lesson ? (
          <>
            <h1>Link inválido</h1>
            <p>Este endereço não corresponde a uma aula. Peça um novo link para a escola.</p>
          </>
        ) : null}
        {lesson ? (
          <>
            <h1>{lesson.instrumento}</h1>
            <p>
              {formatWhen(lesson.inicio)} · {lesson.duracao_minutos} minutos
              <br />
              {lesson.aluno} com {lesson.professor}
            </p>
            {lesson.situacao === "cancelada" || lesson.confirmacao === "cancelada" ? (
              <p>Esta aula foi cancelada.</p>
            ) : !lesson.aberta ? (
              <p>Esta aula não aceita mais confirmação.</p>
            ) : (
              <div className="confirm-actions">
                {lesson.confirmacao === "confirmada" ? <p>Presença confirmada.</p> : <p>Você vai a esta aula?</p>}
                {lesson.confirmacao === "confirmada" ? null : (
                  <button className="btn" type="button" disabled={pending} onClick={() => void respond("confirmar")}>
                    {pending && !arming ? "Confirmando…" : "Confirmar presença"}
                  </button>
                )}
                {arming ? (
                  <>
                    <p>Cancelar cancela só esta data.</p>
                    <button className="btn danger" type="button" disabled={pending} onClick={() => void respond("cancelar")}>
                      {pending ? "Cancelando…" : "Sim, cancelar esta aula"}
                    </button>
                    <button className="btn secondary" type="button" disabled={pending} onClick={() => setArming(false)}>
                      Voltar
                    </button>
                  </>
                ) : (
                  <button className="btn secondary" type="button" disabled={pending} onClick={() => setArming(true)}>
                    Cancelar aula
                  </button>
                )}
              </div>
            )}
          </>
        ) : null}
      </main>
    </AuthLayout>
  )
}
