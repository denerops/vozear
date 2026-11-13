import { clockLabel, teacherTone, type TeacherTone } from "../model.ts"
import type { AgendaClass } from "../types.ts"

export function CalendarEvent({
  item,
  top,
  height,
  column,
  columns,
  teachers,
  onOpen,
}: {
  item: AgendaClass
  top: number
  height: number
  column: number
  columns: number
  teachers: { name: string }[]
  onOpen: (id: string) => void
}) {
  const tone: TeacherTone = teacherTone(item.teacher, teachers)
  const width = `calc((100% - 8px) / ${columns})`
  const left = `calc(4px + (100% - 8px) * ${column} / ${columns})`
  return (
    <button
      type="button"
      className={`agenda-event${item.status === "remarcada" ? " is-moved" : ""}`}
      style={{
        top,
        height,
        width,
        left,
        background: tone.background,
        borderLeftColor: tone.bar,
        color: tone.bar,
      }}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(item.id)
      }}
    >
      <strong>{item.instrument}</strong>
      <span>{item.student}</span>
      <span className="sr-only">
        {item.status === "remarcada" ? "remarcada, " : ""}
        {clockLabel(item.startMinute)}, {item.durationMinutes} minutos
      </span>
    </button>
  )
}
