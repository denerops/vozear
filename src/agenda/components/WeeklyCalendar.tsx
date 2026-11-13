import "../agenda.css"
import type { AgendaTeacher } from "../records.ts"
import type { AgendaClass, AgendaSeries } from "../types.ts"
import { CalendarGrid } from "./CalendarGrid.tsx"
import { CalendarHeader } from "./CalendarHeader.tsx"
import { TeacherPanel } from "./DaySchedule.tsx"

export function WeeklyCalendar({
  monday,
  selectedDate,
  classes,
  roster,
  teachers,
  teacher,
  onShift,
  onSelectDate,
  onSelectTeacher,
  onOpen,
  onCreateAt,
  onCreate,
  pending = false,
}: {
  monday: string
  selectedDate: string
  classes: AgendaClass[]
  roster: AgendaSeries[]
  teachers: AgendaTeacher[]
  teacher: string | null
  onShift: (days: number) => void
  onSelectDate: (date: string) => void
  onSelectTeacher: (teacher: string | null) => void
  onOpen: (id: string) => void
  onCreateAt: (date: string, startMinute: number) => void
  onCreate: () => void
  pending?: boolean
}) {
  return (
    <div className="agenda-board">
      <section className="agenda-card agenda-weekcard">
        <CalendarHeader monday={monday} onShift={onShift} />
        <div className="agenda-frame">
          <div className="agenda-scroll" aria-busy={pending || undefined}>
            <CalendarGrid
              monday={monday}
              selectedDate={selectedDate}
              classes={classes}
              onSelectDate={onSelectDate}
              onOpen={onOpen}
              onCreateAt={onCreateAt}
            />
          </div>
          {pending ? <div className="agenda-refresh" role="status" aria-label="Carregando" /> : null}
        </div>
      </section>
      <TeacherPanel classes={roster} catalog={teachers} selected={teacher} onSelect={onSelectTeacher} onCreate={onCreate} />
    </div>
  )
}
