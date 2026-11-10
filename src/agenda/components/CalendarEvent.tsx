import { clockLabel, toneFor } from "../model.ts"
import type { AgendaClass } from "../types.ts"

export function CalendarEvent({
  item,
  top,
  height,
  column,
  columns,
  onOpen,
}: {
  item: AgendaClass
  top: number
  height: number
  column: number
  columns: number
  onOpen: (id: string) => void
}) {
  const tone = toneFor(item.instrument)
  const width = `calc((100% - 8px) / ${columns})`
  const left = `calc(4px + (100% - 8px) * ${column} / ${columns})`
  return (
    <button
      type="button"
      className="agenda-event"
      style={{
        top,
        height,
        width,
        left,
        background: tone.background,
        borderLeftColor: tone.bar,
      }}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(item.id)
      }}
    >
      <strong>{item.instrument}</strong>
      <span>{item.student}</span>
      <span className="sr-only">
        {clockLabel(item.startMinute)}, {item.durationMinutes} minutos
      </span>
    </button>
  )
}
