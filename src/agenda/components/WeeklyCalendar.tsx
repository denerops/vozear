import "../agenda.css"
import type { AgendaTeacher } from "../records.ts"
import type { AgendaClass } from "../types.ts"
import { CalendarGrid } from "./CalendarGrid.tsx"
import { CalendarHeader } from "./CalendarHeader.tsx"

export function WeeklyCalendar({
  monday,
  selectedDate,
  classes,
  teachers,
  teacher,
  onShift,
  onToday,
  onSelectDate,
  onSelectTeacher,
  onOpen,
  onCreateAt,
  pending = false,
}: {
  monday: string
  selectedDate: string
  classes: AgendaClass[]
  teachers: AgendaTeacher[]
  teacher: string | null
  onShift: (days: number) => void
  onToday: () => void
  onSelectDate: (date: string) => void
  onSelectTeacher: (teacher: string | null) => void
  onOpen: (id: string) => void
  onCreateAt: (date: string, startMinute: number) => void
  pending?: boolean
}) {
  return (
    <div className="agenda-board">
      <CalendarHeader
        monday={monday}
        teachers={teachers}
        teacher={teacher}
        onShift={onShift}
        onToday={onToday}
        onSelectTeacher={onSelectTeacher}
      />
      <div className="agenda-frame">
        <div className="agenda-scroll" aria-busy={pending || undefined}>
          <CalendarGrid
            monday={monday}
            selectedDate={selectedDate}
            classes={classes}
            teachers={teachers}
            onSelectDate={onSelectDate}
            onOpen={onOpen}
            onCreateAt={onCreateAt}
          />
        </div>
        {pending ? <div className="agenda-refresh" role="status" aria-label="Carregando" /> : null}
      </div>
    </div>
  )
}
