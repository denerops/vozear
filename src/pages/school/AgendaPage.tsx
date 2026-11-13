import { useEffect, useMemo, useState } from "react"
import { useSession } from "../../auth/session.tsx"
import { ClassDetailsModal } from "../../agenda/components/ClassDetailsModal.tsx"
import { ClassModal } from "../../agenda/components/ClassModal.tsx"
import type { StudentOption } from "../../agenda/components/FormFields.tsx"
import { WeeklyCalendar } from "../../agenda/components/WeeklyCalendar.tsx"
import { expandWeek, weekdayOf } from "../../agenda/model.ts"
import {
  cancelLesson,
  createEnrollment,
  endEnrollment,
  ensureLessons,
  findLesson,
  lessonHorizon,
  moveEnrollment,
  rescheduleLesson,
} from "../../agenda/persist.ts"
import { toExceptions, toSeries, type AgendaTeacher } from "../../agenda/records.ts"
import type { AgendaClass, AgendaDraft } from "../../agenda/types.ts"
import { ErrorNote } from "../../components/chrome.tsx"
import { loadAulas, loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { peek, remember } from "../../data/memory.ts"
import { addDays, mondayOf, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import type { Aula, Instrumento, Matricula, Pessoa } from "../../types.ts"

type AgendaSnapshot = {
  matriculas: Matricula[]
  aulas: Aula[]
  people: Pessoa[]
  instrumentos: Instrumento[]
  students: StudentOption[]
  teachers: AgendaTeacher[]
}

export function AgendaPage({ mode }: { mode: "escola" | "professor" }) {
  const session = useSession()
  const today = saoPauloDate()
  const professorId = mode === "professor" ? session.userId : null
  const cacheKey = mode === "professor" && !professorId ? null : `agenda:${mode}:${professorId ?? "escola"}`
  const cachedNow = cacheKey ? peek<AgendaSnapshot>(cacheKey) : undefined
  const [matriculas, setMatriculas] = useState<Matricula[]>(cachedNow?.matriculas ?? [])
  const [aulas, setAulas] = useState<Aula[]>(cachedNow?.aulas ?? [])
  const [people, setPeople] = useState<Pessoa[]>(cachedNow?.people ?? [])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>(cachedNow?.instrumentos ?? [])
  const [students, setStudents] = useState<StudentOption[]>(cachedNow?.students ?? [])
  const [teachers, setTeachers] = useState<AgendaTeacher[]>(cachedNow?.teachers ?? [])
  const [studentsStatus, setStudentsStatus] = useState<"loading" | "ready" | "error">(cachedNow ? "ready" : "loading")
  const [cursor, setCursor] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [teacher, setTeacher] = useState<string | null>(null)
  const [editing, setEditing] = useState<AgendaDraft | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  function show(snapshot: AgendaSnapshot) {
    setMatriculas(snapshot.matriculas)
    setAulas(snapshot.aulas)
    setPeople(snapshot.people)
    setInstrumentos(snapshot.instrumentos)
    setStudents(snapshot.students)
    setTeachers(snapshot.teachers)
    setStudentsStatus("ready")
  }

  useEffect(() => {
    if (!cacheKey) return
    const key = cacheKey
    let alive = true
    const cached = peek<AgendaSnapshot>(key)
    if (cached) show(cached)
    else setStudentsStatus("loading")
    async function load() {
      const until = lessonHorizon()
      const [enrollments, pupils, faculty, instruments] = await Promise.all([
        loadMatriculas(professorId ? { professorId } : undefined),
        loadPessoas("aluno"),
        loadPessoas("professor"),
        loadInstrumentos(),
      ])
      const active = enrollments.filter((item) => item.situacao === "ativa").map((item) => item.id)
      await ensureLessons(active, until)
      const lessons = await loadAulas({
        from: saoPauloTimestamp("2026-01-01", "00:00"),
        until: saoPauloTimestamp(addDays(until, 1), "00:00"),
        ...(professorId ? { professorId } : {}),
      })
      const names = new Map(instruments.map((item) => [item.id, item.nome]))
      const visibleFaculty = professorId ? faculty.filter((item) => item.id === professorId) : faculty
      const snapshot: AgendaSnapshot = {
        matriculas: enrollments,
        aulas: lessons,
        people: [...pupils, ...faculty],
        instrumentos: instruments,
        students: pupils.map((person) => ({
          id: person.id,
          nome: person.nome,
          email: person.email,
          telefone: person.telefone,
        })),
        teachers: visibleFaculty.map((person) => ({
          id: person.id,
          name: person.nome,
          instruments: person.instrumentos.map((item) => names.get(item) ?? "").filter(Boolean),
        })),
      }
      remember(key, snapshot)
      return snapshot
    }
    load()
      .then((snapshot) => {
        if (alive) show(snapshot)
      })
      .catch((reason: { message?: string }) => {
        if (!alive) return
        setError(humanError(reason))
        if (!cached) setStudentsStatus("error")
      })
    return () => {
      alive = false
    }
  }, [cacheKey, professorId, version])

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const instrumentNames = useMemo(
    () => new Map(instrumentos.map((item) => [item.id, item.nome])),
    [instrumentos],
  )
  const series = useMemo(
    () => toSeries(matriculas, peopleById, instrumentNames),
    [matriculas, peopleById, instrumentNames],
  )
  const exceptions = useMemo(() => toExceptions(aulas, matriculas), [aulas, matriculas])
  const monday = mondayOf(cursor)
  const occurrences = useMemo(() => expandWeek(series, exceptions, monday), [series, exceptions, monday])
  const visible = teacher ? occurrences.filter((item) => item.teacher === teacher) : occurrences
  const details = occurrences.find((item) => item.id === detailsId) ?? null

  function refresh() {
    setVersion((current) => current + 1)
  }

  function blankDraft(date: string, startMinute: number): AgendaDraft {
    const match = teachers.find((item) => item.name === teacher) ?? teachers[0]
    return {
      scope: "series",
      student: "",
      teacher: match?.name ?? "",
      instrument: match?.instruments[0] ?? "",
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

  async function lessonFor(seriesId: string, fromDate: string) {
    const stored = aulas.find((item) => item.matricula_id === seriesId && item.data_serie.slice(0, 10) === fromDate)
    if (stored) return stored
    await ensureLessons([seriesId])
    const created = await findLesson(seriesId, fromDate)
    if (!created) throw new Error("Essa data não tem aula registrada.")
    return created
  }

  async function save(draft: AgendaDraft) {
    setError(null)
    if (draft.scope === "once" && draft.seriesId && draft.fromDate) {
      const aula = await lessonFor(draft.seriesId, draft.fromDate)
      if (draft.durationMinutes !== aula.duracao_minutos) {
        throw new Error("A duração desta data continua a da matrícula.")
      }
      await rescheduleLesson(aula.id, draft.date, draft.startMinute)
      setCursor(draft.date)
      setSelectedDate(draft.date)
      setEditing(null)
      refresh()
      return
    }

    const aluno = students.find((item) => item.nome === draft.student)
    const professor = teachers.find((item) => item.name === draft.teacher)
    const instrumento = instrumentos.find((item) => item.nome === draft.instrument)
    if (!aluno || !professor || !instrumento) throw new Error("Escolha aluno, professor e instrumento cadastrados.")
    const weekday = weekdayOf(draft.date)
    const current = draft.id ? matriculas.find((item) => item.id === draft.id) : undefined
    const samePeople = current
      && current.aluno_id === aluno.id
      && current.professor_id === professor.id
      && current.instrumento_id === instrumento.id
    if (current && samePeople) {
      await moveEnrollment(current.horario_id, current.id, {
        weekday,
        startMinute: draft.startMinute,
        durationMinutes: draft.durationMinutes,
      })
    } else {
      if (current) await endEnrollment(current.id)
      await createEnrollment({
        alunoId: aluno.id,
        professorId: professor.id,
        instrumentoId: instrumento.id,
        valorCentavos: instrumento.valor_mensal_centavos,
        startsOn: draft.date,
        weekday,
        startMinute: draft.startMinute,
        durationMinutes: draft.durationMinutes,
      })
    }
    setCursor(draft.date)
    setSelectedDate(draft.date)
    setEditing(null)
    refresh()
  }

  async function cancelOnce(item: AgendaClass) {
    if (!window.confirm("Cancelar só esta data? As outras semanas continuam no horário de sempre.")) return
    setError(null)
    try {
      const aula = await lessonFor(item.seriesId, item.fromDate)
      await cancelLesson(aula.id)
      setDetailsId(null)
      refresh()
    } catch (reason) {
      setError(humanError(reason as { message?: string }))
    }
  }

  async function restore(item: AgendaClass) {
    setError(null)
    try {
      const aula = await lessonFor(item.seriesId, item.fromDate)
      await rescheduleLesson(aula.id, item.fromDate, item.seriesStartMinute)
      setDetailsId(null)
      refresh()
    } catch (reason) {
      setError(humanError(reason as { message?: string }))
    }
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
      <ErrorNote>{error}</ErrorNote>
      <WeeklyCalendar
        monday={monday}
        selectedDate={selectedDate}
        classes={visible}
        roster={series}
        teachers={teachers}
        teacher={teacher}
        onShift={shift}
        onSelectDate={setSelectedDate}
        onSelectTeacher={setTeacher}
        onOpen={setDetailsId}
        onCreateAt={(date, startMinute) => setEditing(blankDraft(date, startMinute))}
        onCreate={() => setEditing(blankDraft(selectedDate, 8 * 60))}
        pending={studentsStatus === "loading" && teachers.length === 0}
      />
      {editing ? (
        <ClassModal
          value={editing}
          teachers={teachers}
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
          onRestore={() => void restore(details)}
          onCancel={() => void cancelOnce(details)}
        />
      ) : null}
    </div>
  )
}
