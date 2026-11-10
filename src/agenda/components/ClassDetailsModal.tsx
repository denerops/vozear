import { useEffect } from "react"
import { clockLabel, formatDayTitle, toneFor } from "../model.ts"
import type { AgendaClass } from "../types.ts"

export function ClassDetailsModal({
  item,
  onClose,
  onEdit,
  onCancel,
}: {
  item: AgendaClass
  onClose: () => void
  onEdit: () => void
  onCancel: () => void
}) {
  const tone = toneFor(item.instrument)
  const end = item.startMinute + item.durationMinutes

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
            <dt>Data</dt>
            <dd>{formatDayTitle(item.date)}</dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>
              {clockLabel(item.startMinute)} – {clockLabel(end)}
            </dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{item.durationMinutes} min</dd>
          </div>
        </dl>
        <div className="agenda-form-actions">
          <button className="agenda-ghost" type="button" onClick={onCancel}>
            Cancelar aula
          </button>
          <button className="agenda-primary" type="button" onClick={onEdit}>
            Editar
          </button>
        </div>
      </section>
    </div>
  )
}
