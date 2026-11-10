import { useEffect, useId, useState, type FormEvent } from "react"
import { formatMinute } from "../../lib/dates.ts"
import { INSTRUMENTS, TEACHERS, teachersIn, toneFor } from "../model.ts"
import type { AgendaClass, AgendaDraft } from "../types.ts"
import { ChoiceField, DateField, DurationField, Field, StudentField, type StudentOption } from "./FormFields.tsx"

const DURATIONS = [30, 45, 60, 90, 120]

export function ClassModal({
  value,
  classes,
  students,
  studentsStatus,
  onClose,
  onSave,
}: {
  value: AgendaDraft
  classes: AgendaClass[]
  students: StudentOption[]
  studentsStatus: "loading" | "ready" | "error"
  onClose: () => void
  onSave: (draft: AgendaDraft) => void
}) {
  const titleId = useId()
  const [student, setStudent] = useState(value.student)
  const [teacher, setTeacher] = useState(value.teacher)
  const [instrument, setInstrument] = useState(value.instrument)
  const [when, setWhen] = useState(value.date)
  const [time, setTime] = useState(formatMinute(value.startMinute))
  const [duration, setDuration] = useState(String(value.durationMinutes))
  const [error, setError] = useState("")
  const [menu, setMenu] = useState<"student" | "teacher" | "instrument" | "date" | null>(null)
  const roster = teachersIn(classes)
  const teachers = roster.some((item) => item.name === teacher)
    ? roster
    : [...roster, { name: teacher, instruments: instrument ? [instrument] : [] }]
  const durations = DURATIONS.includes(value.durationMinutes)
    ? DURATIONS
    : [...DURATIONS, value.durationMinutes].sort((a, b) => a - b)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function chooseTeacher(name: string) {
    setTeacher(name)
    const match = teachers.find((item) => item.name === name) ?? TEACHERS.find((item) => item.name === name)
    if (match && !match.instruments.includes(instrument)) setInstrument(match.instruments[0])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [hours, minutes] = time.split(":").map(Number)
    const durationMinutes = Number(duration)
    const knownStudent = students.some((item) => item.nome === student)
    if (!knownStudent || !teacher || !instrument || !when || Number.isNaN(hours) || durationMinutes <= 0) {
      setError(knownStudent ? "Preencha professor, instrumento, data, horário e duração." : "Escolha um aluno cadastrado.")
      return
    }
    onSave({
      id: value.id,
      student: student.trim(),
      teacher,
      instrument,
      date: when,
      startMinute: hours * 60 + minutes,
      durationMinutes,
    })
  }

  return (
    <div
      className="agenda-modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        className="agenda-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id={titleId}>{value.id ? "Editar aula" : "Nova aula"}</h2>
        <StudentField
          students={students}
          status={studentsStatus}
          value={student}
          open={menu === "student"}
          onOpen={(next) => setMenu(next ? "student" : null)}
          onChange={setStudent}
        />
        <ChoiceField
          label="Professor"
          value={teacher}
          open={menu === "teacher"}
          onOpen={(next) => setMenu(next ? "teacher" : null)}
          onChange={chooseTeacher}
          options={teachers.map((item) => ({
            value: item.name,
            label: item.name,
            hint: item.instruments.join(" · "),
          }))}
        />
        <ChoiceField
          label="Instrumento"
          value={instrument}
          open={menu === "instrument"}
          onOpen={(next) => setMenu(next ? "instrument" : null)}
          onChange={setInstrument}
          options={INSTRUMENTS.map((name) => ({
            value: name,
            label: name,
            dot: toneFor(name).dot,
          }))}
        />
        <DateField
          value={when}
          open={menu === "date"}
          onOpen={(next) => setMenu(next ? "date" : null)}
          onChange={setWhen}
        >
          <Field label="Horário">
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </Field>
        </DateField>
        <DurationField value={duration} options={durations} onChange={setDuration} />
        {error ? <p className="agenda-error">{error}</p> : null}
        <div className="agenda-form-actions">
          <button className="agenda-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button className="agenda-primary" type="submit">
            Salvar
          </button>
        </div>
      </form>
    </div>
  )
}
