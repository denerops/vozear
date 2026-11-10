import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useSession } from "../../auth/session.tsx"
import { Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, nomesPorId } from "../../data/api.ts"
import { addDays, formatWhen, mondayOf, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import type { Aula, Instrumento } from "../../types.ts"

export function StudentAgendaPage() {
  const session = useSession()
  const [cursor, setCursor] = useState(saoPauloDate())
  const [aulas, setAulas] = useState<Aula[]>([])
  const [instrumentos, setInstrumentos] = useState<Map<string, Instrumento>>(new Map())
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const monday = mondayOf(cursor)

  useEffect(() => {
    if (!session.userId) return
    let alive = true
    setError(null)
    Promise.all([
      loadAulas({
        from: saoPauloTimestamp(monday, "00:00"),
        until: saoPauloTimestamp(addDays(monday, 7), "00:00"),
        alunoId: session.userId,
      }),
      loadInstrumentos(),
    ])
      .then(async ([lessons, instruments]) => {
        const names = await nomesPorId(lessons.map((lesson) => lesson.professor_id))
        if (!alive) return
        setAulas(lessons)
        setInstrumentos(new Map(instruments.map((item) => [item.id, item])))
        setNomes(names)
      })
      .catch((reason: { message?: string }) => {
        if (alive) setError(humanError(reason))
      })
    return () => {
      alive = false
    }
  }, [session.userId, monday])

  return (
    <Page
      title="Sua agenda"
      lede="Cada aula abre o recado e os links deixados pelo professor."
      action={
        <div className="week-nav">
          <button type="button" onClick={() => setCursor(addDays(monday, -7))}>
            Semana anterior
          </button>
          <button type="button" onClick={() => setCursor(addDays(monday, 7))}>
            Próxima semana
          </button>
        </div>
      }
    >
      <ErrorNote>{error}</ErrorNote>
      {aulas.length === 0 ? <Empty>Nenhuma aula nesta semana.</Empty> : null}
      <ul className="lesson-list">
        {aulas.map((aula) => (
          <li key={aula.id}>
            <Link to={`/aluno/aulas/${aula.id}`}>
              <strong>{formatWhen(aula.inicio)}</strong>
              <span>{instrumentos.get(aula.instrumento_id)?.nome ?? "Aula"}</span>
              <span>{nomes.get(aula.professor_id) ?? "Professor"}</span>
              <StatusBadge value={aula.situacao} />
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}
