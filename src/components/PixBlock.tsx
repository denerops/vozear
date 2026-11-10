import { useEffect, useState } from "react"
import QRCode from "qrcode"

export function PixBlock({ payload, sample = false }: { payload: string; sample?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(payload, {
      margin: 1,
      width: 220,
      color: { dark: "#24100f", light: "#fff5ef" },
    }).then((value) => {
      if (alive) setUrl(value)
    })
    return () => {
      alive = false
    }
  }, [payload])

  return (
    <div className="pix">
      {url ? <img src={url} alt="QR Code do Pix" /> : null}
      {sample ? null : <code>{payload}</code>}
      {sample ? null : (
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(payload)
            setCopied(true)
          }}
        >
          {copied ? "Código copiado" : "Copiar Pix"}
        </button>
      )}
    </div>
  )
}
