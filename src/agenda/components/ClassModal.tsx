import { useEffect, useId, useState, type FormEvent } from "react"
import { formatMinute } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { everyWeek, toneFor, weekdayOf } from "../model.ts"
import type { AgendaTeacher } from "../records.ts"
import type { AgendaDraft } from "../types.ts"
import { ChoiceField, DateField, DurationField, Field, StudentField, type StudentOption } from "./FormFields.tsx"
import { Input } from "@/components/ui/input"

const DURATIONS = [30, 45, 60, 90, 120]

export function ClassModal({
  value,
  teachers,
  students,
  studentsStatus,
  onClose,
  onSave,
}: {
  value: AgendaDraft
  teachers: AgendaTeacher[]
  students: StudentOption[]
  studentsStatus: "loading" | "ready" | "error"
  onClose: () => void
  onSave: (draft: AgendaDraft) => Promise<void>
}) {
  const titleId = useId()
  const once = value.scope === "once"
  const [student, setStudent] = useState(value.student)
  const [teacher, setTeacher] = useState(value.teacher)
  const [instrument, setInstrument] = useState(value.instrument)
  const [when, setWhen] = useState(value.date)
  const [time, setTime] = useState(formatMinute(value.startMinute))
  const [duration, setDuration] = useState(String(value.durationMinutes))
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [menu, setMenu] = useState<"student" | "teacher" | "instrument" | "date" | null>(null)
  const roster = teachers.some((item) => item.name === teacher)
    ? teachers
    : [...teachers, { id: teacher, name: teacher, instruments: instrument ? [instrument] : [] }]
  const durations = DURATIONS.includes(value.durationMinutes)
    ? DURATIONS
    : [...DURATIONS, value.durationMinutes].sort((a, b) => a - b)
  const weekday = weekdayOf(when)
  const weekend = weekday === 0 || weekday === 6

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function chooseTeacher(name: string) {
    setTeacher(name)
    const match = roster.find((item) => item.name === name)
    if (match && !match.instruments.includes(instrument)) setInstrument(match.instruments[0])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const [hours, minutes] = time.split(":").map(Number)
    const durationMinutes = Number(duration)
    const knownStudent = students.some((item) => item.nome === student) || (Boolean(value.id) && student === value.student)
    if (weekend) {
      setError("Escolha um dia de segunda a sexta.")
      return
    }
    if (!once && (!knownStudent || !teacher || !instrument)) {
      setError(knownStudent ? "Preencha professor e instrumento." : "Escolha um aluno cadastrado.")
      return
    }
    if (!when || Number.isNaN(hours) || durationMinutes <= 0) {
      setError("Preencha data, horário e duração.")
      return
    }
    setPending(true)
    setError("")
    try {
      await onSave({
        ...value,
        student: student.trim(),
        teacher,
        instrument,
        date: when,
        startMinute: hours * 60 + minutes,
        durationMinutes,
      })
    } catch (reason) {
      setError(humanError(reason as { message?: string }))
      setPending(false)
    }
  }

  const title = once ? "Reagendar esta aula" : value.id ? "Alterar todas as semanas" : "Nova aula"
  const note = once
    ? `Só esta data muda. A recorrência continua ${everyWeek(value.seriesWeekday ?? weekday)} às ${formatMinute(value.seriesStartMinute ?? value.startMinute)}.`
    : weekend
      ? "Escolha um dia de segunda a sexta."
      : `Repete ${everyWeek(weekday)}, a partir desta data.`

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
        <h2 id={titleId}>{title}</h2>
        <p className="agenda-note">{note}</p>
        {once ? (
          <div className="agenda-readonly">
            <p className="agenda-kicker" style={{ color: toneFor(instrument).bar }}>
              {instrument}
            </p>
            <strong>{student}</strong>
            <span>{teacher}</span>
          </div>
        ) : (
          <>
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
              options={roster.map((item) => ({
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
              options={(roster.find((item) => item.name === teacher)?.instruments ?? []).map((name) => ({
                value: name,
                label: name,
                dot: toneFor(name).dot,
              }))}
            />
          </>
        )}
        <DateField
          value={when}
          open={menu === "date"}
          onOpen={(next) => setMenu(next ? "date" : null)}
          onChange={setWhen}
          weekdaysOnly
        >
          <Field label="Horário">
            <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </Field>
        </DateField>
        <DurationField value={duration} options={durations} onChange={setDuration} />
        {error ? <p className="agenda-error">{error}</p> : null}
        <div className="agenda-form-actions">
          <button className="agenda-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          <button className="agenda-primary" type="submit" disabled={pending}>
            {pending ? "Salvando…" : once ? "Reagendar" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  )
}
