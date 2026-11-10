import { teachersIn, toneFor } from "../model.ts"
import type { AgendaClass } from "../types.ts"

export function TeacherPanel({
  classes,
  selected,
  onSelect,
  onCreate,
}: {
  classes: AgendaClass[]
  selected: string | null
  onSelect: (teacher: string | null) => void
  onCreate: () => void
}) {
  const teachers = teachersIn(classes)
  return (
    <aside className="agenda-card agenda-daycard">
      <h2>Professores</h2>
      <p>Escolha quem aparece na semana.</p>
      <ul>
        <li>
          <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}>
            <span>
              <strong>Todos</strong>
              <small>Aulas da escola</small>
            </span>
          </button>
        </li>
        {teachers.map((teacher) => (
          <li key={teacher.name}>
            <button
              type="button"
              aria-pressed={selected === teacher.name}
              onClick={() => onSelect(selected === teacher.name ? null : teacher.name)}
            >
              <span className="agenda-dots" aria-hidden="true">
                {teacher.instruments.map((instrument) => (
                  <i key={instrument} style={{ background: toneFor(instrument).dot }} />
                ))}
              </span>
              <span>
                <strong>{teacher.name}</strong>
                <small>{teacher.instruments.join(" · ")}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="agenda-add" type="button" onClick={onCreate}>
        Nova aula
      </button>
    </aside>
  )
}
