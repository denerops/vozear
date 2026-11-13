import { dateOfWeekday, saoPauloDate } from "../../lib/dates.ts"
import { DAY_LABEL, ROW_HEIGHT, SLOT_START, WEEKDAYS, classesOn, clockLabel, hourMarks, placedEvents, slotBounds } from "../model.ts"
import type { AgendaClass } from "../types.ts"
import { CalendarEvent } from "./CalendarEvent.tsx"

const GHOSTS: { hour: number; minutes: number }[][] = [
  [{ hour: 10, minutes: 60 }, { hour: 16, minutes: 60 }],
  [{ hour: 9, minutes: 60 }, { hour: 14, minutes: 90 }],
  [{ hour: 11, minutes: 60 }, { hour: 18, minutes: 60 }],
  [{ hour: 8, minutes: 60 }, { hour: 15, minutes: 60 }],
  [{ hour: 13, minutes: 60 }, { hour: 17, minutes: 60 }],
]

export function CalendarGrid({
  monday,
  selectedDate,
  classes,
  teachers,
  onSelectDate,
  onOpen,
  onCreateAt,
  pending = false,
}: {
  monday: string
  selectedDate: string
  classes: AgendaClass[]
  teachers: { name: string }[]
  onSelectDate: (date: string) => void
  onOpen: (id: string) => void
  onCreateAt: (date: string, startMinute: number) => void
  pending?: boolean
}) {
  const today = saoPauloDate()
  const { start, end } = slotBounds()
  const marks = hourMarks(start, end)
  const height = marks.length * ROW_HEIGHT

  return (
    <div className="agenda-grid" style={{ ["--row" as string]: `${ROW_HEIGHT}px` }}>
      <div className="agenda-corner" />
      <div className="agenda-days">
        {WEEKDAYS.map((day) => {
          const date = dateOfWeekday(monday, day)
          const selected = date === selectedDate
          const isToday = date === today
          return (
            <button
              key={day}
              type="button"
              className={`agenda-day${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              aria-pressed={selected}
              onClick={() => onSelectDate(date)}
            >
              <span>{DAY_LABEL[day]}</span>
              <strong>{Number(date.slice(8))}</strong>
            </button>
          )
        })}
      </div>
      <div className="agenda-times" style={{ height }}>
        {marks.map((minute) => (
          <span key={minute} style={{ height: ROW_HEIGHT }}>
            {clockLabel(minute)}
          </span>
        ))}
      </div>
      {WEEKDAYS.map((day) => {
        const date = dateOfWeekday(monday, day)
        const events = placedEvents(classesOn(classes, date))
        return (
          <div
            key={date}
            className={`agenda-column${date === selectedDate ? " is-selected" : ""}`}
            style={{ height }}
            onClick={(event) => {
              if (pending) return
              if ((event.target as HTMLElement).closest(".agenda-event")) return
              const offset = event.clientY - event.currentTarget.getBoundingClientRect().top
              const index = Math.min(marks.length - 1, Math.max(0, Math.floor(offset / ROW_HEIGHT)))
              onSelectDate(date)
              onCreateAt(date, start + index * 60)
            }}
          >
            {pending
              ? GHOSTS[WEEKDAYS.indexOf(day)]?.map((ghost) => {
                  const top = ((ghost.hour * 60 - SLOT_START) / 60) * ROW_HEIGHT + 4
                  const eventHeight = Math.max(28, (ghost.minutes / 60) * ROW_HEIGHT - 8)
                  return (
                    <div key={ghost.hour} className="agenda-ghost" style={{ top, height: eventHeight }}>
                      <i />
                      <i />
                    </div>
                  )
                })
              : null}
            {events.map(({ item, column, columns }) => {
              const top = ((item.startMinute - start) / 60) * ROW_HEIGHT + 4
              const raw = (item.durationMinutes / 60) * ROW_HEIGHT - 8
              const eventHeight = Math.max(28, Math.min(raw, height - top - 4))
              return (
                <CalendarEvent
                  key={item.id}
                  item={item}
                  top={top}
                  height={eventHeight}
                  column={column}
                  columns={columns}
                  teachers={teachers}
                  onOpen={onOpen}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
