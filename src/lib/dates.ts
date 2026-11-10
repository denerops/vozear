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
