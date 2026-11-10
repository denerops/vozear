import { addDays, dateOfWeekday, formatMinute, mondayOf, timeToMinute } from "../lib/dates.ts"
import type { AgendaClass } from "./types.ts"

export const WEEKDAYS = [1, 2, 3, 4, 5]
export const DAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
export const DAY_NAME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
export const INSTRUMENTS = ["Canto", "Violão", "Piano", "Pandeiro", "Percussão"]
export const SLOT_START = 8 * 60
export const SLOT_END = 20 * 60

export const TEACHERS = [
  { name: "Brenda", instruments: ["Canto"] },
  { name: "Dani", instruments: ["Pandeiro", "Percussão"] },
  { name: "Pedro", instruments: ["Violão", "Piano"] },
]
export const ROW_HEIGHT = 58

export type InstrumentTone = { background: string; bar: string; dot: string }

const TONES: Record<string, InstrumentTone> = {
  canto: { background: "#F3E7FB", bar: "#C89BE4", dot: "#C89BE4" },
  violao: { background: "#FFF6D8", bar: "#E8C15A", dot: "#E8C15A" },
  piano: { background: "#FDE7EA", bar: "#F47785", dot: "#F47785" },
  pandeiro: { background: "#FFE9B0", bar: "#FFB21C", dot: "#FFB21C" },
  percussao: { background: "#F8E4E0", bar: "#791323", dot: "#791323" },
}

export function toneFor(instrument: string): InstrumentTone {
  const key = instrument.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  return TONES[key] ?? { background: "#F8EDE6", bar: "#791323", dot: "#791323" }
}

export function slotBounds() {
  return { start: SLOT_START, end: SLOT_END }
}

export function teachersIn(classes: AgendaClass[]) {
  const extras = new Map<string, Set<string>>()
  for (const item of classes) {
    if (item.status === "cancelada") continue
    const known = TEACHERS.find((teacher) => teacher.name === item.teacher)
    if (known) continue
    const set = extras.get(item.teacher) ?? new Set<string>()
    set.add(item.instrument)
    extras.set(item.teacher, set)
  }
  return [
    ...TEACHERS,
    ...[...extras.entries()].map(([name, instruments]) => ({ name, instruments: [...instruments].sort() })),
  ]
}

export function hourMarks(start: number, end: number) {
  const marks: number[] = []
  for (let minute = start; minute <= end; minute += 60) marks.push(minute)
  return marks
}

export function weekdayOf(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function formatSpan(monday: string) {
  const sunday = addDays(monday, 6)
  const startDay = Number(monday.slice(8))
  const endDay = Number(sunday.slice(8))
  const month = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
      .format(utc(iso))
      .replace(".", "")
      .toLowerCase()
  if (monday.slice(0, 7) === sunday.slice(0, 7)) return `${startDay} – ${endDay} ${month(monday)}`
  return `${startDay} ${month(monday)} – ${endDay} ${month(sunday)}`
}

export function formatDayTitle(isoDate: string) {
  const weekday = DAY_NAME[weekdayOf(isoDate)]
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(utc(isoDate))
    .toLowerCase()
  return `${weekday}, ${Number(isoDate.slice(8))} de ${month}`
}

export function classesOn(classes: AgendaClass[], date: string) {
  return classes
    .filter((item) => item.status !== "cancelada" && item.date === date)
    .sort((a, b) => a.startMinute - b.startMinute)
}

export function placedEvents(events: AgendaClass[]) {
  const sorted = [...events].sort((a, b) => a.startMinute - b.startMinute || a.student.localeCompare(b.student, "pt-BR"))
  const placed: { item: AgendaClass; column: number; columns: number }[] = []
  let cluster: { item: AgendaClass; column: number }[] = []
  let clusterEnd = -1

  function flush() {
    const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1))
    for (const entry of cluster) placed.push({ ...entry, columns })
    cluster = []
    clusterEnd = -1
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMinute >= clusterEnd) flush()
    const taken = new Set(
      cluster
        .filter((entry) => entry.item.startMinute + entry.item.durationMinutes > item.startMinute)
        .map((entry) => entry.column),
    )
    let column = 0
    while (taken.has(column)) column += 1
    cluster.push({ item, column })
    clusterEnd = Math.max(clusterEnd, item.startMinute + item.durationMinutes)
  }
  if (cluster.length > 0) flush()
  return placed
}

export function sampleClasses(today: string): AgendaClass[] {
  const monday = mondayOf(today)
  const lesson = (
    id: string,
    weekday: number,
    time: string,
    instrument: string,
    student: string,
    teacher: string,
  ): AgendaClass => ({
    id,
    student,
    teacher,
    instrument,
    date: dateOfWeekday(monday, weekday),
    startMinute: timeToMinute(time),
    durationMinutes: 60,
    status: "prevista",
  })
  return [
    lesson("amostra-1", 1, "15:00", "Violão", "Pedro M.", "Pedro"),
    lesson("amostra-2", 1, "19:00", "Canto", "João P.", "Brenda"),
    lesson("amostra-3", 2, "14:00", "Canto", "Ana C.", "Brenda"),
    lesson("amostra-4", 2, "17:00", "Pandeiro", "Rafael S.", "Dani"),
    lesson("amostra-5", 3, "16:00", "Piano", "Luiza R.", "Pedro"),
    lesson("amostra-6", 4, "18:00", "Violão", "Marina L.", "Pedro"),
    lesson("amostra-7", 4, "20:00", "Piano", "Carla B.", "Pedro"),
  ]
}

export function clockLabel(minute: number) {
  return formatMinute(minute)
}

function utc(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
