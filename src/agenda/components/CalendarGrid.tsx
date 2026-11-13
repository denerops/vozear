import { dateOfWeekday, saoPauloDate } from "../../lib/dates.ts"
import { DAY_LABEL, ROW_HEIGHT, WEEKDAYS, classesOn, clockLabel, hourMarks, placedEvents, slotBounds } from "../model.ts"
import type { AgendaClass } from "../types.ts"
import { CalendarEvent } from "./CalendarEvent.tsx"

export function CalendarGrid({
  monday,
  selectedDate,
  classes,
  teachers,
  onSelectDate,
  onOpen,
  onCreateAt,
}: {
  monday: string
  selectedDate: string
  classes: AgendaClass[]
  teachers: { name: string }[]
  onSelectDate: (date: string) => void
  onOpen: (id: string) => void
  onCreateAt: (date: string, startMinute: number) => void
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
              if ((event.target as HTMLElement).closest(".agenda-event")) return
              const offset = event.clientY - event.currentTarget.getBoundingClientRect().top
              const index = Math.min(marks.length - 1, Math.max(0, Math.floor(offset / ROW_HEIGHT)))
              onSelectDate(date)
              onCreateAt(date, start + index * 60)
            }}
          >
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
