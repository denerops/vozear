import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { dateOfWeekday, formatMinute, formatWeekSpan, mondayOf, saoPauloDate } from "../lib/dates.ts"

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
const DRAG_SLOP = 10

export function hourMarks() {
  const marks: number[] = []
  for (let minute = HOUR_START; minute <= HOUR_END; minute += 60) marks.push(minute)
  return marks
}

export function WeekNav({
  monday,
  onShift,
  onToday,
}: {
  monday: string
  onShift: (days: number) => void
  onToday: () => void
}) {
  const thisWeek = monday === mondayOf(saoPauloDate())
  return (
    <div className="week-nav">
      <button type="button" onClick={() => onShift(-7)}>Anterior</button>
      <span className="week-label">{formatWeekSpan(monday)}</span>
      <button type="button" aria-pressed={thisWeek} onClick={onToday}>Hoje</button>
      <button type="button" onClick={() => onShift(7)}>Próxima</button>
    </div>
  )
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

type Pending = {
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  anchor: Slot
  focus: Slot
  armed: boolean
}

export function WeekCalendar({
  monday,
  cells,
  anchorMinute,
  readOnly = false,
  label = "Semana",
  refreshing = false,
  onCommit,
  onOpenLesson,
}: {
  monday: string
  cells: CellPaint[]
  anchorMinute: number
  readOnly?: boolean
  label?: string
  refreshing?: boolean
  onCommit?: (slots: Slot[]) => void
  onOpenLesson: (aulaId: string) => void
}) {
  const hours = hourMarks()
  const today = saoPauloDate()
  const paint = new Map(cells.map((cell) => [keyOf(cell.day, cell.minute), cell]))
  const pending = useRef<Pending | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<Slot[]>([])
  const previewKeys = new Set(preview.map((slot) => keyOf(slot.day, slot.minute)))
  const finishRef = useRef<(commit: boolean) => void>(() => {})

  finishRef.current = (commit) => {
    const current = pending.current
    pending.current = null
    setPreview([])
    if (!current || !commit || readOnly) return
    if (!current.armed) {
      const painted = paint.get(keyOf(current.anchor.day, current.anchor.minute))
      if (painted?.aulaId) onOpenLesson(painted.aulaId)
      else onCommit?.([current.anchor])
      return
    }
    const slots = rect(current.anchor, current.focus)
    const painted = paint.get(keyOf(slots[0].day, slots[0].minute))
    if (slots.length === 1 && painted?.aulaId) {
      onOpenLesson(painted.aulaId)
      return
    }
    onCommit?.(slots)
  }

  useEffect(() => {
    const up = (event: PointerEvent) => {
      const current = pending.current
      if (!current || current.pointerId !== event.pointerId) return
      if (!current.armed) {
        const dx = event.clientX - current.startX
        const dy = event.clientY - current.startY
        if (Math.abs(dx) >= DRAG_SLOP || Math.abs(dy) >= DRAG_SLOP) {
          finishRef.current(false)
          return
        }
      }
      finishRef.current(true)
    }
    const cancel = (event: PointerEvent) => {
      const current = pending.current
      if (!current || current.pointerId !== event.pointerId) return
      finishRef.current(false)
    }
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", cancel)
    return () => {
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", cancel)
    }
  }, [])

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const place = () => {
      const target = node.querySelector<HTMLElement>(`[data-minute="${anchorMinute}"]`)
      const head = node.querySelector<HTMLElement>(".cal-head")
      if (!target || !head) return
      const top = target.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop
      node.scrollTop = Math.max(0, top - head.offsetHeight - 2)
    }
    place()
    const frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  }, [anchorMinute, monday])

  function slotFromEvent(event: ReactPointerEvent) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-day]")
    if (!target) return null
    return { day: Number(target.dataset.day), minute: Number(target.dataset.minute) }
  }

  return (
    <div className="cal-frame">
    <div
      className="cal-scroll"
      ref={scroller}
      aria-busy={refreshing || undefined}
      onPointerDown={(event) => {
        if (readOnly || event.button !== 0) return
        const slot = slotFromEvent(event)
        if (!slot) return
        const armed = event.pointerType === "mouse"
        pending.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          startX: event.clientX,
          startY: event.clientY,
          anchor: slot,
          focus: slot,
          armed,
        }
        if (armed) setPreview([slot])
      }}
      onPointerMove={(event) => {
        const current = pending.current
        if (!current || current.pointerId !== event.pointerId) return
        if (!current.armed) {
          const dx = event.clientX - current.startX
          const dy = event.clientY - current.startY
          if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return
          if (Math.abs(dx) < DRAG_SLOP || Math.abs(dy) > Math.abs(dx)) {
            pending.current = null
            setPreview([])
            return
          }
          current.armed = true
        }
        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]")
        if (!hit) return
        const focus = { day: Number(hit.dataset.day), minute: Number(hit.dataset.minute) }
        current.focus = focus
        setPreview(rect(current.anchor, focus))
      }}
      onClick={(event) => {
        if (!readOnly) return
        const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-day]")
        if (!slot) return
        const painted = paint.get(keyOf(Number(slot.dataset.day), Number(slot.dataset.minute)))
        if (painted?.aulaId) onOpenLesson(painted.aulaId)
      }}
    >
      <div className="cal" role="grid" aria-label={label}>
        <div className="cal-corner" />
        {WEEK.map((day) => {
          const date = dateOfWeekday(monday, day)
          const isToday = date === today
          return (
            <div key={day} className={`cal-head${isToday ? " is-today" : ""}`} role="columnheader">
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
              const state = painted?.kind === "bloqueado" ? "bloqueado" : painted?.title
              return (
                <div
                  key={day}
                  role="gridcell"
                  data-day={day}
                  data-minute={minute}
                  aria-label={`${SHORT[day]} ${formatMinute(minute)}${state ? `, ${state}` : ""}`}
                  aria-selected={selected || undefined}
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
      {refreshing ? <div className="agenda-refresh" role="status" aria-label="Carregando" /> : null}
    </div>
  )
}
