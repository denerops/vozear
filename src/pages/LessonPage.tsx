import { useState, type FormEvent } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { useSession } from "../auth/session.tsx"
import { CardSkeleton, ErrorNote, Page, StatusBadge } from "../components/chrome.tsx"
import { loadAula, loadInstrumentos, loadRecados, nomesPorId } from "../data/api.ts"
import { useQuery } from "../data/useQuery.ts"
import { client } from "../lib/supabase.ts"
import { formatWhen, saoPauloDate, saoPauloTimestamp } from "../lib/dates.ts"
import { humanError } from "../lib/errors.ts"
import type { RecadoLink, SituacaoAula } from "../types.ts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function LessonPage() {
  const { id = "" } = useParams()
  const location = useLocation()
  const session = useSession()
  const back = location.pathname.startsWith("/aluno")
    ? "/aluno"
    : location.pathname.startsWith("/professor")
      ? "/professor"
      : "/escola/agenda"
  const query = useQuery(id ? `aula:${id}` : null, async () => {
    const [lesson, notes, instruments] = await Promise.all([loadAula(id), loadRecados(id), loadInstrumentos()])
    const names = await nomesPorId(lesson ? [lesson.professor_id, lesson.aluno_id] : [])
    return {
      aula: lesson,
      recados: notes,
      titulo: lesson
        ? `${instruments.find((item) => item.id === lesson.instrumento_id)?.nome ?? "Aula"} · ${names.get(lesson.aluno_id) ?? ""}`
        : "Aula",
    }
  })
  const aula = query.data?.aula ?? null
  const recados = query.data?.recados ?? []
  const titulo = query.data?.titulo ?? "Aula"
  const [texto, setTexto] = useState("")
  const [links, setLinks] = useState<RecadoLink[]>([{ rotulo: "", url: "" }])
  const [quando, setQuando] = useState(saoPauloDate())
  const [hora, setHora] = useState("19:00")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const canEdit = Boolean(
    aula &&
      (session.papeis.includes("administrador") ||
        (session.papeis.includes("professor") && aula.professor_id === session.userId)),
  )

  async function run(action: () => PromiseLike<unknown>) {
    setPending(true)
    setError(null)
    const { error: actionError } = (await action()) as { error: { message?: string } | null }
    setPending(false)
    if (actionError) {
      setError(humanError(actionError))
      return
    }
    await query.refresh()
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault()
    const cleanLinks = links.filter((link) => link.rotulo.trim() || link.url.trim())
    setPending(true)
    setError(null)
    const { error: insertError } = await client()
      .from("recados")
      .insert({
        aula_id: id,
        autor_id: session.userId,
        texto: texto.trim(),
        links: cleanLinks.map((link) => ({ rotulo: link.rotulo.trim(), url: link.url.trim() })),
      })
    setPending(false)
    if (insertError) {
      setError(humanError(insertError))
      return
    }
    setTexto("")
    setLinks([{ rotulo: "", url: "" }])
    await query.refresh()
  }

  if (!aula && query.pending) return <Page title="Aula"><CardSkeleton /></Page>
  if (!aula) return <Page title="Aula"><ErrorNote>{error ?? query.error ?? "Aula não encontrada."}</ErrorNote></Page>

  return (
    <Page title={titulo} lede={formatWhen(aula.inicio)} action={<StatusBadge value={aula.situacao} />}>
      <p>
        <Link to={back}>Voltar</Link>
      </p>
      <ErrorNote>{error ?? query.error}</ErrorNote>
      {canEdit ? (
        <section className="card stack">
          <h2>Esta aula</h2>
          <div className="row">
            {(["realizada", "falta", "prevista"] as SituacaoAula[]).map((situacao) => (
              <Button
                key={situacao}
                variant="outline"
                type="button"
                disabled={pending || aula.situacao === "cancelada"}
                onClick={() =>
                  run(() => client().rpc("registrar_aula", { p_aula_id: id, p_situacao: situacao }))
                }
              >
                {situacao === "realizada" ? "Realizada" : situacao === "falta" ? "Falta" : "Prevista"}
              </Button>
            ))}
            <Button
              variant="destructive"
              type="button"
              disabled={pending || aula.situacao === "cancelada"}
              onClick={() => {
                if (window.confirm("Cancelar só esta aula? A mensalidade do mês continua.")) {
                  void run(() => client().rpc("cancelar_aula", { p_aula_id: id }))
                }
              }}
            >
              Cancelar
            </Button>
          </div>
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault()
              void run(() =>
                client().rpc("remarcar_aula", {
                  p_aula_id: id,
                  p_inicio: saoPauloTimestamp(quando, hora),
                }),
              )
            }}
          >
            <label>
              Nova data
              <Input type="date" value={quando} onChange={(event) => setQuando(event.target.value)} required />
            </label>
            <label>
              Hora
              <Input type="time" value={hora} onChange={(event) => setHora(event.target.value)} required />
            </label>
            <Button  type="submit" disabled={pending || aula.situacao === "cancelada"}>
              Remarcar
            </Button>
          </form>
        </section>
      ) : null}

      <section className="stack">
        <h2>Recados</h2>
        {recados.length === 0 ? <p className="empty">Nenhum recado nesta aula.</p> : null}
        {recados.map((recado) => (
          <article key={recado.id} className="card">
            <p>{recado.texto}</p>
            {recado.links.length > 0 ? (
              <ul>
                {recado.links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="muted">{formatWhen(recado.criado_em)}</p>
          </article>
        ))}
      </section>

      {canEdit ? (
        <form className="card stack" onSubmit={saveNote}>
          <h2>Novo recado</h2>
          <label>
            Texto
            <Textarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={4} />
          </label>
          {links.map((link, index) => (
            <div className="row" key={index}>
              <label>
                Nome do link
                <Input
                  value={link.rotulo}
                  onChange={(event) =>
                    setLinks(links.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, rotulo: event.target.value } : item,
                    ))
                  }
                />
              </label>
              <label>
                URL https
                <Input
                  type="url"
                  value={link.url}
                  placeholder="https://"
                  onChange={(event) =>
                    setLinks(links.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, url: event.target.value } : item,
                    ))
                  }
                />
              </label>
            </div>
          ))}
          <div className="row">
            <Button
              variant="outline"
              type="button"
              onClick={() => setLinks([...links, { rotulo: "", url: "" }])}
            >
              Outro link
            </Button>
            <Button  type="submit" disabled={pending}>
              Publicar recado
            </Button>
          </div>
        </form>
      ) : null}
    </Page>
  )
}
