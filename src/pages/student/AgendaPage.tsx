import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSession } from "../../auth/session.tsx"
import { WeekCalendar, WeekNav, hourMarks, type CellPaint } from "../../components/WeekCalendar.tsx"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, nomesPorId } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { addDays, agendaStartMinute, dateOfWeekday, mondayOf, saoPauloClock, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { SITUACAO_AULA } from "../../lib/format.ts"
import type { Instrumento } from "../../types.ts"

export function StudentAgendaPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(saoPauloDate())
  const [anchorMinute, setAnchorMinute] = useState(agendaStartMinute)
  const monday = mondayOf(cursor)
  const query = useQuery(
    session.userId ? `aluno:agenda:${session.userId}:${monday}` : null,
    async () => {
      const [lessons, instruments] = await Promise.all([
        loadAulas({
          from: saoPauloTimestamp(monday, "00:00"),
          until: saoPauloTimestamp(addDays(monday, 7), "00:00"),
          alunoId: session.userId ?? undefined,
        }),
        loadInstrumentos(),
      ])
      const names = await nomesPorId(lessons.map((lesson) => lesson.professor_id))
      return {
        aulas: lessons,
        instrumentos: new Map(instruments.map((item) => [item.id, item])),
        nomes: names,
      }
    },
  )
  const aulas = query.data?.aulas ?? []
  const instrumentos = query.data?.instrumentos ?? new Map<string, Instrumento>()
  const nomes = query.data?.nomes ?? new Map<string, string>()
  const loading = query.pending && !query.data

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
      <ErrorNote>{query.error}</ErrorNote>
      {loading ? (
        <div className="agenda-skeleton" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="bone" />
          ))}
        </div>
      ) : null}
      {loading || aulas.length > 0 ? null : <Empty>Nenhuma aula nesta semana.</Empty>}
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
