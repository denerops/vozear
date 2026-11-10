export const TIMEZONE = "America/Sao_Paulo"

export const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

export function saoPauloDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function mondayOf(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dow = date.getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  return addDays(isoDate, delta)
}

export function saoPauloTimestamp(date: string, time: string) {
  return `${date}T${time}:00-03:00`
}

export function dateOfWeekday(monday: string, weekday: number) {
  const offset = weekday === 0 ? 6 : weekday - 1
  return addDays(monday, offset)
}

export function saoPauloClock(iso: string) {
  const date = saoPauloDate(new Date(iso))
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
  const [year, month, day] = date.split("-").map(Number)
  return {
    date,
    minute: timeToMinute(time),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

export function formatMinute(minute: number) {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function timeToMinute(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function saoPauloHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date)
  return Number(hour)
}

export function agendaStartMinute(date = new Date()) {
  const hour = saoPauloHour(date)
  if (hour < 16) return 16 * 60
  if (hour > 21) return 21 * 60
  return hour * 60
}

function monthName(isoDate: string, width: "long" | "short") {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: width, timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(".", "")
}

export function formatWeekSpan(monday: string) {
  const sunday = addDays(monday, 6)
  const startDay = Number(monday.slice(8))
  const endDay = Number(sunday.slice(8))
  if (monday.slice(0, 7) === sunday.slice(0, 7)) {
    return `${startDay}–${endDay} de ${monthName(monday, "long")}`
  }
  return `${startDay} de ${monthName(monday, "short")} – ${endDay} de ${monthName(sunday, "short")}`
}

export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatMonth(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function currentMonth() {
  return saoPauloDate().slice(0, 7)
}
