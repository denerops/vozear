import { saoPauloClock } from "../lib/dates.ts"
import type { Aula, Matricula, Pessoa } from "../types.ts"
import type { AgendaException, AgendaSeries } from "./types.ts"

export type AgendaTeacher = { id: string; name: string; instruments: string[] }

export function toSeries(
  matriculas: Matricula[],
  people: Map<string, Pessoa>,
  instruments: Map<string, string>,
): AgendaSeries[] {
  return matriculas
    .filter((item) => item.situacao === "ativa")
    .map((item) => ({
      id: item.id,
      student: people.get(item.aluno_id)?.nome ?? "Aluno",
      teacher: people.get(item.professor_id)?.nome ?? "Professor",
      instrument: instruments.get(item.instrumento_id) ?? "Aula",
      weekday: item.dia_semana,
      startMinute: item.inicio_minuto,
      durationMinutes: item.duracao_minutos,
      startsOn: item.inicio_em.slice(0, 10),
    }))
}

export function toExceptions(aulas: Aula[], matriculas: Matricula[]): AgendaException[] {
  const byId = new Map(matriculas.map((item) => [item.id, item]))
  const exceptions: AgendaException[] = []
  for (const aula of aulas) {
    const matricula = byId.get(aula.matricula_id)
    if (!matricula || matricula.situacao !== "ativa") continue
    const fromDate = aula.data_serie.slice(0, 10)
    if (aula.situacao === "cancelada") {
      exceptions.push({
        seriesId: aula.matricula_id,
        fromDate,
        kind: "cancelada",
        date: fromDate,
        startMinute: matricula.inicio_minuto,
        durationMinutes: aula.duracao_minutos,
      })
      continue
    }
    const clock = saoPauloClock(aula.inicio)
    const moved =
      aula.situacao === "remarcada" ||
      clock.date !== fromDate ||
      clock.minute !== matricula.inicio_minuto ||
      aula.duracao_minutos !== matricula.duracao_minutos
    if (!moved) continue
    exceptions.push({
      seriesId: aula.matricula_id,
      fromDate,
      kind: "remarcada",
      date: clock.date,
      startMinute: clock.minute,
      durationMinutes: aula.duracao_minutos,
    })
  }
  return exceptions
}
