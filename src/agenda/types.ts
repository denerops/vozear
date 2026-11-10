export type AgendaStatus = "prevista" | "cancelada"

export type AgendaClass = {
  id: string
  student: string
  teacher: string
  instrument: string
  date: string
  startMinute: number
  durationMinutes: number
  status: AgendaStatus
}

export type AgendaDraft = Omit<AgendaClass, "id" | "status"> & { id?: string }
