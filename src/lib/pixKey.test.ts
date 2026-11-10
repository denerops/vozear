import { describe, expect, it } from "vitest"
import { checkPixKey } from "./pixKey.ts"

describe("checkPixKey", () => {
  it("aceita campo vazio como chave ainda não configurada", () => {
    expect(checkPixKey("  ")).toEqual({ status: "empty" })
  })

  it("normaliza e-mail em minúsculas", () => {
    expect(checkPixKey(" Escola@Vozear.com ")).toEqual({ status: "ok", kind: "email", key: "escola@vozear.com" })
    expect(checkPixKey("sem-arroba").status).toBe("invalid")
  })

  it("reconhece celular com e sem formatação", () => {
    expect(checkPixKey("+55 (11) 99999-0000")).toEqual({ status: "ok", kind: "telefone", key: "+5511999990000" })
    expect(checkPixKey("(11) 99999-0000")).toEqual({ status: "ok", kind: "telefone", key: "+5511999990000" })
    expect(checkPixKey("+1 555 0100").status).toBe("invalid")
  })

  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(checkPixKey("529.982.247-25")).toEqual({ status: "ok", kind: "cpf", key: "52998224725" })
    expect(checkPixKey("529.982.247-24").status).toBe("invalid")
    expect(checkPixKey("11.222.333/0001-81")).toEqual({ status: "ok", kind: "cnpj", key: "11222333000181" })
    expect(checkPixKey("11.222.333/0001-80").status).toBe("invalid")
  })

  it("reconhece chave aleatória", () => {
    const key = "123E4567-E89B-12D3-A456-426614174000"
    expect(checkPixKey(key)).toEqual({ status: "ok", kind: "aleatoria", key: key.toLowerCase() })
  })

  it("recusa texto solto", () => {
    expect(checkPixKey("minha chave").status).toBe("invalid")
  })
})
