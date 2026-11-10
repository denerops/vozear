import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { dateOfWeekday, formatMinute } from "../lib/dates.ts"

export type Slot = { day: number; minute: number }

export type CellPaint = {
  day: number
  minute: number
  kind: "disponivel" | "bloqueado" | "aula"
  title?: string
  detail?: string
  aulaId?: string
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]
const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const HOUR_START = 8 * 60
const HOUR_END = 21 * 60

export function hourMarks() {
  const marks: number[] = []
  for (let minute = HOUR_START; minute <= HOUR_END; minute += 60) marks.push(minute)
  return marks
}

function keyOf(day: number, minute: number) {
  return `${day}-${minute}`
}

function rect(anchor: Slot, focus: Slot) {
  const days = WEEK
  const hours = hourMarks()
  const dayAt = new Map(days.map((day, index) => [day, index]))
  const hourAt = new Map(hours.map((minute, index) => [minute, index]))
  const dayFrom = Math.min(dayAt.get(anchor.day) ?? 0, dayAt.get(focus.day) ?? 0)
  const dayTo = Math.max(dayAt.get(anchor.day) ?? 0, dayAt.get(focus.day) ?? 0)
  const hourFrom = Math.min(hourAt.get(anchor.minute) ?? 0, hourAt.get(focus.minute) ?? 0)
  const hourTo = Math.max(hourAt.get(anchor.minute) ?? 0, hourAt.get(focus.minute) ?? 0)
  const slots: Slot[] = []
  for (let day = dayFrom; day <= dayTo; day += 1) {
    for (let hour = hourFrom; hour <= hourTo; hour += 1) {
      slots.push({ day: days[day], minute: hours[hour] })
    }
  }
  return slots
}

export function WeekCalendar({
  monday,
  cells,
  onCommit,
  onOpenLesson,
}: {
  monday: string
  cells: CellPaint[]
  onCommit: (slots: Slot[]) => void
  onOpenLesson: (aulaId: string) => void
}) {
  const hours = hourMarks()
  const paint = new Map(cells.map((cell) => [keyOf(cell.day, cell.minute), cell]))
  const drag = useRef<{ anchor: Slot; focus: Slot } | null>(null)
  const [preview, setPreview] = useState<Slot[]>([])
  const previewKeys = new Set(preview.map((slot) => keyOf(slot.day, slot.minute)))
  const finishRef = useRef<(x: number, y: number) => void>(() => {})

  finishRef.current = (x, y) => {
    const current = drag.current
    if (!current) return
    drag.current = null
    setPreview([])
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day]")
    const focus = hit
      ? { day: Number(hit.dataset.day), minute: Number(hit.dataset.minute) }
      : current.focus
    const slots = rect(current.anchor, focus)
    const single =
      slots.length === 1 && current.anchor.day === focus.day && current.anchor.minute === focus.minute
    const painted = paint.get(keyOf(slots[0].day, slots[0].minute))
    if (single && painted?.aulaId) {
      onOpenLesson(painted.aulaId)
      return
    }
    onCommit(slots)
  }

  useEffect(() => {
    const up = (event: PointerEvent) => finishRef.current(event.clientX, event.clientY)
    window.addEventListener("pointerup", up)
    return () => window.removeEventListener("pointerup", up)
  }, [])

  function slotFromEvent(event: ReactPointerEvent) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-day]")
    if (!target) return null
    return { day: Number(target.dataset.day), minute: Number(target.dataset.minute) }
  }

  return (
    <div
      className="cal-scroll"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const slot = slotFromEvent(event)
        if (!slot) return
        drag.current = { anchor: slot, focus: slot }
        setPreview([slot])
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]")
        if (!slot) return
        const focus = { day: Number(slot.dataset.day), minute: Number(slot.dataset.minute) }
        drag.current.focus = focus
        setPreview(rect(drag.current.anchor, focus))
      }}
    >
      <div className="cal" role="grid" aria-label="Semana do professor">
        <div className="cal-corner" />
        {WEEK.map((day) => {
          const date = dateOfWeekday(monday, day)
          return (
            <div key={day} className="cal-head" role="columnheader">
              <span>{SHORT[day]}</span>
              <strong>{Number(date.slice(8))}</strong>
            </div>
          )
        })}
        {hours.map((minute) => (
          <div key={minute} className="cal-row">
            <div className="cal-time">{formatMinute(minute).slice(0, 2)}</div>
            {WEEK.map((day) => {
              const painted = paint.get(keyOf(day, minute))
              const selected = previewKeys.has(keyOf(day, minute))
              return (
                <div
                  key={day}
                  role="gridcell"
                  data-day={day}
                  data-minute={minute}
                  aria-label={`${SHORT[day]} ${formatMinute(minute)}`}
                  aria-selected={selected}
                  className={`cal-cell ${painted?.kind ?? "vazio"}${selected ? " selected" : ""}`}
                >
                  {painted?.title ? <strong>{painted.title}</strong> : null}
                  {painted?.detail ? <span>{painted.detail}</span> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
