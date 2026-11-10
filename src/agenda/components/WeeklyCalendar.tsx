import "../agenda.css"
import type { AgendaClass } from "../types.ts"
import { CalendarGrid } from "./CalendarGrid.tsx"
import { CalendarHeader } from "./CalendarHeader.tsx"
import { TeacherPanel } from "./DaySchedule.tsx"

export function WeeklyCalendar({
  monday,
  selectedDate,
  classes,
  roster,
  teacher,
  onShift,
  onSelectDate,
  onSelectTeacher,
  onOpen,
  onCreateAt,
  onCreate,
}: {
  monday: string
  selectedDate: string
  classes: AgendaClass[]
  roster: AgendaClass[]
  teacher: string | null
  onShift: (days: number) => void
  onSelectDate: (date: string) => void
  onSelectTeacher: (teacher: string | null) => void
  onOpen: (id: string) => void
  onCreateAt: (date: string, startMinute: number) => void
  onCreate: () => void
}) {
  return (
    <div className="agenda-board">
      <section className="agenda-card agenda-weekcard">
        <CalendarHeader monday={monday} onShift={onShift} />
        <div className="agenda-scroll">
          <CalendarGrid
            monday={monday}
            selectedDate={selectedDate}
            classes={classes}
            onSelectDate={onSelectDate}
            onOpen={onOpen}
            onCreateAt={onCreateAt}
          />
        </div>
      </section>
      <TeacherPanel classes={roster} selected={teacher} onSelect={onSelectTeacher} onCreate={onCreate} />
    </div>
  )
}
