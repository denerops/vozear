import { SidebarTrigger } from "@/components/ui/sidebar"
import { formatSpan, teacherTone } from "../model.ts"
import type { AgendaTeacher } from "../records.ts"

export function CalendarHeader({
  monday,
  teachers,
  teacher,
  onShift,
  onToday,
  onSelectTeacher,
}: {
  monday: string
  teachers: AgendaTeacher[]
  teacher: string | null
  onShift: (days: number) => void
  onToday: () => void
  onSelectTeacher: (teacher: string | null) => void
}) {
  return (
    <header className="agenda-toolbar">
      <div className="agenda-toolbar-start">
        <SidebarTrigger />
        <button type="button" className="agenda-today" onClick={onToday}>
          Hoje
        </button>
        <div className="agenda-nav">
          <button type="button" aria-label="Semana anterior" onClick={() => onShift(-7)}>
            ‹
          </button>
          <button type="button" aria-label="Próxima semana" onClick={() => onShift(7)}>
            ›
          </button>
        </div>
        <h2>{formatSpan(monday)}</h2>
      </div>
      {teachers.length > 1 ? (
        <nav className="agenda-teachers" aria-label="Professores">
          {teachers.map((item) => {
            const tone = teacherTone(item.name, teachers)
            const selected = teacher === item.name
            return (
              <button
                key={item.id}
                type="button"
                className={selected ? "is-selected" : teacher ? "is-dimmed" : undefined}
                style={{ ["--teacher" as string]: tone.bar, ["--teacher-on-dark" as string]: tone.onDark }}
                aria-pressed={selected}
                onClick={() => onSelectTeacher(selected ? null : item.name)}
              >
                <i aria-hidden="true" />
                {item.name}
              </button>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
