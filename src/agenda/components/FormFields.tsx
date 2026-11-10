import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react"
import { addDays } from "../../lib/dates.ts"
import { DAY_LABEL, toneFor, weekdayOf } from "../model.ts"

export type Choice = { value: string; label: string; hint?: string; dot?: string }

export function ChoiceField({
  label,
  value,
  options,
  open,
  onOpen,
  onChange,
}: {
  label: string
  value: string
  options: Choice[]
  open: boolean
  onOpen: (open: boolean) => void
  onChange: (value: string) => void
}) {
  const selected = options.find((option) => option.value === value)
  const listId = useId()
  const root = useRef<HTMLDivElement>(null)
  useDismiss(open, root, () => onOpen(false))

  return (
    <div className="agenda-field" ref={root}>
      <span className="agenda-field-label" id={`${listId}-label`}>
        {label}
      </span>
      <button
        type="button"
        className="agenda-control"
        aria-labelledby={`${listId}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        <span className="agenda-control-value">
          {selected?.dot ? <i style={{ background: selected.dot }} /> : null}
          {selected?.label ?? "Escolher"}
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <ul className="agenda-menu" role="listbox" aria-labelledby={`${listId}-label`}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value)
                  onOpen(false)
                }}
              >
                {option.dot ? <i style={{ background: option.dot }} /> : null}
                <span>
                  <strong>{option.label}</strong>
                  {option.hint ? <small>{option.hint}</small> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function DateField({
  value,
  open,
  onOpen,
  onChange,
  children,
}: {
  value: string
  open: boolean
  onOpen: (open: boolean) => void
  onChange: (value: string) => void
  children?: ReactNode
}) {
  const [cursor, setCursor] = useState(value.slice(0, 7))
  const root = useRef<HTMLDivElement>(null)
  const labelId = useId()
  useDismiss(open, root, () => onOpen(false))

  const [year, month] = cursor.split("-").map(Number)
  const first = `${year}-${String(month).padStart(2, "0")}-01`
  const lead = (weekdayOf(first) + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/^./, (letter) => letter.toUpperCase())

  return (
    <div className="agenda-when" ref={root}>
      <div className="agenda-form-row">
        <div className="agenda-field">
          <span className="agenda-field-label" id={labelId}>
            Data
          </span>
          <button
            type="button"
            className="agenda-control"
            aria-labelledby={labelId}
            aria-expanded={open}
            onClick={() => onOpen(!open)}
          >
            <span className="agenda-control-value">{compactDate(value)}</span>
            <Chevron open={open} />
          </button>
        </div>
        {children}
      </div>
      {open ? (
        <div className="agenda-cal">
          <div className="agenda-cal-head">
            <button type="button" aria-label="Mês anterior" onClick={() => setCursor(shiftMonth(cursor, -1))}>
              ‹
            </button>
            <strong>
              {monthName} {year}
            </strong>
            <button type="button" aria-label="Próximo mês" onClick={() => setCursor(shiftMonth(cursor, 1))}>
              ›
            </button>
          </div>
          <div className="agenda-cal-grid">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
            {Array.from({ length: lead }, (_, index) => (
              <span key={`pad-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date = addDays(first, index)
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={date === value}
                  onClick={() => {
                    onChange(date)
                    onOpen(false)
                  }}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DurationField({
  value,
  options,
  onChange,
}: {
  value: string
  options: number[]
  onChange: (value: string) => void
}) {
  const labelId = useId()
  return (
    <div className="agenda-field">
      <span className="agenda-field-label" id={labelId}>
        Duração
      </span>
      <div className="agenda-durations" role="radiogroup" aria-labelledby={labelId}>
        {options.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={String(minutes) === value}
            onClick={() => onChange(String(minutes))}
          >
            {durationLabel(minutes)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={open ? "is-open" : undefined}>
      <path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function useDismiss(open: boolean, root: RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      close()
    }
    window.addEventListener("pointerdown", onPointer)
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [open, root, close])
}

function compactDate(iso: string) {
  const day = Number(iso.slice(8))
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, day)))
    .replace(".", "")
  return `${DAY_LABEL[weekdayOf(iso)]} ${day} ${month}`
}

function shiftMonth(cursor: string, delta: number) {
  const [year, month] = cursor.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function studentHint(student: StudentOption) {
  const phone = student.telefone.replace(/\D/g, "")
  const formatted =
    phone.length === 11
      ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
      : phone.length === 10
        ? `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
        : ""
  return [formatted, student.email].filter(Boolean).join(" · ")
}

function durationLabel(minutes: number) {
  if (minutes === 60) return "1 hora"
  if (minutes === 90) return "1 h 30"
  if (minutes === 120) return "2 horas"
  if (minutes % 60 === 0) return `${minutes / 60} horas`
  return `${minutes} min`
}

export type StudentOption = { id: string; nome: string; email: string; telefone: string }

export function StudentField({
  students,
  status,
  value,
  open,
  onOpen,
  onChange,
}: {
  students: StudentOption[]
  status: "loading" | "ready" | "error"
  value: string
  open: boolean
  onOpen: (open: boolean) => void
  onChange: (value: string) => void
}) {
  const [query, setQuery] = useState(value)
  const root = useRef<HTMLDivElement>(null)
  const labelId = useId()
  useDismiss(open, root, () => onOpen(false))
  const folded = fold(query.trim())
  const matches = students.filter((student) => {
    if (!folded) return true
    return [student.nome, student.email, student.telefone].some((part) => fold(part).includes(folded))
  })

  return (
    <div className="agenda-field" ref={root}>
      <span className="agenda-field-label" id={labelId}>
        Aluno
      </span>
      <span className="agenda-control">
        <input
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Buscar aluno"
          value={query}
          autoFocus
          onFocus={() => onOpen(true)}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            onOpen(true)
            if (next !== value) onChange("")
          }}
        />
        <button type="button" className="agenda-chevron" aria-label="Abrir alunos" onClick={() => onOpen(!open)}>
          <Chevron open={open} />
        </button>
      </span>
      {open ? (
        <ul className="agenda-menu" role="listbox" aria-labelledby={labelId}>
          {status === "loading" ? <li className="agenda-menu-empty">Carregando alunos…</li> : null}
          {status === "error" ? <li className="agenda-menu-empty">Não foi possível carregar os alunos.</li> : null}
          {status === "ready" && matches.length === 0 ? (
            <li className="agenda-menu-empty">Nenhum aluno encontrado.</li>
          ) : null}
          {status === "ready"
            ? matches.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={student.nome === value}
                    onClick={() => {
                      setQuery(student.nome)
                      onChange(student.nome)
                      onOpen(false)
                    }}
                  >
                    <span>
                      <strong>{student.nome}</strong>
                      <small>{studentHint(student)}</small>
                    </span>
                  </button>
                </li>
              ))
            : null}
        </ul>
      ) : null}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="agenda-field">
      <span className="agenda-field-label">{label}</span>
      <span className="agenda-control">{children}</span>
    </label>
  )
}
