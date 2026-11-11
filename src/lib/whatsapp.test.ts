import { describe, expect, it } from "vitest"
import { confirmationMessage, fillTemplate, unknownFields, whatsAppUrl } from "./whatsapp.ts"

describe("whatsapp", () => {
  it("monta o link com DDI e a mensagem", () => {
    const url = whatsAppUrl("(11) 98888-7777", "Olá\nPix")
    expect(url.startsWith("https://wa.me/5511988887777?text=")).toBe(true)
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Olá\nPix")
  })

  it("aponta campos que a mensagem não conhece", () => {
    expect(unknownFields("Oi {nome}, {valor} {pix} {mes} {mes} {turma}")).toEqual(["mes", "turma"])
    expect(unknownFields("Sem campos")).toEqual([])
  })

  it("escreve o convite de confirmação para o aluno", () => {
    expect(confirmationMessage("Caio Teste", "Canto", "seg., 16 de nov., 08:00", "https://vozear.test/confirmar/abc")).toBe(
      "Oi, Caio! Sua aula de Canto é seg., 16 de nov., 08:00.\n\nConfirme ou cancele por aqui:\nhttps://vozear.test/confirmar/abc",
    )
  })

  it("preenche os campos da cobrança", () => {
    expect(fillTemplate("Oi {nome}, {valor}", { nome: "Noa", valor: "R$ 10,00" })).toBe(
      "Oi Noa, R$ 10,00",
    )
  })
})
