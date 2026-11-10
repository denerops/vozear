import { useEffect } from "react"
import { clockLabel, formatDayTitle, recurrenceLabel, toneFor } from "../model.ts"
import type { AgendaClass } from "../types.ts"

export function ClassDetailsModal({
  item,
  onClose,
  onReschedule,
  onEditSeries,
  onRestore,
  onCancel,
}: {
  item: AgendaClass
  onClose: () => void
  onReschedule: () => void
  onEditSeries: () => void
  onRestore: () => void
  onCancel: () => void
}) {
  const tone = toneFor(item.instrument)
  const end = item.startMinute + item.durationMinutes
  const moved = item.status === "remarcada"

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="agenda-modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="agenda-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="agenda-kicker" style={{ color: tone.bar }}>
          {item.instrument}
        </p>
        <h2 id="agenda-detail-title">{item.student}</h2>
        <dl>
          <div>
            <dt>Professor</dt>
            <dd>{item.teacher}</dd>
          </div>
          <div>
            <dt>Esta aula</dt>
            <dd>
              {formatDayTitle(item.date)} · {clockLabel(item.startMinute)} – {clockLabel(end)}
            </dd>
          </div>
          <div>
            <dt>Recorrência</dt>
            <dd>{recurrenceLabel(item.weekday, item.seriesStartMinute)}</dd>
          </div>
        </dl>
        <p className="agenda-note">
          {moved
            ? "Só esta data saiu do horário de sempre."
            : "Esta data segue o horário de toda semana."}
        </p>
        <div className="agenda-detail-actions">
          <button className="agenda-primary" type="button" onClick={onReschedule}>
            Reagendar esta aula
          </button>
          <button className="agenda-ghost" type="button" onClick={onEditSeries}>
            Alterar todas as semanas
          </button>
          {moved ? (
            <button className="agenda-ghost" type="button" onClick={onRestore}>
              Voltar ao horário de sempre
            </button>
          ) : null}
          <button className="agenda-ghost" type="button" onClick={onCancel}>
            Cancelar esta aula
          </button>
        </div>
      </section>
    </div>
  )
}
