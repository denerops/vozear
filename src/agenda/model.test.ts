import { describe, expect, it } from "vitest"
import { expandWeek } from "./model.ts"
import type { AgendaException, AgendaSeries } from "./types.ts"

const series: AgendaSeries = {
  id: "s1",
  student: "Lia",
  teacher: "Brenda",
  instrument: "Canto",
  weekday: 5,
  startMinute: 18 * 60,
  durationMinutes: 60,
  startsOn: "2026-11-13",
}

describe("expandWeek", () => {
  it("repete a aula na sexta das semanas seguintes", () => {
    const first = expandWeek([series], [], "2026-11-09")
    const next = expandWeek([series], [], "2026-11-16")
    expect(first.map((item) => item.date)).toEqual(["2026-11-13"])
    expect(next.map((item) => item.date)).toEqual(["2026-11-20"])
    expect(next[0]?.startMinute).toBe(18 * 60)
  })

  it("remarca uma data sem mudar a recorrência", () => {
    const moved: AgendaException = {
      seriesId: "s1",
      fromDate: "2026-11-13",
      kind: "remarcada",
      date: "2026-11-12",
      startMinute: 19 * 60,
      durationMinutes: 60,
    }
    const thisWeek = expandWeek([series], [moved], "2026-11-09")
    const nextWeek = expandWeek([series], [moved], "2026-11-16")
    expect(thisWeek).toMatchObject([{ date: "2026-11-12", startMinute: 19 * 60, status: "remarcada" }])
    expect(nextWeek).toMatchObject([{ date: "2026-11-20", startMinute: 18 * 60, status: "prevista" }])
  })

  it("mostra na outra semana uma aula empurrada para lá", () => {
    const moved: AgendaException = {
      seriesId: "s1",
      fromDate: "2026-11-13",
      kind: "remarcada",
      date: "2026-11-19",
      startMinute: 16 * 60,
      durationMinutes: 60,
    }
    expect(expandWeek([series], [moved], "2026-11-09")).toEqual([])
    const next = expandWeek([series], [moved], "2026-11-16")
    expect(next.map((item) => `${item.date} ${item.status}`).sort()).toEqual([
      "2026-11-19 remarcada",
      "2026-11-20 prevista",
    ])
  })

  it("cancela só a data escolhida", () => {
    const skipped: AgendaException = {
      seriesId: "s1",
      fromDate: "2026-11-20",
      kind: "cancelada",
      date: "2026-11-20",
      startMinute: 18 * 60,
      durationMinutes: 60,
    }
    expect(expandWeek([series], [skipped], "2026-11-16")).toEqual([])
    expect(expandWeek([series], [skipped], "2026-11-23").map((item) => item.date)).toEqual(["2026-11-27"])
  })
})
