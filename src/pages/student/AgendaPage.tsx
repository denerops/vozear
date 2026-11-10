import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSession } from "../../auth/session.tsx"
import { WeekCalendar, WeekNav, hourMarks, type CellPaint } from "../../components/WeekCalendar.tsx"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, nomesPorId } from "../../data/api.ts"
import { addDays, agendaStartMinute, dateOfWeekday, mondayOf, saoPauloClock, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { SITUACAO_AULA } from "../../lib/format.ts"
import type { Aula, Instrumento } from "../../types.ts"

export function StudentAgendaPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(saoPauloDate())
  const [anchorMinute, setAnchorMinute] = useState(agendaStartMinute)
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

  const paints: CellPaint[] = []
  for (const minute of hourMarks()) {
    for (const day of [1, 2, 3, 4, 5, 6, 0]) {
      const date = dateOfWeekday(monday, day)
      const hits = aulas.filter((item) => {
        const clock = saoPauloClock(item.inicio)
        return clock.date === date && clock.minute >= minute && clock.minute < minute + 60
      })
      const aula = hits.find((item) => item.situacao !== "cancelada" && item.situacao !== "remarcada") ?? hits[0]
      if (!aula) continue
      const status = aula.situacao === "prevista" ? null : SITUACAO_AULA[aula.situacao]
      paints.push({
        day,
        minute,
        kind: "aula",
        aulaId: aula.id,
        title: instrumentos.get(aula.instrumento_id)?.nome ?? "Aula",
        detail: [nomes.get(aula.professor_id) ?? "Professor", status].filter(Boolean).join(" · "),
      })
    }
  }

  return (
    <Page
      title="Sua agenda"
      lede="A mesma semana da escola. Toque uma aula para abrir o recado."
      action={
        <WeekNav
          monday={monday}
          onShift={(days) => {
            setCursor(addDays(monday, days))
            setAnchorMinute(16 * 60)
          }}
          onToday={() => {
            setCursor(saoPauloDate())
            setAnchorMinute(agendaStartMinute())
          }}
        />
      }
    >
      <ErrorNote>{error}</ErrorNote>
      {aulas.length === 0 ? <Empty>Nenhuma aula nesta semana.</Empty> : null}
      <WeekCalendar
        monday={monday}
        cells={paints}
        anchorMinute={anchorMinute}
        readOnly
        label="Sua semana"
        onOpenLesson={(aulaId) => navigate(`/aluno/aulas/${aulaId}`)}
      />
    </Page>
  )
}
