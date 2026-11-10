import { describe, expect, it } from "vitest"
import { fillTemplate, whatsAppUrl } from "./whatsapp.ts"

describe("whatsapp", () => {
  it("monta o link com DDI e a mensagem", () => {
    const url = whatsAppUrl("(11) 98888-7777", "Olá\nPix")
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true)
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Olá\nPix")
  })

  it("preenche os campos da cobrança", () => {
    expect(fillTemplate("Oi {nome}, {valor}", { nome: "Noa", valor: "R$ 10,00" })).toBe(
      "Oi Noa, R$ 10,00",
    )
  })
})
