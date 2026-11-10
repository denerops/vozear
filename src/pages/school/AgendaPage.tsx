import { useEffect, useMemo, useState } from "react"
import { ClassDetailsModal } from "../../agenda/components/ClassDetailsModal.tsx"
import { ClassModal } from "../../agenda/components/ClassModal.tsx"
import type { StudentOption } from "../../agenda/components/FormFields.tsx"
import { WeeklyCalendar } from "../../agenda/components/WeeklyCalendar.tsx"
import { expandWeek, sampleSeries, TEACHERS, weekdayOf } from "../../agenda/model.ts"
import type { AgendaClass, AgendaDraft, AgendaException, AgendaSeries } from "../../agenda/types.ts"
import { loadPessoas } from "../../data/api.ts"
import { addDays, mondayOf, saoPauloDate } from "../../lib/dates.ts"

export function AgendaPage({ mode }: { mode: "escola" | "professor" }) {
  const today = saoPauloDate()
  const [series, setSeries] = useState<AgendaSeries[]>(() => sampleSeries(today))
  const [exceptions, setExceptions] = useState<AgendaException[]>([])
  const [cursor, setCursor] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [teacher, setTeacher] = useState<string | null>(null)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [studentsStatus, setStudentsStatus] = useState<"loading" | "ready" | "error">("loading")
  const [editing, setEditing] = useState<AgendaDraft | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadPessoas("aluno")
      .then((people) => {
        if (!alive) return
        setStudents(people.map((person) => ({
          id: person.id,
          nome: person.nome,
          email: person.email,
          telefone: person.telefone,
        })))
        setStudentsStatus("ready")
      })
      .catch(() => {
        if (alive) setStudentsStatus("error")
      })
    return () => {
      alive = false
    }
  }, [])

  const monday = mondayOf(cursor)
  const occurrences = useMemo(() => expandWeek(series, exceptions, monday), [series, exceptions, monday])
  const visible = teacher ? occurrences.filter((item) => item.teacher === teacher) : occurrences
  const details = occurrences.find((item) => item.id === detailsId) ?? null

  function blankDraft(date: string, startMinute: number): AgendaDraft {
    const match = TEACHERS.find((item) => item.name === teacher)
    return {
      scope: "series",
      student: "",
      teacher: match?.name ?? TEACHERS[0].name,
      instrument: match?.instruments[0] ?? "Canto",
      date,
      startMinute,
      durationMinutes: 60,
    }
  }

  function shift(days: number) {
    setCursor(addDays(cursor, days))
    setSelectedDate(addDays(selectedDate, days))
    setDetailsId(null)
  }

  function replaceException(next: AgendaException | null, seriesId: string, fromDate: string) {
    setExceptions((current) => {
      const rest = current.filter((item) => !(item.seriesId === seriesId && item.fromDate === fromDate))
      return next ? [...rest, next] : rest
    })
  }

  function save(draft: AgendaDraft) {
    if (draft.scope === "once" && draft.seriesId && draft.fromDate) {
      const source = series.find((item) => item.id === draft.seriesId)
      const sameSlot =
        source &&
        draft.date === draft.fromDate &&
        draft.startMinute === source.startMinute &&
        draft.durationMinutes === source.durationMinutes
      replaceException(
        sameSlot
          ? null
          : {
              seriesId: draft.seriesId,
              fromDate: draft.fromDate,
              kind: "remarcada",
              date: draft.date,
              startMinute: draft.startMinute,
              durationMinutes: draft.durationMinutes,
            },
        draft.seriesId,
        draft.fromDate,
      )
      setCursor(draft.date)
      setSelectedDate(draft.date)
      setEditing(null)
      return
    }

    const weekday = weekdayOf(draft.date)
    if (draft.id && series.some((item) => item.id === draft.id)) {
      setSeries((current) =>
        current.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                student: draft.student,
                teacher: draft.teacher,
                instrument: draft.instrument,
                weekday,
                startMinute: draft.startMinute,
                durationMinutes: draft.durationMinutes,
                startsOn: draft.date < item.startsOn ? draft.date : item.startsOn,
              }
            : item,
        ),
      )
    } else {
      setSeries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          student: draft.student,
          teacher: draft.teacher,
          instrument: draft.instrument,
          weekday,
          startMinute: draft.startMinute,
          durationMinutes: draft.durationMinutes,
          startsOn: draft.date,
        },
      ])
    }
    setCursor(draft.date)
    setSelectedDate(draft.date)
    setEditing(null)
  }

  function cancelOnce(item: AgendaClass) {
    if (!window.confirm("Cancelar só esta data? As outras semanas continuam no horário de sempre.")) return
    replaceException(
      {
        seriesId: item.seriesId,
        fromDate: item.fromDate,
        kind: "cancelada",
        date: item.fromDate,
        startMinute: item.seriesStartMinute,
        durationMinutes: item.seriesDuration,
      },
      item.seriesId,
      item.fromDate,
    )
    setDetailsId(null)
  }

  function openOnce(item: AgendaClass) {
    setEditing({
      scope: "once",
      seriesId: item.seriesId,
      fromDate: item.fromDate,
      student: item.student,
      teacher: item.teacher,
      instrument: item.instrument,
      date: item.date,
      startMinute: item.startMinute,
      durationMinutes: item.durationMinutes,
      seriesWeekday: item.weekday,
      seriesStartMinute: item.seriesStartMinute,
    })
    setDetailsId(null)
  }

  function openSeries(item: AgendaClass) {
    setEditing({
      scope: "series",
      id: item.seriesId,
      student: item.student,
      teacher: item.teacher,
      instrument: item.instrument,
      date: item.fromDate,
      startMinute: item.seriesStartMinute,
      durationMinutes: item.seriesDuration,
    })
    setDetailsId(null)
  }

  return (
    <div data-mode={mode}>
      <WeeklyCalendar
        monday={monday}
        selectedDate={selectedDate}
        classes={visible}
        roster={series}
        teacher={teacher}
        onShift={shift}
        onSelectDate={setSelectedDate}
        onSelectTeacher={setTeacher}
        onOpen={setDetailsId}
        onCreateAt={(date, startMinute) => setEditing(blankDraft(date, startMinute))}
        onCreate={() => setEditing(blankDraft(selectedDate, 8 * 60))}
      />
      {editing ? (
        <ClassModal
          value={editing}
          series={series}
          students={students}
          studentsStatus={studentsStatus}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
      {details ? (
        <ClassDetailsModal
          item={details}
          onClose={() => setDetailsId(null)}
          onReschedule={() => openOnce(details)}
          onEditSeries={() => openSeries(details)}
          onRestore={() => {
            replaceException(null, details.seriesId, details.fromDate)
            setDetailsId(null)
          }}
          onCancel={() => cancelOnce(details)}
        />
      ) : null}
    </div>
  )
}
