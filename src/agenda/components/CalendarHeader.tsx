import { formatSpan } from "../model.ts"

export function CalendarHeader({
  monday,
  onShift,
}: {
  monday: string
  onShift: (days: number) => void
}) {
  return (
    <header className="agenda-head">
      <h2>Agenda da semana</h2>
      <div className="agenda-nav">
        <button type="button" aria-label="Semana anterior" onClick={() => onShift(-7)}>
          ‹
        </button>
        <span>{formatSpan(monday)}</span>
        <button type="button" aria-label="Próxima semana" onClick={() => onShift(7)}>
          ›
        </button>
      </div>
    </header>
  )
}
