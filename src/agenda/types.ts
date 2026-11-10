export type AgendaSeries = {
  id: string
  student: string
  teacher: string
  instrument: string
  weekday: number
  startMinute: number
  durationMinutes: number
  startsOn: string
}

export type AgendaException = {
  seriesId: string
  fromDate: string
  kind: "remarcada" | "cancelada"
  date: string
  startMinute: number
  durationMinutes: number
}

export type AgendaStatus = "prevista" | "remarcada"

export type AgendaClass = {
  id: string
  seriesId: string
  fromDate: string
  student: string
  teacher: string
  instrument: string
  date: string
  startMinute: number
  durationMinutes: number
  status: AgendaStatus
  weekday: number
  seriesStartMinute: number
  seriesDuration: number
}

export type AgendaDraft = {
  scope: "series" | "once"
  id?: string
  seriesId?: string
  fromDate?: string
  student: string
  teacher: string
  instrument: string
  date: string
  startMinute: number
  durationMinutes: number
  seriesWeekday?: number
  seriesStartMinute?: number
}
