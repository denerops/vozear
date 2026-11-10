import { describe, expect, it } from "vitest"
import { parseMoney } from "./format.ts"

describe("parseMoney", () => {
  it("lê valores comuns em reais", () => {
    expect(parseMoney("200")).toBe(20000)
    expect(parseMoney("200,00")).toBe(20000)
    expect(parseMoney("R$ 199,90")).toBe(19990)
    expect(parseMoney("1.200,50")).toBe(120050)
    expect(parseMoney("200.5")).toBe(20050)
  })

  it("recusa vazio, zero e texto", () => {
    expect(parseMoney("")).toBeNull()
    expect(parseMoney("0")).toBeNull()
    expect(parseMoney("abc")).toBeNull()
    expect(parseMoney("-10")).toBeNull()
  })
})
