function campo(id: string, valor: string) {
  if (valor.length > 99) throw new Error("campo Pix longo demais")
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`
}

function semAcento(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function pixLabel(valor: string, max: number) {
  return semAcento(valor).slice(0, max)
}

function crc16(texto: string) {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export function pixCopiaECola(input: {
  chave: string
  nome: string
  cidade: string
  valor?: number | null
  txid?: string | null
}) {
  const chave = input.chave.trim()
  const nome = semAcento(input.nome).slice(0, 25)
  const cidade = semAcento(input.cidade).slice(0, 15)
  if (!chave || chave.length > 77) throw new Error("chave Pix inválida")
  if (!nome || !cidade) throw new Error("nome e cidade do recebedor são obrigatórios")

  let txid = (input.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "")
  if (!txid) txid = "***"
  txid = txid.slice(0, 25)

  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave)
  let payload =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986")

  if (input.valor != null && input.valor > 0) {
    payload += campo("54", input.valor.toFixed(2))
  }

  payload +=
    campo("58", "BR") +
    campo("59", nome) +
    campo("60", cidade) +
    campo("62", campo("05", txid)) +
    "6304"

  return payload + crc16(payload)
}
