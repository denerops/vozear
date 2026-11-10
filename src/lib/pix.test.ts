import { describe, expect, it } from "vitest"
import { pixCopiaECola } from "./pix.ts"

describe("pix estático", () => {
  it("reproduz o exemplo do Banco Central", () => {
    expect(
      pixCopiaECola({
        chave: "123e4567-e12b-12d1-a456-426655440000",
        nome: "Fulano de Tal",
        cidade: "BRASILIA",
      }),
    ).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    )
  })

  it("inclui valor com duas casas e corta o identificador em 25 caracteres", () => {
    const codigo = pixCopiaECola({
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Fulano de Tal",
      cidade: "BRASILIA",
      valor: 10.5,
      txid: "ABCDEABCDEABCDEABCDEABCDEEXTRA",
    })
    expect(codigo).toContain("540510.50")
    expect(codigo).toContain("ABCDEABCDEABCDEABCDEABCDE")
    expect(codigo).not.toContain("EXTRA")
    expect(codigo).toMatch(/6304[0-9A-F]{4}$/)
  })

  it("tira acento do recebedor", () => {
    const codigo = pixCopiaECola({
      chave: "vozear@escola.com",
      nome: "São José",
      cidade: "São Paulo",
    })
    expect(codigo).toContain("Sao Jose")
    expect(codigo).toContain("Sao Paulo")
  })
})
