import { useEffect, useState } from "react"
import { ClassDetailsModal } from "../../agenda/components/ClassDetailsModal.tsx"
import { ClassModal } from "../../agenda/components/ClassModal.tsx"
import type { StudentOption } from "../../agenda/components/FormFields.tsx"
import { WeeklyCalendar } from "../../agenda/components/WeeklyCalendar.tsx"
import { sampleClasses, TEACHERS } from "../../agenda/model.ts"
import type { AgendaClass, AgendaDraft } from "../../agenda/types.ts"
import { loadPessoas } from "../../data/api.ts"
import { addDays, mondayOf, saoPauloDate } from "../../lib/dates.ts"

export function AgendaPage({ mode }: { mode: "escola" | "professor" }) {
  const today = saoPauloDate()
  const [classes, setClasses] = useState<AgendaClass[]>(() => sampleClasses(today))
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
  const visible = teacher ? classes.filter((item) => item.teacher === teacher) : classes
  const details = classes.find((item) => item.id === detailsId && item.status !== "cancelada") ?? null

  function blankDraft(date: string, startMinute: number): AgendaDraft {
    const match = TEACHERS.find((item) => item.name === teacher)
    return {
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
  }

  function save(draft: AgendaDraft) {
    setClasses((current) => {
      if (draft.id && current.some((item) => item.id === draft.id)) {
        return current.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                student: draft.student,
                teacher: draft.teacher,
                instrument: draft.instrument,
                date: draft.date,
                startMinute: draft.startMinute,
                durationMinutes: draft.durationMinutes,
              }
            : item,
        )
      }
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          student: draft.student,
          teacher: draft.teacher,
          instrument: draft.instrument,
          date: draft.date,
          startMinute: draft.startMinute,
          durationMinutes: draft.durationMinutes,
          status: "prevista",
        },
      ]
    })
    setCursor(draft.date)
    setSelectedDate(draft.date)
    setEditing(null)
  }

  function cancel(id: string) {
    setClasses((current) => current.map((item) => (item.id === id ? { ...item, status: "cancelada" } : item)))
    setDetailsId(null)
  }

  return (
    <div data-mode={mode}>
      <WeeklyCalendar
        monday={monday}
        selectedDate={selectedDate}
        classes={visible}
        roster={classes}
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
          classes={classes}
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
          onEdit={() => {
            setEditing({
              id: details.id,
              student: details.student,
              teacher: details.teacher,
              instrument: details.instrument,
              date: details.date,
              startMinute: details.startMinute,
              durationMinutes: details.durationMinutes,
            })
            setDetailsId(null)
          }}
          onCancel={() => cancel(details.id)}
        />
      ) : null}
    </div>
  )
}
